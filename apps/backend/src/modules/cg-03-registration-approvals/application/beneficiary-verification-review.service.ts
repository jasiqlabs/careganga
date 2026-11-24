import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {BeneficiariesService} from "../../cg-06-beneficiaries-assistance/application/beneficiaries.service";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {conflict,fields,ref,revision,text,option} from "../../cg-06-beneficiaries-assistance/domain/beneficiary-input";

/** CG03 uses its original process, cg03_case, immutable decision and protected root proof.
 * CG06 remains authoritative for the actual beneficiary profile/verification state.
 */
type Case={id:string;case_number:string;process_id:string;proposer_id:string;
 beneficiary_id:string;beneficiary_review_ref:string;beneficiary_source_revision:number;
 beneficiary_source_digest:string;status:string;revision:number;current_step:number};
type Snapshot={id:string;beneficiary_id:string;source_revision:number;source_digest:string;
 submitted_by:string;request_key:string};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
@Injectable()
export class BeneficiaryVerificationReviewService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade,
  private readonly reviewer:ProtectedAccessOwnerService,
  private readonly source:BeneficiariesService){}
 private async run<T>(token:string,action:string,work:(tx:PoolClient,a:Actor)=>Promise<T>,read=false):Promise<T>{
  const actor=await this.sessions.requireAction(token,action);
  const tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertCurrent(tx,actor,action);
   const result=await work(tx,actor);
   await tx.query("COMMIT");return result;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{/* Preserve original fault. */}
   const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";
   if(["23505","23503","23514","40001","40P01","55P03"].includes(code))
    throw conflict();
   throw e;
  }finally{tx.release();}
 }
 private async event(tx:PoolClient,a:Actor,c:Case,action:string,remarks=""){
  await tx.query(
   "INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref,safe_remarks) "+
   "VALUES($1,$2,$3,$4,1,$5,$6)",
   [a.realmId,c.id,a.accountId,action,randomUUID(),remarks]);
 }
 private async process(tx:PoolClient,a:Actor){
  const existing=(await tx.query<{process_id:string}>(
   "SELECT p.id AS process_id FROM cg03_beneficiary_review_process_current cur "+
   "JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id "+
   "WHERE cur.realm_id=$1 AND p.process_kind='BENEFICIARY_VERIFICATION' FOR SHARE OF p",
   [a.realmId])).rows[0];
  if(existing)return existing.process_id;
  // The caller owns the exclusive Foundation-root process creation lock.
  const created=(await tx.query<{id:string}>(`
   INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind)
   SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'BENEFICIARY_VERIFICATION'
   FROM cg03_process WHERE realm_id=$1 RETURNING id`,[a.realmId,a.accountId])).rows[0];
  if(!created)throw conflict();
  await tx.query(
   "INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) "+
   "VALUES($1,1,'approvals.review',true)",[created.id]);
  await tx.query(
   "INSERT INTO cg03_beneficiary_review_process_current(realm_id,process_id) VALUES($1,$2)",
   [a.realmId,created.id]);
  return created.id;
 }
 async submit(token:string,id:string,body:unknown){
  const target=ref(id),x=fields(body,["requestKey","expectedRevision"]),
   key=ref(x.requestKey),expected=revision(x.expectedRevision);
  const requestDigest=hash(["BENEFICIARY_VERIFICATION",target,expected]);
  return this.run(token,"beneficiaries.manage",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   // Single root lock serializes original CG03 policy creation/route changes.
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const original=await this.source.guardVerificationSource(tx,a,target,true);
   const previous=(await tx.query<Snapshot>(
    "SELECT * FROM cg06_beneficiary_review_snapshot "+
    "WHERE root_realm_id=$1 AND submitted_by=$2 AND request_key=$3",
    [a.realmId,a.accountId,key])).rows[0];
   if(previous){
    if(previous.beneficiary_id!==target||previous.source_revision!==expected+1)throw conflict();
    const priorCase=(await tx.query<Case>(
     "SELECT * FROM cg03_case WHERE realm_id=$1 AND beneficiary_review_ref=$2 "+
     "AND case_kind='BENEFICIARY_VERIFICATION'",[a.realmId,previous.id])).rows[0];
    if(!priorCase||previous.source_digest!==priorCase.beneficiary_source_digest)throw conflict();
    return {caseNumber:priorCase.case_number,status:priorCase.status,replayed:true};
   }
   if(original.revision!==expected||original.lifecycle!=="ACTIVE"||original.consentRevoked||
     !["DRAFT","RETURNED","REJECTED"].includes(original.verification))throw conflict();
   // A protected final reviewer cannot be either the intake creator or
   // the submitter, even when intake is submitted by a different operator.
   const available=await tx.query(`
    SELECT 1 FROM account candidate
    JOIN account_role ar ON ar.account_id=candidate.id AND ar.realm_id=candidate.realm_id
      AND ar.revoked_at IS NULL
    JOIN role r ON r.id=ar.role_id AND r.realm_id=candidate.realm_id
    WHERE candidate.realm_id=$1 AND candidate.status='ACTIVE'
      AND candidate.id<>ALL($2::uuid[]) AND r.active AND r.is_protected LIMIT 1`,
    [a.realmId,[a.accountId,original.creatorRef]]);
   if(!available.rowCount)
    throw new ConflictException("A different active protected Foundation reviewer must be available");
   const processId=await this.process(tx,a);
   const submitted=await this.source.submitVerificationSource(tx,a,target,key,expected);
   const snapshot=(await tx.query<{id:string}>(`
    INSERT INTO cg06_beneficiary_review_snapshot(root_realm_id,beneficiary_id,source_revision,
      source_digest,submitted_by,request_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [a.realmId,target,submitted.revision,submitted.sourceDigest,a.accountId,key])).rows[0];
   if(!snapshot)throw conflict();
   const previousCase=(await tx.query<{id:string}>(`
    SELECT id FROM cg03_case WHERE realm_id=$1 AND beneficiary_id=$2
      AND case_kind='BENEFICIARY_VERIFICATION'
      AND status IN('RETURNED','REJECTED')
    ORDER BY beneficiary_source_revision DESC,id DESC LIMIT 1`,
    [a.realmId,target])).rows[0]?.id??null;
   const c=(await tx.query<Case>(`
    INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,
     target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,
     expected_access_version,expected_role_revision,proposal_revision,proposal_digest,
     request_digest,request_key,case_kind,beneficiary_review_ref,beneficiary_id,
     beneficiary_source_revision,beneficiary_source_digest,previous_case_id)
    SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),
     p.id,p.version,$2,NULL,NULL,$3,'Beneficiary verification',
     NULL,NULL,$4,$5,$6,$7,'BENEFICIARY_VERIFICATION',$8,$9,$4,$5,$11
    FROM cg03_process p WHERE p.id=$10 AND p.realm_id=$1
      AND p.process_kind='BENEFICIARY_VERIFICATION' RETURNING *`,
    [a.realmId,a.accountId,submitted.reference,submitted.revision,submitted.sourceDigest,
     requestDigest,key,snapshot.id,target,processId,previousCase])).rows[0];
   if(!c)throw conflict();
   await this.event(tx,a,c,previousCase?"CORRECTED":"SUBMITTED");
   return {caseNumber:c.case_number,status:c.status,replayed:false};
  });
 }
 async detail(token:string,id:string){
  const target=ref(id);
  return this.run(token,"beneficiaries.view",async(tx,a)=>{
   const src=await this.source.guardVerificationSource(tx,a,target,false);
   if(src.consentRevoked)return {status:"RESTRICTED",caseNumber:null,canReview:false,caseRef:null,sourceRevision:src.revision,sourceVerification:src.verification,decisions:[]};
   const c=(await tx.query<Case>(`
    SELECT * FROM cg03_case WHERE realm_id=$1 AND beneficiary_id=$2
      AND case_kind='BENEFICIARY_VERIFICATION'
    ORDER BY beneficiary_source_revision DESC,id DESC LIMIT 1`,
    [a.realmId,target])).rows[0];
   if(!c)return {status:"NOT_SUBMITTED",caseNumber:null,canReview:false,caseRef:null,
    sourceRevision:src.revision,sourceVerification:src.verification};
   let canReview=false;
   if(c.proposer_id!==a.accountId&&src.creatorRef!==a.accountId&&c.beneficiary_source_revision===src.revision&&
    c.beneficiary_source_digest===src.digest&&src.verification==="SUBMITTED"&&
    src.lifecycle==="ACTIVE"&&!src.consentRevoked&&c.status==="SUBMITTED"){
    try{
     await this.identity.assertCurrent(tx,a,"beneficiaries.verification.review");
     await this.identity.assertCurrent(tx,a,"approvals.review");
     await this.reviewer.verifyReviewer(tx,a,"approvals.review",true);
     canReview=true;
    }catch(e){if(!(e instanceof ForbiddenException))throw e;}
   }
   const decisions=(await tx.query<{action:string;safe_remarks:string;created_at:Date}>(`
    SELECT d.action,d.safe_remarks,d.created_at FROM cg03_case_decision d
    JOIN cg03_case cases ON cases.id=d.case_id AND cases.realm_id=d.realm_id
    WHERE cases.realm_id=$1 AND cases.beneficiary_id=$2
      AND cases.case_kind='BENEFICIARY_VERIFICATION'
    ORDER BY d.created_at DESC,d.id DESC LIMIT 50`,[a.realmId,target])).rows;
   return {caseNumber:c.case_number,status:c.status,revision:c.revision,
    caseRef:canReview?c.id:null,canReview,sourceRevision:src.revision,
    sourceVerification:src.verification,allowedDecisions:canReview?["APPROVE","RETURN","REJECT"]:[],
    requiresCurrentPassword:canReview,decisions:decisions.map(d=>({
     action:d.action,remarks:d.safe_remarks,at:d.created_at}))};
  },true);
 }
 async decide(token:string,caseRef:string,body:unknown){
  const target=ref(caseRef),x=fields(body,["requestKey","expectedRevision","action","remarks","currentPassword"]),
   key=ref(x.requestKey),expected=revision(x.expectedRevision),
   action=option(x.action,["APPROVE","RETURN","REJECT"] as const),
   remarks=text(x.remarks??"",action==="APPROVE"?0:3,500);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   Buffer.byteLength(x.currentPassword,"utf8")>1024)
   throw new BadRequestException("Enter your current Foundation password");
  const requestDigest=hash([target,expected,action,remarks]);
  const auth=await this.sessions.requireAction(token,"approvals.review");
  await this.sessions.limitFoundationRootProof(auth);
  return this.run(token,"beneficiaries.verification.review",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"approvals.review");
   await this.identity.assertCurrent(tx,a,"beneficiaries.view");
   await this.reviewer.verifyReviewer(tx,a,"approvals.review",true);
   const first=(await tx.query<Case>(`
    SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2
      AND case_kind='BENEFICIARY_VERIFICATION'`,[a.realmId,target])).rows[0];
   if(!first)throw new NotFoundException("Beneficiary verification case unavailable");
   const src=await this.source.guardVerificationSource(tx,a,first.beneficiary_id,true);
   const c=(await tx.query<Case>(`
    SELECT * FROM cg03_case WHERE realm_id=$1 AND id=$2
      AND case_kind='BENEFICIARY_VERIFICATION' FOR UPDATE`,[a.realmId,target])).rows[0];
   if(!c||c.proposer_id===a.accountId||src.creatorRef===a.accountId)
    throw new ForbiddenException("An independent reviewer must differ from the intake creator and submitter");
   const prior=(await tx.query<{actor_id:string;request_digest:string}>(`
    SELECT actor_id,request_digest FROM cg03_case_decision
    WHERE realm_id=$1 AND case_id=$2 AND request_key=$3`,
    [a.realmId,c.id,key])).rows[0];
   if(prior){
    if(prior.actor_id!==a.accountId||prior.request_digest!==requestDigest)throw conflict();
    return {status:c.status,replayed:true};
   }
   if(c.revision!==expected||c.status!=="SUBMITTED"||
    src.revision!==c.beneficiary_source_revision||src.digest!==c.beneficiary_source_digest||
    src.verification!=="SUBMITTED"||src.consentRevoked||src.lifecycle!=="ACTIVE")throw conflict();
   const snap=(await tx.query<Snapshot>(`
    SELECT * FROM cg06_beneficiary_review_snapshot WHERE root_realm_id=$1
      AND id=$2 AND beneficiary_id=$3 AND source_revision=$4 AND source_digest=$5 FOR SHARE`,
    [a.realmId,c.beneficiary_review_ref,c.beneficiary_id,c.beneficiary_source_revision,
     c.beneficiary_source_digest])).rows[0];
   if(!snap||snap.submitted_by!==c.proposer_id)throw conflict();
   await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword);
   const state=action==="APPROVE"?"PENDING_OWNER":action==="RETURN"?"RETURNED":"REJECTED";
   const updated=await tx.query(`
    UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now()
    WHERE realm_id=$1 AND id=$2 AND revision=$4 RETURNING id`,
    [a.realmId,c.id,state,expected]);
   if(!updated.rowCount)throw conflict();
   await tx.query(`
    INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,
      expected_case_revision,accepted_case_revision,request_key,request_digest,
      safe_remarks,fresh_password_verified_at)
    VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now())`,
    [a.realmId,c.id,a.accountId,action,expected,expected+1,key,requestDigest,remarks]);
   await this.event(tx,a,c,state==="PENDING_OWNER"?"FINAL_APPROVED":state,remarks);
   await this.source.applyVerificationDecision(tx,a,c.beneficiary_id,c.beneficiary_source_revision,
    c.beneficiary_source_digest,c.id,action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED");
   if(state==="PENDING_OWNER"){
    await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,"+
     "updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,c.id]);
    await this.event(tx,a,c,"OWNER_COMPLETED");
   }
   return {status:state==="PENDING_OWNER"?"OWNER_COMPLETED":state,replayed:false};
  });
 }
}
