
import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {VolunteerEvidenceService} from "../../cg-19-documents-notifications/application/volunteer-evidence.service";
import {recordCommittedReferralAttribution} from "../../cg-13-referrals-rewards/application/committed-referral.source";
import {int,object,pick,plain,uuid} from "../../cg-04-membership-volunteers/domain/tier-input";
type Case={id:string;case_number:string;proposer_id:string;volunteer_review_ref:string;volunteer_application_id:string;volunteer_application_version:number;volunteer_review_digest:string;status:string;revision:number;process_id:string;current_step:number};
type Snapshot={id:string;source_digest:string;source_snapshot:Record<string,unknown>;application_version:number;submitted_by:string;request_key:string};
const changed=()=>new ConflictException("The application or review changed. Refresh and review the current record.");
const unavailable=()=>new NotFoundException("Volunteer review is not available.");
function stable(x:unknown):string{if(x===null||typeof x!=="object")return JSON.stringify(x)??"null";if(Array.isArray(x))return "["+x.map(stable).join(",")+"]";const v=x as Record<string,unknown>;return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}";}
const hash=(x:unknown)=>createHash("sha256").update(stable(x)).digest("hex");
@Injectable()
export class VolunteerApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,private readonly owner:ProtectedAccessOwnerService,private readonly evidence:VolunteerEvidenceService){}
 private async run<T>(a:Actor,work:(tx:PoolClient)=>Promise<T>){const tx=await this.db.connect();try{await tx.query("BEGIN");const result=await work(tx);await tx.query("COMMIT");return result;}catch(e){try{await tx.query("ROLLBACK");}catch{}if(e&&typeof e==="object"&&"code" in e&&["23505","23503","23514","40001","40P01","55P03","P0001"].includes(String(e.code)))throw changed();throw e;}finally{tx.release();}}
 private async event(tx:PoolClient,a:Actor,id:string,action:string){await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,id,a.accountId,action,randomUUID()]);}
 private async reviewer(token:string){const a=await this.sessions.requireAction(token,"approvals.review");await this.sessions.requireAction(token,"volunteers.applications.review");return a;}
 private async authority(tx:PoolClient,a:Actor){await this.owner.verifyReviewer(tx,a,"approvals.review",true);await this.identity.assertCurrent(tx,a,"volunteers.applications.review");await this.identity.assertCurrent(tx,a,"documents.files.view");}
 private async process(tx:PoolClient,root:string){return (await tx.query<{id:string;version:number}>("SELECT p.id,p.version FROM cg03_volunteer_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1 AND p.process_kind='VOLUNTEER_APPLICATION' FOR SHARE OF p",[root])).rows[0];}
 async policy(token:string){const a=await this.reviewer(token);return this.run(a,async tx=>{await this.authority(tx,a);const p=await this.process(tx,a.realmId);return {configured:!!p,version:p?.version??0};});}
 async configure(token:string,raw:unknown){
  const x=object(raw,["currentPassword"]);if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword)>1024)throw new BadRequestException("Enter your current password to configure volunteer review.");
  const password=x.currentPassword,a=await this.sessions.requireAction(token,"approvals.process.manage");await this.sessions.limitFoundationRootProof(a);
  return this.run(a,async tx=>{
   if(!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId])).rowCount)throw unavailable();
   await this.authority(tx,a);await this.identity.assertCurrent(tx,a,"approvals.process.manage");await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const old=await this.process(tx,a.realmId);if(old)return {configured:true,version:old.version,replayed:true};
   const p=(await tx.query<{id:string;version:number}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'VOLUNTEER_APPLICATION' FROM cg03_process WHERE realm_id=$1 RETURNING id,version",[a.realmId,a.accountId])).rows[0];
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
   await tx.query("INSERT INTO cg03_volunteer_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);return {configured:true,version:p.version,replayed:false};
  });
 }
 async submit(token:string,appRef:string,raw:unknown){
  const id=uuid(appRef),x=object(raw,["requestKey","expectedVersion"]),key=uuid(x.requestKey),expected=int(x.expectedVersion,1,2147483646,"application revision"),requestDigest=hash(["SUBMIT",id,expected]);
  const a=await this.sessions.verifySession(token);
  return this.run(a,async tx=>{
   await this.identity.verifiedCommunityApplicant(tx,a);
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG04:VOLUNTEER:"+a.realmId+":"+a.accountId]);
   const row=(await tx.query<{version:number;status:string;source:Record<string,unknown>;display_name:string}>("SELECT a.version,a.status,(a.first_name||' '||a.last_name) AS display_name,to_jsonb(a)-'status'-'version'-'updated_at'-'submitted_at'-'submitted_digest' AS source FROM volunteer_application a WHERE a.root_realm_id=$1 AND a.id=$2 AND a.applicant_account_ref=$3 FOR UPDATE OF a",[a.realmId,id,a.accountId])).rows[0];if(!row)throw unavailable();
   const prior=(await tx.query<{application_id:string;actor_ref:string;payload_digest:string;action:string;result_version:number}>("SELECT application_id,actor_ref,payload_digest,action,result_version FROM volunteer_application_command WHERE root_realm_id=$1 AND request_key=$2",[a.realmId,key])).rows[0];
   if(prior){if(prior.application_id!==id||prior.actor_ref!==a.accountId||prior.action!=="SUBMIT"||prior.payload_digest!==requestDigest||prior.result_version!==expected+1)throw changed();const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='VOLUNTEER_APPLICATION' AND volunteer_application_id=$2 AND volunteer_application_version=$3",[a.realmId,id,prior.result_version])).rows[0];if(!c)throw changed();return {reference:c.case_number,status:c.status,replayed:true};}
   if(row.version!==expected||!["DRAFT","RETURNED"].includes(row.status))throw changed();
   const process=await this.process(tx,a.realmId);if(!process)throw new ConflictException("Foundation volunteer review is not configured. Your draft is saved; please contact the Foundation.");
   await this.owner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const files=await this.evidence.frozenProof(tx,a.realmId,id,expected),next=expected+1,source={record:row.source,files},digest=hash([id,next,source]);
   await tx.query("UPDATE volunteer_application SET status='SUBMITTED',version=$3,submitted_digest=$4,submitted_at=now(),updated_at=now() WHERE root_realm_id=$1 AND id=$2",[a.realmId,id,next,digest]);
   const s=(await tx.query<{id:string}>("INSERT INTO volunteer_review_snapshot(root_realm_id,application_id,application_version,source_digest,submitted_by,request_key,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id",[a.realmId,id,next,digest,a.accountId,key,JSON.stringify(source)])).rows[0];
   for(const file of files)await tx.query("INSERT INTO volunteer_review_file(root_realm_id,snapshot_id,application_id,file_id,file_version,source_version,classification,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[a.realmId,s.id,id,file.fileRef,file.fileVersion,file.sourceVersion,file.classification,file.sha256]);
   await tx.query("INSERT INTO volunteer_application_command(root_realm_id,request_key,application_id,result_version,actor_ref,action,payload_digest) VALUES($1,$2,$3,$4,$5,'SUBMIT',$6)",[a.realmId,key,id,next,a.accountId,requestDigest]);
   const previous=(await tx.query<{id:string;status:string}>("SELECT id,status FROM cg03_case WHERE realm_id=$1 AND case_kind='VOLUNTEER_APPLICATION' AND volunteer_application_id=$2 ORDER BY volunteer_application_version DESC LIMIT 1",[a.realmId,id])).rows[0];
   if(previous&&previous.status!=="RETURNED")throw changed();
   const c=(await tx.query<Case>("INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,volunteer_review_ref,volunteer_application_id,volunteer_application_version,volunteer_review_digest,previous_case_id) VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),$2,$3,$4,NULL,NULL,$5,'Volunteer application',NULL,NULL,$6,$7,$8,$9,'VOLUNTEER_APPLICATION',$10,$11,$6,$7,$12) RETURNING *",[a.realmId,process.id,process.version,a.accountId,row.display_name,next,digest,requestDigest,key,s.id,id,previous?.id??null])).rows[0];
   await this.event(tx,a,c.id,"SUBMITTED");
   // CG13 source-only: freeze one verified referrer from the original CG04
   // submitted snapshot, inside THIS already-authorized CG03 transaction.
   // No credit is issued here; ordinary applications without a valid code work.
   await recordCommittedReferralAttribution(tx,{
    root:a.realmId,applicantAccount:a.accountId,application:id,
    kind:"VOLUNTEER",applicationRevision:next,submittedDigest:digest,
    originalSubmitKey:key,
    code:typeof row.source.referral_input==="string"?row.source.referral_input:null
   });
   return {reference:c.case_number,status:c.status,replayed:false};
  });
 }
 private async case(tx:PoolClient,a:Actor,id:string,write=false){const v=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='VOLUNTEER_APPLICATION'"+(write?" FOR UPDATE":" FOR SHARE"),[a.realmId,id])).rows[0];if(!v)throw unavailable();return v;}
 private async exact(tx:PoolClient,a:Actor,c:Case,current:boolean){
  const s=(await tx.query<Snapshot>("SELECT * FROM volunteer_review_snapshot WHERE root_realm_id=$1 AND id=$2 AND application_id=$3 AND application_version=$4",[a.realmId,c.volunteer_review_ref,c.volunteer_application_id,c.volunteer_application_version])).rows[0];
  if(!s||s.submitted_by!==c.proposer_id||s.source_digest!==c.volunteer_review_digest||hash([c.volunteer_application_id,s.application_version,s.source_snapshot])!==s.source_digest)throw changed();
  const files=(await tx.query<{fileRef:string;fileVersion:number;sourceVersion:number;classification:string;sha256:string;currentVersion:number;revoked:boolean;actualHash:string;scan:string}>("SELECT f.file_id AS \"fileRef\",f.file_version AS \"fileVersion\",f.source_version AS \"sourceVersion\",f.classification,f.sha256,d.revision AS \"currentVersion\",d.revoked_at IS NOT NULL AS revoked,d.sha256 AS \"actualHash\",d.scan_status AS scan FROM volunteer_review_file f JOIN cg19_volunteer_private_file d ON d.realm_id=f.root_realm_id AND d.id=f.file_id AND d.application_id=f.application_id WHERE f.root_realm_id=$1 AND f.snapshot_id=$2 AND f.application_id=$3 ORDER BY f.classification FOR SHARE OF d",[a.realmId,s.id,c.volunteer_application_id])).rows;
  const expected=files.map(({fileRef,fileVersion,sourceVersion,classification,sha256})=>({fileRef,fileVersion,sourceVersion,classification,sha256}));
  if(!expected.some(f=>f.classification==="VOLUNTEER_IDENTITY_PROOF")||stable(expected)!==stable(s.source_snapshot.files))throw changed();
  if(current){const app=(await tx.query<{version:number;status:string;submitted_digest:string}>("SELECT version,status,submitted_digest FROM volunteer_application WHERE root_realm_id=$1 AND id=$2 FOR SHARE",[a.realmId,c.volunteer_application_id])).rows[0];if(!app||app.status!=="SUBMITTED"||app.version!==s.application_version||app.submitted_digest!==s.source_digest||files.some(f=>f.revoked||f.currentVersion!==f.fileVersion||f.actualHash!==f.sha256||f.scan!=="CLEAN_VERIFIED"))throw changed();}
  return {source:s.source_snapshot.record as Record<string,unknown>,files:files.map(f=>({classification:f.classification,fileRef:f.fileRef,fileVersion:f.fileVersion,verified:!f.revoked&&f.currentVersion===f.fileVersion&&f.actualHash===f.sha256&&f.scan==="CLEAN_VERIFIED"}))};
 }

 async inbox(token:string,raw:unknown){
  const a=await this.reviewer(token),x=object(raw,["status","offset","q","departmentRef","availability"]);
  const status=pick(x.status??"ALL",["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"] as const,"review status");
  // Express GET @Query yields strings, unlike POST JSON numeric revisions.
  const offset=x.offset===undefined||x.offset===""?0:
   typeof x.offset==="string"&&/^(0|[1-9][0-9]{0,3})$/.test(x.offset)?Number(x.offset):NaN;
  if(!Number.isSafeInteger(offset)||offset<0||offset>5000)throw new BadRequestException("Choose a valid volunteer review page.");
  const term=plain(x.q??"",0,80,"search").toLowerCase();
  const department=x.departmentRef===undefined||x.departmentRef===""?null:uuid(x.departmentRef);
  const availability=pick(x.availability??"ALL",["ALL","FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const,"availability");
  return this.run(a,async tx=>{
   await this.authority(tx,a);
   const keyword=term?"%"+term.replace(/[\\%_]/g,"\\$&")+"%":"";
   const result=await tx.query<{
    caseRef:string;reference:string;status:string;revision:number;name:string;applicationNumber:string;
    department:string;availability:string;submittedAt:Date;canDecide:boolean
   }>(`SELECT c.id AS "caseRef",c.case_number AS reference,c.status,c.revision,
     (v.first_name||' '||v.last_name) AS name,v.application_ref AS "applicationNumber",
     d.name AS department,v.availability,c.created_at AS "submittedAt",
     (c.status='SUBMITTED' AND c.proposer_id<>$2) AS "canDecide"
     FROM cg03_case c
     JOIN volunteer_application v ON v.root_realm_id=c.realm_id AND v.id=c.volunteer_application_id
     JOIN department d ON d.root_realm_id=v.root_realm_id AND d.id=v.department_ref
     WHERE c.realm_id=$1 AND c.case_kind='VOLUNTEER_APPLICATION'
       AND ($3='ALL' OR c.status=$3)
       AND ($4='' OR lower(c.case_number) LIKE $4 ESCAPE '\\'
         OR lower(v.application_ref) LIKE $4 ESCAPE '\\'
         OR lower(v.first_name||' '||v.last_name) LIKE $4 ESCAPE '\\')
       AND ($5::uuid IS NULL OR v.department_ref=$5)
       AND ($6='ALL' OR v.availability=$6)
     ORDER BY c.created_at DESC,c.id DESC LIMIT 26 OFFSET $7`,
    [a.realmId,a.accountId,status,keyword,department,availability,offset]);
   const counts=(await tx.query<{
     total:string;active:string;pending:string;rejected:string;today:string
   }>(`SELECT
    (SELECT count(*)::text FROM volunteer_application app WHERE app.root_realm_id=$1) AS total,
    (SELECT count(*)::text FROM volunteer approved WHERE approved.root_realm_id=$1 AND approved.status='ACTIVE') AS active,
    (SELECT count(*)::text FROM volunteer_application pending WHERE pending.root_realm_id=$1 AND pending.status='SUBMITTED') AS pending,
    (SELECT count(*)::text FROM volunteer_application rejected WHERE rejected.root_realm_id=$1 AND rejected.status='REJECTED') AS rejected,
    (SELECT count(*)::text FROM volunteer_application today WHERE today.root_realm_id=$1 AND (today.created_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date) AS today`,
    [a.realmId])).rows[0];
   const current=counts??{total:"0",active:"0",pending:"0",rejected:"0",today:"0"};
   return {items:result.rows.slice(0,25),hasMore:result.rows.length>25,offset,overview:{
    total:Number(current.total),active:Number(current.active),pending:Number(current.pending),
    rejected:Number(current.rejected),today:Number(current.today),
    approvalRate:Number(current.total)>0?Math.round(100*Number(current.active)/Number(current.total)):null
   }};
  });
 }
 async detail(token:string,ref:string){
  const a=await this.reviewer(token),id=uuid(ref);
  return this.run(a,async tx=>{
   await this.authority(tx,a);
   const c=await this.case(tx,a,id),source=await this.exact(tx,a,c,["SUBMITTED","PENDING_OWNER"].includes(c.status));
   const timeline=(await tx.query<{action:string;occurredAt:Date;reviewer:string}>(`SELECT e.action,e.occurred_at AS "occurredAt",account.display_name AS reviewer
    FROM cg03_case_event e JOIN account account ON account.id=e.actor_id AND account.realm_id=e.realm_id
    WHERE e.realm_id=$1 AND e.case_id=$2 ORDER BY e.occurred_at,e.id LIMIT 100`,[a.realmId,id])).rows;
   const names=(await tx.query<{applicationNumber:string;department:string;branch:string|null}>(`SELECT app.application_ref AS "applicationNumber",department.name AS department,branch.name AS branch
     FROM volunteer_application app JOIN department department ON department.id=app.department_ref AND department.root_realm_id=app.root_realm_id
     LEFT JOIN branch branch ON branch.id=app.branch_ref AND branch.root_realm_id=app.root_realm_id
     WHERE app.root_realm_id=$1 AND app.id=$2`,[a.realmId,c.volunteer_application_id])).rows[0];
   return {caseRef:c.id,reference:c.case_number,status:c.status,revision:c.revision,
    applicationNumber:names?.applicationNumber??"",department:names?.department??"",branch:names?.branch??null,
    source:source.source,files:source.files,timeline,canDecide:c.status==="SUBMITTED"&&c.proposer_id!==a.accountId};
  });
 }
 async approvedForActivation(tx:PoolClient,a:Actor,app:string,version:number,digest:string){
  const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='VOLUNTEER_APPLICATION' AND volunteer_application_id=$2 AND proposer_id=$3 AND volunteer_application_version=$4 AND volunteer_review_digest=$5 AND status='PENDING_OWNER' FOR UPDATE",[a.realmId,app,a.accountId,version,digest])).rows[0];
  if(!c)throw new ConflictException("Volunteer review has not been finally approved.");
  await this.exact(tx,a,c,true);
  const d=(await tx.query<{id:string}>("SELECT d.id FROM cg03_case_decision d JOIN account r ON r.realm_id=d.realm_id AND r.id=d.actor_id AND r.status='ACTIVE' JOIN account_role ar ON ar.account_id=r.id AND ar.realm_id=r.realm_id AND ar.revoked_at IS NULL JOIN role reviewer_role ON reviewer_role.id=ar.role_id AND reviewer_role.realm_id=ar.realm_id AND reviewer_role.active AND reviewer_role.is_protected WHERE d.realm_id=$1 AND d.case_id=$2 AND d.action='APPROVE' AND d.actor_id<>$3 AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=$4 AND d.step_ordinal=1 LIMIT 1 FOR SHARE OF d,r,ar,reviewer_role",[a.realmId,c.id,a.accountId,c.revision])).rows[0];
  if(!d)throw new ConflictException("A current independent protected approval is required.");
  return {caseRef:c.id,decisionRef:d.id};
 }
 async completeVolunteer(tx:PoolClient,a:Actor,caseRef:string,app:string){
  const updated=await tx.query("UPDATE cg03_case c SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='VOLUNTEER_APPLICATION' AND c.status='PENDING_OWNER' AND c.volunteer_application_id=$3 AND EXISTS(SELECT 1 FROM volunteer_approval_effect e WHERE e.root_realm_id=c.realm_id AND e.application_id=$3 AND e.case_id=c.id AND e.actor_ref=$4) RETURNING id",[a.realmId,caseRef,app,a.accountId]);
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
   if(c.status!=="SUBMITTED"||c.revision!==expected||!(await tx.query("SELECT 1 FROM cg03_process p JOIN cg03_process_step s ON s.process_id=p.id WHERE p.realm_id=$1 AND p.id=$2 AND p.process_kind='VOLUNTEER_APPLICATION' AND s.ordinal=1 AND s.capability_key='approvals.review' AND s.protected_root_required FOR SHARE OF p,s",[a.realmId,c.process_id])).rowCount)throw changed();
   await this.exact(tx,a,c,true);await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const next=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",[a.realmId,c.id,next,expected]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())",[a.realmId,c.id,a.accountId,action,c.revision,c.revision+1,key,digest,remarks]);
   if(action!=="APPROVE"){const applied=await tx.query("UPDATE volunteer_application SET status=$3,version=version+1,updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='SUBMITTED' AND version=$4 RETURNING id",[a.realmId,c.volunteer_application_id,next,c.volunteer_application_version]);if(!applied.rowCount)throw changed();}
   // Volunteers are free; no CG09 membership refund or fee ledger is created.
   await this.event(tx,a,c.id,action==="APPROVE"?"FINAL_APPROVED":next);
   return {reference:c.case_number,status:next,revision:c.revision+1,replayed:false};
  });
 }
}
