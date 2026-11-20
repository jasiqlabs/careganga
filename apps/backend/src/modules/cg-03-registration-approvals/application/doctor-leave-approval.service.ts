import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {DoctorLeaveReviewSourceFacade,type DoctorLeaveSubmission}
 from "../../cg-15-patients-appointments/application/doctor-leave-review-source.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DIGEST=/^[0-9a-f]{64}$/;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Case={id:string;case_number:string;status:string;revision:number;
 request_key:string;request_digest:string;proposer_id:string;
 health_doctor_id:string;health_center_id:string;cg15_exception_id:string;
 cg15_exception_revision:number;cg15_exception_digest:string;
 process_id:string;current_step:number;account_name_snapshot:string};
function action(body:unknown){
 if(!body||typeof body!=="object"||Array.isArray(body))
  throw new BadRequestException({code:"CG15_LEAVE_DECISION_INVALID"});
 const x=body as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","action",
  "remarks","currentPassword"].includes(k))||
   !ID.test(String(x.requestKey))||!Number.isSafeInteger(x.expectedRevision)||
   Number(x.expectedRevision)<1||
   !["APPROVE","RETURN","REJECT"].includes(String(x.action))||
   typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   Buffer.byteLength(x.currentPassword,"utf8")>1024||
   (x.remarks!==undefined&&(typeof x.remarks!=="string"||
    x.remarks.length>500||/[\u0000-\u001f\u007f<>]/.test(x.remarks))))
  throw new BadRequestException({code:"CG15_LEAVE_DECISION_INVALID"});
 return {requestKey:String(x.requestKey),expected:Number(x.expectedRevision),
  result:String(x.action) as "APPROVE"|"RETURN"|"REJECT",
  remarks:typeof x.remarks==="string"?x.remarks.trim():"",
  currentPassword:x.currentPassword};
}
/** Original CG03 case/approval; CG15 supplies frozen leave source and applies
 * accepted decision once. A creator can never act as final reviewer. */
