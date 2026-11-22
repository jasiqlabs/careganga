import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HrEnrollmentSourceFacade,type HrFrozenSource} from "../../cg-10-human-resources/application/hr-enrollment-source.facade";
import {HrEmployeeEvidenceService} from "../../cg-19-documents-notifications/application/hr-employee-evidence.service";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type ApprovalSource={applicationRef:string;revisionRef:string;
 revisionNo:number;digest:string;requestKey:string};
type Decision={requestKey:string;expectedRevision:number;action:"APPROVE"|"RETURN"|"REJECT";
 remarks:string;currentPassword:string};
type Case={id:string;realm_id:string;case_number:string;proposer_id:string;
 hr_application_id:string;hr_revision_id:string;hr_revision_no:number;
 hr_source_digest:string;status:string;revision:number;process_id:string;
 current_step:number;account_name_snapshot:string;request_key:string;request_digest:string;
 process_version:number};
const id=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))throw new BadRequestException("Choose a valid employee review");
 return v;
};
function parseDecision(body:unknown):Decision{
 if(!body||typeof body!=="object"||Array.isArray(body))
  throw new BadRequestException("Check the employee review decision");
 const x=body as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","action","remarks",
  "currentPassword"].includes(k))||typeof x.requestKey!=="string"||!ID.test(x.requestKey)||
  !Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<1||
  !["APPROVE","RETURN","REJECT"].includes(String(x.action))||
  typeof x.currentPassword!=="string"||x.currentPassword.length<8||
  Buffer.byteLength(x.currentPassword,"utf8")>1024||
  (x.remarks!==undefined&&(typeof x.remarks!=="string"||x.remarks.length>500||
   /[\u0000-\u001f\u007f]/.test(x.remarks))))
  throw new BadRequestException("Check the employee review decision");
 return {requestKey:x.requestKey,expectedRevision:Number(x.expectedRevision),
  action:x.action as Decision["action"],remarks:typeof x.remarks==="string"?x.remarks.trim():"",
  currentPassword:x.currentPassword};
}
@Injectable()
export class HrEnrollmentApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:HrEnrollmentSourceFacade,
  private readonly files:HrEmployeeEvidenceService){}
 private async exact(tx:PoolClient,realm:string,c:Case,requireCurrent=true){
  const frozen=await this.source.frozen(tx,realm,c.hr_revision_id,
   c.hr_revision_no,c.hr_source_digest,requireCurrent);
  if(frozen.applicationRef!==c.hr_application_id||
   frozen.proposerRef!==c.proposer_id)
   throw new ConflictException("The original employee submission does not match");
  for(const file of frozen.files){
   if(!file||!ID.test(file.fileRef)||!Number.isSafeInteger(file.fileVersion)||
    !["HR_IDENTITY_PROOF","HR_PAN_PROOF","HR_QUALIFICATION","HR_PORTRAIT"].includes(file.classification))
    throw new ConflictException("Original employee documents cannot be verified");
   await this.files.prove(tx,realm,frozen.applicationRef,frozen.revisionNo,
    file.fileRef,file.classification as "HR_IDENTITY_PROOF"|"HR_PAN_PROOF"|"HR_QUALIFICATION"|"HR_PORTRAIT",
    file.fileVersion);
  }
  if(!frozen.files.some(x=>x.classification==="HR_IDENTITY_PROOF"))
   throw new ConflictException("Verified identity evidence is required before review");
  return frozen;
 }
 async processStatus(token:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.review");
  const r=await this.db.query(
   "SELECT 1 FROM cg03_hr_process_current c JOIN cg03_process p "+
   "ON p.id=c.process_id AND p.realm_id=c.realm_id "+
   "WHERE c.realm_id=$1 AND p.process_kind='EMPLOYEE_ENROLLMENT'",
   [actor.realmId]);
  return {configured:!!r.rowCount};
 }
 /** Only original protected process-manager authority can establish the
  * Foundation reviewer workflow, with fresh authentication evidence.
  */
 async initializeProcess(token:string,body:unknown){
  const actor=await this.sessions.requireAction(token,"approvals.process.manage");
  await this.sessions.requireAction(token,"hr.employees.review");
  if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body as Record<string,unknown>).some(k=>k!=="currentPassword")||
   typeof (body as {currentPassword?:unknown}).currentPassword!=="string")
   throw new BadRequestException("Enter your current password to configure reviews");
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const root=await tx.query(
    "SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",
    [actor.realmId]);
   if(!root.rowCount)throw new ForbiddenException("Foundation review root unavailable");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.identity.assertCurrent(tx,actor,"approvals.process.manage");
   await this.identity.assertCurrent(tx,actor,"hr.employees.review");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,
    (body as {currentPassword:string}).currentPassword);
   const existing=await tx.query(
    "SELECT 1 FROM cg03_hr_process_current WHERE realm_id=$1 FOR SHARE",
    [actor.realmId]);
   if(existing.rowCount){await tx.query("COMMIT");return {configured:true,replayed:true};}
   const version=await tx.query<{next:number}>(
    "SELECT COALESCE(MAX(version),0)+1 AS next FROM cg03_process WHERE realm_id=$1",
    [actor.realmId]);
   const added=await tx.query<{id:string}>(
    "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
    "configured_by,process_kind) VALUES($1,$2,NULL,$3,'EMPLOYEE_ENROLLMENT') "+
    "RETURNING id",
    [actor.realmId,version.rows[0].next,actor.accountId]);
   await tx.query(
    "INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) "+
    "VALUES($1,1,'approvals.review',true)",[added.rows[0].id]);
   await tx.query(
    "INSERT INTO cg03_hr_process_current(realm_id,process_id) VALUES($1,$2)",
    [actor.realmId,added.rows[0].id]);
   await tx.query("COMMIT");
   return {configured:true,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }

 /** Reuse original CG03 process, immutable case, decisions and event master.
  * Called with the caller's original HR draft transaction (not a separate request).
  */
 async createCase(tx:PoolClient,actor:VerifiedFoundationActor,input:ApprovalSource){
  id(input.applicationRef);id(input.revisionRef);id(input.requestKey);
  if(!Number.isSafeInteger(input.revisionNo)||input.revisionNo<1||!SHA.test(input.digest))
   throw new BadRequestException("Check the submitted employee revision");
  await this.identity.assertCurrent(tx,actor,"hr.applications.manage");
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const frozen=await this.source.frozen(tx,actor.realmId,input.revisionRef,
   input.revisionNo,input.digest);
  if(frozen.applicationRef!==input.applicationRef||frozen.proposerRef!==actor.accountId)
   throw new ForbiddenException("This employee submission is assigned to another person");
  for(const file of frozen.files){
   await this.files.prove(tx,actor.realmId,input.applicationRef,input.revisionNo,
    file.fileRef,file.classification as "HR_IDENTITY_PROOF"|"HR_PAN_PROOF"|"HR_QUALIFICATION"|"HR_PORTRAIT",
    file.fileVersion);
  }
  if(!frozen.files.some(f=>f.classification==="HR_IDENTITY_PROOF"))
   throw new ConflictException("Verify employee identity evidence before submitting");
  const current=await tx.query<{id:string}>(
   "SELECT p.id FROM cg03_hr_process_current c "+
   "JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id "+
   "WHERE c.realm_id=$1 AND p.process_kind='EMPLOYEE_ENROLLMENT' FOR SHARE OF p",
   [actor.realmId]);
  const process=current.rows[0]?.id;
  if(!process)throw new ConflictException(
   "An authorized Foundation officer must configure employee reviews before submission");
  const requestDigest=hash(["CG10_EMPLOYEE_ENROLLMENT",input]);
  const prior=await tx.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='EMPLOYEE_ENROLLMENT' "+
   "AND hr_revision_id=$2 FOR SHARE",[actor.realmId,input.revisionRef]);
  if(prior.rows[0]){
   if(prior.rows[0].request_digest!==requestDigest||
    prior.rows[0].request_key!==input.requestKey||
    prior.rows[0].proposer_id!==actor.accountId)
    throw new ConflictException("This employee revision is already under review");
   return {caseRef:prior.rows[0].id,reference:prior.rows[0].case_number,replayed:true};
  }
  const c=await tx.query<Case>(
   "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,"+
   "target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
   "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
   "request_digest,request_key,case_kind,hr_application_id,hr_revision_id,"+
   "hr_revision_no,hr_source_digest) "+
   "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
   "p.id,p.version,$2,NULL,NULL,$3,'Employee enrollment',NULL,NULL,$4,$5,$6,$7,"+
   "'EMPLOYEE_ENROLLMENT',$8,$9,$10,$11 FROM cg03_process p WHERE p.id=$12 RETURNING *",
   [actor.realmId,actor.accountId,frozen.source.legal_name,input.revisionNo,input.digest,
    requestDigest,input.requestKey,input.applicationRef,input.revisionRef,
    input.revisionNo,input.digest,process]);
  if(!c.rows[0])throw new ConflictException("Employee review cannot be created");
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,'SUBMITTED',1,$4)",
   [actor.realmId,c.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:c.rows[0].id,reference:c.rows[0].case_number,replayed:false};
 }
 private async reviewer(token:string){
  const actor=await this.sessions.requireAction(token,"approvals.review");
  await this.sessions.requireAction(token,"hr.employees.review");
  await this.sessions.limitFoundationRootProof(actor);
  return actor;
 }
 async inbox(token:string,offsetInput:unknown,statusInput:unknown){
  const actor=await this.reviewer(token);
  const offset=Number(offsetInput??0),status=statusInput??"ALL";
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||
   !["ALL","SUBMITTED","IN_REVIEW","PENDING_OWNER","OWNER_COMPLETED",
     "RETURNED","REJECTED"].includes(String(status)))
   throw new BadRequestException("Check employee review filters");
  const q=await this.db.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='EMPLOYEE_ENROLLMENT' "+
   "AND ($2::text='ALL' OR status=$2) "+
   "ORDER BY submitted_at DESC,id DESC LIMIT 26 OFFSET $3",
   [actor.realmId,status,offset]);
  return {items:q.rows.slice(0,25).map(c=>({caseRef:c.id,reference:c.case_number,
   name:c.account_name_snapshot,status:c.status,revision:c.revision,
   canReview:c.proposer_id!==actor.accountId&&
     ["SUBMITTED","IN_REVIEW"].includes(c.status)})),
   hasMore:q.rows.length>25,offset};
 }
 async detail(token:string,caseRef:string){
  const actor=await this.reviewer(token),ref=id(caseRef),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const q=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='EMPLOYEE_ENROLLMENT' FOR SHARE",[ref,actor.realmId]);
   const c=q.rows[0];
   if(!c)throw new NotFoundException("Employee review is unavailable");
   const frozen=await this.exact(tx,actor.realmId,c,
     ["SUBMITTED","IN_REVIEW","PENDING_OWNER"].includes(c.status));
   const events=await tx.query<{action:string;step_ordinal:number;occurred_at:Date}>(
    "SELECT action,step_ordinal,occurred_at FROM cg03_case_event WHERE realm_id=$1 AND case_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 50",[actor.realmId,c.id]);
   await tx.query("COMMIT");
   return {caseRef:c.id,reference:c.case_number,revision:c.revision,
    name:c.account_name_snapshot,status:c.status,
    designation:frozen.source.designation,employmentType:frozen.source.employment_type,
    branchRef:frozen.source.proposed_branch_ref,
    proposedJoiningDate:frozen.source.hire_date,
    evidence:frozen.files.map(f=>({classification:f.classification,verified:true})),
    timeline:events.rows.map(e=>({action:e.action,step:e.step_ordinal,occurredAt:e.occurred_at})),
    canReadProof:c.proposer_id!==actor.accountId,
    canDecide:c.proposer_id!==actor.accountId&&
      ["SUBMITTED","IN_REVIEW"].includes(c.status)};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 /** A protected reviewer reads ORIGINAL scanned source bytes via CG19 only,
  * after checking CG03 identity, different proposer and exact submitted files.
  */
 async originalProof(token:string,caseInput:string,kindInput:string){
  const actor=await this.reviewer(token),ref=id(caseInput);
  if(!["HR_IDENTITY_PROOF","HR_PAN_PROOF","HR_QUALIFICATION","HR_PORTRAIT"].includes(kindInput))
   throw new BadRequestException("Choose an original employee proof category");
  const tx=await this.db.connect();
  let file:{fileRef:string;fileVersion:number;classification:string}|undefined;
  let c:Case;
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.identity.assertCurrent(tx,actor,"hr.employees.review");
   const q=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='EMPLOYEE_ENROLLMENT' FOR SHARE",[ref,actor.realmId]);
   if(!q.rows[0])throw new NotFoundException("Original employee review unavailable");
   c=q.rows[0];
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("You cannot read your own enrollment review evidence");
   const frozen=await this.exact(tx,actor.realmId,c,
     ["SUBMITTED","IN_REVIEW","PENDING_OWNER"].includes(c.status));
   file=frozen.files.find(f=>f.classification===kindInput);
   if(!file)throw new NotFoundException("This original employee proof was not supplied");
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
  return this.files.protectedReviewRead(actor,c!.hr_application_id,c!.hr_revision_no,
   file!.fileRef,kindInput as "HR_IDENTITY_PROOF"|"HR_PAN_PROOF"|"HR_QUALIFICATION"|"HR_PORTRAIT");
 }

 async decide(token:string,caseRef:string,body:unknown){
  const actor=await this.reviewer(token),ref=id(caseRef),decision=parseDecision(body);
  const requestDigest=hash([decision.action,decision.remarks,decision.expectedRevision]);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.identity.assertCurrent(tx,actor,"hr.employees.review");
   const q=await tx.query<Case>(
    "SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 "+
    "AND case_kind='EMPLOYEE_ENROLLMENT' FOR UPDATE",[ref,actor.realmId]);
   const c=q.rows[0];
   if(!c)throw new NotFoundException("Employee approval case unavailable");
   if(c.proposer_id===actor.accountId)
    throw new ForbiddenException("Another Foundation reviewer must decide");
   const replay=await tx.query<{actor_id:string;request_digest:string;
     accepted_case_revision:number;action:string}>(
    "SELECT actor_id,request_digest,accepted_case_revision,action "+
    "FROM cg03_case_decision WHERE case_id=$1 AND request_key=$2 FOR SHARE",
    [ref,decision.requestKey]);
   if(replay.rows[0]){
    if(replay.rows[0].actor_id!==actor.accountId||
      replay.rows[0].request_digest!==requestDigest)
     throw new ConflictException("This review key was already used");
    await tx.query("COMMIT");
    return {caseRef:ref,revision:replay.rows[0].accepted_case_revision,
     status:"PREVIOUSLY_CONFIRMED",replayed:true};
   }
   if(!["SUBMITTED","IN_REVIEW"].includes(c.status)||
      c.revision!==decision.expectedRevision)
    throw new ConflictException("This employee review changed. Refresh before deciding.");
   await this.exact(tx,actor.realmId,c);
   const step=await tx.query(
    "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 "+
    "AND ordinal=$2 AND capability_key='approvals.review' "+
    "AND protected_root_required=true FOR SHARE",[c.process_id,c.current_step]);
   if(!step.rowCount)throw new ConflictException("Reviewer process is unavailable");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,decision.currentPassword);
   const next=decision.action==="APPROVE"?"PENDING_OWNER":
     decision.action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query(
    "UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() "+
    "WHERE id=$1 AND realm_id=$2 AND revision=$4",
    [c.id,actor.realmId,next,c.revision]);
   const record=await tx.query<{id:string}>(
    "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,"+
    "expected_case_revision,accepted_case_revision,request_key,request_digest,"+
    "safe_remarks,fresh_password_verified_at) "+
    "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
    [actor.realmId,c.id,actor.accountId,decision.action,c.revision,c.revision+1,
     decision.requestKey,requestDigest,decision.remarks]);
   await tx.query(
    "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) "+
    "VALUES($1,$2,$3,$4,1,$5)",
    [actor.realmId,c.id,actor.accountId,
     decision.action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
   await this.source.applyCaseDecision(tx,actor.realmId,c.hr_application_id,c.id,
    decision.action==="APPROVE"?"FINAL_APPROVED_PENDING_ACTIVATION":
      decision.action==="RETURN"?"RETURNED":"REJECTED");
   await tx.query("COMMIT");
   return {caseRef:c.id,reference:c.case_number,status:next,
    revision:c.revision+1,decisionRef:decision.action==="APPROVE"?
     record.rows[0].id:undefined,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 /** Original case + live independent protected reviewer + exact immutable
  * original file proof are required before CG10 can create employment.
  */
 async approved(tx:PoolClient,realm:string,applicationRef:string,revisionRef:string,
  revisionNo:number,digest:string,caseRef:string){
  const q=await tx.query<Case>(
   "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 "+
   "AND case_kind='EMPLOYEE_ENROLLMENT' AND hr_application_id=$3 "+
   "AND hr_revision_id=$4 AND hr_revision_no=$5 AND hr_source_digest=$6 "+
   "AND status IN('PENDING_OWNER','OWNER_COMPLETED') FOR SHARE",
   [realm,id(caseRef),id(applicationRef),id(revisionRef),revisionNo,digest]);
  const c=q.rows[0];
  if(!c)throw new ConflictException("Employee review has not been finally approved");
  const d=await tx.query<{actor_id:string}>(
   "SELECT d.actor_id FROM cg03_case_decision d "+
   "JOIN account reviewer ON reviewer.id=d.actor_id AND reviewer.realm_id=d.realm_id "+
   "AND reviewer.status='ACTIVE' "+
   "JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id "+
   "AND ar.revoked_at IS NULL "+
   "JOIN role r ON r.id=ar.role_id AND r.realm_id=reviewer.realm_id "+
   "AND r.is_protected AND r.active "+
   "WHERE d.case_id=$1 AND d.realm_id=$2 AND d.action='APPROVE' "+
   "AND d.actor_id<>$3 AND d.fresh_password_verified_at IS NOT NULL "+
   "AND d.accepted_case_revision=$4 ORDER BY d.created_at DESC LIMIT 1",
   [c.id,realm,c.proposer_id,c.revision]);
  if(!d.rowCount)throw new ConflictException("A current independent approval is required");
  await this.exact(tx,realm,c);
  return c;
 }

 /** The CG03 case owner serves current case status; CG10 supplies real branch
  * authorization first. No fake HR-controlled approval state.
  */
 async currentForSource(tx:PoolClient,realm:string,appRef:string,caseRef:string|null){
  if(!caseRef)return {status:"DRAFT",caseRef:null,reference:null,revision:0};
  const c=await tx.query<{id:string;case_number:string;status:string;revision:number}>(
   "SELECT id,case_number,status,revision FROM cg03_case "+
   "WHERE id=$1 AND realm_id=$2 AND hr_application_id=$3 "+
   "AND case_kind='EMPLOYEE_ENROLLMENT' FOR SHARE",[caseRef,realm,appRef]);
  const row=c.rows[0];
  if(!row)throw new ConflictException("The original enrollment review is unavailable");
  return {status:row.status,caseRef:row.id,
    reference:row.case_number,revision:row.revision};
 }

 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  const result=await tx.query(
   "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
   "updated_at=now() WHERE id=$1 AND realm_id=$2 AND "+
   "case_kind='EMPLOYEE_ENROLLMENT' AND status='PENDING_OWNER' RETURNING id",
   [id(caseRef),actor.realmId]);
  if(!result.rowCount)throw new ConflictException("The approved case was already finalized");
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) "+
   "VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
   [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
