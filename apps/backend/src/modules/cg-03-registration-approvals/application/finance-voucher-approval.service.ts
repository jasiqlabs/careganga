import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException
} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {FinanceVoucherSourceFacade} from "../../cg-09-finance-accounting/application/finance-voucher-source.facade";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const requireId=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException({code:"FINANCE_VOUCHER_SOURCE_INVALID"});
 return v;
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const parseDecision=(v:unknown)=>{
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw new BadRequestException({code:"FINANCE_VOUCHER_REVIEW_INVALID"});
 const x=v as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["requestKey","expectedRevision","action","remarks","currentPassword"].includes(k))||
    !UUID.test(String(x.requestKey))||!Number.isSafeInteger(x.expectedRevision)||
    Number(x.expectedRevision)<1||!["APPROVE","RETURN","REJECT"].includes(String(x.action))||
    (x.remarks!==undefined&&(typeof x.remarks!=="string"||x.remarks.length>500))||
    typeof x.currentPassword!=="string"||x.currentPassword.length<8||
    Buffer.byteLength(x.currentPassword,"utf8")>1024)
  throw new BadRequestException({code:"FINANCE_VOUCHER_REVIEW_INVALID"});
 return {requestKey:String(x.requestKey),expectedRevision:Number(x.expectedRevision),
  action:x.action as "APPROVE"|"RETURN"|"REJECT",
  remarks:typeof x.remarks==="string"?x.remarks.trim():"",
  currentPassword:x.currentPassword as string};
};
type CaseRow={id:string;realm_id:string;case_number:string;proposer_id:string;
 process_id:string;process_version:number;proposal_revision:number;proposal_digest:string;
 finance_voucher_id:string;finance_voucher_revision:number;finance_voucher_digest:string;
 finance_proof_file_id:string;finance_proof_revision:number;current_step:number;
 status:string;revision:number;request_key:string;request_digest:string;previous_case_id:string|null;submitted_at:Date};
