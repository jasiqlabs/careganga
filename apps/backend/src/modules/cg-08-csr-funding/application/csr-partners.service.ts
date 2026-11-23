import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const changed=()=>new ConflictException({code:"CG08_SOURCE_CHANGED",message:"This CSR record has changed. Refresh the current record."});
const missing=()=>new NotFoundException("CSR partner not available.");
function body(raw:unknown,fields:readonly string[]):Record<string,unknown>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new BadRequestException("Check the CSR application fields.");
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!fields.includes(k)))throw new BadRequestException("Unsupported CSR application field.");
 return v;
}
function ref(v:unknown):string{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose a valid CSR record.");
 return v.toLowerCase();
}
function text(v:unknown,label:string,min:number,max:number):string{
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>max||/[<>\u0000-\u001f\u007f]/.test(v))
  throw new BadRequestException("Check the "+label+".");
 return v.trim();
}
function optional(v:unknown,label:string,min:number,max:number):string|null{
 if(v===undefined||v===null||v==="")return null;
 return text(v,label,min,max);
}
function version(v:unknown):number{
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1||v>=2147483647)
  throw new BadRequestException("Refresh the CSR application before continuing.");
 return v;
}
export type PartnerDraft=Readonly<{branchRef:string|null;legalName:string;registrationReference:string|null;
 contactName:string;contactEmail:string|null;contactMobile:string|null;supportSummary:string;}>;
export function parsePartner(raw:unknown):PartnerDraft&{requestKey:string;expectedVersion:number|null}{
 const v=body(raw,["requestKey","expectedVersion","branchRef","legalName","registrationReference","contactName","contactEmail","contactMobile","supportSummary"]);
 const branch=v.branchRef===undefined||v.branchRef===null||v.branchRef===""?null:ref(v.branchRef);
 const email=optional(v.contactEmail,"contact email",5,254)?.toLowerCase();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException("Enter a valid contact email.");
 const mobile=optional(v.contactMobile,"contact mobile",13,13);
 if(mobile&&!/^\+91[6-9][0-9]{9}$/.test(mobile))throw new BadRequestException("Enter a valid Indian contact mobile.");
 if(!email&&!mobile)throw new BadRequestException("Provide a contact email or mobile.");
 return {requestKey:ref(v.requestKey),expectedVersion:v.expectedVersion===undefined?null:version(v.expectedVersion),
  branchRef:branch,legalName:text(v.legalName,"registered organization name",2,200),
  registrationReference:optional(v.registrationReference,"registration reference",3,100),
  contactName:text(v.contactName,"contact person",2,160),contactEmail:email,
  contactMobile:mobile,supportSummary:text(v.supportSummary,"proposed support",5,1000)};
}
type PartnerRow={id:string;branch_ref:string|null;status:string;version:number;created_by:string};
const projection='p.id AS ref,p.branch_ref AS "branchRef",b.name AS branch,p.legal_name AS "legalName",p.registration_reference AS "registrationReference",p.contact_name AS "contactName",p.contact_email AS "contactEmail",p.contact_mobile AS "contactMobile",p.support_summary AS "supportSummary",p.status,p.version,p.updated_at AS "updatedAt"';
const listProjection='p.id AS ref,p.branch_ref AS "branchRef",b.name AS branch,p.legal_name AS "legalName",p.status,p.version,p.updated_at AS "updatedAt"';
const joins=" FROM csr_partner p LEFT JOIN branch b ON b.id=p.branch_ref AND b.root_realm_id=p.root_realm_id";
const stable=(v:unknown):string=>{
 if(v===null||typeof v!=="object")return JSON.stringify(v)??"null";
 if(Array.isArray(v))return "["+v.map(stable).join(",")+"]";
 const obj=v as Record<string,unknown>;
 return "{"+Object.keys(obj).sort().map(k=>JSON.stringify(k)+":"+stable(obj[k])).join(",")+"}";
};
export const csrDigest=(v:unknown)=>createHash("sha256").update(stable(v)).digest("hex");
const digest=csrDigest;

