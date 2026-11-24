import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor as Actor} from "../../cg-01-identity-access/public-api";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {PayrollCompensationService} from "../../cg-11-payroll-compensation/application/payroll-compensation.service";
import {fields,id,option} from "../../cg-11-payroll-compensation/domain/payroll-input";
type Kind="POLICY"|"COMPENSATION"|"PAYOUT";
type Case={id:string;case_number:string;proposer_id:string;payroll_review_ref:string;payroll_source_digest:string;status:string;revision:number;source_kind:Kind;source_ref:string};
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const stale=()=>new ConflictException("Payroll approval source changed. Refresh and review the current record.");
const version=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<1)throw stale();return Number(v);};
const kindOf=(v:unknown)=>option(v,["POLICY","COMPENSATION","PAYOUT"] as const);
@Injectable()
export class PayrollCompensationReviewService{
 constructor(private readonly source:PayrollCompensationService,private readonly identity:FoundationStructureIdentityFacade,private readonly protectedOwner:ProtectedAccessOwnerService,private readonly sessions:SessionService){}
 private async event(tx:PoolClient,a:Actor,ref:string,action:string){
  await tx.query("INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,correlation_ref) VALUES($1,$2,$3,$4,1,$5)",[a.realmId,ref,a.accountId,action,randomUUID()]);
 }
 private async process(tx:PoolClient,a:Actor){
  const existing=(await tx.query<{process_id:string}>("SELECT p.id AS process_id FROM cg03_payroll_review_process_current cur JOIN cg03_process p ON p.id=cur.process_id AND p.realm_id=cur.realm_id WHERE cur.realm_id=$1 AND p.process_kind='PAYROLL_COMPENSATION_REVIEW' FOR SHARE OF p",[a.realmId])).rows[0];
  if(existing)return existing.process_id;
  const p=(await tx.query<{id:string}>("INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by,process_kind) SELECT $1,COALESCE(MAX(version),0)+1,NULL,$2,'PAYROLL_COMPENSATION_REVIEW' FROM cg03_process WHERE realm_id=$1 RETURNING id",[a.realmId,a.accountId])).rows[0];
  await tx.query("INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required) VALUES($1,1,'approvals.review',true)",[p.id]);
  await tx.query("INSERT INTO cg03_payroll_review_process_current(realm_id,process_id) VALUES($1,$2)",[a.realmId,p.id]);return p.id;
 }
 private async original(tx:PoolClient,a:Actor,ref:string,lock=false){
  const c=(await tx.query<Case>("SELECT c.*,s.source_kind,COALESCE(s.policy_ref,s.compensation_ref,s.payout_ref) AS source_ref FROM cg03_case c JOIN payroll_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_review_ref WHERE c.realm_id=$1 AND c.id=$2 AND c.case_kind='PAYROLL_COMPENSATION_REVIEW' "+(lock?"FOR UPDATE OF c":"FOR SHARE OF c"),[a.realmId,id(ref)])).rows[0];
  if(!c)throw new NotFoundException("Payroll review unavailable");return c;
 }
 async submit(token:string,kindInput:string,refInput:string,raw:unknown){
  const kind=kindOf(kindInput),ref=id(refInput),x=fields(raw,["requestKey","expectedRevision"]),key=id(x.requestKey),expected=version(x.expectedRevision),requestDigest=hash([kind,ref,expected]);
  return this.source.run(token,kind==="POLICY"?"payroll.policy.manage":kind==="PAYOUT"?"payroll.bank.edit":"payroll.compensation.edit",async(tx,a)=>{
   await tx.query("SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE",[a.realmId]);
   const src=await this.source.reviewSource(tx,a,kind,ref,true);
   const prior=(await tx.query<{id:string;request_digest:string;case_number:string}>("SELECT id,request_digest,case_number FROM cg03_case WHERE realm_id=$1 AND proposer_id=$2 AND request_key=$3 AND case_kind='PAYROLL_COMPENSATION_REVIEW'",[a.realmId,a.accountId,key])).rows[0];
   if(prior){if(prior.request_digest!==requestDigest||src.row.approval_case_ref!==prior.id)throw stale();return {caseNumber:prior.case_number,status:src.row.status,replayed:true};}
   if(src.row.status!=="DRAFT"||src.row.revision!==expected||expected!==1||src.row.created_by!==a.accountId)throw stale();
   await this.protectedOwner.requireDistinctFinalReviewer(tx,a.realmId,a.accountId);
   const snapshot=(await tx.query<{id:string}>("INSERT INTO payroll_review_snapshot(root_realm_id,source_kind,policy_ref,compensation_ref,payout_ref,source_revision,source_digest,submitted_by) VALUES($1,$2,$3,$4,$5,1,$6,$7) RETURNING id",[a.realmId,kind,kind==="POLICY"?ref:null,kind==="COMPENSATION"?ref:null,kind==="PAYOUT"?ref:null,src.digest,a.accountId])).rows[0];
   const process=await this.process(tx,a);
   const c=(await tx.query<{id:string;case_number:string}>(`INSERT INTO cg03_case(realm_id,case_number,process_id,process_version,proposer_id,target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,expected_access_version,expected_role_revision,proposal_revision,proposal_digest,request_digest,request_key,case_kind,payroll_review_ref,payroll_source_revision,payroll_source_digest)
    SELECT $1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),p.id,p.version,$2,NULL,NULL,'Protected payroll source','Payroll compensation review',NULL,NULL,1,$3,$4,$5,'PAYROLL_COMPENSATION_REVIEW',$6,1,$3 FROM cg03_process p WHERE p.realm_id=$1 AND p.id=$7 RETURNING id,case_number`,[a.realmId,a.accountId,src.digest,requestDigest,key,snapshot.id,process])).rows[0];
   if(!c)throw stale();
   await this.source.applyReview(tx,a,kind,ref,"SUBMITTED",1,c.id);await this.event(tx,a,c.id,"SUBMITTED");
   return {caseNumber:c.case_number,status:"SUBMITTED",replayed:false};
  });
 }
 async list(token:string){
  return this.source.run(token,"payroll.sensitive.approve",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
   const rows=(await tx.query<{id:string;case_number:string;source_kind:Kind;source_ref:string}>("SELECT c.id,c.case_number,s.source_kind,COALESCE(s.policy_ref,s.compensation_ref,s.payout_ref) AS source_ref FROM cg03_case c JOIN payroll_review_snapshot s ON s.root_realm_id=c.realm_id AND s.id=c.payroll_review_ref WHERE c.realm_id=$1 AND c.case_kind='PAYROLL_COMPENSATION_REVIEW' AND c.status='SUBMITTED' AND c.proposer_id<>$2 ORDER BY c.submitted_at DESC,c.id DESC LIMIT 100",[a.realmId,a.accountId])).rows;
   const items=[];for(const row of rows){try{const src=await this.source.reviewSource(tx,a,row.source_kind,row.source_ref);items.push({ref:row.id,caseNumber:row.case_number,kind:row.source_kind,preview:src.preview});}catch(e){if(!(e instanceof ForbiddenException)&&!(e instanceof NotFoundException))throw e;}}
   return {items};
  });
 }
 async detail(token:string,ref:string){
  return this.source.run(token,"payroll.sensitive.approve",async(tx,a)=>{
   await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
   const c=await this.original(tx,a,ref),src=await this.source.reviewSource(tx,a,c.source_kind,c.source_ref);
   const canReview=c.status==="SUBMITTED"&&src.row.status==="SUBMITTED"&&src.row.revision===2&&src.row.approval_case_ref===c.id&&src.digest===c.payroll_source_digest&&c.proposer_id!==a.accountId&&src.row.created_by!==a.accountId;
   const history=(await tx.query("SELECT action,accepted_case_revision AS revision,created_at AS at FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 ORDER BY accepted_case_revision",[a.realmId,c.id])).rows;
   return {caseNumber:c.case_number,status:c.status,revision:c.revision,kind:c.source_kind,preview:src.preview,canReview,history};
  });
 }
 async decide(token:string,refInput:string,raw:unknown){
  return this.source.run(token,"payroll.sensitive.approve",async(tx,a)=>{
   const ref=id(refInput),x=fields(raw,["requestKey","expectedRevision","action","currentPassword"]),key=id(x.requestKey),expected=version(x.expectedRevision),action=option(x.action,["APPROVE","RETURN","REJECT"] as const);
   if(typeof x.currentPassword!=="string"||x.currentPassword.length<8||Buffer.byteLength(x.currentPassword,"utf8")>1024)throw new BadRequestException("Enter the current Foundation password");
   const password=x.currentPassword,requestDigest=hash([ref,expected,action]);
   await this.identity.assertCurrent(tx,a,"approvals.review");await this.protectedOwner.verifyReviewer(tx,a,"approvals.review",true);
   const c=await this.original(tx,a,ref,true),src=await this.source.reviewSource(tx,a,c.source_kind,c.source_ref,action==="APPROVE");
   if(c.proposer_id===a.accountId||src.row.created_by===a.accountId)throw new ForbiddenException("Independent payroll reviewer required");
   await this.sessions.requireFreshFoundationRootProof(tx,a,password);
   const prior=(await tx.query<{actor_id:string;request_digest:string}>("SELECT actor_id,request_digest FROM cg03_case_decision WHERE realm_id=$1 AND case_id=$2 AND request_key=$3",[a.realmId,c.id,key])).rows[0];
   if(prior){if(prior.actor_id!==a.accountId||prior.request_digest!==requestDigest)throw stale();return {status:src.row.status,replayed:true};}
   if(c.revision!==expected||c.status!=="SUBMITTED"||src.row.revision!==2||src.row.status!=="SUBMITTED"||src.row.approval_case_ref!==c.id||src.digest!==c.payroll_source_digest)throw stale();
   const status=action==="APPROVE"?"APPROVED":action==="RETURN"?"RETURNED":"REJECTED";
   await tx.query("UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2 AND revision=$4",[a.realmId,c.id,status==="APPROVED"?"PENDING_OWNER":status,expected]);
   await tx.query("INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks,fresh_password_verified_at) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,'',now())",[a.realmId,c.id,a.accountId,action,expected,expected+1,key,requestDigest]);
   await this.source.applyReview(tx,a,c.source_kind,c.source_ref,status,2,c.id);await this.event(tx,a,c.id,status==="APPROVED"?"FINAL_APPROVED":status);
   if(status==="APPROVED"){await tx.query("UPDATE cg03_case SET status='OWNER_COMPLETED',revision=revision+1,updated_at=now() WHERE realm_id=$1 AND id=$2",[a.realmId,c.id]);await this.event(tx,a,c.id,"OWNER_COMPLETED");}
   return {status,replayed:false};
  },a=>this.sessions.limitFoundationRootProof(a));
 }
}
