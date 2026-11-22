import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrDocumentApprovalService} from "../../cg-03-registration-approvals/application/hr-document-approval.service";
import {HrDocumentSourceFacade,type HrDocumentRow,type HrDocumentKind} from "../../cg-10-human-resources/application/hr-document-source.facade";
import {leaveId} from "../../cg-10-human-resources/application/hr-leave-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {employeeCardToken,hrTemplateHash,renderHrDocument} from "./hr-document-renderer";
const hash=(v:string|Buffer)=>createHash("sha256").update(v).digest("hex");
const kinds=["APPOINTMENT","OFFER","JOINING","EXPERIENCE","RELIEVING","MEMO","EMPLOYEE_ID"];
type Template={id:string;template_kind:string;version:number;title:string;body:string;content_sha256:string;status:string};
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
const view=(d:Doc)=>({documentRef:d.id,status:d.state,issueRevision:d.issue_revision,issuedAt:d.issued_at?.toISOString()??null,canDownload:d.state==="ISSUED",canRetry:["PENDING","UNKNOWN","VERIFYING"].includes(d.state)&&d.attempt_count<5});
@Injectable()
export class HrIssuedDocumentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly source:HrDocumentSourceFacade,
  private readonly approvals:HrDocumentApprovalService,private readonly objects:PrivateObjectStorage){}
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
   const q=await tx.query<Template>("SELECT id,template_kind,version,title,body,status,content_sha256 FROM cg19_document_template WHERE realm_id=$1 AND template_kind LIKE 'HR_%' AND status='APPROVED' ORDER BY template_kind,version DESC LIMIT 20",[a.realmId]);
   return {items:q.rows.map(x=>({templateId:x.id,kind:x.template_kind.slice(3),version:x.version,title:x.title,body:x.body}))};
  });
 }
 async approveTemplate(token:string,raw:unknown){
  const x=body(raw,["kind","title","body","expectedVersion","requestKey","currentPassword"]);
  if(typeof x.kind!=="string"||!kinds.includes(x.kind)||!Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<0||typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Check template and current password");
  const kind="HR_"+x.kind,title=text(x.title,10,100),content=text(x.body,20,1200),key=leaveId(x.requestKey),expected=Number(x.expectedVersion),password=x.currentPassword;
  const a=await this.sessions.requireAction(token,"hr.documents.review");await this.sessions.limitFoundationRootProof(a);
  const digest=hash(JSON.stringify([kind,title,content,expected]));
  return this.run(async tx=>{
   await this.root(tx,a);await this.identity.assertCurrent(tx,a,"hr.documents.review");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const replay=(await tx.query<{request_digest:string;version:number}>(`SELECT c.request_digest,t.version FROM cg19_template_command c
     JOIN cg19_document_template t ON t.id=c.template_id AND t.realm_id=c.realm_id WHERE c.realm_id=$1 AND c.actor_id=$2 AND c.request_key=$3`,[a.realmId,a.accountId,key])).rows[0];
   if(replay){if(replay.request_digest!==digest)throw new ConflictException("Original template request differs");return {status:"APPROVED",version:replay.version};}
   const old=(await tx.query<Template>("SELECT * FROM cg19_document_template WHERE realm_id=$1 AND template_kind=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE",[a.realmId,kind])).rows[0];
   if((old?.version??0)!==expected)throw new ConflictException("Template version changed");
   if(old?.status==="APPROVED"){await tx.query("UPDATE cg19_document_template SET status='WITHDRAWN' WHERE id=$1 AND realm_id=$2",[old.id,a.realmId]);await tx.query("INSERT INTO cg19_template_event(realm_id,template_id,actor_id,action) VALUES($1,$2,$3,'WITHDRAWN')",[a.realmId,old.id,a.accountId]);}
   const t=(await tx.query<Template>(`INSERT INTO cg19_document_template(realm_id,template_kind,version,content_sha256,title,body,approved_by,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,'APPROVED') RETURNING *`,[a.realmId,kind,expected+1,hrTemplateHash(kind,title,content),title,content,a.accountId])).rows[0];
   await tx.query("INSERT INTO cg19_template_command(realm_id,actor_id,request_key,request_digest,template_id) VALUES($1,$2,$3,$4,$5)",[a.realmId,a.accountId,key,digest,t.id]);
   await tx.query("INSERT INTO cg19_template_event(realm_id,template_id,actor_id,action) VALUES($1,$2,$3,'APPROVED')",[a.realmId,t.id,a.accountId]);
   return {status:"APPROVED",version:t.version};
  });
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
   return {items:rows.slice(0,25).map(r=>({...this.source.summary(r),document:docs.find(d=>d.case_id===r.case_ref)?view(docs.find(d=>d.case_id===r.case_ref)!):null,canSubmit:!own&&r.status==="DRAFT"&&r.created_by===a.accountId})),hasMore:rows.length>25,offset};
  });
 }
 async issue(token:string,reference:string,raw:unknown){
  const x=body(raw,["requestKey","currentPassword"]),key=leaveId(x.requestKey);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Confirm current password");
  const password=x.currentPassword,a=await this.sessions.requireAction(token,"hr.documents.manage");await this.sessions.requireAction(token,"documents.letters.issue");await this.sessions.limitFoundationRootProof(a);
  const doc=await this.run(async tx=>{
   await this.root(tx,a);await this.identity.assertCurrent(tx,a,"documents.letters.issue");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const row=await this.find(tx,a,reference),c=await this.approvals.approvedSource(tx,a,row);
   const digest=hash(JSON.stringify(["CG19_HR_ISSUE",row.id,row.source_digest,row.template_id,row.template_version]));
   const existing=(await tx.query<Doc>("SELECT * FROM cg19_generated_document WHERE realm_id=$1 AND issued_by=$2 AND issue_key=$3 FOR UPDATE",[a.realmId,a.accountId,key])).rows[0];
   if(existing){if(existing.request_digest!==digest||existing.case_id!==c.id)throw new ConflictException("Original issue request differs");return existing;}
   if((await tx.query("SELECT 1 FROM cg19_generated_document WHERE realm_id=$1 AND case_id=$2 AND state IN('PENDING','UNKNOWN','VERIFYING','ISSUED')",[a.realmId,c.id])).rowCount)throw new ConflictException("An original document already exists. Review or retry it.");
   const version=(await tx.query<{rev:number}>("SELECT COALESCE(MAX(issue_revision),0)+1 AS rev FROM cg19_generated_document WHERE realm_id=$1 AND case_id=$2",[a.realmId,c.id])).rows[0].rev;
   const id=randomUUID(),objectKey="careganga/private/cg19/"+a.realmId+"/hr-documents/"+id;
   const qr=row.kind==="EMPLOYEE_ID"?employeeCardToken(a.realmId,id,row.source_digest):null;
   const d=(await tx.query<Doc>(`INSERT INTO cg19_generated_document(id,realm_id,case_id,proposal_revision,template_id,template_version,issue_revision,source_snapshot,source_sha256,issue_key,request_digest,issued_by,state,object_key,hr_card_token_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,'PENDING',$13,$14) RETURNING *`,[id,a.realmId,c.id,row.revision,row.template_id,row.template_version,version,JSON.stringify(row.source_snapshot),row.source_digest,key,digest,a.accountId,objectKey,qr?hash(qr):null])).rows[0];
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
   if(["ISSUED","REVOKED","FAILED"].includes(d.state))return {d,claimed:false};
   await this.approvals.approvedSource(tx,a,row);
   const q=await tx.query<Doc>(`UPDATE cg19_generated_document SET state='VERIFYING',claim_token=$3,claim_expires_at=now()+interval '2 minutes',attempt_count=attempt_count+1
    WHERE realm_id=$1 AND id=$2 AND state IN('PENDING','UNKNOWN','VERIFYING') AND attempt_count<5 AND (claim_expires_at IS NULL OR claim_expires_at<now()) RETURNING *`,[a.realmId,d.id,claim]);
   return {d:q.rows[0]??d,claimed:!!q.rowCount};
  });
  const d=found.d;if(!found.claimed)return view(d);
  try{
   const template=(await this.db.query<Template>("SELECT * FROM cg19_document_template WHERE realm_id=$1 AND id=$2 AND version=$3",[a.realmId,d.template_id,d.template_version])).rows[0];
   if(!template||template.status!=="APPROVED"||template.content_sha256!==hrTemplateHash(template.template_kind,template.title,template.body))throw Error("Original template unavailable");
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
    const bytes=await renderHrDocument({snapshot:d.source_snapshot,title:template.title,body:template.body,reference:String(d.source_snapshot.subjectReference),sourceDigest:d.source_sha256,documentRef:d.id,issueRevision:d.issue_revision,createdAt:d.created_at,qr});
    const checksum=hash(bytes);stored=await this.objects.writeVerifiedPrivateDocument({objectKey:d.object_key,bytes,sha256:checksum});
    if(stored.sha256!==checksum)throw Error("Original bytes not verified");
   }
   const verified=stored;
   if(!verified.objectVersion||!verified.sha256)throw Error("Original storage proof unavailable");
   const current=await this.sessions.requireAction(token,"documents.letters.issue");
   return this.run(async tx=>{
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
 async verifyPublic(raw:unknown){
  if(typeof raw!=="string"||!/^CGV-[A-F0-9]{24}$/.test(raw))return {status:"INACTIVE"};
  const q=await this.db.query<{result:string}>(`SELECT CASE WHEN h.expiry_date<=CURRENT_DATE THEN 'EXPIRED'
   WHEN d.state='ISSUED' AND e.status IN('ACTIVE','PROBATION') AND e.status_version=h.employee_version
    AND a.id=h.assignment_id AND a.assignment_version=h.assignment_version AND a.valid_to IS NULL AND b.status='ACTIVE' THEN 'VALID' ELSE 'INACTIVE' END AS result
   FROM cg19_generated_document d JOIN hr_document_request h ON h.root_realm_id=d.realm_id AND h.case_ref=d.case_id AND h.kind='EMPLOYEE_ID' AND h.source_digest=d.source_sha256
   JOIN hr_employee e ON e.root_realm_id=h.root_realm_id AND e.id=h.employee_id
   JOIN hr_employment_assignment a ON a.root_realm_id=h.root_realm_id AND a.id=h.assignment_id
   JOIN branch b ON b.root_realm_id=a.root_realm_id AND b.id=a.branch_ref
   WHERE d.hr_card_token_digest=$1 LIMIT 1`,[hash(raw)]);
  return {status:q.rows[0]?.result??"INACTIVE"};
 }
}
