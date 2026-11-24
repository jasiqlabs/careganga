import {ConflictException,Inject,Injectable,Logger,OnModuleDestroy,OnModuleInit,ServiceUnavailableException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {decryptPayoutForDispatch,matchesPayoutEvidence} from "../../cg-11-payroll-compensation/domain/payout-instruction";
import {payrollReadbackConfig,readbackEnabled,readOriginalPayout,dispatchEnabled,checkDispatchBalance,sendApprovedPayout,type Dispatch} from "../infrastructure/payroll-razorpayx-readback";
type Claim={id:string;root_realm_id:string;item_ref:string;provider_claim:string;provider_checks:number;provider_ref:string|null;provider_connection_ref:string;provider_credential_revision:number;provider_account_binding:string;amount_minor:string};
@Injectable()
export class PayrollProviderReadbackService implements OnModuleInit,OnModuleDestroy{
 private timer:ReturnType<typeof setInterval>|null=null;private busy=false;private stopped=false;
 private readonly log=new Logger(PayrollProviderReadbackService.name);
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly identity:FoundationStructureIdentityFacade,private readonly protectedOwner:ProtectedAccessOwnerService){}
 onModuleInit(){if(!readbackEnabled())return;this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref?.();void this.tick();}
 onModuleDestroy(){this.stopped=true;if(this.timer)clearInterval(this.timer);}
 async enqueue(tx:PoolClient,root:string,voucher:string,dispatchActor:string|null=null){
  if(!readbackEnabled()){if(dispatchActor)throw new ServiceUnavailableException("Bank payout is disabled");return null;}
  const t=(await tx.query<{id:string;payment_account_ref:string;method:string}>(`SELECT t.id,b.payment_account_ref,b.method FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref WHERE t.root_realm_id=$1 AND t.voucher_ref=$2 FOR UPDATE OF t`,[root,voucher])).rows[0];
  if(!t||t.method!=="BANK"){if(dispatchActor)throw new ConflictException("An original payroll bank voucher is required");return null;}
  const c=payrollReadbackConfig();if(!c)throw new ServiceUnavailableException("Payroll bank readback configuration unavailable");
  if(c.root!==root||c.bank!==t.payment_account_ref){if(dispatchActor)throw new ConflictException("Selected bank is not authorized for the configured payroll readback");return null;}
  const connection=(await tx.query<{id:string;credential_revision:number}>(`SELECT id,credential_revision FROM integration_connection WHERE foundation_realm_id=$1 AND provider='razorpayx' AND purpose='payroll' AND secret_reference=$2 AND verification_status='VERIFIED' AND last_checked_credential_revision=credential_revision FOR SHARE`,[root,c.reference])).rows[0];
  if(!connection)throw new ServiceUnavailableException("Verify the dedicated payroll payout connection before requesting payment");
  await tx.query(`UPDATE payroll_payout_attempt SET provider_connection_ref=$3,provider_credential_revision=$4,provider_account_binding=$6,provider_state=CASE WHEN $5::uuid IS NULL THEN 'AWAITING_BANK' ELSE 'UNKNOWN_WRITE_STATUS' END,provider_due_at=CASE WHEN $5::uuid IS NULL THEN now() ELSE now()+interval '30 seconds' END,dispatch_actor_ref=$5,dispatch_authorized_at=CASE WHEN $5::uuid IS NULL THEN NULL ELSE now() END WHERE root_realm_id=$1 AND id=$2 AND provider_state='NOT_ENABLED'`,[root,t.id,connection.id,connection.credential_revision,dispatchActor,c.binding]);
  return t.id;
 }
 /** Only callable during the fresh authorized Finance request. No worker dispatch. */
 async prepareDispatch(tx:PoolClient,root:string,voucher:string):Promise<Dispatch>{
  const c=payrollReadbackConfig();if(!c||!dispatchEnabled()||root!==c.root)throw new ServiceUnavailableException("Bank payout dispatch unavailable");
  const p=(await tx.query<{id:string;employee_ref:string;amount:string;instruction:string;destination_ciphertext:string;destination_nonce:string;destination_tag:string;destination_fingerprint:string}>(`SELECT t.id,l.employee_ref,t.amount_minor::text amount,d.id instruction,d.destination_ciphertext,d.destination_nonce,d.destination_tag,d.destination_fingerprint
   FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref
   JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK'
   JOIN employee_payout_instruction_effective d ON d.root_realm_id=i.root_realm_id AND d.id=i.destination_ref AND d.employee_ref=l.employee_ref AND d.revision=i.destination_revision AND d.destination_fingerprint=i.destination_fingerprint AND d.status='APPROVED'
   WHERE t.root_realm_id=$1 AND t.voucher_ref=$2 AND b.payment_account_ref=$3 AND t.provider_state='NOT_ENABLED' AND d.effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (d.effective_until IS NULL OR d.effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date) FOR SHARE OF t,i,l,b`,[root,voucher,c.bank])).rows[0];
  if(!p)throw new ConflictException("Original approved payout destination unavailable");
  const destination=decryptPayoutForDispatch(root,p.employee_ref,p.instruction,{ciphertext:p.destination_ciphertext,nonce:p.destination_nonce,tag:p.destination_tag,fingerprint:p.destination_fingerprint});
  if(BigInt(p.amount)<100n||destination.holder.length<4||destination.holder.length>50)throw new ConflictException("Approved recipient or amount is not eligible for configured bank payout");
  return {id:p.id,employee:p.employee_ref,amount:p.amount,destination};
 }
 async preflight(root:string,voucher:string){
  const c=payrollReadbackConfig();if(!c||!dispatchEnabled()||root!==c.root)throw new ServiceUnavailableException("Bank payout dispatch unavailable");
  const original=(await this.db.query<{amount:string}>(`SELECT t.amount_minor::text amount FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK' JOIN finance_voucher v ON v.root_realm_id=t.root_realm_id AND v.id=t.voucher_ref AND v.status='APPROVED' WHERE t.root_realm_id=$1 AND t.voucher_ref=$2 AND b.payment_account_ref=$3`,[root,voucher,c.bank])).rows[0];
  if(!original||!await checkDispatchBalance(c,original.amount))throw new ConflictException({code:"FINANCE_PAYROLL_BANK_FUNDS_UNAVAILABLE",message:"Selected bank balance is unavailable, stale or insufficient including configured fees."});
 }
 async dispatchOnce(actor:VerifiedFoundationActor,payload:Dispatch){
  const c=payrollReadbackConfig();if(!c||actor.realmId!==c.root||!dispatchEnabled())return;
  // Fresh staff session and protected authority are rechecked immediately
  // before claiming the one send. No worker can use this path or impersonate it.
  const tx=await this.db.connect();let claimed=false;
  try{
   await tx.query("BEGIN");await this.identity.assertCurrent(tx,actor,"finance.vouchers.manage");await this.protectedOwner.verifyReviewer(tx,actor,"approvals.review",true);
   const account=await tx.query("SELECT 1 FROM finance_account WHERE root_realm_id=$1 AND id=$2 AND account_kind='BANK' AND status='ACTIVE' FOR UPDATE",[actor.realmId,c.bank]);
   if(!account.rowCount)throw new ConflictException("Selected bank is unavailable");
   const current=(await tx.query<{voucher_ref:string;employee_ref:string;destination_fingerprint:string}>(`SELECT t.voucher_ref,l.employee_ref,i.destination_fingerprint FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref JOIN hr_employee employee ON employee.root_realm_id=l.root_realm_id AND employee.id=l.employee_ref
    JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref AND b.method='BANK' AND b.payment_account_ref=$3
    JOIN employee_payout_instruction_effective d ON d.root_realm_id=i.root_realm_id AND d.id=i.destination_ref AND d.employee_ref=l.employee_ref AND d.revision=i.destination_revision AND d.destination_fingerprint=i.destination_fingerprint AND d.status='APPROVED' AND d.effective_from<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND (d.effective_until IS NULL OR d.effective_until>(now() AT TIME ZONE 'Asia/Kolkata')::date)
    JOIN finance_voucher v ON v.root_realm_id=t.root_realm_id AND v.id=t.voucher_ref AND v.status='PAYMENT_REQUESTED' AND v.payment_account_id=$3 AND v.credit_account_id=$3
    JOIN cash_bank_account bank ON bank.root_realm_id=v.root_realm_id AND bank.account_id=v.payment_account_id AND bank.status='ACTIVE' AND bank.kind='BANK'
    JOIN integration_connection cfg ON cfg.foundation_realm_id=t.root_realm_id AND cfg.id=t.provider_connection_ref AND cfg.credential_revision=t.provider_credential_revision AND cfg.verification_status='VERIFIED' AND cfg.secret_reference=$4 AND cfg.provider='razorpayx' AND cfg.purpose='payroll'
    JOIN cg03_case cs ON cs.realm_id=v.root_realm_id AND cs.id=v.approval_case_id AND cs.case_kind='FINANCE_VOUCHER' AND cs.finance_voucher_id=v.id AND cs.finance_voucher_revision=v.version AND cs.status IN('PENDING_OWNER','OWNER_COMPLETED')
    JOIN cg03_finance_owner_effect effect ON effect.realm_id=cs.realm_id AND effect.case_id=cs.id
    JOIN cg03_case_decision decision ON decision.realm_id=cs.realm_id AND decision.case_id=cs.id AND decision.id=effect.final_decision_id AND decision.action='APPROVE' AND decision.fresh_password_verified_at IS NOT NULL AND decision.actor_id<>cs.proposer_id AND decision.actor_id<>v.created_by
    JOIN account signer ON signer.realm_id=decision.realm_id AND signer.id=decision.actor_id AND signer.status='ACTIVE'
    WHERE t.root_realm_id=$1 AND t.id=$2 AND t.dispatch_actor_ref=$5 AND t.provider_account_binding=$6 AND t.amount_minor=$7::bigint AND l.employee_ref=$8
    AND t.dispatch_authorized_at>now()-interval '1 minute' AND t.dispatch_started_at IS NULL AND t.provider_state='UNKNOWN_WRITE_STATUS' AND t.provider_claim IS NULL AND t.provider_checks=0
    AND EXISTS(SELECT 1 FROM account_role ar JOIN role role ON role.id=ar.role_id AND role.realm_id=ar.realm_id AND role.active AND role.is_protected WHERE ar.realm_id=signer.realm_id AND ar.account_id=signer.id AND ar.revoked_at IS NULL)
    AND cg11_reconciled_bank_available(t.root_realm_id,b.payment_account_ref,t.voucher_ref)>=t.amount_minor
    FOR UPDATE OF t,employee`,[actor.realmId,payload.id,c.bank,c.reference,actor.accountId,c.binding,payload.amount,payload.employee])).rows[0];
   if(!current)throw new ConflictException("Current bank payout authority or source changed");
   if(!matchesPayoutEvidence(actor.realmId,current.employee_ref,current.destination_fingerprint,{accountHolder:payload.destination.holder,accountNumber:payload.destination.account,ifsc:payload.destination.ifsc}))throw new ConflictException("Approved bank destination changed");
   const saved=await tx.query("UPDATE payroll_payout_attempt SET dispatch_started_at=now() WHERE root_realm_id=$1 AND id=$2 AND dispatch_started_at IS NULL RETURNING id",[actor.realmId,payload.id]);
   if(!saved.rowCount)throw new ConflictException("Original bank dispatch already claimed");
   await tx.query("COMMIT");claimed=true;
  }catch{await tx.query("ROLLBACK").catch(()=>undefined);}finally{tx.release();}
  if(!claimed){this.log.warn("Payroll dispatch not sent; original attempt requires reconciliation");return;}
  try{await sendApprovedPayout(c,payload);}catch{/* Unknown write remains durable. Never send again from worker. */}
  await this.db.query("UPDATE payroll_payout_attempt SET provider_due_at=now() WHERE root_realm_id=$1 AND id=$2 AND provider_state='UNKNOWN_WRITE_STATUS' AND provider_claim IS NULL",[actor.realmId,payload.id]).catch(()=>undefined);
  void this.tick();
 }
 private async claim(){
  return (await this.db.query<Claim>(`WITH due AS(SELECT id FROM payroll_payout_attempt WHERE provider_due_at<=now() AND provider_checks<8 AND (provider_claim_until IS NULL OR provider_claim_until<=now()) ORDER BY provider_due_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
   UPDATE payroll_payout_attempt t SET provider_claim=gen_random_uuid(),provider_claim_until=now()+interval '2 minutes',provider_checks=provider_checks+1 FROM due WHERE t.id=due.id
   RETURNING t.id,t.root_realm_id,t.item_ref,t.provider_claim,t.provider_checks,t.provider_ref,t.provider_connection_ref,t.provider_credential_revision,t.provider_account_binding,t.amount_minor::text`)).rows[0];
 }
 private async settle(t:Claim){
  const c=payrollReadbackConfig();
  const source=(await this.db.query<{employee_ref:string;destination_fingerprint:string;payment_account_ref:string;secret_reference:string}>(`SELECT l.employee_ref,i.destination_fingerprint,b.payment_account_ref,c.secret_reference
   FROM payroll_batch_item i JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref
   JOIN integration_connection c ON c.foundation_realm_id=i.root_realm_id AND c.id=$3 AND c.credential_revision=$4 AND c.verification_status='VERIFIED' AND c.provider='razorpayx' AND c.purpose='payroll'
   WHERE i.root_realm_id=$1 AND i.id=$2 AND b.method='BANK'`,[t.root_realm_id,t.item_ref,t.provider_connection_ref,t.provider_credential_revision])).rows[0];
  const result=c&&source&&c.bank===source.payment_account_ref&&c.reference===source.secret_reference&&c.binding===t.provider_account_binding?await readOriginalPayout(c,{id:t.id,root:t.root_realm_id,employee:source.employee_ref,fingerprint:source.destination_fingerprint,amount:t.amount_minor,priorRef:t.provider_ref}):{state:"UNKNOWN_WRITE_STATUS" as const,providerRef:t.provider_ref};
  const retry=["PROCESSING","UNKNOWN_WRITE_STATUS"].includes(result.state);
  const next=retry&&t.provider_checks>=8?"EXHAUSTED":result.state;
  await this.db.query(`UPDATE payroll_payout_attempt SET provider_state=$4,provider_ref=$5,provider_utr_digest=$6,provider_checked_at=now(),provider_claim=NULL,provider_claim_until=NULL,
   provider_due_at=CASE WHEN $4 IN('PROCESSING','UNKNOWN_WRITE_STATUS') THEN now()+make_interval(mins=>least(120,power(2,provider_checks)::int)) ELSE NULL END
   WHERE root_realm_id=$1 AND id=$2 AND provider_claim=$3 AND provider_claim_until>now()`,[t.root_realm_id,t.id,t.provider_claim,next,result.providerRef,'utrDigest' in result?result.utrDigest??null:null]);
 }
 async tick(){
  if(this.busy||this.stopped||!readbackEnabled())return;this.busy=true;
  try{
   await this.db.query(`WITH exhausted AS(SELECT id FROM payroll_payout_attempt WHERE provider_due_at<=now() AND provider_checks=8 AND (provider_claim_until IS NULL OR provider_claim_until<=now()) ORDER BY provider_due_at,id LIMIT 25 FOR UPDATE SKIP LOCKED)
    UPDATE payroll_payout_attempt t SET provider_state='EXHAUSTED',provider_due_at=NULL,provider_claim=NULL,provider_claim_until=NULL FROM exhausted WHERE t.id=exhausted.id`);
   for(let n=0;n<4&&!this.stopped;n++){const t=await this.claim();if(!t)break;await this.settle(t);}
  }catch{this.log.warn("Payroll provider status recovery unavailable; original pending attempt retained");}finally{this.busy=false;}
 }
}
