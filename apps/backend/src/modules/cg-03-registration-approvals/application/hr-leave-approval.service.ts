import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrLeaveSourceFacade,leaveId,type LeaveSubmission} from "../../cg-10-human-resources/application/hr-leave-source.facade";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Case={id:string;case_number:string;process_id:string;status:string;revision:number;current_step:number;
 proposer_id:string;hr_leave_request_id:string;hr_leave_source_digest:string;account_name_snapshot:string};
function decision(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["requestKey","expectedRevision","action","currentPassword"].includes(k)))
  throw new BadRequestException({code:"CG10_LEAVE_DECISION_INVALID"});
 const v=body as Record<string,unknown>;
 if(!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<1||typeof v.action!=="string"||!["APPROVE","RETURN","REJECT"].includes(v.action)||
    typeof v.currentPassword!=="string"||v.currentPassword.length<8||Buffer.byteLength(v.currentPassword,"utf8")>1024)
  throw new BadRequestException({code:"CG10_LEAVE_DECISION_INVALID"});
 return {requestKey:leaveId(v.requestKey),expected:Number(v.expectedRevision),
  action:v.action as "APPROVE"|"RETURN"|"REJECT",password:v.currentPassword};
}
@Injectable()
export class HrLeaveApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:HrLeaveSourceFacade){}
 /** All submissions hold the Foundation root lock before employee and case locks,
  * matching the existing process-version creation convention. */
 async create(tx:PoolClient,actor:VerifiedFoundationActor,submission:LeaveSubmission){
  const row=await this.source.original(tx,actor.realmId,submission.requestRef);
  if(row.submitted_by!==actor.accountId||row.source_digest!==submission.sourceDigest||row.request_key!==submission.requestKey||
     row.case_ref||row.status!=="SUBMITTED")
   throw new ConflictException({code:"CG10_LEAVE_STALE"});
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const existing=await tx.query<{id:string}>(`SELECT id FROM cg03_process WHERE realm_id=$1 AND process_kind='LEAVE_REQUEST' FOR SHARE`,[actor.realmId]);
  let process=existing.rows[0]?.id;
  if(!process){
   const ver=await tx.query<{next:number}>(`SELECT COALESCE(MAX(version),0)+1 AS next FROM cg03_process WHERE realm_id=$1`,[actor.realmId]);
   const made=await tx.query<{id:string}>(`INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind)
    VALUES($1,$2,NULL,$3,'LEAVE_REQUEST') RETURNING id`,[actor.realmId,ver.rows[0].next,actor.accountId]);
   process=made.rows[0].id;
   await tx.query(`INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
    VALUES($1,1,'approvals.review',true)`,[process]);
  }
  const c=await tx.query<Case>(`INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,
    target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,
    proposal_revision,proposal_digest,request_digest,request_key,case_kind,hr_leave_request_id,hr_leave_source_digest)
   SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,
    NULL,NULL,$3,'Employee leave',NULL,NULL,1,$4,$5,$6,'LEAVE_REQUEST',$7,$4
    FROM cg03_process p WHERE p.realm_id=$1 AND p.id=$8 AND p.process_kind='LEAVE_REQUEST' RETURNING *`,
   [actor.realmId,actor.accountId,row.employee_name,row.source_digest,hash(["CG10_LEAVE",row.id,row.source_digest]),
    submission.requestKey,row.id,process]);
  if(!c.rows[0])throw new ConflictException({code:"CG10_LEAVE_STALE"});
  await this.event(tx,actor,c.rows[0].id,"SUBMITTED");
  return {caseRef:c.rows[0].id,reference:c.rows[0].case_number,status:c.rows[0].status};
 }
 async current(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,request:string){
  const c=await tx.query<Case>(`SELECT id,case_number,status FROM cg03_case WHERE realm_id=$1 AND id=$2 AND proposer_id=$3
    AND case_kind='LEAVE_REQUEST' AND hr_leave_request_id=$4`,[actor.realmId,ref,actor.accountId,request]);
  if(!c.rows[0])throw new ConflictException({code:"CG10_LEAVE_STALE"});
  return {caseRef:c.rows[0].id,reference:c.rows[0].case_number,status:c.rows[0].status};
 }
 private async event(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,action:string){
  await tx.query(`INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref)
    VALUES($1,$2,$3,$4,1,$5)`,[actor.realmId,ref,actor.accountId,action,randomUUID()]);
 }
 private async reviewer(token:string){
  await this.sessions.requireAction(token,"hr.leave.review");
  return this.sessions.requireAction(token,"approvals.review");
 }
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");
   const out=await fn(tx);await tx.query("COMMIT");return out;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async requireReviewer(tx:PoolClient,actor:VerifiedFoundationActor){
  await this.identity.assertCurrent(tx,actor,"hr.leave.review");
  await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
 }
 async inbox(token:string,offsetInput:unknown,statusInput:unknown){
  const actor=await this.reviewer(token),offset=Number(offsetInput??0),status=String(statusInput??"ALL");
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||
   !["ALL","SUBMITTED","IN_REVIEW","OWNER_COMPLETED","RETURNED","REJECTED"].includes(status))
   throw new BadRequestException("Check leave review filters");
  return this.run(async tx=>{
   await this.requireReviewer(tx,actor);
   const q=await tx.query<Case&{leave_type:string;start_date:string;end_date:string;half_days:number;leave_status:string}>(`
    SELECT c.id,c.case_number,c.status,c.revision,c.proposer_id,c.account_name_snapshot,
     p.leave_type,to_char(r.start_date,'YYYY-MM-DD') AS start_date,to_char(r.end_date,'YYYY-MM-DD') AS end_date,
     r.half_days,r.status AS leave_status
    FROM cg03_case c JOIN hr_leave_request r ON r.root_realm_id=c.realm_id AND r.id=c.hr_leave_request_id
     AND r.source_digest=c.hr_leave_source_digest AND r.case_ref=c.id
    JOIN hr_leave_policy p ON p.id=r.policy_id AND p.root_realm_id=r.root_realm_id
    WHERE c.realm_id=$1 AND c.case_kind='LEAVE_REQUEST' AND ($2='ALL' OR c.status=$2)
    ORDER BY c.submitted_at DESC,c.id DESC LIMIT 26 OFFSET $3`,[actor.realmId,status,offset]);
   return {items:q.rows.slice(0,25).map(c=>({caseRef:c.id,reference:c.case_number,employeeName:c.account_name_snapshot,
    caseStatus:c.status,status:c.leave_status,revision:c.revision,leaveType:c.leave_type,startDate:c.start_date,
    endDate:c.end_date,days:c.half_days/2,canReview:c.proposer_id!==actor.accountId&&["SUBMITTED","IN_REVIEW"].includes(c.status)})),
    hasMore:q.rows.length>25,offset};
  });
 }
 async detail(token:string,refInput:string){
  const actor=await this.reviewer(token),ref=leaveId(refInput);
  return this.run(async tx=>{
   await this.requireReviewer(tx,actor);
   const c=(await tx.query<Case>(`SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='LEAVE_REQUEST' FOR SHARE`,[actor.realmId,ref])).rows[0];
   if(!c)throw new NotFoundException("This leave review is unavailable");
   const row=await this.source.original(tx,actor.realmId,c.hr_leave_request_id);
   if(row.case_ref!==c.id||row.source_digest!==c.hr_leave_source_digest)throw new ConflictException({code:"CG10_LEAVE_STALE"});
   return {caseRef:c.id,reference:c.case_number,caseStatus:c.status,revision:c.revision,
    ...this.source.summary(row),reason:this.source.reason(row,actor.realmId),
    canReview:c.proposer_id!==actor.accountId&&["SUBMITTED","IN_REVIEW"].includes(c.status)};
  });
 }
 async decide(token:string,refInput:string,body:unknown){
  const actor=await this.reviewer(token),ref=leaveId(refInput),d=decision(body);
  await this.sessions.limitFoundationRootProof(actor);
  const digest=hash([d.action,d.expected]);
  return this.run(async tx=>{
   // Shared root lock keeps policy/version changes out of the exact decision.
   const root=await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR SHARE",[actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation review unavailable");
   await this.requireReviewer(tx,actor);
   const c=(await tx.query<Case>(`SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind='LEAVE_REQUEST' FOR UPDATE`,[actor.realmId,ref])).rows[0];
   if(!c)throw new NotFoundException("This leave review is unavailable");
   if(c.proposer_id===actor.accountId)throw new ForbiddenException("Another authorized Foundation reviewer must decide");
   const old=(await tx.query<{actor_id:string;request_digest:string}>(`SELECT actor_id,request_digest FROM cg03_case_decision
    WHERE realm_id=$1 AND case_id=$2 AND request_key=$3`,[actor.realmId,ref,d.requestKey])).rows[0];
   if(old){
    if(old.actor_id!==actor.accountId||old.request_digest!==digest)throw new ConflictException({code:"CG10_LEAVE_STALE"});
    return {confirmed:true,status:c.status,reference:c.case_number,replayed:true};
   }
   if(!["SUBMITTED","IN_REVIEW"].includes(c.status)||c.revision!==d.expected)
    throw new ConflictException({code:"CG10_LEAVE_STALE"});
   const row=await this.source.original(tx,actor.realmId,c.hr_leave_request_id);
   if(row.case_ref!==ref||row.source_digest!==c.hr_leave_source_digest||row.submitted_by!==c.proposer_id||row.status!=="SUBMITTED")
    throw new ConflictException({code:"CG10_LEAVE_STALE"});
   const step=await tx.query(`SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2
    AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE`,[c.process_id,c.current_step]);
   if(!step.rowCount)throw new ConflictException({code:"CG10_LEAVE_STALE"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,d.password);
   const days=d.action==="APPROVE"?await this.source.validateApproval(tx,actor.realmId,row):[];
   const next=d.action==="APPROVE"?"PENDING_OWNER":d.action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query(`UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now()
    WHERE realm_id=$1 AND id=$2 AND revision=$4`,[actor.realmId,ref,next,c.revision]);
   const record=await tx.query<{id:string}>(`INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,
    expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at)
    VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'',now()) RETURNING id`,
    [actor.realmId,ref,actor.accountId,d.action,c.revision,c.revision+1,d.requestKey,digest]);
   await this.event(tx,actor,ref,d.action==="APPROVE"?"FINAL_APPROVED":next);
   // Only the HR owner can write leave and attendance. Both effects are committed
   // with the actual CG03 decision; any failure rolls the complete transaction back.
   await this.source.applyDecision(tx,actor.realmId,row,record.rows[0].id,d.action,days);
   if(d.action==="APPROVE"){
    await tx.query(`UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now()
     WHERE realm_id=$1 AND id=$2 AND status='PENDING_OWNER'`,[actor.realmId,ref]);
    await this.event(tx,actor,ref,"OWNER_COMPLETED");
   }
   return {confirmed:true,status:d.action==="APPROVE"?"OWNER_COMPLETED":next,reference:c.case_number,replayed:false};
  });
 }
}
