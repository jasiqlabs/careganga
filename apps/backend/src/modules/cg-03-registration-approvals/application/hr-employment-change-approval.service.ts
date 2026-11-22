import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrEmploymentChangeSourceFacade,type ChangeSubmission,type ChangeRow,changeCaseKind,parseEmploymentChangeAction} from "../../cg-10-human-resources/application/hr-employment-change-source.facade";
import {leaveId} from "../../cg-10-human-resources/application/hr-leave-source.facade";
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Case={id:string;case_number:string;process_id:string;status:string;revision:number;current_step:number;
 proposer_id:string;hr_employment_change_id:string;hr_employment_change_digest:string;account_name_snapshot:string;proposal_revision:number};
function decision(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["requestKey","expectedRevision","action","currentPassword"].includes(k)))
  throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 const v=body as Record<string,unknown>;
 if(!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<1||typeof v.action!=="string"||!["APPROVE","RETURN","REJECT"].includes(v.action)||
    typeof v.currentPassword!=="string"||v.currentPassword.length<8||Buffer.byteLength(v.currentPassword,"utf8")>1024)
  throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
 return {requestKey:leaveId(v.requestKey),expected:Number(v.expectedRevision),
  action:v.action as "APPROVE"|"RETURN"|"REJECT",password:v.currentPassword};
}
@Injectable()
export class HrEmploymentChangeApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:HrEmploymentChangeSourceFacade){}
 private stale():never{throw new ConflictException({code:"CG10_CHANGE_STALE"});}
 private async event(tx:PoolClient,realm:string,actor:string,ref:string,action:string,key=randomUUID()){
  return (await tx.query<{id:string}>(`INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref)
   VALUES($1,$2,$3,$4,1,$5) RETURNING id`,[realm,ref,actor,action,key])).rows[0].id;
 }
 private exact(c:Case,row:ChangeRow){
  if(row.case_ref!==c.id||row.source_digest!==c.hr_employment_change_digest||row.revision!==c.proposal_revision||row.created_by!==c.proposer_id)this.stale();
 }
 async create(tx:PoolClient,actor:VerifiedFoundationActor,v:ChangeSubmission){
  const row=await this.source.original(tx,actor.realmId,v.requestRef,true);
  if(row.created_by!==actor.accountId||row.source_digest!==v.sourceDigest||row.revision!==v.revision||row.case_ref||row.status!=="DRAFT")this.stale();
  const kind=changeCaseKind(row.kind);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  let process=(await tx.query<{id:string}>(`SELECT id FROM cg03_process WHERE realm_id=$1 AND process_kind=$2 FOR SHARE`,[actor.realmId,kind])).rows[0]?.id;
  if(!process){
   const ver=(await tx.query<{next:number}>(`SELECT COALESCE(MAX(version),0)+1 AS next FROM cg03_process WHERE realm_id=$1`,[actor.realmId])).rows[0].next;
   process=(await tx.query<{id:string}>(`INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind)
    VALUES($1,$2,NULL,$3,$4) RETURNING id`,[actor.realmId,ver,actor.accountId,kind])).rows[0].id;
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[process]);
  }
  const c=(await tx.query<Case>(`INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,
    target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,
    proposal_revision,proposal_digest,request_digest,request_key,case_kind,hr_employment_change_id,hr_employment_change_digest)
   SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,
    NULL,NULL,$3,$10,NULL,NULL,$9,$4,$5,$6,$11,$7,$4
   FROM cg03_process p WHERE p.realm_id=$1 AND p.id=$8 AND p.process_kind=$11 RETURNING *`,
   [actor.realmId,actor.accountId,row.employee_name,row.source_digest,hash(["CG10_CHANGE",row.id,row.source_digest]),v.requestKey,row.id,process,row.revision,row.kind,kind])).rows[0];
  if(!c)this.stale();
  await this.event(tx,actor.realmId,actor.accountId,c.id,"SUBMITTED");
  return c.id;
 }
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();try{await tx.query("BEGIN");await tx.query("SET LOCAL lock_timeout='3s'");const out=await fn(tx);await tx.query("COMMIT");return out;}
  catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 private async reviewer(token:string){
  await this.sessions.requireAction(token,"hr.changes.review");return this.sessions.requireAction(token,"approvals.review");
 }
 private async currentReviewer(tx:PoolClient,actor:VerifiedFoundationActor){
  await this.identity.assertCurrent(tx,actor,"hr.changes.review");
  await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
 }
 private async root(tx:PoolClient,realm:string){
  if(!(await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[realm])).rowCount)throw new ForbiddenException("Foundation review unavailable");
 }
 private async original(tx:PoolClient,realm:string,ref:string,write=false){
  const c=(await tx.query<Case>("SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW')"+(write?" FOR UPDATE":" FOR SHARE"),[realm,ref])).rows[0];
  if(!c)throw new NotFoundException("Employment review unavailable");
  const row=await this.source.original(tx,realm,c.hr_employment_change_id,write);this.exact(c,row);return {c,row};
 }
 async inbox(token:string,offsetInput:unknown,statusInput:unknown){
  const actor=await this.reviewer(token),offset=Number(offsetInput??0),status=String(statusInput??"ALL");
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||!["ALL","SUBMITTED","IN_REVIEW","PENDING_OWNER","OWNER_COMPLETED","RETURNED","REJECTED","CANCELLED"].includes(status))throw new BadRequestException({code:"CG10_CHANGE_INVALID"});
  return this.run(async tx=>{
   await this.currentReviewer(tx,actor);
   const q=await tx.query<Case&{kind:string;reference:string;effective_date:string;change_status:string;employee_account_ref:string|null}>(`
    SELECT c.*,h.kind,h.reference,to_char(h.effective_date,'YYYY-MM-DD') AS effective_date,h.status AS change_status,e.account_ref AS employee_account_ref
    FROM cg03_case c JOIN hr_employment_change h ON h.root_realm_id=c.realm_id AND h.id=c.hr_employment_change_id
    AND h.source_digest=c.hr_employment_change_digest AND h.revision=c.proposal_revision AND h.case_ref=c.id
    JOIN hr_employee e ON e.root_realm_id=h.root_realm_id AND e.id=h.employee_id
    WHERE c.realm_id=$1 AND c.case_kind IN('HR_TRANSFER_PROMOTION','HR_EXIT_REVIEW') AND ($2='ALL' OR c.status=$2)
    ORDER BY c.submitted_at DESC,c.id DESC LIMIT 26 OFFSET $3`,[actor.realmId,status,offset]);
   return {items:q.rows.slice(0,25).map(c=>({caseRef:c.id,caseReference:c.case_number,reference:c.reference,employeeName:c.account_name_snapshot,kind:c.kind,effectiveDate:c.effective_date,status:c.change_status,caseStatus:c.status,revision:c.revision,
    canReview:c.proposer_id!==actor.accountId&&c.employee_account_ref!==actor.accountId&&["SUBMITTED","IN_REVIEW"].includes(c.status)})),offset,hasMore:q.rows.length>25};
  });
 }
 async detail(token:string,refInput:string){
  const actor=await this.reviewer(token),ref=leaveId(refInput);
  return this.run(async tx=>{
   await this.currentReviewer(tx,actor);const {c,row}=await this.original(tx,actor.realmId,ref);
   const eligible=c.proposer_id!==actor.accountId&&row.employee_account_ref!==actor.accountId;
   const detail=eligible?await this.source.privateDetail(tx,actor.realmId,row,actor.accountId):this.source.summary(row);
   return {...detail,caseRef:c.id,caseReference:c.case_number,caseStatus:c.status,revision:c.revision,clearance:await this.source.clearanceSummary(tx,actor.realmId,row),
    canReview:eligible&&["SUBMITTED","IN_REVIEW"].includes(c.status),canApply:eligible&&c.status==="PENDING_OWNER"};
  });
 }
 async decide(token:string,refInput:string,body:unknown){
  const actor=await this.reviewer(token),ref=leaveId(refInput),d=decision(body);await this.sessions.limitFoundationRootProof(actor);
  return this.run(async tx=>{
   await this.root(tx,actor.realmId);await this.currentReviewer(tx,actor);
   const {c,row}=await this.original(tx,actor.realmId,ref,true);
   if(c.proposer_id===actor.accountId||row.employee_account_ref===actor.accountId)throw new ForbiddenException("Another authorized reviewer must decide");
   const digest=hash([d.action,d.expected]);
   const old=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[actor.realmId,ref,d.requestKey])).rows[0];
   if(old){if(old.actor_id!==actor.accountId||old.request_digest!==digest)this.stale();return {confirmed:true,status:c.status,reference:c.case_number,replayed:true};}
   if(!["SUBMITTED","IN_REVIEW"].includes(c.status)||c.revision!==d.expected||row.status!=="SUBMITTED")this.stale();
   if(!(await tx.query("SELECT 1 FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2 AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step])).rowCount)this.stale();
   await this.sessions.requireFreshFoundationRootProof(tx,actor,d.password);
   if(d.action==="APPROVE")await this.source.validateApproval(tx,actor.realmId,row);
   const next=d.action==="APPROVE"?"PENDING_OWNER":d.action==="RETURN"?"RETURNED":"REJECTED";
   if(!(await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4 RETURNING id",[actor.realmId,ref,next,c.revision])).rowCount)this.stale();
   const rec=(await tx.query<{id:string}>(`INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at)
    VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'',now()) RETURNING id`,[actor.realmId,ref,actor.accountId,d.action,c.revision,c.revision+1,d.requestKey,digest])).rows[0];
   await this.event(tx,actor.realmId,actor.accountId,ref,d.action==="APPROVE"?"FINAL_APPROVED":next);
   await this.source.applyDecision(tx,actor.realmId,row,rec.id,actor.accountId,d.action);
   return {confirmed:true,status:next,reference:c.case_number,replayed:false};
  });
 }
 async withdraw(tx:PoolClient,actor:VerifiedFoundationActor,ref:string,body:unknown){
  const x=parseEmploymentChangeAction(body),row=await this.source.requesterRow(tx,actor,ref),digest=hash(["WITHDRAW",ref,x]);
  if(!row.case_ref||row.revision!==x.expectedRevision)this.stale();
  const {c}=await this.original(tx,actor.realmId,row.case_ref,true);
  if(row.status==="WITHDRAWN"&&c.status==="CANCELLED"&&row.last_command_key===x.requestKey&&row.last_command_digest===digest)return {withdrawn:true,replayed:true};
  if(row.status!=="SUBMITTED"||!["SUBMITTED","IN_REVIEW"].includes(c.status)||c.proposer_id!==actor.accountId)this.stale();
  if(!(await tx.query("UPDATE cg03_case SET status='CANCELLED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$3 RETURNING id",[actor.realmId,c.id,c.revision])).rowCount)this.stale();
  const event=await this.event(tx,actor.realmId,actor.accountId,c.id,"CANCELLED",x.requestKey);
  await this.source.withdraw(tx,actor,row,event,x.requestKey,digest);return {withdrawn:true,replayed:false};
 }
 /** No effect unless actual frozen CG03 approval, due date, source and owner access still match. Root lock belongs to caller. */
 async applyDue(tx:PoolClient,realm:string,ref:string){
  const {c,row}=await this.original(tx,realm,ref,true);
  if(row.status==="APPLIED"&&c.status==="OWNER_COMPLETED")return {applied:true,replayed:true};
  if(c.status!=="PENDING_OWNER"||row.status!=="APPROVED_PENDING_EFFECT")this.stale();
  const d=(await tx.query<{actor_id:string}>(`SELECT d.actor_id FROM cg03_case_decision d JOIN account a ON a.id=d.actor_id AND a.realm_id=d.realm_id AND a.status='ACTIVE'
    JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
    JOIN role rr ON rr.id=ar.role_id AND rr.realm_id=ar.realm_id AND rr.active AND rr.is_protected
   WHERE d.realm_id=$1 AND d.case_id=$2 AND d.id=$3 AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL AND d.accepted_case_revision=$4
    AND d.actor_id<>$5 AND d.actor_id IS DISTINCT FROM $6::uuid FOR SHARE OF a,ar,rr`,[realm,c.id,row.decision_ref,c.revision,c.proposer_id,row.employee_account_ref])).rows[0];
  if(!d)this.stale();
  await this.source.applyDue(tx,realm,row,d.actor_id);
  if(!(await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND status='PENDING_OWNER' AND revision=$3 RETURNING id",[realm,c.id,c.revision])).rowCount)this.stale();
  await this.event(tx,realm,d.actor_id,c.id,"OWNER_COMPLETED");return {applied:true,replayed:false};
 }
 async applyNow(token:string,refInput:string){
  const actor=await this.reviewer(token),ref=leaveId(refInput);
  return this.run(async tx=>{await this.root(tx,actor.realmId);await this.currentReviewer(tx,actor);const {c,row}=await this.original(tx,actor.realmId,ref,true);
   if(c.proposer_id===actor.accountId||row.employee_account_ref===actor.accountId)throw new ForbiddenException("Another authorized reviewer must apply");
   return this.applyDue(tx,actor.realmId,ref);});
 }
}