@Injectable()
export class FinanceVoucherApprovalService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly financeSource:FinanceVoucherSourceFacade){}
 async processStatus(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.manage");
  const result=await this.db.query<{version:number}>(`
   SELECT p.version FROM cg03_finance_process_current c
   JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
   WHERE c.realm_id=$1 AND p.process_kind='FINANCE_VOUCHER'`,[actor.realmId]);
  return {configured:!!result.rows[0],status:result.rows[0]?"AVAILABLE":"NOT_CONFIGURED"};
 }
 async initializeProcess(bearer:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"approvals.process.manage");
  await this.sessions.requireAction(bearer,"finance.vouchers.manage");
  if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).some(k=>k!=="currentPassword")||
   typeof (input as Record<string,unknown>).currentPassword!=="string")
   throw new BadRequestException({code:"FINANCE_VOUCHER_REVIEW_INVALID"});
  await this.sessions.limitFoundationRootProof(actor);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   const root=await client.query<{id:string}>(`
     SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE`,
     [actor.realmId]);
   if(!root.rows[0])throw new ForbiddenException("Foundation root is unavailable");
   await this.protectedOwner.verifyReviewer(client,actor,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(client,actor,
     (input as {currentPassword:string}).currentPassword);
   const existing=await client.query<{id:string;version:number}>(`
    SELECT p.id,p.version FROM cg03_finance_process_current c
    JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
    WHERE c.realm_id=$1 AND p.process_kind='FINANCE_VOUCHER'`,[actor.realmId]);
   if(existing.rows[0]){await client.query("COMMIT");
    return {configured:true,status:"AVAILABLE",version:existing.rows[0].version};}
   const revision=await client.query<{version:number}>(`
    SELECT COALESCE(MAX(version),0)+1 AS version
    FROM cg03_process WHERE realm_id=$1`,[actor.realmId]);
   const inserted=await client.query<{id:string;version:number}>(`
    INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,
     configured_by,process_kind) VALUES($1,$2,NULL,$3,'FINANCE_VOUCHER')
    RETURNING id,version`,
    [actor.realmId,revision.rows[0].version,actor.accountId]);
   const process=inserted.rows[0];
   await client.query(`
    INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
    VALUES($1,1,'approvals.review',true)`,[process.id]);
   await client.query(`
    INSERT INTO cg03_finance_process_current(realm_id,process_id)
    VALUES($1,$2)`,[actor.realmId,process.id]);
   await client.query("COMMIT");return {configured:true,status:"AVAILABLE",version:process.version};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 /** Typed original CG-03 case creation, called within CG-09's same submit TX.
  * The CG-09 facade validates the immutable source before this insert.
  */
 async createCase(client:PoolClient,actor:VerifiedFoundationActor,input:{
  voucherRef:string;version:number;digest:string;proofRef:string;proofRevision:number;
  voucherNumber:string;requestKey:string
 }){
  const key=requireId(input.requestKey);
  const source=await this.financeSource.guardDraft(client,actor,input.voucherRef,input.version);
  if(source.sourceDigest!==input.digest||!UUID.test(input.proofRef)||
    !Number.isSafeInteger(input.proofRevision)||input.proofRevision<1)
   throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  const existing=await client.query<CaseRow>(`
    SELECT * FROM cg03_case WHERE case_kind='FINANCE_VOUCHER'
    AND realm_id=$1 AND finance_voucher_id=$2
    AND finance_voucher_revision=$3 FOR SHARE`,
   [actor.realmId,input.voucherRef,input.version]);
  const requestDigest=sha(["CG03_FINANCE_VOUCHER",input.voucherRef,input.version,
    input.digest,input.proofRef,input.proofRevision,key]);
  if(existing.rows[0]){
   if(existing.rows[0].proposer_id!==actor.accountId||
      existing.rows[0].request_key!==key||
      existing.rows[0].request_digest!==requestDigest)
    throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
   return {caseRef:existing.rows[0].id,reference:existing.rows[0].case_number,
    status:existing.rows[0].status,revision:existing.rows[0].revision};
  }
  await this.protectedOwner.requireDistinctFinalReviewer(client,actor.realmId,actor.accountId);
  const latest=await client.query<CaseRow>(`
    SELECT * FROM cg03_case WHERE realm_id=$1 AND case_kind='FINANCE_VOUCHER'
    AND finance_voucher_id=$2 AND finance_voucher_revision<$3
    ORDER BY finance_voucher_revision DESC LIMIT 1 FOR SHARE`,
    [actor.realmId,input.voucherRef,input.version]);
  if(latest.rows[0]&&latest.rows[0].status!=="RETURNED")
   throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
  const process=await client.query<{id:string;version:number}>(`
    SELECT p.id,p.version FROM cg03_finance_process_current c
    JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
    WHERE c.realm_id=$1 AND p.process_kind='FINANCE_VOUCHER'`,
    [actor.realmId]);
  if(!process.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
  const created=await client.query<CaseRow>(`
    INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,
     proposer_id,target_account_id,target_role_id,account_name_snapshot,
     role_name_snapshot,expected_access_version,expected_role_revision,
     proposal_revision,proposal_digest,request_digest,request_key,
     case_kind,finance_voucher_id,finance_voucher_revision,finance_voucher_digest,
     finance_proof_file_id,finance_proof_revision,previous_case_id)
    VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),
     $2,$3,$4,NULL,NULL,$5,'Finance voucher',NULL,NULL,
     $6,$7,$8,$9,'FINANCE_VOUCHER',$10,$11,$12,$13,$14,$15)
    RETURNING *`,
   [actor.realmId,process.rows[0].id,process.rows[0].version,actor.accountId,
    input.voucherNumber,input.version,input.digest,requestDigest,key,
    input.voucherRef,input.version,input.digest,input.proofRef,input.proofRevision,
    latest.rows[0]?.id??null]);
  await client.query(`
   INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref)
   VALUES($1,$2,$3,$4,1,$5)`,
   [actor.realmId,created.rows[0].id,actor.accountId,latest.rows[0]?"CORRECTED":"SUBMITTED",randomUUID()]);
  return {caseRef:created.rows[0].id,reference:created.rows[0].case_number,
    status:"SUBMITTED",revision:1};
 }
 private async reviewActor(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"approvals.review");
  await this.sessions.requireAction(bearer,"finance.vouchers.view");
  return actor;
 }
 async list(bearer:string){
  const actor=await this.reviewActor(bearer);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.protectedOwner.verifyReviewer(client,actor,"approvals.review",true);
   const result=await client.query<{caseRef:string;reference:string;voucherNumber:string;
    status:string;revision:number;submittedAt:Date}>(`
    SELECT c.id AS "caseRef",c.case_number AS reference,
      c.account_name_snapshot AS "voucherNumber",c.status,c.revision,
      c.submitted_at AS "submittedAt"
    FROM cg03_case c WHERE c.realm_id=$1 AND c.case_kind='FINANCE_VOUCHER'
     AND c.status IN('SUBMITTED','IN_REVIEW','RETURNED','REJECTED','PENDING_OWNER','OWNER_COMPLETED')
    ORDER BY c.submitted_at DESC,c.id DESC LIMIT 50`,[actor.realmId]);
   await client.query("COMMIT");return {cases:result.rows};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async detail(bearer:string,refInput:string){
  const actor=await this.reviewActor(bearer);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.protectedOwner.verifyReviewer(client,actor,"approvals.review",true);
   const rows=await client.query<CaseRow&{account_name_snapshot:string}>(`
    SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 AND case_kind='FINANCE_VOUCHER'`,
    [requireId(refInput),actor.realmId]);
   const row=rows.rows[0];
   if(!row)throw new NotFoundException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
   await client.query("COMMIT");
   return {caseRef:row.id,reference:row.case_number,voucherNumber:row.account_name_snapshot,
    voucherRef:row.finance_voucher_id,sourceVersion:row.finance_voucher_revision,
    proofFileRef:row.finance_proof_file_id,proofRevision:row.finance_proof_revision,
    status:row.status,revision:row.revision,submittedAt:row.submitted_at};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async decide(bearer:string,refInput:string,value:unknown){
  const input=parseDecision(value),caseRef=requireId(refInput);
  const actor=await this.reviewActor(bearer);
  // Returning an already committed decision never consumes a second password proof.
  // Reviewer still needs active protected-root authorization at replay.
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.protectedOwner.verifyReviewer(client,actor,"approvals.review",true);
   const old=await client.query<{actor_id:string;request_digest:string;
     accepted_case_revision:number}>(`
    SELECT d.actor_id,d.request_digest,d.accepted_case_revision
    FROM cg03_case_decision d JOIN cg03_case c
      ON c.id=d.case_id AND c.realm_id=d.realm_id
    WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='FINANCE_VOUCHER'
      AND d.request_key=$3`,
    [caseRef,actor.realmId,input.requestKey]);
   const hash=sha([input.action,input.remarks,input.expectedRevision]);
   if(old.rows[0]){
    if(old.rows[0].actor_id!==actor.accountId||old.rows[0].request_digest!==hash)
     throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    await client.query("COMMIT");
    return {caseRef,revision:old.rows[0].accepted_case_revision,status:"PREVIOUSLY_CONFIRMED"};
   }
   await client.query("ROLLBACK");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   await this.sessions.requireFreshFoundationRootProof(tx,actor,input.currentPassword);
   const found=await tx.query<CaseRow>(`
    SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2
      AND case_kind='FINANCE_VOUCHER' FOR UPDATE`,[caseRef,actor.realmId]);
   const row=found.rows[0];
   if(!row)throw new NotFoundException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
   if(row.proposer_id===actor.accountId)
    throw new ForbiddenException("Another authorized Super Admin must review this voucher");
   const digest=sha([input.action,input.remarks,input.expectedRevision]);
   const duplicate=await tx.query<{actor_id:string;request_digest:string;
     accepted_case_revision:number}>(`
     SELECT actor_id,request_digest,accepted_case_revision FROM cg03_case_decision
     WHERE case_id=$1 AND request_key=$2 FOR SHARE`,[caseRef,input.requestKey]);
   if(duplicate.rows[0]){
    if(duplicate.rows[0].actor_id!==actor.accountId||
       duplicate.rows[0].request_digest!==digest)
     throw new ConflictException({code:"FINANCE_VOUCHER_REPLAY_CONFLICT"});
    await tx.query("COMMIT");
    return {caseRef,revision:duplicate.rows[0].accepted_case_revision,status:"PREVIOUSLY_CONFIRMED"};
   }
   if(!["SUBMITTED","IN_REVIEW"].includes(row.status)||row.revision!==input.expectedRevision)
    throw new ConflictException({code:"FINANCE_VOUCHER_STALE"});
   const step=await tx.query<{ordinal:number}>(`
     SELECT ordinal FROM cg03_process_step WHERE process_id=$1 AND ordinal=$2
       AND capability_key='approvals.review' AND protected_root_required=true FOR SHARE`,
     [row.process_id,row.current_step]);
   if(!step.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
   const next=input.action==="RETURN"?"RETURNED":
     input.action==="REJECT"?"REJECTED":"PENDING_OWNER";
   await tx.query(`
     UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now()
     WHERE id=$1 AND realm_id=$2 AND revision=$4`,
    [caseRef,actor.realmId,next,row.revision]);
   const decision=await tx.query<{id:string}>(`
     INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,
       expected_case_revision,accepted_case_revision,request_key,request_digest,
       safe_remarks,fresh_password_verified_at)
     VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,now()) RETURNING id`,
    [actor.realmId,caseRef,actor.accountId,input.action,row.revision,row.revision+1,
     input.requestKey,digest,input.remarks]);
   await tx.query(`
    INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref)
    VALUES($1,$2,$3,$4,1,$5)`,
    [actor.realmId,caseRef,actor.accountId,input.action==="APPROVE"?"FINAL_APPROVED":
      input.action==="RETURN"?"RETURNED":"REJECTED",randomUUID()]);
   if(input.action==="APPROVE")await tx.query(`
    INSERT INTO cg03_finance_owner_effect(case_id,realm_id,final_decision_id)
    VALUES($1,$2,$3)`,[caseRef,actor.realmId,decision.rows[0].id]);
   await tx.query("COMMIT");
   return {caseRef,revision:row.revision+1,status:next};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async guardFinalApproval(client:PoolClient,actor:VerifiedFoundationActor,input:{
  caseRef:string;voucherRef:string;sourceVersion:number;digest:string;
  proofRef:string;proofRevision:number
 }){
  const found=await client.query<{effect_key:string;status:string}>(`
   SELECT eff.effect_key,eff.status FROM cg03_case c
   JOIN cg03_finance_owner_effect eff ON eff.case_id=c.id AND eff.realm_id=c.realm_id
   JOIN cg03_case_decision d ON d.id=eff.final_decision_id AND d.case_id=c.id
   WHERE c.id=$1 AND c.realm_id=$2 AND c.case_kind='FINANCE_VOUCHER'
     AND c.finance_voucher_id=$3 AND c.finance_voucher_revision=$4
     AND c.finance_voucher_digest=$5 AND c.finance_proof_file_id=$6
     AND c.finance_proof_revision=$7
     AND c.status IN('PENDING_OWNER','OWNER_COMPLETED')
     AND d.action='APPROVE' AND d.fresh_password_verified_at IS NOT NULL
   FOR SHARE OF c,eff,d`,[input.caseRef,actor.realmId,input.voucherRef,
    input.sourceVersion,input.digest,input.proofRef,input.proofRevision]);
  if(!found.rows[0])throw new ConflictException({code:"FINANCE_VOUCHER_REVIEW_UNAVAILABLE"});
  return found.rows[0];
 }
 async completeEffect(client:PoolClient,actor:VerifiedFoundationActor,caseRef:string){
  await client.query(`
   UPDATE cg03_finance_owner_effect SET status='OWNER_COMPLETED',completed_at=now()
   WHERE case_id=$1 AND realm_id=$2 AND status='PENDING_OWNER'`,
   [caseRef,actor.realmId]);
 }
}