@Injectable()
export class CsrPartnersService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly branches:BranchSourceFacade){}
 private async run<T>(token:string,action:string,fn:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>,read=false):Promise<T>{
  const actor=await this.sessions.requireAction(token,action),tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,actor,action);
   const result=await fn(tx,actor);await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))throw changed();
   throw e;
  }finally{tx.release();}
 }
 private async permitted(tx:PoolClient,a:VerifiedFoundationActor,b:string|null):Promise<void>{
  await this.branches.projectBranch(tx,a,b);
 }
 private async row(tx:PoolClient,a:VerifiedFoundationActor,key:string,lock=false){
  const r=(await tx.query<PartnerRow>("SELECT id,branch_ref,status,version,created_by FROM csr_partner WHERE root_realm_id=$1 AND id=$2 "+(lock?"FOR UPDATE":"FOR SHARE"),[a.realmId,ref(key)])).rows[0];
  if(!r)throw missing();
  await this.permitted(tx,a,r.branch_ref);
  return r;
 }

 /** Original CG08 owner authority, used only by CG19 private CSR agreement evidence.
  * Verify current actor and assigned active branch in the SAME transaction. */
 async guardAgreement(tx:PoolClient,a:VerifiedFoundationActor,partnerRef:string,sourceVersion:number|null,write:boolean){
  await this.identity.assertCurrent(tx,a,write?"csr.partners.manage":"csr.partners.view");
  const p=await this.row(tx,a,partnerRef,write);
  if(sourceVersion!==null&&p.version!==sourceVersion)throw changed();
  if(write&&!["DRAFT","RETURNED"].includes(p.status))throw changed();
  return p;
 }


 /** Freeze only current CG08 data. CG03 owns the original case and CG19 proof.
  * This method must run in CG03's own atomic transaction. */
 async freezeForReview(tx:PoolClient,a:VerifiedFoundationActor,partnerRef:string,expectedVersion:number,fileRef:string){
  await this.identity.assertCurrent(tx,a,"csr.partners.manage");
  await this.identity.assertCurrent(tx,a,"csr.partners.view");
  const row=await this.guardAgreement(tx,a,partnerRef,expectedVersion,true);
  if(row.status!=="DRAFT")throw changed();
  const current=(await tx.query<{
   branch_ref:string|null;legal_name:string;registration_reference:string|null;contact_name:string;
   contact_email:string|null;contact_mobile:string|null;support_summary:string;
  }>("SELECT branch_ref,legal_name,registration_reference,contact_name,contact_email,contact_mobile,support_summary FROM csr_partner WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,row.id])).rows[0];
  if(!current)throw changed();
  const snapshot={partnerRef:row.id,branchRef:current.branch_ref,legalName:current.legal_name,
   registrationReference:current.registration_reference,contactName:current.contact_name,
   contactEmail:current.contact_email,contactMobile:current.contact_mobile,
   supportSummary:current.support_summary,evidenceFileRef:fileRef};
  const sourceDigest=digest(["CG08_REVIEW_SOURCE_V1",snapshot]);
  const q=await tx.query("UPDATE csr_partner SET status='SUBMITTED',version=version+1,updated_by=$3,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND version=$4 AND status='DRAFT' RETURNING id",
   [a.realmId,row.id,a.accountId,row.version]);
  if(!q.rowCount)throw changed();
  return {partnerRef:row.id,sourceVersion:row.version,sourceDigest,title:current.legal_name,
   snapshot};
 }
 /** Actual current source for protected CG03 re-review. No second partner table. */
 async reviewSource(tx:PoolClient,a:VerifiedFoundationActor,partnerRef:string){
  await this.identity.assertCurrent(tx,a,"csr.partners.review");
  const p=await this.row(tx,a,partnerRef);
  const c=(await tx.query<{
   branch_ref:string|null;legal_name:string;registration_reference:string|null;contact_name:string;
   contact_email:string|null;contact_mobile:string|null;support_summary:string;
  }>("SELECT branch_ref,legal_name,registration_reference,contact_name,contact_email,contact_mobile,support_summary FROM csr_partner WHERE root_realm_id=$1 AND id=$2",
   [a.realmId,p.id])).rows[0];
  if(!c)throw changed();
  return {ref:p.id,version:p.version,status:p.status,branchRef:c.branch_ref,legalName:c.legal_name,
   registrationReference:c.registration_reference,contactName:c.contact_name,
   contactEmail:c.contact_email,contactMobile:c.contact_mobile,supportSummary:c.support_summary};
 }
 /** Called only after CG03 has inserted an original password-verified decision
  * in the SAME transaction. PostgreSQL deferred guard re-verifies provenance. */
 async acceptReviewEffect(tx:PoolClient,root:string,partnerRef:string,sourceVersion:number,
  action:"APPROVE"|"RETURN"|"REJECT",reviewer:string){
  const id=ref(partnerRef);
  const c=(await tx.query<PartnerRow>("SELECT id,branch_ref,status,version,created_by FROM csr_partner WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[root,id])).rows[0];
  if(!c||c.status!=="SUBMITTED"||c.version!==sourceVersion+1)throw changed();
  const next=action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED";
  const q=await tx.query("UPDATE csr_partner SET status=$3,version=version+1,updated_by=$4,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' AND version=$5 RETURNING version",
   [root,id,next,reviewer,c.version]);
  if(!q.rowCount)throw changed();
  return {status:next,version:c.version+1};
 }

 /** Explicit original scanned public naming attestation. Does NOT publish: CG18
  * independent editorial authorization is a separate, necessary gate. */
 async publicRelease(token:string,partnerRef:string){
  return this.run(token,"csr.partners.view",async(tx,a)=>{
   const p=await this.row(tx,a,partnerRef);
   const x=(await tx.query<{version:number;state:string;public_summary:string;
    evidence_file_id:string}>(
    "SELECT version,state,public_summary,evidence_file_id FROM csr_partner_public_release "+
    "WHERE root_realm_id=$1 AND partner_id=$2",[a.realmId,p.id])).rows[0];
   // A CSR directory reader is not automatically allowed to learn a private
   // CG19 agreement reference. Only an authorized publisher who may inspect
   // the original proof receives the attestation source selector.
   let canInspect=false;
   try{
    await this.identity.assertCurrent(tx,a,"csr.partners.manage");
    await this.identity.assertCurrent(tx,a,"cms.content.manage");
    await this.identity.assertCurrent(tx,a,"documents.files.view");
    canInspect=true;
   }catch(e){if(!(e instanceof ForbiddenException))throw e;}
   const approved=canInspect?(await tx.query<{evidence_file_id:string}>(
    "SELECT snap.evidence_file_id FROM csr_partner_review_snapshot snap "+
    "JOIN cg03_case c ON c.realm_id=snap.root_realm_id AND c.csr_review_ref=snap.id "+
    "AND c.csr_partner_id=snap.partner_id AND c.csr_source_version=snap.source_version "+
    "AND c.csr_source_digest=snap.source_digest AND c.case_kind='CSR_PARTNER_REVIEW' "+
    "JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id "+
    "JOIN cg19_stored_file f ON f.id=snap.evidence_file_id AND f.realm_id=snap.root_realm_id "+
    "AND f.csr_partner_id=snap.partner_id AND f.owner_kind='CG08_CSR_AGREEMENT' "+
    "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
    "AND i.csr_partner_id=f.csr_partner_id AND i.owner_kind='CG08_CSR_AGREEMENT' "+
    "WHERE snap.root_realm_id=$1 AND snap.partner_id=$2 AND c.status='OWNER_COMPLETED' "+
    "AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' "+
    "ORDER BY snap.submitted_at DESC LIMIT 1",[a.realmId,p.id])).rows[0]:undefined;
   return {partnerStatus:p.status,version:x?.version??0,state:x?.state??"NOT_AUTHORIZED",
    publicSummary:x?.public_summary??"",approvedAgreementFileRef:approved?.evidence_file_id??null};
  },true);
 }
 async authorizePublic(token:string,partnerRef:string,raw:unknown){
  const id=ref(partnerRef),v=body(raw,["requestKey","expectedVersion",
   "evidenceFileRef","publicSummary","publicRightsConfirmed"]);
  if(v.publicRightsConfirmed!==true)throw new BadRequestException(
   "Confirm the signed original agreement expressly permits public naming.");
  if(typeof v.expectedVersion!=="number"||!Number.isSafeInteger(v.expectedVersion)||
    v.expectedVersion<0||v.expectedVersion>=2147483647)
   throw new BadRequestException("Refresh CSR public display permission.");
  const key=ref(v.requestKey),file=ref(v.evidenceFileRef);
  const summary=text(v.publicSummary,"public partnership description",10,500);
  const hash=digest(["CG08_PUBLIC_AUTHORIZE",id,v.expectedVersion,file,summary]);
  return this.run(token,"csr.partners.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"cms.content.manage");
   await this.identity.assertCurrent(tx,a,"documents.files.view");
   const previous=await this.replay(tx,a,key,hash,"AUTHORIZE_PUBLIC",id);
   if(previous)return previous;
   const p=await this.row(tx,a,id,true);
   if(p.status!=="APPROVED")throw changed();
   const prior=(await tx.query<{version:number;state:string}>(
    "SELECT version,state FROM csr_partner_public_release WHERE root_realm_id=$1 "+
    "AND partner_id=$2 FOR UPDATE",[a.realmId,id])).rows[0];
   if((prior?.version??0)!==v.expectedVersion||prior?.state==="AUTHORIZED")
    throw changed();
   const proof=await tx.query(
    "SELECT 1 FROM csr_partner_review_snapshot snap "+
    "JOIN cg03_case c ON c.realm_id=snap.root_realm_id AND c.csr_review_ref=snap.id "+
    "AND c.csr_partner_id=snap.partner_id AND c.csr_source_version=snap.source_version "+
    "AND c.csr_source_digest=snap.source_digest AND c.case_kind='CSR_PARTNER_REVIEW' "+
    "JOIN cg03_case_decision d ON d.realm_id=c.realm_id AND d.case_id=c.id "+
    "JOIN cg19_stored_file f ON f.id=snap.evidence_file_id AND f.realm_id=snap.root_realm_id "+
    "AND f.csr_partner_id=snap.partner_id AND f.owner_kind='CG08_CSR_AGREEMENT' "+
    "JOIN cg19_upload_intent i ON i.id=f.upload_intent_id AND i.realm_id=f.realm_id "+
    "AND i.csr_partner_id=f.csr_partner_id AND i.owner_kind='CG08_CSR_AGREEMENT' "+
    "WHERE snap.root_realm_id=$1 AND snap.partner_id=$2 AND snap.evidence_file_id=$3 "+
    "AND c.status='OWNER_COMPLETED' AND d.action='APPROVE' "+
    "AND d.fresh_password_verified_at IS NOT NULL "+
    "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL AND i.status='VALIDATED' "+
    "LIMIT 1 FOR SHARE OF snap,c,d,f,i",[a.realmId,id,file]);
   if(!proof.rowCount)throw new ConflictException(
    "Original approved agreement is unavailable. Refresh and check its scanner status.");
   const result=prior?await tx.query<{version:number}>(
    "UPDATE csr_partner_public_release SET state='AUTHORIZED',version=version+1,"+
    "public_summary=$3,evidence_file_id=$4,authorized_by=$5,updated_by=$5,"+
    "authorized_at=now(),withdrawn_at=NULL,updated_at=now() "+
    "WHERE root_realm_id=$1 AND partner_id=$2 AND version=$6 AND state='WITHDRAWN' "+
    "RETURNING version",[a.realmId,id,summary,file,a.accountId,v.expectedVersion]):
    await tx.query<{version:number}>(
    "INSERT INTO csr_partner_public_release(root_realm_id,partner_id,state,"+
    "public_summary,evidence_file_id,authorized_by,updated_by) "+
    "VALUES($1,$2,'AUTHORIZED',$3,$4,$5,$5) RETURNING version",
    [a.realmId,id,summary,file,a.accountId]);
   if(!result.rows[0])throw changed();
   return this.event(tx,a,id,key,hash,"AUTHORIZE_PUBLIC",result.rows[0].version);
  });
 }
 async withdrawPublic(token:string,partnerRef:string,raw:unknown){
  const id=ref(partnerRef),v=body(raw,["requestKey","expectedVersion"]);
  const key=ref(v.requestKey),expected=version(v.expectedVersion);
  const hash=digest(["CG08_PUBLIC_WITHDRAW",id,expected]);
  return this.run(token,"csr.partners.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"cms.content.manage");
   const previous=await this.replay(tx,a,key,hash,"WITHDRAW_PUBLIC",id);
   if(previous)return previous;
   await this.row(tx,a,id,true);
   const q=await tx.query<{version:number}>(
    "UPDATE csr_partner_public_release SET state='WITHDRAWN',"+
    "version=version+1,withdrawn_at=now(),updated_by=$3,updated_at=now() "+
    "WHERE root_realm_id=$1 AND partner_id=$2 AND state='AUTHORIZED' "+
    "AND version=$4 RETURNING version",[a.realmId,id,a.accountId,expected]);
   if(!q.rows[0])throw changed();
   return this.event(tx,a,id,key,hash,"WITHDRAW_PUBLIC",q.rows[0].version);
  });
 }

 private async replay(tx:PoolClient,a:VerifiedFoundationActor,key:string,hash:string,action:string,target?:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG08:"+a.realmId+":"+key]);
  const c=(await tx.query<{partner_id:string;actor_ref:string;action:string;payload_digest:string;result_version:number}>(
   "SELECT partner_id,actor_ref,action,payload_digest,result_version FROM csr_partner_command WHERE root_realm_id=$1 AND request_key=$2",
   [a.realmId,key])).rows[0];
  if(!c)return null;
  if(c.actor_ref!==a.accountId||c.action!==action||c.payload_digest!==hash||target&&c.partner_id!==target)throw changed();
  await this.row(tx,a,c.partner_id);
  return {ref:c.partner_id,version:c.result_version,replayed:true};
 }
 private async event(tx:PoolClient,a:VerifiedFoundationActor,id:string,key:string,hash:string,action:string,v:number){
  await tx.query("INSERT INTO csr_partner_command(root_realm_id,request_key,partner_id,actor_ref,action,payload_digest,result_version) VALUES($1,$2,$3,$4,$5,$6,$7)",[a.realmId,key,id,a.accountId,action,hash,v]);
  return {ref:id,version:v,replayed:false};
 }
 async options(token:string){
  return this.run(token,"csr.partners.view",async(tx,a)=>{
   const s=await this.branches.projectBranchScope(tx,a);
   return {foundation:s.all,branches:s.branches.map(b=>({value:b.value,label:b.label}))};
  },true);
 }
 async list(token:string,raw:Record<string,unknown>){
  const v=body(raw,["branchRef","q","status","offset"]);
  const q=optional(v.q,"search",1,80)?.toLowerCase()??"";
  const s=optional(v.status,"status",4,16);
  if(s&&!["DRAFT","RETURNED","SUBMITTED","APPROVED","REJECTED","INACTIVE"].includes(s))throw new BadRequestException("Choose a supported status.");
  const offset=v.offset===undefined?0:Number(v.offset);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new BadRequestException("Narrow the search.");
  const branch=v.branchRef===undefined?undefined:v.branchRef==="FOUNDATION"?null:ref(v.branchRef);
  return this.run(token,"csr.partners.view",async(tx,a)=>{
   const scope=await this.branches.projectBranchScope(tx,a);
   if(branch===null&&!scope.all)throw new ForbiddenException("Foundation-wide CSR information is restricted.");
   if(branch&&!(scope.all||scope.branches.some(b=>b.value===branch)))throw new ForbiddenException("CSR branch is not assigned.");
   const rows=await tx.query("SELECT "+listProjection+joins+
    " WHERE p.root_realm_id=$1 AND ($2::boolean OR p.branch_ref=ANY($3::uuid[])) "+
    "AND ($4::boolean OR p.branch_ref IS NOT DISTINCT FROM $5::uuid) "+
    "AND ($6='' OR strpos(p.legal_name_norm,$6)>0) "+
    "AND ($7::text IS NULL OR p.status=$7) "+
    "ORDER BY p.updated_at DESC,p.id DESC LIMIT 26 OFFSET $8",
    [a.realmId,scope.all,scope.branches.map(b=>b.value),branch===undefined,branch??null,q,s,offset]);
   // B03–B05 screenshot status tiles must use real current rows in exactly
   // the same current CG02 Foundation/branch/search scope as the directory.
   const grouped=await tx.query<{status:string;count:string}>(
    "SELECT p.status,count(*)::text AS count "+joins+
    " WHERE p.root_realm_id=$1 AND ($2::boolean OR p.branch_ref=ANY($3::uuid[])) "+
    "AND ($4::boolean OR p.branch_ref IS NOT DISTINCT FROM $5::uuid) "+
    "AND ($6='' OR strpos(p.legal_name_norm,$6)>0) GROUP BY p.status",
    [a.realmId,scope.all,scope.branches.map(b=>b.value),branch===undefined,branch??null,q]);
   const statusCounts=Object.fromEntries(grouped.rows.map(x=>[x.status,Number(x.count)]));
   const counts={all:Object.values(statusCounts).reduce((sum,v)=>sum+v,0),
    pending:statusCounts.SUBMITTED??0,approved:statusCounts.APPROVED??0,
    rejected:statusCounts.REJECTED??0};
   return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25,counts};
  },true);
 }
 async detail(token:string,key:string){
  return this.run(token,"csr.partners.view",async(tx,a)=>{
   await this.row(tx,a,key);
   const q=await tx.query("SELECT "+projection+joins+" WHERE p.root_realm_id=$1 AND p.id=$2",[a.realmId,ref(key)]);
   return q.rows[0];
  },true);
 }
 async create(token:string,raw:unknown){
  const v=parsePartner(raw);
  if(v.expectedVersion!==null)throw new BadRequestException("Choose a new CSR application.");
  const hash=digest(v);
  return this.run(token,"csr.partners.manage",async(tx,a)=>{
   const previous=await this.replay(tx,a,v.requestKey,hash,"CREATE");if(previous)return previous;
   await this.permitted(tx,a,v.branchRef);
   const r=(await tx.query<{id:string;version:number}>(
    "INSERT INTO csr_partner(root_realm_id,branch_ref,legal_name,registration_reference,contact_name,contact_email,contact_mobile,support_summary,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id,version",
    [a.realmId,v.branchRef,v.legalName,v.registrationReference,v.contactName,v.contactEmail,v.contactMobile,v.supportSummary,a.accountId])).rows[0];
   return this.event(tx,a,r.id,v.requestKey,hash,"CREATE",r.version);
  });
 }
 async edit(token:string,key:string,raw:unknown){
  const v=parsePartner(raw),id=ref(key);
  if(v.expectedVersion===null)throw new BadRequestException("Refresh the CSR record before editing.");
  const hash=digest([id,v]);
  return this.run(token,"csr.partners.manage",async(tx,a)=>{
   const previous=await this.replay(tx,a,v.requestKey,hash,"EDIT",id);if(previous)return previous;
   const old=await this.row(tx,a,id,true);
   if(old.branch_ref!==v.branchRef||old.version!==v.expectedVersion||!["DRAFT","RETURNED"].includes(old.status))throw changed();
   const updated=(await tx.query<{version:number}>(`UPDATE csr_partner SET legal_name=$3,registration_reference=$4,contact_name=$5,contact_email=$6,contact_mobile=$7,support_summary=$8,status='DRAFT',version=version+1,updated_by=$9,updated_at=now()
     WHERE root_realm_id=$1 AND id=$2 RETURNING version`,[a.realmId,id,v.legalName,v.registrationReference,v.contactName,v.contactEmail,v.contactMobile,v.supportSummary,a.accountId])).rows[0];
   return this.event(tx,a,id,v.requestKey,hash,"EDIT",updated.version);
  });
 }
 async cancel(token:string,key:string,raw:unknown){
  const v=body(raw,["requestKey","expectedVersion"]);
  const requestKey=ref(v.requestKey),expected=version(v.expectedVersion),id=ref(key),hash=digest([id,expected]);
  return this.run(token,"csr.partners.manage",async(tx,a)=>{
   const previous=await this.replay(tx,a,requestKey,hash,"CANCEL",id);if(previous)return previous;
   const old=await this.row(tx,a,id,true);
   if(old.version!==expected||!["DRAFT","RETURNED"].includes(old.status))throw changed();
   const next=old.version+1;
   await tx.query("UPDATE csr_partner SET status='INACTIVE',version=$3,updated_by=$4,updated_at=now() WHERE root_realm_id=$1 AND id=$2",[a.realmId,id,next,a.accountId]);
   return this.event(tx,a,id,requestKey,hash,"CANCEL",next);
  });
 }
}
