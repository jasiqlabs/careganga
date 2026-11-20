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
import {HealthReviewSourceFacade,type HealthSubmission,type HealthReviewKind}
 from "../../cg-14-healthcare-network/application/health-review-source.facade";
import {HealthDoctorReviewSourceFacade,type DoctorSubmission}
 from "../../cg-14-healthcare-network/application/health-doctor-review-source.facade";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const KINDS:HealthReviewKind[]=[
 "HEALTH_PROVIDER_VERIFICATION","HEALTH_CENTER_VERIFICATION"
];
type CaseRow={
 id:string;realm_id:string;case_number:string;case_kind:HealthReviewKind|"HEALTH_DOCTOR_VERIFICATION";
 process_id:string;process_version:number;current_step:number;proposer_id:string;
 health_provider_id:string;health_center_id:string|null;
 health_provider_revision_id:string|null;health_center_revision_id:string|null;
 health_doctor_id:string|null;health_doctor_revision_id:string|null;
 health_revision_no:number;health_source_digest:string;
 revision:number;status:string;request_key:string;request_digest:string;
};
type Decision={
 requestKey:string;expectedRevision:number;action:"APPROVE"|"RETURN"|"REJECT";
 remarks:string;currentPassword:string
};
const parseDecision=(value:unknown):Decision=>{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","action","remarks","currentPassword"].includes(k))||
  !ID.test(String(x.requestKey))||!Number.isSafeInteger(x.expectedRevision)||
  Number(x.expectedRevision)<1||!["APPROVE","RETURN","REJECT"].includes(String(x.action))||
  (x.remarks!==undefined&&(typeof x.remarks!=="string"||x.remarks.length>500))||
  typeof x.currentPassword!=="string"||x.currentPassword.length<8||
  Buffer.byteLength(x.currentPassword,"utf8")>1024)
  throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
 const remarks=typeof x.remarks==="string"?x.remarks.trim():"";
 if(/[\u0000-\u001f\u007f]/.test(remarks))
  throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
 return {requestKey:x.requestKey as string,expectedRevision:Number(x.expectedRevision),
   action:x.action as Decision["action"],remarks,currentPassword:x.currentPassword};
};
@Injectable()
export class HealthVerificationApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly source:HealthReviewSourceFacade,
  private readonly doctorSource:HealthDoctorReviewSourceFacade){}
 /** Genuine CG-03 case. Caller CG-14 already pinned the immutable submitted
  * original revision and CG-19 proof inside its current transaction.
  */
 async createCase(tx:PoolClient,actor:VerifiedFoundationActor,input:HealthSubmission){
  if(!KINDS.includes(input.kind)||!ID.test(input.providerRef)||
   (input.centerRef!==null&&!ID.test(input.centerRef))||
   !ID.test(input.revisionRef)||!ID.test(input.requestKey)||
   !Number.isSafeInteger(input.revisionNo)||input.revisionNo<1||
   !DIGEST.test(input.digest))
    throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const original=await this.source.original(tx,actor,input);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const lock=await tx.query("SELECT id FROM access_realm "+
    "WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
  if(!lock.rowCount)throw new ForbiddenException("Foundation unavailable");
  const curr=await tx.query<{process_id:string}>(
    "SELECT process_id FROM cg03_health_process_current "+
    "WHERE realm_id=$1 AND case_kind=$2 FOR SHARE",[actor.realmId,input.kind]);
  let process=curr.rows[0]?.process_id;
  if(!process){
    const version=await tx.query<{v:number}>(
      "SELECT COALESCE(MAX(version),0)+1 AS v FROM cg03_process WHERE realm_id=$1",
      [actor.realmId]);
    const inserted=await tx.query<{id:string}>(
      "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
      "configured_by,process_kind) VALUES($1,$2,NULL,$3,$4) RETURNING id",
      [actor.realmId,version.rows[0].v,actor.accountId,input.kind]);
    await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
      "protected_root_required) VALUES($1,1,'approvals.review',true)",
      [inserted.rows[0].id]);
    await tx.query("INSERT INTO cg03_health_process_current(realm_id,case_kind,process_id) "+
      "VALUES($1,$2,$3)",[actor.realmId,input.kind,inserted.rows[0].id]);
    process=inserted.rows[0].id;
  }
  const requestDigest=hash(["CG03_HEALTH_VERIFY_V1",input.kind,input.providerRef,
    input.centerRef,input.revisionRef,input.revisionNo,input.digest,input.requestKey]);
  const previous=await tx.query<CaseRow>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind=$2 "+
    "AND health_provider_id=$3 AND health_center_id IS NOT DISTINCT FROM $4::uuid "+
    "AND health_revision_no=$5 FOR SHARE",
    [actor.realmId,input.kind,input.providerRef,input.centerRef,input.revisionNo]);
  if(previous.rows[0]){
    const prior=previous.rows[0];
    if(prior.proposer_id!==actor.accountId||prior.request_key!==input.requestKey||
       prior.request_digest!==requestDigest)
      throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
    return {caseRef:prior.id,caseNumber:prior.case_number,replayed:true};
  }
  const label=String(original.sourceSnapshot.displayName??
    original.sourceSnapshot.legalName??original.title).slice(0,160);
  const created=await tx.query<CaseRow>(
    "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
    "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
    "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
    "request_digest,request_key,case_kind,health_provider_id,health_center_id,"+
    "health_provider_revision_id,health_center_revision_id,health_revision_no,health_source_digest) "+
    "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
    "p.id,p.version,$2,NULL,NULL,$3,'Healthcare review',NULL,NULL,$4,$5,$6,$7,"+
    "$8,$9,$10,$11,$12,$13,$14 FROM cg03_process p WHERE p.id=$15 RETURNING *",
    [actor.realmId,actor.accountId,label,input.revisionNo,input.digest,
     requestDigest,input.requestKey,input.kind,input.providerRef,input.centerRef,
     input.kind==="HEALTH_PROVIDER_VERIFICATION"?input.revisionRef:null,
     input.kind==="HEALTH_CENTER_VERIFICATION"?input.revisionRef:null,
     input.revisionNo,input.digest,process]);
  if(!created.rows[0])throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
    [actor.realmId,created.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:created.rows[0].id,caseNumber:created.rows[0].case_number,
    replayed:false};
 }
 /** CG-03 owns the case, process and final decision; CG-14 only supplies
  * a frozen professional revision linked to the original CG-19 licence.
  */
 async createDoctorCase(tx:PoolClient,actor:VerifiedFoundationActor,input:DoctorSubmission){
  if(input.kind!=="HEALTH_DOCTOR_VERIFICATION"||
    !ID.test(input.doctorRef)||!ID.test(input.revisionRef)||
    !ID.test(input.requestKey)||!Number.isSafeInteger(input.revisionNo)||
    input.revisionNo<1||!DIGEST.test(input.digest))
    throw new BadRequestException({code:"HEALTH_DOCTOR_REVIEW_INVALID"});
  const original=await this.doctorSource.original(tx,actor,input);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,actor.realmId,actor.accountId);
  const lock=await tx.query("SELECT id FROM access_realm "+
    "WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[actor.realmId]);
  if(!lock.rowCount)throw new ForbiddenException("Foundation unavailable");
  const current=await tx.query<{process_id:string}>(
    "SELECT process_id FROM cg03_health_process_current "+
    "WHERE realm_id=$1 AND case_kind=$2 FOR SHARE",[actor.realmId,input.kind]);
  let process=current.rows[0]?.process_id;
  if(!process){
    const version=await tx.query<{v:number}>(
      "SELECT COALESCE(MAX(version),0)+1 AS v FROM cg03_process WHERE realm_id=$1",
      [actor.realmId]);
    const row=await tx.query<{id:string}>(
      "INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,"+
      "configured_by,process_kind) VALUES($1,$2,NULL,$3,$4) RETURNING id",
      [actor.realmId,version.rows[0].v,actor.accountId,input.kind]);
    await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,"+
      "protected_root_required) VALUES($1,1,'approvals.review',true)",[row.rows[0].id]);
    await tx.query("INSERT INTO cg03_health_process_current(realm_id,case_kind,process_id) "+
      "VALUES($1,$2,$3)",[actor.realmId,input.kind,row.rows[0].id]);
    process=row.rows[0].id;
  }
  const requestDigest=hash(["CG03_HEALTH_DOCTOR_VERIFY_V1",input.kind,
    input.doctorRef,input.revisionRef,input.revisionNo,input.digest,input.requestKey]);
  const previous=await tx.query<CaseRow>(
    "SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind=$2 "+
    "AND health_doctor_id=$3 AND health_revision_no=$4 FOR SHARE",
    [actor.realmId,input.kind,input.doctorRef,input.revisionNo]);
  if(previous.rows[0]){
    const prior=previous.rows[0];
    if(prior.proposer_id!==actor.accountId||
      prior.request_key!==input.requestKey||prior.request_digest!==requestDigest)
      throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
    return {caseRef:prior.id,caseNumber:prior.case_number,replayed:true};
  }
  const label=String(original.sourceSnapshot.fullName??"Doctor verification").slice(0,160);
  const created=await tx.query<CaseRow>(
    "INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,"+
    "proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,"+
    "expected_access_version,expected_role_revision,proposal_revision,proposal_digest,"+
    "request_digest,request_key,case_kind,health_doctor_id,health_doctor_revision_id,"+
    "health_revision_no,health_source_digest) "+
    "SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),"+
    "p.id,p.version,$2,NULL,NULL,$3,'Professional verification',NULL,NULL,"+
    "$4,$5,$6,$7,$8,$9,$10,$11,$12 FROM cg03_process p WHERE p.id=$13 RETURNING *",
    [actor.realmId,actor.accountId,label,input.revisionNo,input.digest,
      requestDigest,input.requestKey,input.kind,input.doctorRef,input.revisionRef,
      input.revisionNo,input.digest,process]);
  if(!created.rows[0])throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_UNAVAILABLE"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,'SUBMITTED',1,$4)",
    [actor.realmId,created.rows[0].id,actor.accountId,randomUUID()]);
  return {caseRef:created.rows[0].id,caseNumber:created.rows[0].case_number,
    replayed:false};
 }
 private async reviewer(bearer:string){
  return this.sessions.requireAction(bearer,"approvals.review");
 }
 private async requireKind(bearer:string,kind:CaseRow["case_kind"]){
  await this.sessions.requireAction(bearer,kind==="HEALTH_DOCTOR_VERIFICATION"?
    "health.doctors.verify":"health.providers.verify");
 }
 private submission(c:CaseRow):HealthSubmission{
  if(c.case_kind==="HEALTH_DOCTOR_VERIFICATION")
    throw new ConflictException({code:"HEALTH_REVIEW_SOURCE_CHANGED"});
  return {kind:c.case_kind,providerRef:c.health_provider_id,
    centerRef:c.health_center_id,
    revisionRef:c.case_kind==="HEALTH_PROVIDER_VERIFICATION"?
      c.health_provider_revision_id!:c.health_center_revision_id!,
    revisionNo:c.health_revision_no,digest:c.health_source_digest,
    requestKey:c.request_key};
 }
 private doctorSubmission(c:CaseRow):DoctorSubmission{
  if(c.case_kind!=="HEALTH_DOCTOR_VERIFICATION"||
     !c.health_doctor_id||!c.health_doctor_revision_id)
    throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED"});
  return {kind:"HEALTH_DOCTOR_VERIFICATION",doctorRef:c.health_doctor_id,
    revisionRef:c.health_doctor_revision_id,
    revisionNo:c.health_revision_no,digest:c.health_source_digest,
    requestKey:c.request_key};
 }
 async inbox(bearer:string,offset=0,status="ALL",kind="ALL",search=""){
  const actor=await this.reviewer(bearer);
  let canProviders=false,canDoctors=false;
  try{await this.sessions.requireAction(bearer,"health.providers.verify");canProviders=true;}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  try{await this.sessions.requireAction(bearer,"health.doctors.verify");canDoctors=true;}
  catch(e){if(!(e instanceof ForbiddenException))throw e;}
  if(!canProviders&&!canDoctors)
    throw new ForbiddenException("Healthcare reviewer access is unavailable");
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000||
    !["ALL","SUBMITTED","IN_REVIEW","RETURNED","REJECTED",
      "PENDING_OWNER","OWNER_COMPLETED"].includes(status)||
    !["ALL","HEALTH_PROVIDER_VERIFICATION","HEALTH_CENTER_VERIFICATION","HEALTH_DOCTOR_VERIFICATION"].includes(kind)||
    search.length>80)
    throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const tx=await this.db.connect();
  try{
    await tx.query("BEGIN");
    await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
    // These filters are applied on the ORIGINAL CG03 cases before pagination;
    // client-only filtering could hide pending records outside page 1.
    const cases=await tx.query<{id:string;case_number:string;account_name_snapshot:string;
      case_kind:string;status:string;revision:number}>(
      "SELECT id,case_number,account_name_snapshot,case_kind,status,revision "+
      "FROM cg03_case WHERE realm_id=$1 AND ( "+
      "($6::boolean AND case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION')) "+
      "OR ($7::boolean AND case_kind='HEALTH_DOCTOR_VERIFICATION')) "+
      "AND status IN('SUBMITTED','IN_REVIEW','RETURNED','REJECTED','PENDING_OWNER','OWNER_COMPLETED') "+
      "AND ($3::text='ALL' OR status=$3) "+
      "AND ($4::text='ALL' OR case_kind=$4) "+
      "AND ($5::text='' OR strpos(lower(case_number),lower($5))>0 "+
      "OR strpos(lower(account_name_snapshot),lower($5))>0) "+
      "ORDER BY submitted_at DESC,id DESC LIMIT 41 OFFSET $2",
      [actor.realmId,offset,status,kind,search.trim(),canProviders,canDoctors]);
    await tx.query("COMMIT");
    return {cases:cases.rows.slice(0,40).map(c=>({caseRef:c.id,reference:c.case_number,
      title:c.account_name_snapshot,kind:c.case_kind,status:c.status,revision:c.revision})),
      nextOffset:cases.rows.length>40?offset+40:null};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async detail(bearer:string,caseRef:string){
  const actor=await this.reviewer(bearer);
  if(!ID.test(caseRef))throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  const tx=await this.db.connect();
  try{
    await tx.query("BEGIN");
    await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
    const found=await tx.query<CaseRow>(
      "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind "+
      "IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',"+
      "'HEALTH_DOCTOR_VERIFICATION') FOR SHARE",
      [actor.realmId,caseRef]);
    const c=found.rows[0];
    if(!c)throw new NotFoundException({code:"HEALTH_REVIEW_UNAVAILABLE"});
    await this.requireKind(bearer,c.case_kind);
    let source:null|Awaited<ReturnType<HealthReviewSourceFacade["reviewSnapshot"]>>|Awaited<ReturnType<HealthDoctorReviewSourceFacade["reviewSnapshot"]>>=null;
    if(c.status==="SUBMITTED"||c.status==="IN_REVIEW")
      source=c.case_kind==="HEALTH_DOCTOR_VERIFICATION"?
        await this.doctorSource.reviewSnapshot(tx,actor,this.doctorSubmission(c)):
        await this.source.reviewSnapshot(tx,actor,this.submission(c));
    await tx.query("COMMIT");
    return {caseRef:c.id,reference:c.case_number,status:c.status,
      revision:c.revision,kind:c.case_kind,source};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async decide(bearer:string,caseRef:string,body:unknown){
  const actor=await this.reviewer(bearer),request=parseDecision(body);
  if(!ID.test(caseRef))throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const digest=hash([request.action,request.remarks,request.expectedRevision]);
  const tx=await this.db.connect();
  try{
    await tx.query("BEGIN");
    await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
    const found=await tx.query<CaseRow>(
      "SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2 AND case_kind "+
      "IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',"+
      "'HEALTH_DOCTOR_VERIFICATION') FOR UPDATE",
      [actor.realmId,caseRef]);
    const c=found.rows[0];
    if(!c)throw new NotFoundException({code:"HEALTH_REVIEW_UNAVAILABLE"});
    await this.requireKind(bearer,c.case_kind);
    await this.identity.assertCurrent(tx,actor,c.case_kind==="HEALTH_DOCTOR_VERIFICATION"?
      "health.doctors.verify":"health.providers.verify");
    if(c.proposer_id===actor.accountId)
      throw new ForbiddenException("The registration must be reviewed by a different person");
    const previous=await tx.query<{actor_id:string;request_digest:string;
      accepted_case_revision:number}>(
      "SELECT actor_id,request_digest,accepted_case_revision "+
      "FROM cg03_case_decision WHERE case_id=$1 AND request_key=$2 FOR SHARE",
      [caseRef,request.requestKey]);
    if(previous.rows[0]){
      const prior=previous.rows[0];
      if(prior.actor_id!==actor.accountId||prior.request_digest!==digest)
        throw new ConflictException({code:"HEALTH_REVIEW_CONFLICT"});
      await tx.query("COMMIT");
      return {status:"PREVIOUSLY_CONFIRMED",caseRef,
        revision:prior.accepted_case_revision,replayed:true};
    }
    if(c.revision!==request.expectedRevision||
      !["SUBMITTED","IN_REVIEW"].includes(c.status))
      throw new ConflictException({code:"HEALTH_REVIEW_CONFLICT"});
    if(c.case_kind==="HEALTH_DOCTOR_VERIFICATION")
      await this.doctorSource.original(tx,actor,this.doctorSubmission(c));
    else await this.source.original(tx,actor,this.submission(c));
    const step=await tx.query(
      "SELECT ordinal FROM cg03_process_step WHERE process_id=$1 AND "+
      "ordinal=$2 AND capability_key='approvals.review' AND "+
      "protected_root_required=true FOR SHARE",[c.process_id,c.current_step]);
    if(!step.rowCount)throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
    await this.sessions.requireFreshFoundationRootProof(tx,actor,request.currentPassword);
    const next=request.action==="APPROVE"?"PENDING_OWNER":
      request.action==="RETURN"?"RETURNED":"REJECTED";
    await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,"+
      "updated_at=now() WHERE id=$1 AND realm_id=$2 AND revision=$4",
      [caseRef,actor.realmId,next,c.revision]);
    const inserted=await tx.query<{id:string}>(
      "INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,"+
      "step_ordinal,expected_case_revision,accepted_case_revision,request_key,"+
      "request_digest,safe_remarks,fresh_password_verified_at) "+
      "VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id",
      [actor.realmId,caseRef,actor.accountId,request.action,c.revision,c.revision+1,
      request.requestKey,digest,request.remarks]);
    await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
      "step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",
      [actor.realmId,caseRef,actor.accountId,
        request.action==="APPROVE"?"FINAL_APPROVED":next,randomUUID()]);
    await tx.query("COMMIT");
    return {confirmed:true,status:next,caseRef,
      revision:c.revision+1,decisionRef:request.action==="APPROVE"?
        inserted.rows[0].id:undefined,replayed:false};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async approved(tx:PoolClient,actor:VerifiedFoundationActor,
  input:HealthSubmission & {caseRef:string}){
  const current=await tx.query<{decision_ref:string}>(
    "SELECT d.id AS decision_ref FROM cg03_case c "+
    "JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id "+
    "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind=$3 "+
    "AND c.health_provider_id=$4 AND c.health_center_id IS NOT DISTINCT FROM $5::uuid "+
    "AND c.health_provider_revision_id IS NOT DISTINCT FROM $6::uuid "+
    "AND c.health_center_revision_id IS NOT DISTINCT FROM $7::uuid "+
    "AND c.health_revision_no=$8 AND c.health_source_digest=$9 "+
    "AND c.status IN('PENDING_OWNER','OWNER_COMPLETED') "+
    "AND d.action='APPROVE' AND d.actor_id<>c.proposer_id "+
    "AND d.fresh_password_verified_at IS NOT NULL AND "+
    "EXISTS(SELECT 1 FROM account reviewer "+
    "JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id "+
    "AND ar.revoked_at IS NULL JOIN role role_now ON role_now.id=ar.role_id "+
    "AND role_now.realm_id=reviewer.realm_id "+
    "WHERE reviewer.id=d.actor_id AND reviewer.realm_id=c.realm_id "+
    "AND reviewer.status='ACTIVE' AND role_now.active=true AND role_now.is_protected=true) "+
    "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
    [input.caseRef,actor.realmId,input.kind,input.providerRef,input.centerRef,
      input.kind==="HEALTH_PROVIDER_VERIFICATION"?input.revisionRef:null,
      input.kind==="HEALTH_CENTER_VERIFICATION"?input.revisionRef:null,
      input.revisionNo,input.digest]);
  if(!current.rows[0])throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
  return current.rows[0].decision_ref;
 }
 /** The one original CG03 accepted final decision for the exact doctor
  * revision and scanned CG19 proof. No client 'verified' flag is trusted.
  */
 async approvedDoctor(tx:PoolClient,actor:VerifiedFoundationActor,
  input:DoctorSubmission&{caseRef:string}){
  const accepted=await tx.query<{decision_ref:string}>(
    "SELECT d.id AS decision_ref FROM cg03_case c "+
    "JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id "+
    "WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='HEALTH_DOCTOR_VERIFICATION' "+
    "AND c.health_doctor_id=$3 AND c.health_doctor_revision_id=$4 "+
    "AND c.health_revision_no=$5 AND c.health_source_digest=$6 "+
    "AND c.status IN('PENDING_OWNER','OWNER_COMPLETED') "+
    "AND d.action='APPROVE' AND d.actor_id<>c.proposer_id "+
    "AND d.fresh_password_verified_at IS NOT NULL "+
    "AND EXISTS(SELECT 1 FROM account reviewer "+
    "JOIN account_role ar ON ar.account_id=reviewer.id AND ar.realm_id=reviewer.realm_id "+
    "AND ar.revoked_at IS NULL JOIN role role_now ON role_now.id=ar.role_id "+
    "AND role_now.realm_id=reviewer.realm_id "+
    "WHERE reviewer.id=d.actor_id AND reviewer.realm_id=c.realm_id "+
    "AND reviewer.status='ACTIVE' AND role_now.active=true AND role_now.is_protected=true) "+
    "ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR SHARE OF c,d",
    [input.caseRef,actor.realmId,input.doctorRef,input.revisionRef,
      input.revisionNo,input.digest]);
  if(!accepted.rows[0])
    throw new ConflictException({code:"HEALTH_DOCTOR_REVIEW_UNAVAILABLE"});
  return accepted.rows[0].decision_ref;
 }
 async finish(tx:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  const updated=await tx.query(
    "UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
    "updated_at=now() WHERE id=$1 AND realm_id=$2 AND "+
    "case_kind IN('HEALTH_PROVIDER_VERIFICATION','HEALTH_CENTER_VERIFICATION',"+
      "'HEALTH_DOCTOR_VERIFICATION') "+
    "AND status='PENDING_OWNER' RETURNING id",[caseRef,actor.realmId]);
  if(!updated.rowCount)
    throw new ConflictException({code:"HEALTH_REVIEW_UNAVAILABLE"});
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,"+
    "step_ordinal,correlation_ref) VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)",
    [actor.realmId,caseRef,actor.accountId,randomUUID()]);
 }
}