@Injectable()
export class DoctorLeaveApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:DoctorLeaveReviewSourceFacade){}
 async create(tx:PoolClient,actor:VerifiedFoundationActor,request:DoctorLeaveSubmission){
  if(request.kind!=="CG15_DOCTOR_LEAVE"||
    ![request.doctorRef,request.centerRef,request.exceptionRef,request.requestKey]
     .every(x=>ID.test(x))||
    !Number.isSafeInteger(request.revisionNo)||request.revisionNo!==1||
    !DIGEST.test(request.digest))
   throw new BadRequestException({code:"CG15_LEAVE_INVALID"});
  const proof=await this.source.original(tx,actor,request);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const root=await tx.query(
   "SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
   [actor.realmId]);
  if(!root.rowCount)throw new ForbiddenException("Protected leave review unavailable");
  const configured=await tx.query<{process_id:string}>(
   "SELECT process_id FROM cg03_health_process_current WHERE realm_id=$1 "+
   "AND case_kind='CG15_DOCTOR_LEAVE' FOR SHARE",[actor.realmId]);
  let process=configured.rows[0]?.process_id;
  if(!process){
   const next=await tx.query<{version:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS version FROM cg03_process "+
    "WHERE realm_id=$1",[actor.realmId]);
   const created=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'CG15_DOCTOR_LEAVE') "+
    "RETURNING id",[actor.realmId,Number(next.rows[0].version),actor.accountId]);
   await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
    "protected_root_required) VALUES($1,1,'approvals.review',true)",
    [created.rows[0].id]);
   await tx.query("INSERT INTO cg03_health_process_current(realm_id,case_kind,process_id) "+
    "VALUES($1,'CG15_DOCTOR_LEAVE',$2)",[actor.realmId,created.rows[0].id]);
   process=created.rows[0].id;
  }
  const signature=hash(["CG03_CG15_DOCTOR_LEAVE_V1",request]);
  const old=await tx.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND "+
   "case_kind='CG15_DOCTOR_LEAVE' AND cg15_exception_id=$2 FOR SHARE",
   [actor.realmId,request.exceptionRef]);
  if(old.rows[0]){
   const c=old.rows[0];
   if(c.proposer_id!==actor.accountId||c.request_key!==request.requestKey||
     c.request_digest!==signature)
    throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   return {caseRef:c.id,reference:c.case_number,replayed:true};
  }
  const made=await tx.query<Case>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
   "proposer_id,target_account_id,target_role_id,account_name_snapshot,"+
   "role_name_snapshot,expected_access_version,expected_role_revision,"+
   "proposal_revision,proposal_digest,request_digest,request_key,case_kind,"+
   "health_doctor_id,health_center_id,cg15_exception_id,"+
   "cg15_exception_revision,cg15_exception_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "p.id,p.version,$2,NULL,NULL,$3,'Doctor leave',NULL,NULL,"+
   "$4,$5,$6,$7,'CG15_DOCTOR_LEAVE',$8,$9,$10,$11,$12 "+
   "FROM cg03_process p WHERE p.id=$13 RETURNING *",
   [actor.realmId,actor.accountId,("Doctor leave · "+proof.doctorName).slice(0,160),
    request.revisionNo,request.digest,signature,request.requestKey,
    request.doctorRef,request.centerRef,request.exceptionRef,request.revisionNo,
    request.digest,process]);
  const c=made.rows[0];
  if(!c)throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,c.id,actor.accountId,randomUUID()]);
  return {caseRef:c.id,reference:c.case_number,replayed:false};
 }
 private sourceFrom(c:Case):DoctorLeaveSubmission{
  return {kind:"CG15_DOCTOR_LEAVE",doctorRef:c.health_doctor_id,
   centerRef:c.health_center_id,exceptionRef:c.cg15_exception_id,
   revisionNo:c.cg15_exception_revision,digest:c.cg15_exception_digest,
   requestKey:c.request_key};
 }
 private async reviewer(token:string){
  await this.sessions.requireAction(token,"health.schedules.view");
  return this.sessions.requireAction(token,"approvals.review");
 }
 private async run<T>(fn:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();let begun=false;
  try{
   await tx.query("BEGIN");begun=true;
   await tx.query("SET LOCAL lock_timeout='3s'");
   const output=await fn(tx);
   await tx.query("COMMIT");begun=false;return output;
  }catch(e){if(begun)try{await tx.query("ROLLBACK");}catch{};throw e;}
  finally{tx.release();}
 }
 async inbox(token:string){
  const actor=await this.reviewer(token);
  return this.run(async tx=>{
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const rows=await tx.query<Case>(
    "SELECT id,case_number,status,revision,account_name_snapshot FROM cg03_case "+
    "WHERE realm_id=$1 AND case_kind='CG15_DOCTOR_LEAVE' "+
    "ORDER BY submitted_at DESC,id DESC LIMIT 50",[actor.realmId]);
   return {cases:rows.rows.map(c=>({caseRef:c.id,reference:c.case_number,
    status:c.status,revision:c.revision,title:c.account_name_snapshot}))};
  });
 }
 async detail(token:string,caseRef:string){
  if(!ID.test(caseRef))throw new BadRequestException({code:"CG15_LEAVE_INVALID"});
  const actor=await this.reviewer(token);
  return this.run(async tx=>{
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const read=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG15_DOCTOR_LEAVE'",[actor.realmId,caseRef]);
   const first=read.rows[0];
   if(!first)throw new NotFoundException("Original doctor leave review unavailable");
   const proof=["SUBMITTED","IN_REVIEW","PENDING_OWNER"].includes(first.status)?
    await this.source.original(tx,actor,this.sourceFrom(first)):null;
   if(proof&&proof.originalCaseRef!==caseRef)
    throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   const current=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG15_DOCTOR_LEAVE' FOR SHARE",[actor.realmId,caseRef]);
   const c=current.rows[0];
   if(!c||c.cg15_exception_id!==first.cg15_exception_id||
     c.cg15_exception_digest!==first.cg15_exception_digest||
     c.cg15_exception_revision!==first.cg15_exception_revision||
     c.status!==first.status)
    throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   return {caseRef:c.id,reference:c.case_number,status:c.status,
    revision:c.revision,title:c.account_name_snapshot,
    ...(proof?{doctorName:proof.doctorName,startAt:proof.startAt,
     endAt:proof.endAt,reason:proof.reason}:{}),
    requiresIndependentReviewer:true};
  });
 }
 async decide(token:string,caseRef:string,raw:unknown){
  const input=action(raw),actor=await this.reviewer(token);
  if(!ID.test(caseRef))throw new BadRequestException({code:"CG15_LEAVE_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const signature=hash([input.result,input.remarks,input.expected]);
  return this.run(async tx=>{
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const firstRows=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG15_DOCTOR_LEAVE'",[actor.realmId,caseRef]);
   const snap=firstRows.rows[0];
   if(!snap)throw new NotFoundException("Original doctor leave unavailable");
   await this.identity.assertCurrent(tx,actor,"health.schedules.view");
   if(!["SUBMITTED","IN_REVIEW"].includes(snap.status)){
    const replay=await tx.query<{actor_id:string;request_digest:string;
      accepted_case_revision:number}>(
     "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
     "WHERE realm_id=$1 AND case_id=$2 AND request_key=$3 FOR SHARE",
     [actor.realmId,caseRef,input.requestKey]);
    if(replay.rows[0]&&replay.rows[0].actor_id===actor.accountId&&
      replay.rows[0].request_digest===signature)
     return {caseRef,status:"PREVIOUSLY_CONFIRMED",
      revision:replay.rows[0].accepted_case_revision,replayed:true};
    throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   }
   const pinned=await this.source.original(tx,actor,this.sourceFrom(snap));
   if(pinned.originalCaseRef!==caseRef)
    throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   const locked=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
    "AND case_kind='CG15_DOCTOR_LEAVE' FOR UPDATE",[actor.realmId,caseRef]);
   const c=locked.rows[0];
   if(!c||c.cg15_exception_id!==snap.cg15_exception_id||
     c.cg15_exception_digest!==snap.cg15_exception_digest||
     c.cg15_exception_revision!==snap.cg15_exception_revision||
     c.proposer_id===actor.accountId)
    throw new ForbiddenException("A different authorized Foundation reviewer is required");
   const old=await tx.query<{actor_id:string;request_digest:string;
     accepted_case_revision:number}>(
    "SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision "+
    "WHERE realm_id=$1 AND case_id=$2 AND request_key=$3 FOR SHARE",
    [actor.realmId,caseRef,input.requestKey]);
   if(old.rows[0]){
    if(old.rows[0].actor_id!==actor.accountId||old.rows[0].request_digest!==signature)
     throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
    return {caseRef,status:"PREVIOUSLY_CONFIRMED",
     revision:old.rows[0].accepted_case_revision,replayed:true};
   }
   if(c.revision!==input.expected||
      !["SUBMITTED","IN_REVIEW"].includes(c.status))
    throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 "+
    "AND ordinal=$2 AND capability_key='approvals.review' "+
    "AND protected_root_required=true FOR SHARE",
    [c.process_id,c.current_step]);
   if(!step.rowCount)throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   await this.sessions.requireFreshFoundationRootProof(tx,actor,input.currentPassword);
   const target=input.result==="APPROVE"?"PENDING_OWNER":
    input.result==="RETURN"?"RETURNED":"REJECTED";
   const updated=await tx.query(
    "UPDATE cg03_case SET status=$3,revision=revision+1,"+
    "updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4 RETURNING id",
    [actor.realmId,caseRef,target,c.revision]);
   if(!updated.rowCount)throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
   const decision=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
    "step_ordinal,expected_case_revision,accepted_case_revision,request_key,"+
    "request_digest,safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,caseRef,actor.accountId,input.result,c.revision,
     c.revision+1,input.requestKey,signature,input.remarks]);
   await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
    "action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,caseRef,actor.accountId,
     input.result==="APPROVE"?"FINAL_APPROVED":target,randomUUID()]);
   return {caseRef,status:target,revision:c.revision+1,
    decisionRef:input.result==="APPROVE"?decision.rows[0].id:null,replayed:false};
  });
 }
 async approved(tx:PoolClient,actor:VerifiedFoundationActor,
  input:DoctorLeaveSubmission&{caseRef:string}){
  const rows=await tx.query<{decision_ref:string}>(
   "SELECT decision.id AS decision_ref FROM cg03_case c "+
   "JOIN cg03_case_decision decision ON decision.realm_id=c.realm_id "+
   "AND decision.case_id=c.id AND decision.action='APPROVE' "+
   "AND decision.actor_id<>c.proposer_id "+
   "AND decision.fresh_password_verified_at IS NOT NULL "+
   "WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='CG15_DOCTOR_LEAVE' "+
   "AND c.health_center_id=$3 AND c.health_doctor_id=$4 "+
   "AND c.cg15_exception_id=$5 AND c.cg15_exception_revision=$6 "+
   "AND c.cg15_exception_digest=$7 AND c.status='PENDING_OWNER' "+
   "AND EXISTS(SELECT 1 FROM account reviewer "+
   "JOIN account_role ar ON ar.account_id=reviewer.id "+
   "AND ar.realm_id=reviewer.realm_id AND ar.revoked_at IS NULL "+
   "JOIN role r ON r.id=ar.role_id AND r.realm_id=reviewer.realm_id "+
   "WHERE reviewer.id=decision.actor_id AND reviewer.realm_id=c.realm_id "+
   "AND reviewer.status='ACTIVE' AND r.active AND r.is_protected) "+
   "ORDER BY decision.created_at DESC,decision.id DESC LIMIT 1 FOR SHARE OF c,decision",
   [actor.realmId,input.caseRef,input.centerRef,input.doctorRef,
    input.exceptionRef,input.revisionNo,input.digest]);
  if(!rows.rows[0])throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  return rows.rows[0].decision_ref;
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  const changed=await tx.query(
   "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
   "updated_at=now() WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='CG15_DOCTOR_LEAVE' AND status='PENDING_OWNER' RETURNING id",
   [actor.realmId,caseRef]);
  if(!changed.rowCount)throw new ConflictException({code:"CG15_LEAVE_SOURCE_CHANGED"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,"+
   "action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
