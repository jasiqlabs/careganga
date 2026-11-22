import {MembershipFeesService} from "../../cg-09-finance-accounting/application/membership-fees.service";
import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {MembershipEvidenceService} from "../../cg-19-documents-notifications/application/membership-evidence.service";
import {int,object,pick,plain,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
type Case={id:string;case_number:string;proposer_id:string;membership_review_ref:string;membership_application_id:string;membership_application_version:number;membership_review_digest:string;status:string;revision:number;process_id:string;current_step:number};
type Snapshot={id:string;source_digest:string;source_snapshot:Record<string,unknown>;application_version:number;submitted_by:string;request_key:string};
const changed=()=>new ConflictException("The application or review changed. Refresh and review the current record.");
const unavailable=()=>new NotFoundException("Membership review is not available.");
function stable(x:unknown):string{if(x===null||typeof x!=="object")return JSON.stringify(x)??"null";if(Array.isArray(x))return "["+x.map(stable).join(",")+"]";const v=x as Record<string,unknown>;return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}";}
const hash=(x:unknown)=>createHash("sha256").update(stable(x)).digest("hex");
@Injectable()
export class MembershipApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService,private readonly evidence:MembershipEvidenceService,private readonly fees:MembershipFeesService){}
 private async run<T>(a:Actor,work:(tx:PoolClient)=>Promise<T>){const tx=await this.db.connect();try{await tx.query("BEGIN");const result=await work(tx);await tx.query("COMMIT");return result;}catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03"].includes(String(e.code)))throw changed();throw e;}finally{tx.release();}}
 private async event(tx:PoolClient,a:Actor,id:string,action:string){await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,id,a.accountId,action,randomUUID()]);}
 private async reviewer(token:string){const a=await this.sessions.requireAction(token,"approvals.review");await this.sessions.requireAction(token,"membership.applications.review");return a;}
 private async authority(tx:PoolClient,a:Actor){await this.owner.verifyReviewer(tx,a,"approvals.review",true);await this.identity.assertCurrent(tx,a,"membership.applications.review");await this.identity.assertCurrent(tx,a,"documents.files.view");}
 private async process(tx:PoolClient,root:string){return (await tx.query<{id:string;version:number}>("SELECT p.id,p.version FROM cg03_membership_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1 AND p.process_kind='MEMBER_APPLICATION' FOR SHARE OF p",[root])).rows[0];}
 async policy(token:string){const a=await this.reviewer(token);return this.run(a,async tx=>{await this.authority(tx,a);const p=await this.process(tx,a.realmId);return {configured:!!p,version:p?.version??0};});}
 async configure(token:string,raw:unknown){
  const x=object(raw,["currentPassword"]);if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw new BadRequestException("Enter your current password to configure membership review.");
  const password=x.currentPassword,a=await this.sessions.requireAction(token,"approvals.process.manage");await this.sessions.limitFoundationRootProof(a);
  return this.run(a,async tx=>{
   if(!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId])).rowCount)throw unavailable();
   await this.authority(tx,a);await this.identity.assertCurrent(tx,a,"approvals.process.manage");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const old=await this.process(tx,a.realmId);if(old)return {configured:true,version:old.version,replayed:true};
   const p=(await tx.query<{id:string;version:number}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'MEMBER_APPLICATION' FROM cg03_process WHERE realm_id=$1 RETURNING id,version",[a.realmId,a.accountId])).rows[0];
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
   await tx.query("INSERT INTO cg03_membership_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);return {configured:true,version:p.version,replayed:false};
  });
 }
 async submit(token:string,appRef:string,raw:unknown){
  const id=uuid(appRef),x=object(raw,["requestKey","expectedVersion"]),key=uuid(x.requestKey),expected=int(x.expectedVersion,1,2147483646,"application revision"),requestDigest=hash(["SUBMIT",id,expected]);
  const a=await this.sessions.verifySession(token);
  return this.run(a,async tx=>{
   await this.identity.verifiedCommunityApplicant(tx,a);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:APPLICATION:"+a.realmId+":"+a.accountId]);
   const row=(await tx.query<{version:number;status:string;source:Record<string,unknown>;display_name:string}>("SELECT a.version,a.status,a.display_name,to_jsonb(a)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest' AS source FROM membership_application a WHERE a.root_realm_id=$1 AND a.id=$2 AND a.applicant_account_ref=$3 FOR UPDATE OF a",[a.realmId,id,a.accountId])).rows[0];if(!row)throw unavailable();
   const prior=(await tx.query<{application_id:string;actor_ref:string;payload_digest:string;action:string;result_version:number}>("SELECT application_id,actor_ref,payload_digest,action,result_version FROM membership_application_command WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,key])).rows[0];
   if(prior){if(prior.application_id!==id||prior.actor_ref!==a.accountId||prior.action!=="SUBMIT"||prior.payload_digest!==requestDigest||prior.result_version!==expected+1)throw changed();const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='MEMBER_APPLICATION' AND membership_application_id=$2 AND membership_application_version=$3",[a.realmId,id,prior.result_version])).rows[0];if(!c)throw changed();return {reference:c.case_number,status:c.status,replayed:true};}
   if(row.version!==expected||!["DRAFT","RETURNED"].includes(row.status))throw changed();
   const process=await this.process(tx,a.realmId);if(!process)throw new ConflictException("Foundation membership review is not configured. Your draft is saved; please contact the Foundation.");
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const files=await this.evidence.frozenProof(tx,a.realmId,id,expected),next=expected+1,source={record:row.source,files},digest=hash([id,next,source]);
   await tx.query("UPDATE membership_application SET status='SUBMITTED',version=$3,submitted_digest=$4,submitted_at=now(),updated_at=now() WHERE root_realm_id=$1 AND id=$2",[a.realmId,id,next,digest]);
   const s=(await tx.query<{id:string}>("INSERT INTO membership_review_snapshot(root_realm_id,application_id,application_version,source_digest,submitted_by,request_key,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id",[a.realmId,id,next,digest,a.accountId,key,JSON.stringify(source)])).rows[0];
   for(const file of files)await tx.query("INSERT INTO membership_review_file(root_realm_id,snapshot_id,application_id,file_id,file_version,source_version,classification,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[a.realmId,s.id,id,file.fileRef,file.fileVersion,file.sourceVersion,file.classification,file.sha256]);
   await tx.query("INSERT INTO membership_application_command(root_realm_id,request_key,application_id,result_version,actor_ref,action,payload_digest) VALUES($1,$2,$3,$4,$5,'SUBMIT',$6)",[a.realmId,key,id,next,a.accountId,requestDigest]);
   const previous=(await tx.query<{id:string;status:string}>("SELECT id,status FROM cg03_case WHERE realm_id=$1 AND case_kind='MEMBER_APPLICATION' AND membership_application_id=$2 ORDER BY membership_application_version DESC LIMIT 1",[a.realmId,id])).rows[0];
   if(previous&&previous.status!=="RETURNED")throw changed();
   const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,membership_review_ref,membership_application_id,membership_application_version,membership_review_digest,previous_case_id) VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),$2,$3,$4,NULL,NULL,$5,'Membership application',NULL,NULL,$6,$7,$8,$9,'MEMBER_APPLICATION',$10,$11,$6,$7,$12) RETURNING *",[a.realmId,process.id,process.version,a.accountId,row.display_name,next,digest,requestDigest,key,s.id,id,previous?.id??null])).rows[0];
   await this.event(tx,a,c.id,"SUBMITTED");return {reference:c.case_number,status:c.status,replayed:false};
  });
 }
 private async case(tx:PoolClient,a:Actor,id:string,write=false){const v=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='MEMBER_APPLICATION'"+(write?" FOR UPDATE":" FOR SHARE"),[a.realmId,id])).rows[0];if(!v)throw unavailable();return v;}
 private async exact(tx:PoolClient,a:Actor,c:Case,current:boolean){
  const s=(await tx.query<Snapshot>("SELECT * FROM membership_review_snapshot WHERE root_realm_id=$1 AND id=$2 AND application_id=$3 AND application_version=$4",[a.realmId,c.membership_review_ref,c.membership_application_id,c.membership_application_version])).rows[0];
  if(!s||s.submitted_by!==c.proposer_id||s.source_digest!==c.membership_review_digest||hash([c.membership_application_id,s.application_version,s.source_snapshot])!==s.source_digest)throw changed();
  const files=(await tx.query<{fileRef:string;fileVersion:number;sourceVersion:number;classification:string;sha256:string;currentVersion:number;revoked:boolean;actualHash:string;scan:string}>("SELECT f.file_id AS \"fileRef\",f.file_version AS \"fileVersion\",f.source_version AS \"sourceVersion\",f.classification,f.sha256,d.revision AS \"currentVersion\",d.revoked_at IS NOT NULL AS revoked,d.sha256 AS \"actualHash\",d.scan_status AS scan FROM membership_review_file f JOIN cg19_membership_private_file d ON d.realm_id=f.root_realm_id AND d.id=f.file_id AND d.application_id=f.application_id WHERE f.root_realm_id=$1 AND f.snapshot_id=$2 AND f.application_id=$3 ORDER BY f.classification FOR SHARE OF d",[a.realmId,s.id,c.membership_application_id])).rows;
  const expected=files.map(({fileRef,fileVersion,sourceVersion,classification,sha256})=>({fileRef,fileVersion,sourceVersion,classification,sha256}));
  if(!expected.some(f=>f.classification==="MEMBER_IDENTITY_PROOF")||stable(expected)!==stable(s.source_snapshot.files))throw changed();
  if(current){const app=(await tx.query<{version:number;status:string;submitted_digest:string}>("SELECT version,status,submitted_digest FROM membership_application WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,c.membership_application_id])).rows[0];if(!app||app.status!=="SUBMITTED"||app.version!==s.application_version||app.submitted_digest!==s.source_digest||files.some(f=>f.revoked||f.currentVersion!==f.fileVersion||f.actualHash!==f.sha256||f.scan!=="CLEAN_VERIFIED"))throw changed();}
  return {source:s.source_snapshot.record as Record<string,unknown>,files:files.map(f=>({classification:f.classification,fileRef:f.fileRef,fileVersion:f.fileVersion,verified:!f.revoked&&f.currentVersion===f.fileVersion&&f.actualHash===f.sha256&&f.scan==="CLEAN_VERIFIED"}))};
 }
 async inbox(token:string,q:unknown){const a=await this.reviewer(token),x=object(q,["status","offset"]),status=pick(x.status??"ALL",["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"] as const,"status"),offset=x.offset===undefined?0:int(Number(x.offset),0,10000,"page");
  return this.run(a,async tx=>{await this.authority(tx,a);
   const rows=(await tx.query("SELECT id AS \"caseRef\",case_number AS reference,account_name_snapshot AS name,status,revision,submitted_at AS \"submittedAt\",proposer_id<>$2 AND status='SUBMITTED' AS \"canDecide\" FROM cg03_case WHERE realm_id=$1 AND case_kind='MEMBER_APPLICATION' AND ($3='ALL' OR status=$3) ORDER BY submitted_at DESC,id DESC LIMIT 26 OFFSET $4",[a.realmId,a.accountId,status,offset])).rows;return {items:rows.slice(0,25),hasMore:rows.length>25,offset};
  });
 }
 async detail(token:string,ref:string){const a=await this.reviewer(token),id=uuid(ref);return this.run(a,async tx=>{await this.authority(tx,a);const c=await this.case(tx,a,id);const frozen=await this.exact(tx,a,c,["SUBMITTED","PENDING_OWNER"].includes(c.status));const timeline=(await tx.query("SELECT e.action,e.occurred_at AS \"occurredAt\",a.display_name AS reviewer FROM cg03_case_event e JOIN account a ON a.id=e.actor_id AND a.realm_id=e.realm_id WHERE e.realm_id=$1 AND e.case_id=$2 ORDER BY e.occurred_at DESC,e.id DESC LIMIT 50",[a.realmId,c.id])).rows;
  const source=frozen.source,summary={applicationNumber:source.application_ref,name:source.display_name,mobile:source.contact_mobile,email:source.contact_email,address:source.address_text,city:source.city,pinCode:source.pin_code,feeMinor:source.accepted_fee_minor,currency:source.currency};
  return {caseRef:c.id,reference:c.case_number,status:c.status,revision:c.revision,source:summary,files:frozen.files,timeline,canDecide:c.proposer_id!==a.accountId&&c.status==="SUBMITTED"};
 });}
 /** Original CG03 finalized decision source for CG04's short owner transaction.
  * The applicant is not a reviewer: no reviewer grant is issued or inferred. */
 async approvedForActivation(tx:PoolClient,a:Actor,app:string,version:number,digest:string){
  const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='MEMBER_APPLICATION' AND membership_application_id=$2 AND proposer_id=$3 AND membership_application_version=$4 AND membership_review_digest=$5 AND status='PENDING_OWNER' FOR UPDATE",[a.realmId,app,a.accountId,version,digest])).rows[0];
  if(!c)throw new ConflictException("Membership review has not been finally approved.");
  await this.exact(tx,a,c,true);
  const d=(await tx.query<{id:string}>("SELECT d.id FROM cg03_case_decision d JOIN account r ON r.realm_id=d.realm_id AND r.id=d.actor_id AND r.status='ACTIVE' JOIN account_role ar ON ar.account_id=r.id AND ar.realm_id=r.realm_id AND ar.revoked_at IS NULL JOIN role role ON role.id=ar.role_id AND role.realm_id=ar.realm_id AND role.active AND role.is_protected WHERE d.realm_id=$1 AND d.case_id=$2 AND d.action='APPROVE' AND d.actor_id<>$3 AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=$4 AND d.step_ordinal=1 LIMIT 1 FOR SHARE OF d,r,ar,role",[a.realmId,c.id,a.accountId,c.revision])).rows[0];
  if(!d)throw new ConflictException("A current independent protected approval is required.");
  return {caseRef:c.id,decisionRef:d.id};
 }
 async completeMembership(tx:PoolClient,a:Actor,caseRef:string,app:string){
  const updated=await tx.query("UPDATE cg03_case c SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='MEMBER_APPLICATION' AND c.status='PENDING_OWNER' AND c.membership_application_id=$3 AND EXISTS(SELECT 1 FROM membership_application_effect e WHERE e.root_realm_id=c.realm_id AND e.application_id=$3 AND e.case_id=c.id AND e.actor_ref=$4) RETURNING id",[a.realmId,caseRef,app,a.accountId]);
  if(!updated.rowCount)throw changed();await this.event(tx,a,caseRef,"OWNER_COMPLETED");
 }
 async proof(token:string,ref:string,file:string){const a=await this.reviewer(token);await this.run(a,async tx=>{await this.authority(tx,a);const v=await this.case(tx,a,uuid(ref));if(v.proposer_id===a.accountId||!["SUBMITTED","PENDING_OWNER"].includes(v.status))throw unavailable();await this.exact(tx,a,v,true);});return this.evidence.reviewDownload(token,ref,file);}
 async decide(token:string,ref:string,raw:unknown){
  const a=await this.reviewer(token),id=uuid(ref),x=object(raw,["requestKey","expectedRevision","action","remarks","currentPassword"]),key=uuid(x.requestKey),expected=int(x.expectedRevision,1,2147483646,"review revision"),action=pick(x.action,["APPROVE","RETURN","REJECT"] as const,"decision"),remarks=plain(x.remarks??"",action==="APPROVE"?0:3,500,"review remarks");
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw new BadRequestException("Enter your current password to confirm the decision.");const password=x.currentPassword,digest=hash([action,expected,remarks]);await this.sessions.limitFoundationRootProof(a);
  return this.run(a,async tx=>{
   await this.authority(tx,a);const c=await this.case(tx,a,id,true);if(c.proposer_id===a.accountId)throw new ForbiddenException("Another Foundation reviewer must decide this application.");
   const old=(await tx.query<{actor_id:string;request_digest:string;accepted_case_revision:number}>("SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,id,key])).rows[0];
   if(old){if(old.actor_id!==a.accountId||old.request_digest!==digest)throw changed();return {reference:c.case_number,status:c.status,revision:c.revision,replayed:true};}
   if(c.status!=="SUBMITTED"||c.revision!==expected||!(await tx.query("SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id WHERE p.realm_id=$1 AND p.id=$2 AND p.process_kind='MEMBER_APPLICATION' AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required FOR SHARE OF p,s",[a.realmId,c.process_id])).rowCount)throw changed();
   await this.exact(tx,a,c,true);await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",[a.realmId,c.id,next,expected]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[a.realmId,c.id,a.accountId,action,c.revision,c.revision+1,key,digest,remarks]);
   if(action!=="APPROVE"){const applied=await tx.query("UPDATE membership_application SET status=$3,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' AND version=$4 RETURNING id",[a.realmId,c.membership_application_id,next,c.membership_application_version]);if(!applied.rowCount)throw changed();}
   if(action==="REJECT")await this.fees.requestRefundIfPaid(tx,a,c.membership_application_id);
   await this.event(tx,a,c.id,action==="APPROVE"?"FINAL_APPROVED":next);
   return {reference:c.case_number,status:next,revision:c.revision+1,replayed:false};
  });
 }
}
