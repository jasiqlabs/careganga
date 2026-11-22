import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrDocumentApprovalService} from "../../cg-03-registration-approvals/application/hr-document-approval.service";
import {HrDocumentSourceFacade,type HrDocumentRow} from "../../cg-10-human-resources/application/hr-document-source.facade";
import {leaveId} from "../../cg-10-human-resources/application/hr-leave-source.facade";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {NotificationService} from "./notification.service";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {employeeCardToken,hrTemplateHash,renderHrDocument} from "./hr-document-renderer";
const hash=(v:string|Buffer)=>createHash("sha256").update(v).digest("hex");
const kinds=["APPOINTMENT","OFFER","JOINING","EXPERIENCE","RELIEVING","MEMO","EMPLOYEE_ID"];
type Template={id:string;template_kind:string;version:number;title:string;body:string;content_sha256:string;status:string;hr_signatory_name:string|null;hr_signature_file_ref:string|null;hr_seal_file_ref:string|null;assets_ready?:boolean};
type TemplateAsset={id:string;mime:string;sha256:string;object_key:string;object_version:string;size_bytes:string};
type ReceiptIntent={id:string;case_id:string;proposal_revision:number;requested_by:string;request_digest:string;request_key:string;mime:string;size_bytes:string;expected_sha256:string;status:string;object_key:string;reserved_until:Date};
type Doc={id:string;realm_id:string;case_id:string;proposal_revision:number;template_id:string;template_version:number;issue_revision:number;source_snapshot:Record<string,unknown>;source_sha256:string;request_digest:string;issue_key:string;issued_by:string;state:string;object_key:string;object_version:string|null;content_sha256:string|null;created_at:Date;hr_card_token_digest:string|null;attempt_count:number;issued_at:Date|null};
function body(raw:unknown,keys:string[]){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!keys.includes(k)))throw new BadRequestException("Check the document details");
 return raw as Record<string,unknown>;
}
function text(v:unknown,min:number,max:number){
 if(typeof v!=="string"||v.trim().length<min||v.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v)||/<[\s/]*[a-z][^>]*>/i.test(v))
  throw new BadRequestException("Check the approved template text");
 return v.trim();
}
const view=(d:Doc)=>({documentRef:d.id,status:d.state,issueRevision:d.issue_revision,issuedAt:d.issued_at?.toISOString()??null,canDownload:d.state==="ISSUED",canRetry:["PENDING","UNKNOWN","VERIFYING"].includes(d.state)});
@Injectable()
export class HrIssuedDocumentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly source:HrDocumentSourceFacade,
  private readonly approvals:HrDocumentApprovalService,private readonly objects:PrivateObjectStorage,private readonly recipients:CommunicationRecipientSource,private readonly notifications:NotificationService){}
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
  const v=await fn(tx);await tx.query("COMMIT");return v;}catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async root(tx:PoolClient,a:VerifiedFoundationActor){
  if(!(await tx.query("SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId])).rowCount)throw new ForbiddenException();
 }
 async templates(token:string){
  const a=await this.sessions.requireAction(token,"hr.documents.manage");
  return this.run(async tx=>{await this.identity.assertCurrent(tx,a,"hr.documents.manage");
   const q=await tx.query<Template>("SELECT id,template_kind,version,title,body,status,content_sha256,hr_signatory_name,(hr_signatory_name IS NOT NULL AND cg19_hr_template_assets_ready(realm_id,hr_signature_file_ref,hr_seal_file_ref)) AS assets_ready FROM cg19_document_template WHERE realm_id=$1 AND template_kind LIKE 'HR_%' AND status='APPROVED' ORDER BY template_kind,version DESC LIMIT 20",[a.realmId]);
   return {items:q.rows.map(x=>({templateId:x.id,kind:x.template_kind.slice(3),version:x.version,title:x.title,body:x.body,assetsReady:x.assets_ready===true,signatoryName:x.hr_signatory_name}))};
  });
 }
 async approveTemplate(token:string,raw:unknown){
  const x=body(raw,["kind","title","body","expectedVersion","requestKey","currentPassword","signatoryName","signatureFileRef","sealFileRef"]);
  if(typeof x.kind!=="string"||!kinds.includes(x.kind)||!Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<0||typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Check template and current password");
  const kind="HR_"+x.kind,title=text(x.title,10,100),content=text(x.body,20,1200),key=leaveId(x.requestKey),expected=Number(x.expectedVersion),password=x.currentPassword;
  const a=await this.sessions.requireAction(token,"hr.documents.review");await this.sessions.limitFoundationRootProof(a);
  const signatoryName=text(x.signatoryName,2,100),signatureRef=leaveId(x.signatureFileRef),sealRef=leaveId(x.sealFileRef);
  const digest=hash(JSON.stringify([kind,title,content,expected,signatoryName,signatureRef,sealRef]));
  return this.run(async tx=>{
   await this.root(tx,a);await this.identity.assertCurrent(tx,a,"hr.documents.review");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const replay=(await tx.query<{request_digest:string;version:number}>(`SELECT c.request_digest,t.version FROM cg19_template_command c
     JOIN cg19_document_template t ON t.id=c.template_id AND t.realm_id=c.realm_id WHERE c.realm_id=$1 AND c.actor_id=$2 AND c.request_key=$3`,[a.realmId,a.accountId,key])).rows[0];
   if(replay){if(replay.request_digest!==digest)throw new ConflictException("Original template request differs");return {status:"APPROVED",version:replay.version};}
   const old=(await tx.query<Template>("SELECT * FROM cg19_document_template WHERE realm_id=$1 AND template_kind=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE",[a.realmId,kind])).rows[0];
   if((old?.version??0)!==expected)throw new ConflictException("Template version changed");
   const signature=await this.templateAsset(tx,a.realmId,signatureRef,"SIGNATURE"),seal=await this.templateAsset(tx,a.realmId,sealRef,"SEAL");
   if(old?.status==="APPROVED"){await tx.query("UPDATE cg19_document_template SET status='WITHDRAWN' WHERE id=$1 AND realm_id=$2",[old.id,a.realmId]);await tx.query("INSERT INTO cg19_template_event(realm_id,template_id,actor_id,action) VALUES($1,$2,$3,'WITHDRAWN')",[a.realmId,old.id,a.accountId]);}
   const t=(await tx.query<Template>(`INSERT INTO cg19_document_template(realm_id,template_kind,version,content_sha256,title,body,approved_by,status,hr_signatory_name,hr_signature_file_ref,hr_seal_file_ref)
    VALUES($1,$2,$3,$4,$5,$6,$7,'APPROVED',$8,$9,$10) RETURNING *`,[a.realmId,kind,expected+1,hrTemplateHash(kind,title,content,{signatoryName,signatureSha256:signature.sha256,sealSha256:seal.sha256}),title,content,a.accountId,signatoryName,signature.id,seal.id])).rows[0];
   await tx.query("INSERT INTO cg19_template_command(realm_id,actor_id,request_key,request_digest,template_id) VALUES($1,$2,$3,$4,$5)",[a.realmId,a.accountId,key,digest,t.id]);
   await tx.query("INSERT INTO cg19_template_event(realm_id,template_id,actor_id,action) VALUES($1,$2,$3,'APPROVED')",[a.realmId,t.id,a.accountId]);
   return {status:"APPROVED",version:t.version};
  });
 }
 private async templateAsset(tx:PoolClient,realm:string,ref:string,kind:"SIGNATURE"|"SEAL"){
  const q=await tx.query<TemplateAsset>(`SELECT f.id,f.original_mime AS mime,f.verified_sha256 AS sha256,f.object_key,f.object_version,f.verified_size_bytes::text AS size_bytes
   FROM cg19_stored_file f JOIN cg19_upload_intent i ON i.realm_id=f.realm_id AND i.id=f.upload_intent_id
   WHERE f.realm_id=$1 AND f.id=$2 AND f.owner_kind='CG19_HR_TEMPLATE_ASSET' AND i.owner_kind=f.owner_kind AND i.classification=$3
   AND i.status='VALIDATED' AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND f.original_mime IN('image/jpeg','image/png')
   AND f.verified_size_bytes BETWEEN 1 AND 2097152 FOR SHARE OF f,i`,[realm,ref,"HR_TEMPLATE_"+kind]);
  if(!q.rows[0])throw new ConflictException({code:"CG10_TEMPLATE_ASSETS_REQUIRED"});
  return q.rows[0];
 }
 private async assetIntent(tx:PoolClient,a:VerifiedFoundationActor,upload:string){
  await this.identity.assertCurrent(tx,a,"hr.documents.review");
  const q=await tx.query<ReceiptIntent>(`SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 AND requested_by=$3
  AND owner_kind='CG19_HR_TEMPLATE_ASSET' FOR UPDATE`,[a.realmId,leaveId(upload),a.accountId]);
  if(!q.rows[0])throw new NotFoundException({code:"CG10_TEMPLATE_ASSETS_REQUIRED"});
  return q.rows[0];
 }
 async initiateTemplateAsset(token:string,raw:unknown){
  const x=body(raw,["assetType","requestKey","mime","sizeBytes","sha256"]),key=leaveId(x.requestKey);
  if((x.assetType!=="SIGNATURE"&&x.assetType!=="SEAL")||typeof x.mime!=="string"||!["image/jpeg","image/png"].includes(x.mime)||!Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||Number(x.sizeBytes)>2097152||typeof x.sha256!=="string"||!/^([a-f0-9]{64})$/.test(x.sha256))
   throw new BadRequestException({code:"CG10_TEMPLATE_ASSET_FORMAT",field:"file"});
  const classification="HR_TEMPLATE_"+x.assetType,mime=x.mime,size=Number(x.sizeBytes),checksum=x.sha256,a=await this.sessions.requireAction(token,"hr.documents.review");
  const digest=hash(JSON.stringify([classification,mime,size,checksum]));
  const i=await this.run(async tx=>{
   await this.root(tx,a);await this.identity.assertCurrent(tx,a,"hr.documents.review");
   const q=await tx.query<ReceiptIntent>(`INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,request_key,mime,size_bytes,expected_sha256,request_digest,classification,object_key,reserved_until,owner_kind)
   VALUES($1,NULL,1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '15 minutes','CG19_HR_TEMPLATE_ASSET') ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *`,
    [a.realmId,a.accountId,key,mime,size,checksum,digest,classification,"careganga/private/cg19/"+a.realmId+"/"+randomUUID()]);
   if(q.rows[0]){await tx.query("INSERT INTO cg19_document_event(realm_id,actor_id,intent_id,hr_template_asset,event_key) VALUES($1,$2,$3,true,'UPLOAD_INITIATED')",[a.realmId,a.accountId,q.rows[0].id]);return q.rows[0];}
   const prior=(await tx.query<ReceiptIntent>("SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3 AND owner_kind='CG19_HR_TEMPLATE_ASSET'",[a.realmId,a.accountId,key])).rows[0];
   if(!prior||prior.request_digest!==digest)throw new ConflictException({code:"CG10_RECEIPT_REQUEST_CHANGED"});return prior;
  });
  if(i.status==="VALIDATED")return this.templateAssetStatus(token,i.id);
  if(["REJECTED","EXPIRED"].includes(i.status)||i.reserved_until.getTime()<=Date.now())return {uploadRef:i.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  try{
   const grant=await this.objects.reservePrivateUpload({objectKey:i.object_key,requestKey:i.request_key,mime:i.mime,sizeBytes:Number(i.size_bytes),sha256:i.expected_sha256,expiresAt:i.reserved_until.toISOString()});
   const url=new URL(grant.url),expires=Date.parse(grant.expiresAt);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||!Number.isFinite(expires)||expires<=Date.now()||expires>i.reserved_until.getTime()||!grant.reservationRef||grant.reservationRef.length>160||grant.headers?.["Content-Type"]!==i.mime||!Object.entries(grant.headers).every(([k,v])=>["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))throw Error("Private reservation unavailable");
   const current=await this.sessions.requireAction(token,"hr.documents.review");
   await this.run(async tx=>{const locked=await this.assetIntent(tx,current,i.id);if(!["INITIATED","UNKNOWN"].includes(locked.status)||locked.reserved_until.getTime()<=Date.now())throw new ConflictException({code:"CG10_TEMPLATE_ASSETS_REQUIRED"});await tx.query("UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() WHERE realm_id=$1 AND id=$2",[current.realmId,i.id,grant.reservationRef]);});
   return {uploadRef:i.id,status:"UPLOAD_READY",uploadUrl:grant.url,uploadHeaders:grant.headers,cleanVerified:false};
  }catch{return {uploadRef:i.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};}
 }
 async templateAssetStatus(token:string,upload:string){
  const a=await this.sessions.requireAction(token,"hr.documents.review");
  return this.run(async tx=>{const i=await this.assetIntent(tx,a,upload);
   const f=(await tx.query<{id:string}>("SELECT id FROM cg19_stored_file WHERE realm_id=$1 AND upload_intent_id=$2 AND owner_kind='CG19_HR_TEMPLATE_ASSET' AND scan_status='CLEAN_VERIFIED' AND revoked_at IS NULL",[a.realmId,i.id])).rows[0];
   return {uploadRef:i.id,status:i.status,cleanVerified:i.status==="VALIDATED"&&!!f,...(i.status==="VALIDATED"&&f?{fileRef:f.id}:{})};
  });
 }
 async confirmTemplateAsset(token:string,upload:string){
  const a=await this.sessions.requireAction(token,"hr.documents.review"),i=await this.run(tx=>this.assetIntent(tx,a,upload));
  if(i.status==="VALIDATED")return this.templateAssetStatus(token,upload);
  if(["REJECTED","EXPIRED"].includes(i.status)||i.reserved_until.getTime()<=Date.now())return {uploadRef:i.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let proof:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{proof=await this.objects.verifyPrivateObject({objectKey:i.object_key,mime:i.mime,sizeBytes:Number(i.size_bytes),sha256:i.expected_sha256});}
  catch{return {uploadRef:i.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const scanAt=Date.parse(proof.verifiedAt),clean=proof.state==="CLEAN_VERIFIED"&&proof.sha256===i.expected_sha256&&proof.mime===i.mime&&proof.sizeBytes===Number(i.size_bytes)&&proof.objectVersion.length>0&&proof.objectVersion.length<=160&&proof.scanProofRef.length>=8&&proof.scanProofRef.length<=160&&Number.isFinite(scanAt)&&scanAt<=Date.now()+60000&&Date.now()-scanAt<900000;
  const current=await this.sessions.requireAction(token,"hr.documents.review");
  await this.run(async tx=>{const locked=await this.assetIntent(tx,current,upload);
   if(locked.status==="VALIDATED")return;
   if(["REJECTED","EXPIRED"].includes(locked.status)||locked.reserved_until.getTime()<=Date.now())throw new ConflictException({code:"CG10_TEMPLATE_ASSETS_REQUIRED"});
   await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() WHERE realm_id=$1 AND id=$2",[current.realmId,i.id,clean?"VALIDATED":"REJECTED"]);
   if(clean)await tx.query(`INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,original_mime,verified_sha256,verified_size_bytes,object_key,object_version,scan_status,scan_proof_ref,scanned_at,created_by,owner_kind)
   VALUES($1,$2,NULL,1,$3,$4,$5,$6,$7,'CLEAN_VERIFIED',$8,$9,$10,'CG19_HR_TEMPLATE_ASSET') ON CONFLICT(upload_intent_id) DO NOTHING`,[current.realmId,i.id,i.mime,i.expected_sha256,i.size_bytes,i.object_key,proof.objectVersion,proof.scanProofRef,new Date(proof.verifiedAt),current.accountId]);
   await tx.query("INSERT INTO cg19_document_event(realm_id,actor_id,intent_id,hr_template_asset,event_key) VALUES($1,$2,$3,true,$4)",[current.realmId,current.accountId,i.id,clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED"]);
  });
  return this.templateAssetStatus(token,upload);
 }
 private async find(tx:PoolClient,a:VerifiedFoundationActor,reference:string,own=false){
  return this.source.authorizedHistory(tx,a,reference,own);
 }
 async list(token:string,own=false,offsetInput:unknown=0){
  const a=own?await this.sessions.verifySession(token):await this.sessions.requireAction(token,"hr.documents.manage");
  const offset=Number(offsetInput??0);if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new BadRequestException("Check the document page");
  return this.run(async tx=>{
   const rows=await this.source.history(tx,a,own,offset);
   const refs=rows.slice(0,25).map(x=>x.case_ref).filter((x):x is string=>!!x);
   const docs=refs.length?(await tx.query<Doc>(`SELECT DISTINCT ON(case_id) * FROM cg19_generated_document WHERE realm_id=$1 AND case_id=ANY($2::uuid[])
    ORDER BY case_id,issue_revision DESC`,[a.realmId,refs])).rows:[];
   const ids=docs.map(d=>d.id);
   const receipts=ids.length?(await tx.query<{document_id:string;at:Date}>(`SELECT document_id,max(occurred_at) AS at FROM cg19_document_event
    WHERE realm_id=$1 AND document_id=ANY($2::uuid[]) AND event_key='ACKNOWLEDGED' GROUP BY document_id`,[a.realmId,ids])).rows:[];
   const copies=ids.length?(await tx.query<{document_ref:string}>(`SELECT DISTINCT i.hr_receipt_document_ref AS document_ref FROM cg19_upload_intent i
    JOIN cg19_stored_file f ON f.realm_id=i.realm_id AND f.upload_intent_id=i.id AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED'
    WHERE i.realm_id=$1 AND i.hr_receipt_document_ref=ANY($2::uuid[]) AND i.classification='HR_RECEIVED_COPY' AND i.status='VALIDATED' AND ($3::uuid IS NULL OR i.requested_by=$3)`,[a.realmId,ids,own?a.accountId:null])).rows:[];
   const dispatch=ids.length?(await tx.query<{hr_document_ref:string;channel:string;state:string}>(`SELECT hr_document_ref,channel,state FROM cg19_notification
    WHERE realm_id=$1 AND hr_document_ref=ANY($2::uuid[]) AND source_kind='CG10_DOCUMENT_READY' ORDER BY channel`,[a.realmId,ids])).rows:[];
   return {items:rows.slice(0,25).map(r=>{const d=docs.find(d=>d.case_id===r.case_ref);return {...this.source.summary(r),
    document:d?{...view(d),receiptStatus:copies.some(x=>x.document_ref===d.id)?"RECEIVED_COPY_VERIFIED":receipts.some(x=>x.document_id===d.id)?"ACKNOWLEDGED":"AWAITING_ACKNOWLEDGEMENT",canDownloadReceipt:d.state==="ISSUED"&&copies.some(x=>x.document_ref===d.id),
      dispatch:dispatch.filter(x=>x.hr_document_ref===d.id).map(x=>({channel:x.channel,status:x.state}))}:null,
    canSubmit:!own&&r.status==="DRAFT"&&r.created_by===a.accountId};}),hasMore:rows.length>25,offset};
  });
 }
 async issue(token:string,reference:string,raw:unknown){
  const x=body(raw,["requestKey","currentPassword"]),key=leaveId(x.requestKey);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Confirm current password");
  const password=x.currentPassword,a=await this.sessions.requireAction(token,"hr.documents.manage");await this.sessions.requireAction(token,"documents.letters.issue");await this.sessions.limitFoundationRootProof(a);
  const doc=await this.run(async tx=>{
   await this.root(tx,a);await this.identity.assertCurrent(tx,a,"documents.letters.issue");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const row=await this.find(tx,a,reference);
   const digest=hash(JSON.stringify(["CG19_HR_ISSUE",row.id,row.source_digest,row.template_id,row.template_version]));
   const existing=(await tx.query<Doc>("SELECT * FROM cg19_generated_document WHERE realm_id=$1 AND issued_by=$2 AND issue_key=$3 FOR UPDATE",[a.realmId,a.accountId,key])).rows[0];
   if(existing){if(existing.request_digest!==digest||existing.case_id!==row.case_ref)throw new ConflictException("Original issue request differs");return existing;}
   const c=await this.approvals.approvedSource(tx,a,row);
   if((await tx.query("SELECT 1 FROM cg19_generated_document WHERE realm_id=$1 AND case_id=$2 AND state IN('PENDING','UNKNOWN','VERIFYING','ISSUED')",[a.realmId,c.id])).rowCount)throw new ConflictException("An original document already exists. Review or retry it.");
   if(row.kind==="EMPLOYEE_ID"&&(await tx.query("SELECT 1 FROM cg19_generated_document WHERE realm_id=$1 AND hr_card_employee_ref=$2 AND state IN('PENDING','UNKNOWN','VERIFYING','ISSUED')",[a.realmId,row.employee_id])).rowCount)throw new ConflictException("Revoke or resolve the previous employee card before issuing a replacement");
   const version=(await tx.query<{rev:number}>("SELECT COALESCE(MAX(issue_revision),0)+1 AS rev FROM cg19_generated_document WHERE realm_id=$1 AND case_id=$2",[a.realmId,c.id])).rows[0].rev;
   const id=randomUUID(),objectKey="careganga/private/cg19/"+a.realmId+"/hr-documents/"+id;
   const qr=row.kind==="EMPLOYEE_ID"?employeeCardToken(a.realmId,id,row.source_digest):null;
   const d=(await tx.query<Doc>(`INSERT INTO cg19_generated_document(id,realm_id,case_id,proposal_revision,template_id,template_version,issue_revision,source_snapshot,source_sha256,issue_key,request_digest,issued_by,state,object_key,hr_card_token_digest,hr_card_employee_ref)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,'PENDING',$13,$14,$15) RETURNING *`,[id,a.realmId,c.id,row.revision,row.template_id,row.template_version,version,JSON.stringify(row.source_snapshot),row.source_digest,key,digest,a.accountId,objectKey,qr?hash(qr):null,qr?row.employee_id:null])).rows[0];
   await this.event(tx,a,d,"ISSUE_PENDING");return d;
  });
  return this.reconcile(token,doc.id);
 }
 private async event(tx:PoolClient,a:VerifiedFoundationActor,d:Doc,event:string){
  await tx.query("INSERT INTO cg19_document_event(realm_id,case_id,actor_id,document_id,event_key) VALUES($1,$2,$3,$4,$5)",[a.realmId,d.case_id,a.accountId,d.id,event]);
 }
 private async docAccess(tx:PoolClient,a:VerifiedFoundationActor,id:string,own=false){
  const q=await tx.query<Doc&{reference:string}>(`SELECT d.*,h.reference FROM cg19_generated_document d JOIN hr_document_request h ON h.root_realm_id=d.realm_id AND h.case_ref=d.case_id
   AND h.source_digest=d.source_sha256 AND h.revision=d.proposal_revision WHERE d.realm_id=$1 AND d.id=$2`,[a.realmId,leaveId(id)]);
  if(!q.rows[0])throw new NotFoundException("Employee document unavailable");
  const d=q.rows[0],row=await this.find(tx,a,d.reference,own);return {d,row};
 }
 async reconcile(token:string,id:string){
  const a=await this.sessions.requireAction(token,"hr.documents.manage");await this.sessions.requireAction(token,"documents.letters.issue");
  const claim=randomUUID();
  const found=await this.run(async tx=>{
   await this.identity.assertCurrent(tx,a,"documents.letters.issue");const {d,row}=await this.docAccess(tx,a,id);
   if(["ISSUED","REVOKED","FAILED"].includes(d.state))return {d,claimed:false,reference:row.reference};
   await this.approvals.approvedSource(tx,a,row);
   const q=await tx.query<Doc>(`UPDATE cg19_generated_document SET state='VERIFYING',claim_token=$3,claim_expires_at=now()+interval '2 minutes',attempt_count=LEAST(5,attempt_count+1)
    WHERE realm_id=$1 AND id=$2 AND state IN('PENDING','UNKNOWN','VERIFYING') AND (claim_expires_at IS NULL OR claim_expires_at<now()) RETURNING *`,[a.realmId,d.id,claim]);
   return {d:q.rows[0]??d,claimed:!!q.rowCount,reference:row.reference};
  });
  const d=found.d;if(!found.claimed)return view(d);
  // Explicit authorized retry after provider recovery uses the original create-only key, with a saturated attempt counter and no background polling.
  try{
   const template=(await this.db.query<Template>("SELECT * FROM cg19_document_template WHERE realm_id=$1 AND id=$2 AND version=$3",[a.realmId,d.template_id,d.template_version])).rows[0];
   if(!template||template.status!=="APPROVED"||!template.hr_signatory_name||!template.hr_signature_file_ref||!template.hr_seal_file_ref)throw Error("Original template unavailable");
   const assets=await this.run(async tx=>({signature:await this.templateAsset(tx,a.realmId,template.hr_signature_file_ref!,"SIGNATURE"),seal:await this.templateAsset(tx,a.realmId,template.hr_seal_file_ref!,"SEAL")}));
   const signatoryName=template.hr_signatory_name;
   if(template.content_sha256!==hrTemplateHash(template.template_kind,template.title,template.body,{signatoryName,signatureSha256:assets.signature.sha256,sealSha256:assets.seal.sha256})||d.source_snapshot.templateHash!==template.content_sha256)throw Error("Original template proof changed");
   const qr=d.hr_card_token_digest?employeeCardToken(a.realmId,d.id,d.source_sha256):null;
   if(qr&&hash(qr)!==d.hr_card_token_digest)throw Error("Original QR key changed");
   let stored:{objectVersion:string;sha256:string}|null=null;
   if(d.attempt_count>1){
    try{const proof=await this.objects.reconcileIssuedPrivateDocument({objectKey:d.object_key,maxBytes:10*1024*1024});
     const bytes=await this.objects.readVerifiedPrivateObject({objectKey:d.object_key,objectVersion:proof.objectVersion,maxBytes:proof.sizeBytes});
     const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
     if(hash(bytes)!==proof.sha256||pdf.getSubject()!=="CG19-HR:"+d.id+":"+d.source_sha256+":"+d.issue_revision)throw Error("Original document proof mismatch");
     stored=proof;
    }catch{/* The original object key is create-only. Never allocate another key. */}
   }
   if(!stored){
    let portrait:{bytes:Buffer;mime:string}|undefined;
    if(qr){
     const proof=await this.run(async tx=>{
      const {row}=await this.docAccess(tx,a,d.id);
      await this.approvals.approvedSource(tx,a,row);
      const f=await this.source.cardPortrait(tx,a.realmId,row.employee_id!);
      if(f.sha256!==d.source_snapshot.portraitSha256)throw Error("Original portrait proof changed");
      return f;
     });
     const bytes=await this.objects.readVerifiedPrivateObject({objectKey:proof.object_key,objectVersion:proof.object_version,maxBytes:Number(proof.size_bytes)});
     if(bytes.length!==Number(proof.size_bytes)||hash(bytes)!==proof.sha256)throw Error("Original portrait bytes unavailable");
     portrait={bytes,mime:proof.mime};
    }
    const loadAsset=async(f:TemplateAsset)=>{const bytes=await this.objects.readVerifiedPrivateObject({objectKey:f.object_key,objectVersion:f.object_version,maxBytes:Number(f.size_bytes)});if(bytes.length!==Number(f.size_bytes)||hash(bytes)!==f.sha256)throw Error("Original signatory proof changed");return {bytes,mime:f.mime};};
    const signature=await loadAsset(assets.signature),seal=await loadAsset(assets.seal);
    const bytes=await renderHrDocument({snapshot:d.source_snapshot,title:template.title,body:template.body,reference:found.reference,sourceDigest:d.source_sha256,documentRef:d.id,issueRevision:d.issue_revision,createdAt:d.created_at,qr,portrait,signature,seal,signatoryName});
    const checksum=hash(bytes);stored=await this.objects.writeVerifiedPrivateDocument({objectKey:d.object_key,bytes,sha256:checksum});
    if(stored.sha256!==checksum)throw Error("Original bytes not verified");
   }
   const verified=stored;
   if(!verified.objectVersion||!verified.sha256)throw Error("Original storage proof unavailable");
   const current=await this.sessions.requireAction(token,"documents.letters.issue");
   // Await the final transaction so a rejected commit enters the recovery path.
   return await this.run(async tx=>{
    await this.identity.assertCurrent(tx,current,"documents.letters.issue");const {row}=await this.docAccess(tx,current,d.id);
    await this.approvals.approvedSource(tx,current,row);
    const q=await tx.query<Doc>(`UPDATE cg19_generated_document SET state='ISSUED',object_version=$4,content_sha256=$5,issued_at=now(),claim_token=NULL,claim_expires_at=NULL
     WHERE realm_id=$1 AND id=$2 AND claim_token=$3 AND state='VERIFYING' AND claim_expires_at>now() RETURNING *`,[a.realmId,d.id,claim,verified.objectVersion,verified.sha256]);
    if(!q.rows[0])throw Error("Original issue outcome uncertain");await this.event(tx,a,d,"ISSUED");return view(q.rows[0]);
   });
  }catch{
   return this.run(async tx=>{
    const q=await tx.query<Doc>("UPDATE cg19_generated_document SET state='UNKNOWN',claim_token=NULL,claim_expires_at=NULL WHERE realm_id=$1 AND id=$2 AND claim_token=$3 AND state='VERIFYING' RETURNING *",[a.realmId,d.id,claim]);
    if(q.rows[0]){await this.event(tx,a,d,"ISSUE_UNKNOWN");return view(q.rows[0]);}
    return {documentRef:d.id,status:"UNKNOWN",canDownload:false,canRetry:true};
   });
  }
 }
 /** Source-pinned preview only: never persists a generated file or renders reusable approval/QR assets. */
 async preview(token:string,ref:string){
  const a=await this.sessions.requireAction(token,"hr.documents.manage");
  const proof=await this.run(async tx=>{
   const row=await this.source.authorizedHistory(tx,a,ref);
   if(!["DRAFT","SUBMITTED","APPROVED"].includes(row.status))throw new ConflictException("Create a current document request to preview.");
   await this.source.verifyCurrent(tx,a,row);
   const t=(await tx.query<Template>("SELECT * FROM cg19_document_template WHERE realm_id=$1 AND id=$2 AND version=$3 AND status='APPROVED' FOR SHARE",[a.realmId,row.template_id,row.template_version])).rows[0];
   if(!t||!t.hr_signatory_name||t.content_sha256!==row.source_snapshot.templateHash)throw new ConflictException("Original template unavailable");
   const portrait=row.kind==="EMPLOYEE_ID"?await this.source.cardPortrait(tx,a.realmId,row.employee_id!):null;
   return {row,t,portrait};
  });
  let portrait:{bytes:Buffer;mime:string}|undefined;
  if(proof.portrait){const f=proof.portrait,bytes=await this.objects.readVerifiedPrivateObject({objectKey:f.object_key,objectVersion:f.object_version,maxBytes:Number(f.size_bytes)});
   if(bytes.length!==Number(f.size_bytes)||hash(bytes)!==f.sha256||f.sha256!==proof.row.source_snapshot.portraitSha256)throw new ConflictException("Original approved portrait changed");portrait={bytes,mime:f.mime};}
  const bytes=await renderHrDocument({snapshot:proof.row.source_snapshot,title:proof.t.title,body:proof.t.body,reference:proof.row.reference,sourceDigest:proof.row.source_digest,documentRef:proof.row.id,issueRevision:proof.row.revision,createdAt:new Date(),qr:null,portrait,signatoryName:proof.t.hr_signatory_name!,preview:true});
  if(bytes.length>10*1024*1024)throw new ServiceUnavailableException("Draft preview exceeds the safe file limit");
  const current=await this.sessions.requireAction(token,"hr.documents.manage");
  await this.run(async tx=>{const latest=await this.source.authorizedHistory(tx,current,ref);if(latest.source_digest!==proof.row.source_digest||latest.revision!==proof.row.revision||!["DRAFT","SUBMITTED","APPROVED"].includes(latest.status))throw new ConflictException("Original request changed");await this.source.verifyCurrent(tx,current,latest);});
  return bytes;
 }
 async download(token:string,id:string,own=false){
  const a=own?await this.sessions.verifySession(token):await this.sessions.requireAction(token,"hr.documents.manage");
  const d=await this.run(async tx=>{const {d}=await this.docAccess(tx,a,id,own);if(d.state!=="ISSUED"||!d.object_version||!d.content_sha256)throw new NotFoundException("Employee document unavailable");return d;});
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:d.object_key,objectVersion:d.object_version!,maxBytes:10*1024*1024});
  if(hash(bytes)!==d.content_sha256)throw new ServiceUnavailableException("Original document bytes unavailable");
  const current=await this.sessions.verifySession(token);
  await this.run(async tx=>{const latest=await this.docAccess(tx,current,d.id,own);if(latest.d.state!=="ISSUED"||latest.d.content_sha256!==d.content_sha256)throw new NotFoundException("Employee document revoked");});
  return bytes;
 }
 async revoke(token:string,id:string,raw:unknown){
  const x=body(raw,["currentPassword"]);if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Confirm current password");
  const password=x.currentPassword,a=await this.sessions.requireAction(token,"documents.letters.revoke");await this.sessions.limitFoundationRootProof(a);
  return this.run(async tx=>{await this.root(tx,a);await this.identity.assertCurrent(tx,a,"documents.letters.revoke");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const {d}=await this.docAccess(tx,a,id);if(d.state==="REVOKED")return view(d);
   const q=await tx.query<Doc>("UPDATE cg19_generated_document SET state='REVOKED',revoked_at=now() WHERE realm_id=$1 AND id=$2 AND state='ISSUED' RETURNING *",[a.realmId,d.id]);if(!q.rows[0])throw new ConflictException("Only a verified issued document can be revoked");
   await this.event(tx,a,d,"REVOKED");return view(q.rows[0]);});
 }
 async dispatch(token:string,id:string,raw:unknown){
  const x=body(raw,["channel"]);
  if(x.channel!=="IN_APP"&&x.channel!=="EMAIL"&&x.channel!=="SMS")throw new BadRequestException("Choose a supported dispatch channel");
  const channel=x.channel,a=await this.sessions.requireAction(token,"hr.documents.manage");
  await this.sessions.requireAction(token,"documents.letters.issue");
  return this.run(async tx=>{
   await this.identity.assertCurrent(tx,a,"documents.letters.issue");const {d,row}=await this.docAccess(tx,a,id);
   if(d.state!=="ISSUED"||!row.employee_id)throw new ConflictException("A verified document and linked employee are required for dispatch");
   const recipient=(await tx.query<{account_ref:string}>(`SELECT e.account_ref FROM hr_employee e WHERE e.root_realm_id=$1 AND e.id=$2 AND e.account_ref IS NOT NULL
    AND cg19_hr_document_notice_matches($1,$3,e.account_ref) FOR SHARE OF e`,[a.realmId,row.employee_id,d.id])).rows[0]?.account_ref;
   if(!recipient)throw new ConflictException("No current linked recipient is available");
   const previous=(await tx.query<{state:string}>(`SELECT state FROM cg19_notification WHERE realm_id=$1 AND hr_document_ref=$2 AND recipient_id=$3 AND channel=$4 AND source_kind='CG10_DOCUMENT_READY'`,[a.realmId,d.id,recipient,channel])).rows[0];
   if(previous)return {channel,status:previous.state,replayed:true};
   const current=await this.recipients.get(tx,a.realmId,recipient);
   if(!current?.active)throw new ConflictException("No current linked recipient is available");
   if(channel!=="IN_APP"&&(!(channel==="EMAIL"?current.email:current.mobile)||!await this.notifications.hasConsent(tx,a.realmId,recipient,channel,"TRANSACTIONAL")))
    throw new ForbiddenException("The verified contact or transactional consent is unavailable");
   const title="Private CareGanga document ready",content=channel==="SMS"?"Sign in to your private CareGanga account to check your document.":"A private CareGanga document is available. Sign in to check your current access and view it securely.";
   await tx.query(`INSERT INTO cg19_message_template(realm_id,kind,channel,version,subject,body,status,origin)
    VALUES($1,'CG10_DOCUMENT_READY',$2,1,$3,$4,'APPROVED','SYSTEM') ON CONFLICT(realm_id,kind,channel,version) DO NOTHING`,[a.realmId,channel,title,content]);
   const template=(await tx.query<{id:string;version:number;subject:string;body:string}>(`SELECT id,version,subject,body FROM cg19_message_template WHERE realm_id=$1
    AND kind='CG10_DOCUMENT_READY' AND channel=$2 AND version=1 AND status='APPROVED'`,[a.realmId,channel])).rows[0];
   if(!template)throw new ConflictException("Original dispatch template unavailable");
   const inserted=await tx.query<{id:string;state:string}>(`INSERT INTO cg19_notification(realm_id,source_kind,source_key,hr_document_ref,recipient_id,template_id,template_version,channel,subject_snapshot,body_snapshot,purpose,state,due_at,expires_at)
    VALUES($1,'CG10_DOCUMENT_READY',$2,$2,$3,$4,$5,$6,$7,$8,'TRANSACTIONAL',CASE WHEN $6='IN_APP' THEN 'IN_APP' ELSE 'QUEUED' END,
    CASE WHEN $6='IN_APP' THEN NULL ELSE now() END,now()+interval '30 days') ON CONFLICT DO NOTHING RETURNING id,state`,
    [a.realmId,d.id,recipient,template.id,template.version,channel,template.subject,template.body]);
   if(inserted.rows[0])await tx.query("INSERT INTO cg19_communication_event(realm_id,notification_id,actor_id,kind) VALUES($1,$2,$3,'SOURCE_CAPTURED')",[a.realmId,inserted.rows[0].id,a.accountId]);
   const confirmed=inserted.rows[0]??(await tx.query<{state:string}>(`SELECT state FROM cg19_notification WHERE realm_id=$1 AND hr_document_ref=$2 AND recipient_id=$3 AND channel=$4 AND source_kind='CG10_DOCUMENT_READY'`,[a.realmId,d.id,recipient,channel])).rows[0];
   if(!confirmed)throw new ConflictException("The dispatch result could not be confirmed");
   return {channel,status:confirmed.state,replayed:!inserted.rowCount};
  });
 }
 async acknowledge(token:string,id:string){
  const a=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   const {d}=await this.docAccess(tx,a,id,true);
   // Serialize acknowledgement with revocation without trusting the earlier read.
   const latest=(await tx.query<{state:string}>("SELECT state FROM cg19_generated_document WHERE realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,d.id])).rows[0];
   if(latest?.state!=="ISSUED"||!(await tx.query("SELECT cg19_hr_document_notice_matches($1,$2,$3) AS allowed",[a.realmId,d.id,a.accountId])).rows[0]?.allowed)throw new ForbiddenException("The original document is not available for acknowledgement");
   const q=await tx.query(`INSERT INTO cg19_document_event(realm_id,case_id,actor_id,document_id,event_key) VALUES($1,$2,$3,$4,'ACKNOWLEDGED')
    ON CONFLICT DO NOTHING RETURNING id`,[a.realmId,d.case_id,a.accountId,d.id]);
   return {status:"ACKNOWLEDGED",replayed:!q.rowCount};
  });
 }
 private async receiptAccess(tx:PoolClient,a:VerifiedFoundationActor,id:string){
  const {d}=await this.docAccess(tx,a,id,true);
  const current=(await tx.query<{state:string}>("SELECT state FROM cg19_generated_document WHERE realm_id=$1 AND id=$2 FOR UPDATE",[a.realmId,d.id])).rows[0];
  if(current?.state!=="ISSUED"||!(await tx.query("SELECT cg19_hr_document_notice_matches($1,$2,$3) AS allowed",[a.realmId,d.id,a.accountId])).rows[0]?.allowed)
   throw new ForbiddenException({code:"CG10_RECEIPT_UNAVAILABLE"});
  return d;
 }
 private async receiptIntent(tx:PoolClient,a:VerifiedFoundationActor,doc:string,upload:string){
  const d=await this.receiptAccess(tx,a,doc);
  const i=(await tx.query<ReceiptIntent>(`SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND id=$2 AND hr_receipt_document_ref=$3 AND requested_by=$4 AND classification='HR_RECEIVED_COPY' FOR UPDATE`,[a.realmId,leaveId(upload),d.id,a.accountId])).rows[0];
  if(!i)throw new NotFoundException({code:"CG10_RECEIPT_UNAVAILABLE"});
  return i;
 }
 async initiateReceipt(token:string,id:string,raw:unknown){
  const x=body(raw,["requestKey","mime","sizeBytes","sha256"]),key=leaveId(x.requestKey);
  if(typeof x.mime!=="string"||!["application/pdf","image/jpeg","image/png"].includes(x.mime)||!Number.isSafeInteger(x.sizeBytes)||Number(x.sizeBytes)<1||Number(x.sizeBytes)>10485760||typeof x.sha256!=="string"||!/^([a-f0-9]{64})$/.test(x.sha256))
   throw new BadRequestException({code:"CG10_RECEIPT_FORMAT",field:"file"});
  const mime=x.mime,size=Number(x.sizeBytes),checksum=x.sha256,a=await this.sessions.verifySession(token);
  const intent=await this.run(async tx=>{
   const d=await this.receiptAccess(tx,a,id),digest=hash(JSON.stringify(["CG10_RECEIVED_COPY",d.id,mime,size,checksum]));
   const q=await tx.query<ReceiptIntent>(`INSERT INTO cg19_upload_intent(realm_id,case_id,proposal_revision,requested_by,request_key,mime,size_bytes,expected_sha256,request_digest,classification,object_key,reserved_until,hr_receipt_document_ref)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'HR_RECEIVED_COPY',$10,now()+interval '15 minutes',$11) ON CONFLICT(realm_id,requested_by,request_key) DO NOTHING RETURNING *`,
    [a.realmId,d.case_id,d.proposal_revision,a.accountId,key,mime,size,checksum,digest,"careganga/private/cg19/"+a.realmId+"/"+randomUUID(),d.id]);
   if(q.rows[0]){
    await tx.query("INSERT INTO cg19_document_event(realm_id,case_id,actor_id,intent_id,event_key) VALUES($1,$2,$3,$4,'UPLOAD_INITIATED')",[a.realmId,d.case_id,a.accountId,q.rows[0].id]);
    return q.rows[0];
   }
   const i=(await tx.query<ReceiptIntent>("SELECT * FROM cg19_upload_intent WHERE realm_id=$1 AND requested_by=$2 AND request_key=$3 AND hr_receipt_document_ref=$4 AND classification='HR_RECEIVED_COPY'",[a.realmId,a.accountId,key,d.id])).rows[0];
   if(!i||i.request_digest!==digest)throw new ConflictException({code:"CG10_RECEIPT_REQUEST_CHANGED"});
   return i;
  });
  if(intent.status==="VALIDATED")return this.receiptStatus(token,id,intent.id);
  if(["REJECTED","EXPIRED"].includes(intent.status)||intent.reserved_until.getTime()<=Date.now())return {uploadRef:intent.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  try{
   const grant=await this.objects.reservePrivateUpload({objectKey:intent.object_key,requestKey:intent.request_key,mime:intent.mime,sizeBytes:Number(intent.size_bytes),sha256:intent.expected_sha256,expiresAt:intent.reserved_until.toISOString()});
   const url=new URL(grant.url),expires=Date.parse(grant.expiresAt);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||!Number.isFinite(expires)||expires<=Date.now()||expires>intent.reserved_until.getTime()||!grant.reservationRef||grant.reservationRef.length>160||grant.headers?.["Content-Type"]!==intent.mime||!Object.entries(grant.headers).every(([k,v])=>["Content-Type","x-goog-if-generation-match","x-amz-checksum-sha256","If-None-Match"].includes(k)&&typeof v==="string"&&v.length<=160))throw Error("Private reservation unavailable");
   await this.run(async tx=>{
    const i=await this.receiptIntent(tx,a,id,intent.id);
    if(!["INITIATED","UNKNOWN"].includes(i.status)||i.reserved_until.getTime()<=Date.now())throw new ConflictException({code:"CG10_RECEIPT_UNAVAILABLE"});
    await tx.query("UPDATE cg19_upload_intent SET storage_reservation_ref=$3,status='INITIATED',updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,i.id,grant.reservationRef]);
   });
   return {uploadRef:intent.id,status:"UPLOAD_READY",uploadUrl:grant.url,uploadHeaders:grant.headers,cleanVerified:false};
  }catch{return {uploadRef:intent.id,status:"STORAGE_UNAVAILABLE",cleanVerified:false};}
 }
 async receiptStatus(token:string,id:string,upload:string){
  const a=await this.sessions.verifySession(token);
  return this.run(async tx=>{
   const i=await this.receiptIntent(tx,a,id,upload);
   const q=await tx.query("SELECT 1 FROM cg19_stored_file WHERE realm_id=$1 AND upload_intent_id=$2 AND scan_status='CLEAN_VERIFIED' AND revoked_at IS NULL",[a.realmId,i.id]);
   return {uploadRef:i.id,status:i.status,cleanVerified:i.status==="VALIDATED"&&!!q.rowCount};
  });
 }
 async confirmReceipt(token:string,id:string,upload:string){
  const a=await this.sessions.verifySession(token),i=await this.run(tx=>this.receiptIntent(tx,a,id,upload));
  if(i.status==="VALIDATED")return this.receiptStatus(token,id,upload);
  if(["REJECTED","EXPIRED"].includes(i.status)||i.reserved_until.getTime()<=Date.now())return {uploadRef:i.id,status:"EXPIRED_OR_REJECTED",cleanVerified:false};
  let proof:Awaited<ReturnType<PrivateObjectStorage["verifyPrivateObject"]>>;
  try{proof=await this.objects.verifyPrivateObject({objectKey:i.object_key,mime:i.mime,sizeBytes:Number(i.size_bytes),sha256:i.expected_sha256});}
  catch{return {uploadRef:i.id,status:"VERIFICATION_UNAVAILABLE",cleanVerified:false};}
  const scanAt=Date.parse(proof.verifiedAt);
  const clean=proof.state==="CLEAN_VERIFIED"&&proof.sha256===i.expected_sha256&&proof.mime===i.mime&&proof.sizeBytes===Number(i.size_bytes)&&proof.objectVersion.length>0&&proof.objectVersion.length<=160&&proof.scanProofRef.length>=8&&proof.scanProofRef.length<=160&&Number.isFinite(scanAt)&&scanAt<=Date.now()+60000&&Date.now()-scanAt<900000;
  const currentActor=await this.sessions.verifySession(token);
  await this.run(async tx=>{
   const locked=await this.receiptIntent(tx,currentActor,id,upload);
   if(locked.status==="VALIDATED")return;
   if(["REJECTED","EXPIRED"].includes(locked.status)||locked.reserved_until.getTime()<=Date.now())throw new ConflictException({code:"CG10_RECEIPT_UNAVAILABLE"});
   await tx.query("UPDATE cg19_upload_intent SET status=$3,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,i.id,clean?"VALIDATED":"REJECTED"]);
   if(clean)await tx.query(`INSERT INTO cg19_stored_file(realm_id,upload_intent_id,case_id,proposal_revision,original_mime,verified_sha256,verified_size_bytes,object_key,object_version,scan_status,scan_proof_ref,scanned_at,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'CLEAN_VERIFIED',$10,$11,$12) ON CONFLICT(upload_intent_id) DO NOTHING`,
    [a.realmId,i.id,i.case_id,i.proposal_revision,i.mime,i.expected_sha256,i.size_bytes,i.object_key,proof.objectVersion,proof.scanProofRef,new Date(proof.verifiedAt),a.accountId]);
   await tx.query("INSERT INTO cg19_document_event(realm_id,case_id,actor_id,intent_id,event_key) VALUES($1,$2,$3,$4,$5)",[a.realmId,i.case_id,a.accountId,i.id,clean?"UPLOAD_VERIFIED":"UPLOAD_REJECTED"]);
  });
  return this.receiptStatus(token,id,upload);
 }
 private async receivedCopy(tx:PoolClient,a:VerifiedFoundationActor,id:string,own:boolean){
  const d=own?await this.receiptAccess(tx,a,id):(await this.docAccess(tx,a,id)).d;
  if(d.state!=="ISSUED")throw new NotFoundException({code:"CG10_RECEIPT_UNAVAILABLE"});
  const q=await tx.query<{id:string;mime:string;size:string;sha256:string;key:string;version:string}>(`SELECT f.id,f.original_mime AS mime,f.verified_size_bytes::text AS size,f.verified_sha256 AS sha256,f.object_key AS key,f.object_version AS version
   FROM cg19_upload_intent i JOIN cg19_stored_file f ON f.realm_id=i.realm_id AND f.upload_intent_id=i.id
   WHERE i.realm_id=$1 AND i.hr_receipt_document_ref=$2 AND i.classification='HR_RECEIVED_COPY' AND i.status='VALIDATED'
   AND f.revoked_at IS NULL AND f.scan_status='CLEAN_VERIFIED' AND ($3::uuid IS NULL OR i.requested_by=$3)
   ORDER BY f.created_at DESC,f.id DESC LIMIT 1 FOR SHARE OF i,f`,[a.realmId,d.id,own?a.accountId:null]);
  if(!q.rows[0])throw new NotFoundException({code:"CG10_RECEIPT_UNAVAILABLE"});
  return q.rows[0];
 }
 async downloadReceipt(token:string,id:string,own:boolean){
  const a=own?await this.sessions.verifySession(token):await this.sessions.requireAction(token,"hr.documents.manage");
  const f=await this.run(tx=>this.receivedCopy(tx,a,id,own));
  if(!["application/pdf","image/jpeg","image/png"].includes(f.mime))throw new NotFoundException({code:"CG10_RECEIPT_UNAVAILABLE"});
  const bytes=await this.objects.readVerifiedPrivateObject({objectKey:f.key,objectVersion:f.version,maxBytes:Number(f.size)});
  if(bytes.length!==Number(f.size)||hash(bytes)!==f.sha256)throw new ServiceUnavailableException({code:"CG10_RECEIPT_UNAVAILABLE"});
  const current=own?await this.sessions.verifySession(token):await this.sessions.requireAction(token,"hr.documents.manage");
  const latest=await this.run(tx=>this.receivedCopy(tx,current,id,own));
  if(latest.id!==f.id||latest.sha256!==f.sha256||latest.version!==f.version)throw new ConflictException({code:"CG10_RECEIPT_UNAVAILABLE"});
  return {bytes,mime:f.mime};
 }
 async verifyPublic(raw:unknown){
  if(typeof raw!=="string"||!/^CGV-[A-F0-9]{24}$/.test(raw))return {status:"INACTIVE"};
  const q=await this.db.query<{result:string}>(`SELECT CASE WHEN d.state<>'ISSUED' THEN 'INACTIVE' WHEN h.expiry_date<=CURRENT_DATE THEN 'EXPIRED'
   WHEN d.state='ISSUED' AND e.status IN('ACTIVE','PROBATION') AND e.status_version=h.employee_version
    AND a.id=h.assignment_id AND a.assignment_version=h.assignment_version AND a.valid_from<=CURRENT_DATE AND a.valid_to IS NULL AND b.status='ACTIVE' THEN 'VALID' ELSE 'INACTIVE' END AS result
   FROM cg19_generated_document d JOIN hr_document_request h ON h.root_realm_id=d.realm_id AND h.case_ref=d.case_id AND h.kind='EMPLOYEE_ID' AND h.source_digest=d.source_sha256
   JOIN hr_employee e ON e.root_realm_id=h.root_realm_id AND e.id=h.employee_id
   JOIN hr_employment_assignment a ON a.root_realm_id=h.root_realm_id AND a.id=h.assignment_id
   JOIN branch b ON b.root_realm_id=a.root_realm_id AND b.id=a.branch_ref
   WHERE d.hr_card_token_digest=$1 LIMIT 1`,[hash(raw)]);
  return {status:q.rows[0]?.result??"INACTIVE"};
 }
}
