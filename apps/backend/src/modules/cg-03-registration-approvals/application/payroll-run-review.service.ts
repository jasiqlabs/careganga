import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {PayrollCompensationService} from "../../cg-11-payroll-compensation/application/payroll-compensation.service";
import {PayrollRunService} from "../../cg-11-payroll-compensation/application/payroll-run.service";
import {fields,id,option} from "../../cg-11-payroll-compensation/domain/payroll-input";
type Case={id:string;case_number:string;proposer_id:string;run_id:string;source_revision:number;source_digest:string;status:string;revision:number};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const stale=()=>new ConflictException("Payroll run approval changed. Refresh the current source.");
function version(v:unknown){if(!Number.isSafeInteger(v)||Number(v)<1)throw stale();return Number(v);}
@Injectable()
export class PayrollRunReviewService{
 constructor(private readonly compensation:PayrollCompensationService,private readonly runs:PayrollRunService,private readonly identity:FoundationStructureIdentityFacade,private readonly protectedOwner:ProtectedAccessOwnerService,private readonly sessions:SessionService){}
 private async event(tx:PoolClient,a:Actor,ref:string,action:string){await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,ref,a.accountId,action,randomUUID()]);}
 private async process(tx:PoolClient,a:Actor){
  const existing=(await tx.query<{process_id:string}>("SELECT p.id AS process_id FROM cg03_payroll_run_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1 AND p.process_kind='PAYROLL_RUN_RELEASE' FOR SHARE OF p",[a.realmId])).rows[0];
  if(existing)return existing.process_id;
  const p=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'PAYROLL_RUN_RELEASE' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0];
  await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
  await tx.query("INSERT INTO cg03_payroll_run_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);return p.id;
 }
 private async original(tx:PoolClient,a:Actor,ref:string,lock=false){
  const c=(await tx.query<Case>("SELECT c.id,c.case_number,c.proposer_id,c.status,c.revision,s.run_id,s.source_revision,s.source_digest FROM cg03_case c JOIN payroll_run_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_run_review_ref WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='PAYROLL_RUN_RELEASE' "+(lock?"FOR UPDATE OF c":"FOR SHARE OF c"),[a.realmId,id(ref)])).rows[0];
  if(!c)throw new NotFoundException("Payroll run review unavailable");return c;
 }
 async submit(token:string,ref:string,raw:unknown){return this.compensation.run(token,"payroll.runs.manage",async(tx,a)=>{
  const x=fields(raw,["requestKey","expectedRevision"]),key=id(x.requestKey),expected=version(x.expectedRevision),requestDigest=hash([id(ref),expected]);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN-WRITE:"+a.realmId]);
  await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
  const r=await this.runs.row(tx,a,ref,true);
  const prior=(await tx.query<{id:string;request_digest:string;case_number:string}>("SELECT id,request_digest,case_number FROM cg03_case WHERE realm_id=$1 AND proposer_id=$2 AND request_key=$3 AND case_kind='PAYROLL_RUN_RELEASE'",[a.realmId,a.accountId,key])).rows[0];
  if(prior){if(prior.request_digest!==requestDigest||r.approval_case_ref!==prior.id)throw stale();return {caseNumber:prior.case_number,status:r.status,replayed:true};}
  if(r.revision!==expected||r.status!=="CALCULATED")throw stale();
  const src=await this.runs.reviewSource(tx,a,ref,true,true);
  await this.protectedOwner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
  if(r.creator!==a.accountId)await this.protectedOwner.requireDistinctFinalReviewer(tx,a.realmId,r.creator);
  const snapshot=(await tx.query<{id:string}>("INSERT INTO payroll_run_review_snapshot(root_realm_id,run_id,source_revision,source_digest,submitted_by) VALUES($1,$2,$3,$4,$5) RETURNING id",[a.realmId,r.id,expected,src.digest,a.accountId])).rows[0];
  const process=await this.process(tx,a);
  const c=(await tx.query<{id:string;case_number:string}>(`INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,payroll_run_review_ref,payroll_run_revision,payroll_run_digest)
   SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,'Protected payroll run','Payroll run release',NULL,NULL,$3,$4,$5,$6,'PAYROLL_RUN_RELEASE',$7,$3,$4 FROM cg03_process p WHERE p.realm_id=$1 AND p.id=$8 RETURNING id,case_number`,[a.realmId,a.accountId,expected,src.digest,requestDigest,key,snapshot.id,process])).rows[0];
  if(!c)throw stale();
  await this.runs.applyReview(tx,a,r.id,"SUBMITTED",expected,c.id,null);await this.event(tx,a,c.id,"SUBMITTED");
  return {caseNumber:c.case_number,status:"SUBMITTED",replayed:false};
 });}
 async list(token:string){return this.compensation.run(token,"payroll.sensitive.approve",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
  const rows=(await tx.query<Case>("SELECT c.id,c.case_number,c.proposer_id,c.status,c.revision,s.run_id,s.source_revision,s.source_digest FROM cg03_case c JOIN payroll_run_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_run_review_ref WHERE c.realm_id=$1 AND c.case_kind='PAYROLL_RUN_RELEASE' AND c.status='SUBMITTED' AND c.proposer_id<>$2 ORDER BY c.submitted_at DESC,c.id DESC LIMIT 100",[a.realmId,a.accountId])).rows;
  const items=[];for(const c of rows){try{const src=await this.runs.reviewSource(tx,a,c.run_id);if(src.row.creator===a.accountId)continue;items.push({ref:c.id,caseNumber:c.case_number,kind:"RUN",preview:src.preview});}catch(e){if(!(e instanceof ForbiddenException)&&!(e instanceof NotFoundException)&&!(e instanceof ConflictException))throw e;}}
  return {items};
 });}
 async detail(token:string,ref:string){return this.compensation.run(token,"payroll.sensitive.approve",async(tx,a)=>{
  await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
  const c=await this.original(tx,a,ref),src=await this.runs.reviewSource(tx,a,c.run_id);
  const canReview=c.status==="SUBMITTED"&&src.row.status==="SUBMITTED"&&src.row.revision===c.source_revision+1&&src.row.approval_case_ref===c.id&&src.digest===c.source_digest&&c.proposer_id!==a.accountId&&src.row.creator!==a.accountId;
  const history=(await tx.query("SELECT action,accepted_case_revision AS revision,created_at AS at FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 ORDER BY accepted_case_revision",[a.realmId,c.id])).rows;
  return {caseNumber:c.case_number,status:c.status,revision:c.revision,kind:"RUN",preview:src.preview,canReview,history};
 });}
 async decide(token:string,ref:string,raw:unknown){return this.compensation.run(token,"payroll.sensitive.approve",async(tx,a)=>{
  const x=fields(raw,["requestKey","expectedRevision","action","currentPassword"]),key=id(x.requestKey),expected=version(x.expectedRevision),action=option(x.action,["APPROVE","RETURN","REJECT"] as const);
  if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Enter the current Foundation password");
  await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["CG11-RUN-WRITE:"+a.realmId]);
  const c=await this.original(tx,a,ref,true),r=await this.runs.row(tx,a,c.run_id,true);
  if(c.proposer_id===a.accountId||r.creator===a.accountId)throw new ForbiddenException("Independent payroll reviewer required");
  await this.sessions.requireFreshFoundationRootProof(tx,a,x.currentPassword);
  const requestDigest=hash([id(ref),expected,action]);
  const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,c.id,key])).rows[0];
  if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==requestDigest)throw stale();return {status:r.status,replayed:true};}
  const src=await this.runs.reviewSource(tx,a,c.run_id,true,action==="APPROVE");
  if(c.revision!==expected||c.status!=="SUBMITTED"||r.status!=="SUBMITTED"||r.revision!==c.source_revision+1||r.approval_case_ref!==c.id||src.digest!==c.source_digest)throw stale();
  const status=action==="APPROVE"?"APPROVED_FROZEN":action==="RETURN"?"RETURNED":"REJECTED";
  await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",[a.realmId,c.id,status==="APPROVED_FROZEN"?"PENDING_OWNER":status,expected]);
  const d=(await tx.query<{id:string}>("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'',now()) RETURNING id",[a.realmId,c.id,a.accountId,action,expected,expected+1,key,requestDigest])).rows[0];
  await this.runs.applyReview(tx,a,r.id,status,r.revision,c.id,d.id);await this.event(tx,a,c.id,status==="APPROVED_FROZEN"?"FINAL_APPROVED":status);
  if(status==="APPROVED_FROZEN"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,c.id]);await this.event(tx,a,c.id,"OWNER_COMPLETED");}
  return {status,replayed:false};
 },a=>this.sessions.limitFoundationRootProof(a));}
}
