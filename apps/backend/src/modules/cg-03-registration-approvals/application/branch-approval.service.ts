import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reference=(x:unknown)=>{
 if(typeof x!=="string"||!UUID.test(x))throw new BadRequestException("Choose a valid application");
 return x;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type CaseRow={
 id:string;realm_id:string;case_number:string;proposer_id:string;process_id:string;
 proposal_revision:number;proposal_digest:string;branch_source_ref:string;
 branch_source_revision:number;branch_source_digest:string;status:string;revision:number;
 request_key:string;request_digest:string;current_step:number;submitted_at:Date;
};
type DecisionBody={action:"APPROVE"|"RETURN"|"REJECT";remarks:string;
 expectedRevision:number;requestKey:string;totp:string};
function decisionInput(value:unknown):DecisionBody{
 if(!value||typeof value!=="object"||Array.isArray(value))
   throw new BadRequestException("Check the approval decision");
 const r=value as Record<string,unknown>;
 if(Object.keys(r).some(k=>!["action","remarks","expectedRevision","requestKey","totp"].includes(k))||
    !["APPROVE","RETURN","REJECT"].includes(String(r.action))||
    !Number.isSafeInteger(r.expectedRevision)||Number(r.expectedRevision)<1||
    typeof r.remarks!=="string"||r.remarks.length>500||/[\u0000-\u001f\u007f]/.test(r.remarks)||
    typeof r.totp!=="string"||!/^[0-9]{6}$/.test(r.totp)||
    typeof r.requestKey!=="string"||!UUID.test(r.requestKey))
  throw new BadRequestException("Check the decision, remarks and fresh authenticator");
 return {action:r.action as DecisionBody["action"],remarks:r.remarks.trim(),
   expectedRevision:Number(r.expectedRevision),requestKey:r.requestKey,totp:r.totp};
}
/** CG-03-owned typed branch approval case authority, separate from original
 * CG-01 protected-role proposal behavior, but using the same case/decision/event tables.
 */
@Injectable()
export class BranchApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly owner:ProtectedAccessOwnerService,
  private readonly branches:BranchSourceFacade){}
 private async currentBranchProcess(client:PoolClient,actor:VerifiedFoundationActor){
   // Only a currently authorized Foundation root may initialize an approval
   // process; ordinary branch managers never create reviewer policy.
   await this.owner.verifyReviewer(client,actor,"approvals.review",true);
   const current=await client.query<{id:string;version:number}>(`
     SELECT p.id,p.version FROM cg03_branch_process_current c
       JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
     WHERE c.realm_id=$1 AND p.process_kind='BRANCH_REGISTRATION'
   `,[actor.realmId]);
   if(current.rows[0])return current.rows[0];
   const version=await client.query<{next_version:number}>(`
     SELECT COALESCE(MAX(version),0)+1 AS next_version FROM cg03_process WHERE realm_id=$1
   `,[actor.realmId]);
   const created=await client.query<{id:string;version:number}>(`
     INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind)
     VALUES($1,$2,NULL,$3,'BRANCH_REGISTRATION') RETURNING id,version
   `,[actor.realmId,version.rows[0].next_version,actor.accountId]);
   await client.query(`
     INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
     VALUES($1,1,'approvals.review',true)
   `,[created.rows[0].id]);
   await client.query(`
     INSERT INTO cg03_branch_process_current(realm_id,process_id) VALUES($1,$2)
   `,[actor.realmId,created.rows[0].id]);
   return created.rows[0];
 }
 async processStatus(bearer:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const current=await this.db.query<{version:number}>(`
     SELECT p.version FROM cg03_branch_process_current c
     JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
     WHERE c.realm_id=$1 AND p.process_kind='BRANCH_REGISTRATION'
     LIMIT 1
   `,[actor.realmId]);
   return {configured:!!current.rows[0],status:current.rows[0]?"AVAILABLE":"NOT_CONFIGURED"};
 }
 async initializeProcess(bearer:string){
   const actor=await this.sessions.requireAction(bearer,"approvals.process.manage");
   await this.sessions.requireAction(bearer,"foundation.branches.admin");
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     const root=await client.query(`
       SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
     `,[actor.realmId]);
     if(!root.rowCount)throw new ForbiddenException("Foundation root is unavailable");
     const process=await this.currentBranchProcess(client,actor);
     await client.query("COMMIT");tx=false;
     return {status:"AVAILABLE",configured:true,version:process.version};
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
 async createOrGetCase(bearer:string,registrationRef:string,revision:number,digest:string,
   requestKey:string){
   const source=await this.branches.submission(bearer,registrationRef,revision,digest);
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.manage");
   const key=reference(requestKey);
   if(source.requestedBy!==actor.accountId&&source.managerRef!==actor.accountId){
     // Only a protected root may submit someone else's authorized registration.
     await this.sessions.requireAction(bearer,"foundation.branches.admin");
   }
   if(!["SUBMISSION_UNCONFIRMED","SUBMITTED","IN_REVIEW"].includes(source.status))
     throw new ConflictException("This registration cannot be submitted again");
   const requestDigest=sha(["BRANCH_REGISTRATION",registrationRef,revision,digest,key]);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     const root=await client.query(`
       SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
     `,[actor.realmId]);
     if(!root.rowCount)throw new ForbiddenException("Foundation scope unavailable");
     await this.branches.guardSubmittedSource(client,actor,registrationRef,revision,digest);
     await this.owner.requireDistinctFinalReviewer(client,actor.realmId,actor.accountId);
     const prior=await client.query<CaseRow>(`
       SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='BRANCH_REGISTRATION'
         AND branch_source_ref=$2 AND branch_source_revision=$3 FOR SHARE
     `,[actor.realmId,registrationRef,revision]);
     if(prior.rows[0]){
       if(prior.rows[0].branch_source_digest!==digest||
         prior.rows[0].request_digest!==requestDigest||
         prior.rows[0].proposer_id!==actor.accountId)
         throw new ConflictException("A different branch submission already exists");
       await client.query("COMMIT");tx=false;
       return {caseRef:prior.rows[0].id,reference:prior.rows[0].case_number,
         status:prior.rows[0].status,revision:prior.rows[0].revision};
     }
     const predecessor=await client.query<{id:string;status:string;branch_source_revision:number}>(`
     SELECT id,status,branch_source_revision FROM cg03_case
     WHERE realm_id=$1 AND case_kind='BRANCH_REGISTRATION'
       AND branch_source_ref=$2 AND branch_source_revision<$3
     ORDER BY branch_source_revision DESC LIMIT 1 FOR SHARE
   `,[actor.realmId,registrationRef,revision]);
   if(predecessor.rows[0]&&predecessor.rows[0].status!=="RETURNED")
     throw new ConflictException("Only a returned registration may be resubmitted");
   const previousCase=predecessor.rows[0]?.id??null;
   // A branch applicant can use only an existing process configured by a
   // genuine Super Admin; never create reviewer policy in this mutation.
   const available=await client.query<{id:string;version:number}>(`
     SELECT p.id,p.version FROM cg03_branch_process_current c
     JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
     WHERE c.realm_id=$1 AND p.process_kind='BRANCH_REGISTRATION'
   `,[actor.realmId]);
   const process=available.rows[0];
   if(!process)throw new ConflictException("Super Admin branch approval is not configured");
     const created=await client.query<CaseRow>(`
       INSERT INTO cg03_case(
         realm_id,case_number,process_id,process_version,proposer_id,
         target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,
         expected_access_version,expected_role_revision,proposal_revision,
         proposal_digest,request_digest,request_key,
         case_kind,branch_source_ref,branch_source_revision,branch_source_digest,previous_case_id
       ) VALUES(
         $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),
         $2,$3,$4,NULL,NULL,$5,'Branch registration',NULL,NULL,$6,$7,$8,$9,
         'BRANCH_REGISTRATION',$10,$11,$12,$13
       ) RETURNING *
     `,[actor.realmId,process.id,process.version,actor.accountId,
       source.branchName,revision,digest,requestDigest,key,registrationRef,revision,digest,previousCase]);
     await client.query(`
       INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref)
       VALUES($1,$2,$3,$5,1,$4)
     `,[actor.realmId,created.rows[0].id,actor.accountId,randomUUID(),previousCase?"CORRECTED":"SUBMITTED"]);
     await client.query("COMMIT");tx=false;
     return {caseRef:created.rows[0].id,reference:created.rows[0].case_number,
       status:"SUBMITTED",revision:1};
   }catch(e){
     if(tx)try{await client.query("ROLLBACK");}catch{}
     if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
       throw new ConflictException("An approval already exists for this branch submission");
     throw e;
   }finally{client.release();}
 }
 private async actorForCase(bearer:string,caseRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.view");
   const root=await this.db.query<{id:string}>(`
     SELECT a.id FROM auth_session s JOIN account a ON a.id=s.account_id
       AND a.realm_id=$2 AND a.status='ACTIVE'
     JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
     JOIN role r ON r.id=ar.role_id AND r.active AND r.is_protected
     WHERE s.id=$1 AND s.revoked_at IS NULL AND s.mfa_verified_at IS NOT NULL
       AND s.account_access_version=a.access_version
       AND s.expires_at>now() LIMIT 1
   `,[actor.activeSessionId,actor.realmId]);
   const rows=await this.db.query<CaseRow>(`
     SELECT * FROM cg03_case
     WHERE id=$1 AND realm_id=$2 AND case_kind='BRANCH_REGISTRATION'
       AND ($3::boolean OR proposer_id=$4)
   `,[reference(caseRef),actor.realmId,!!root.rowCount,actor.accountId]);
   if(!rows.rows[0])throw new NotFoundException("Branch approval unavailable");
   return {actor,root:!!root.rowCount,caseRow:rows.rows[0]};
 }
 async detail(bearer:string,caseRef:string){
   const {actor,root,caseRow}=await this.actorForCase(bearer,caseRef);
   const changes=await this.db.query<{action:string;safe_remarks:string;occurred_at:Date}>(`
     SELECT action,safe_remarks,occurred_at FROM cg03_case_event
     WHERE realm_id=$1 AND case_id=$2 ORDER BY occurred_at,id LIMIT 30
   `,[actor.realmId,caseRow.id]);
   // CG-02's immutable submitted revision is the review display authority;
   // never read mutable draft stages to decide an earlier case.
   const frozen=await this.branches.submission(bearer,
     caseRow.branch_source_ref,caseRow.branch_source_revision,caseRow.branch_source_digest);
   return {caseRef:caseRow.id,reference:caseRow.case_number,
     submittedBranchName:frozen.branchName,reviewSummary:frozen.reviewSummary,
     evidence:frozen.fileVersions,
     registrationRef:caseRow.branch_source_ref,submissionRevision:caseRow.branch_source_revision,
     status:caseRow.status,revision:caseRow.revision,
     canDecide:root&&actor.accountId!==caseRow.proposer_id&&
        ["SUBMITTED","IN_REVIEW"].includes(caseRow.status),
     history:changes.rows.map(x=>({action:x.action,remarks:x.safe_remarks,
       at:x.occurred_at.toISOString()}))};
 }
 async decide(bearer:string,caseRef:string,input:unknown){
   const body=decisionInput(input);
   const actor=await this.sessions.requireAction(bearer,"approvals.review");
   // Safe same-actor replay is resolved before consuming another one-use MFA proof.
   // Current root permission remains mandatory even on a previous request.
   const replayDigest=sha([body.action,body.remarks,body.expectedRevision]);
   const oldDecision=await this.db.query<{actor_id:string;request_digest:string;
       accepted_case_revision:number}>(`
     SELECT d.actor_id,d.request_digest,d.accepted_case_revision
     FROM cg03_case_decision d JOIN cg03_case c ON c.id=d.case_id AND c.realm_id=d.realm_id
     WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='BRANCH_REGISTRATION'
       AND d.request_key=$3
   `,[reference(caseRef),actor.realmId,body.requestKey]);
   if(oldDecision.rows[0]){
     if(oldDecision.rows[0].actor_id!==actor.accountId||
       oldDecision.rows[0].request_digest!==replayDigest)
       throw new ConflictException("A different decision already uses this request");
     return {status:"PREVIOUSLY_CONFIRMED",caseRef,
       revision:oldDecision.rows[0].accepted_case_revision};
   }
   // Keep CG-01 single-use fresh-MFA lock before CG-03 case row lock.
   await this.sessions.limitFoundationRootProof(actor);
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.owner.verifyReviewer(client,actor,"approvals.review",true);
     await this.sessions.requireFreshFoundationRootProof(client,actor,body.totp);
     const current=await client.query<CaseRow>(`
       SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2
         AND case_kind='BRANCH_REGISTRATION' FOR UPDATE
     `,[reference(caseRef),actor.realmId]);
     const row=current.rows[0];
     if(!row)throw new NotFoundException("Branch approval unavailable");
     if(row.proposer_id===actor.accountId)
       throw new ForbiddenException("Another Super Admin must review this branch");
     const requestDigest=sha([body.action,body.remarks,body.expectedRevision]);
     const old=await client.query<{actor_id:string;request_digest:string}>(`
       SELECT actor_id,request_digest FROM cg03_case_decision
       WHERE case_id=$1 AND request_key=$2 FOR SHARE
     `,[row.id,body.requestKey]);
     if(old.rows[0]){
       if(old.rows[0].actor_id!==actor.accountId||
          old.rows[0].request_digest!==requestDigest)
         throw new ConflictException("A different decision already uses this request");
       await client.query("COMMIT");tx=false;
       return {status:"PREVIOUSLY_CONFIRMED",caseRef:row.id,revision:row.revision};
     }
     if(!["SUBMITTED","IN_REVIEW"].includes(row.status)||row.revision!==body.expectedRevision)
       throw new ConflictException("The review changed. Refresh before deciding.");
     const step=await client.query<{ordinal:number;protected_root_required:boolean}>(`
       SELECT ordinal,protected_root_required FROM cg03_process_step
       WHERE process_id=$1 AND ordinal=$2 AND capability_key='approvals.review' FOR SHARE
     `,[row.process_id,row.current_step]);
     if(!step.rows[0]||!step.rows[0].protected_root_required)
       throw new ConflictException("The branch approval route is unavailable");
     const status=body.action==="RETURN"?"RETURNED":body.action==="REJECT"?"REJECTED":"PENDING_OWNER";
     const updated=await client.query<{revision:number}>(`
       UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now()
       WHERE id=$1 AND realm_id=$2 AND revision=$4 RETURNING revision
     `,[row.id,actor.realmId,status,row.revision]);
     const decision=await client.query<{id:string}>(`
       INSERT INTO cg03_case_decision(
         realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,
         accepted_case_revision,request_key,request_digest,safe_remarks,fresh_mfa_verified_at
       ) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id
     `,[actor.realmId,row.id,actor.accountId,body.action,
       row.revision,updated.rows[0].revision,body.requestKey,requestDigest,body.remarks]);
     await client.query(`
       INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,
         safe_remarks,correlation_ref)
       VALUES($1,$2,$3,$4,1,$5,$6)
     `,[actor.realmId,row.id,actor.accountId,
       status==="PENDING_OWNER"?"FINAL_APPROVED":status,body.remarks,randomUUID()]);
     if(status==="PENDING_OWNER")await client.query(`
       INSERT INTO cg03_branch_owner_effect(case_id,realm_id,final_decision_id)
       VALUES($1,$2,$3)
     `,[row.id,actor.realmId,decision.rows[0].id]);
     await client.query("COMMIT");tx=false;
     return {status,caseRef:row.id,revision:updated.rows[0].revision};
   }catch(e){
     if(tx)try{await client.query("ROLLBACK");}catch{}
     if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
       throw new ConflictException("The branch approval changed");
     throw e;
   }finally{client.release();}
 }
 async proof(bearer:string,caseRef:string,registrationRef:string,revision:number,digest:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.admin");
   const found=await this.db.query<{case_id:string;effect_key:string}>(`
     SELECT e.case_id,e.effect_key FROM cg03_branch_owner_effect e
       JOIN cg03_case c ON c.id=e.case_id AND c.realm_id=e.realm_id
       JOIN cg03_case_decision d ON d.id=e.final_decision_id
       WHERE e.case_id=$1 AND e.realm_id=$5 AND e.realm_id=(
          SELECT realm_id FROM cg03_case WHERE id=$1 AND case_kind='BRANCH_REGISTRATION')
         AND c.branch_source_ref=$2 AND c.branch_source_revision=$3
         AND c.branch_source_digest=$4 AND c.status IN('PENDING_OWNER','OWNER_COMPLETED')
         AND d.action='APPROVE' AND d.fresh_mfa_verified_at IS NOT NULL
     LIMIT 1
   `,[reference(caseRef),reference(registrationRef),revision,digest,actor.realmId]);
   if(!found.rows[0])throw new ConflictException("A genuine final branch decision is required");
   return {caseRef,registrationRef,revision,digest,effectKey:found.rows[0].effect_key};
 }
 async guardFinalDecision(client:PoolClient,actor:VerifiedFoundationActor,
   caseRef:string,registrationRef:string,revision:number,digest:string,effectKey:string){
   const rows=await client.query<{effect_key:string;status:string}>(`
     SELECT e.effect_key,e.status FROM cg03_case c
       JOIN cg03_branch_owner_effect e ON e.case_id=c.id AND e.realm_id=c.realm_id
       JOIN cg03_case_decision d ON d.id=e.final_decision_id
       WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='BRANCH_REGISTRATION'
         AND c.branch_source_ref=$3 AND c.branch_source_revision=$4
         AND c.branch_source_digest=$5 AND e.effect_key=$6
         AND c.status IN('PENDING_OWNER','OWNER_COMPLETED')
         AND d.action='APPROVE' AND d.fresh_mfa_verified_at IS NOT NULL
       FOR SHARE OF c,e,d
   `,[reference(caseRef),actor.realmId,reference(registrationRef),revision,digest,
     reference(effectKey)]);
   if(!rows.rows[0])throw new ConflictException("The approved branch source is stale or unavailable");
   return rows.rows[0].status;
 }
 async sourceCase(bearer:string,caseRef:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.admin");
   const result=await this.db.query<CaseRow>(`
     SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2
       AND case_kind='BRANCH_REGISTRATION'
   `,[reference(caseRef),actor.realmId]);
   if(!result.rows[0])throw new NotFoundException("Branch approval unavailable");
   const row=result.rows[0];
   return {registrationRef:row.branch_source_ref,revision:row.branch_source_revision,
     digest:row.branch_source_digest,status:row.status,caseRef:row.id};
 }
 async listCases(bearer:string){
   const actor=await this.sessions.requireAction(bearer,"approvals.review");
   await this.sessions.requireAction(bearer,"foundation.branches.admin");
   // Ordinary approvers cannot read the complete protected branch inbox.
   const protectedRole=await this.db.query<{id:string}>(`
     SELECT a.id FROM auth_session s
     JOIN account a ON a.id=s.account_id AND a.realm_id=$2
       AND a.status='ACTIVE' AND a.access_version=s.account_access_version
     JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id
       AND ar.revoked_at IS NULL
     JOIN role r ON r.id=ar.role_id AND r.realm_id=a.realm_id
       AND r.active AND r.is_protected
     WHERE s.id=$1 AND s.revoked_at IS NULL AND s.mfa_verified_at IS NOT NULL
       AND s.expires_at>now() LIMIT 1
   `,[actor.activeSessionId,actor.realmId]);
   if(!protectedRole.rowCount)
     throw new ForbiddenException("Super Admin permission is required to review branch applications");
   const cases=await this.db.query<CaseRow & {account_name_snapshot:string}>(`
     SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='BRANCH_REGISTRATION'
     ORDER BY submitted_at DESC,id DESC LIMIT 40
   `,[actor.realmId]);
   return {cases:cases.rows.map(x=>({caseRef:x.id,reference:x.case_number,
     branchName:x.account_name_snapshot,registrationRef:x.branch_source_ref,
     submissionRevision:x.branch_source_revision,status:x.status,revision:x.revision,
     submittedAt:x.submitted_at.toISOString()}))};
 }
 /** CG-03-own immutable case proof for a newly submitted CG-02 snapshot. */
 async guardOriginalCase(client:PoolClient,actor:VerifiedFoundationActor,
   registrationRef:string,revision:number,digest:string,caseRef:string){
   const rows=await client.query<CaseRow>(`
     SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2
       AND case_kind='BRANCH_REGISTRATION' AND branch_source_ref=$3
       AND branch_source_revision=$4 AND branch_source_digest=$5
       AND status IN('SUBMITTED','IN_REVIEW','RETURNED','REJECTED',
         'PENDING_OWNER','OWNER_COMPLETED') FOR SHARE
   `,[reference(caseRef),actor.realmId,reference(registrationRef),revision,digest]);
   if(!rows.rows[0]||rows.rows[0].proposer_id!==actor.accountId)
     throw new ConflictException("The source-approved branch application is unavailable");
 }
 /** CG-03's decision row, not CG-02 UI status, is authority for state transitions. */
 async guardOutcome(client:PoolClient,actor:VerifiedFoundationActor,
   caseRef:string,expected:"RETURNED"|"REJECTED"|"PENDING_OWNER"){
   const rows=await client.query<CaseRow>(`
     SELECT c.* FROM cg03_case c
     JOIN cg03_case_decision d ON d.case_id=c.id AND d.realm_id=c.realm_id
     WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='BRANCH_REGISTRATION'
       AND c.status=$3 AND d.action=$4
       AND (c.status<>'PENDING_OWNER' OR d.fresh_mfa_verified_at IS NOT NULL)
     FOR SHARE OF c,d
   `,[reference(caseRef),actor.realmId,expected,
      expected==="PENDING_OWNER"?"APPROVE":expected==="RETURNED"?"RETURN":"REJECT"]);
   if(!rows.rows[0])throw new ConflictException("The branch decision could not be confirmed");
 }
 async markCompleted(bearer:string,caseRef:string,effectKey:string){
   const actor=await this.sessions.requireAction(bearer,"foundation.branches.admin");
   const client=await this.db.connect();let tx=false;
   try{
     await client.query("BEGIN");tx=true;
     await this.owner.verifyReviewer(client,actor,"approvals.review",true);
     const caseRow=await client.query<{realm_id:string;status:string;proposer_id:string}>(`
       SELECT c.realm_id,c.status,c.proposer_id FROM cg03_case c
       JOIN cg03_branch_owner_effect e ON e.case_id=c.id
       WHERE c.id=$1 AND e.effect_key=$2 AND c.realm_id=$3 AND c.case_kind='BRANCH_REGISTRATION'
       FOR UPDATE OF c,e
     `,[reference(caseRef),reference(effectKey),actor.realmId]);
     if(!caseRow.rows[0])throw new ConflictException("Approved branch source unavailable");
     if(caseRow.rows[0].status==="OWNER_COMPLETED"){
       await client.query("COMMIT");tx=false;return;
     }
     if(caseRow.rows[0].status!=="PENDING_OWNER")
       throw new ConflictException("The original approval state has changed");
     await client.query(`
       UPDATE cg03_branch_owner_effect SET status='OWNER_COMPLETED',completed_at=COALESCE(completed_at,now())
       WHERE case_id=$1 AND effect_key=$2
     `,[caseRef,effectKey]);
     await client.query(`
       UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now()
       WHERE id=$1 AND status='PENDING_OWNER'
     `,[caseRef]);
     await client.query(`
       INSERT INTO cg03_case_event(
         realm_id,case_id,actor_id,action,step_ordinal,correlation_ref)
       VALUES($1,$2,$3,'OWNER_COMPLETED',1,$4)
     `,[actor.realmId,caseRef,actor.accountId,randomUUID()]);
     await client.query("COMMIT");tx=false;
   }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};throw e;}
   finally{client.release();}
 }
}
