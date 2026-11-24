import {ConflictException,Inject,Injectable,Logger,OnModuleDestroy,OnModuleInit,ServiceUnavailableException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {payrollReadbackConfig,readbackEnabled,readOriginalPayout} from "../infrastructure/payroll-razorpayx-readback";
type Claim={id:string;root_realm_id:string;item_ref:string;provider_claim:string;provider_checks:number;provider_ref:string|null;provider_connection_ref:string;provider_credential_revision:number;amount_minor:string};
@Injectable()
export class PayrollProviderReadbackService implements OnModuleInit,OnModuleDestroy{
 private timer:ReturnType<typeof setInterval>|null=null;private busy=false;private stopped=false;
 private readonly log=new Logger(PayrollProviderReadbackService.name);
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 onModuleInit(){if(!readbackEnabled())return;this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref?.();void this.tick();}
 onModuleDestroy(){this.stopped=true;if(this.timer)clearInterval(this.timer);}
 async enqueue(tx:PoolClient,root:string,voucher:string){
  if(!readbackEnabled())return null;
  const t=(await tx.query<{id:string;payment_account_ref:string;method:string}>(`SELECT t.id,b.payment_account_ref,b.method FROM payroll_payout_attempt t JOIN payroll_batch_item i ON i.root_realm_id=t.root_realm_id AND i.id=t.item_ref JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref WHERE t.root_realm_id=$1 AND t.voucher_ref=$2 FOR UPDATE OF t`,[root,voucher])).rows[0];
  if(!t||t.method!=="BANK")return null;
  const c=payrollReadbackConfig();if(!c)throw new ServiceUnavailableException("Payroll bank readback configuration unavailable");
  if(c.root!==root||c.bank!==t.payment_account_ref)throw new ConflictException("Selected bank is not authorized for the configured payroll readback");
  const connection=(await tx.query<{id:string;credential_revision:number}>(`SELECT id,credential_revision FROM integration_connection WHERE foundation_realm_id=$1 AND provider='razorpayx' AND purpose='payroll' AND secret_reference=$2 AND verification_status='VERIFIED' AND last_checked_credential_revision=credential_revision FOR SHARE`,[root,c.reference])).rows[0];
  if(!connection)throw new ServiceUnavailableException("Verify the dedicated payroll payout connection before requesting payment");
  await tx.query(`UPDATE payroll_payout_attempt SET provider_connection_ref=$3,provider_credential_revision=$4,provider_state='AWAITING_BANK',provider_due_at=now() WHERE root_realm_id=$1 AND id=$2 AND provider_state='NOT_ENABLED'`,[root,t.id,connection.id,connection.credential_revision]);
  return t.id;
 }
 private async claim(){
  return (await this.db.query<Claim>(`WITH due AS(SELECT id FROM payroll_payout_attempt WHERE provider_due_at<=now() AND provider_checks<8 AND (provider_claim_until IS NULL OR provider_claim_until<=now()) ORDER BY provider_due_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
   UPDATE payroll_payout_attempt t SET provider_claim=gen_random_uuid(),provider_claim_until=now()+interval '2 minutes',provider_checks=provider_checks+1 FROM due WHERE t.id=due.id
   RETURNING t.id,t.root_realm_id,t.item_ref,t.provider_claim,t.provider_checks,t.provider_ref,t.provider_connection_ref,t.provider_credential_revision,t.amount_minor::text`)).rows[0];
 }
 private async settle(t:Claim){
  const c=payrollReadbackConfig();
  const source=(await this.db.query<{employee_ref:string;destination_fingerprint:string;payment_account_ref:string;secret_reference:string}>(`SELECT l.employee_ref,i.destination_fingerprint,b.payment_account_ref,c.secret_reference
   FROM payroll_batch_item i JOIN payroll_line l ON l.root_realm_id=i.root_realm_id AND l.id=i.line_ref JOIN payroll_batch b ON b.root_realm_id=i.root_realm_id AND b.id=i.batch_ref
   JOIN integration_connection c ON c.foundation_realm_id=i.root_realm_id AND c.id=$3 AND c.credential_revision=$4 AND c.verification_status='VERIFIED' AND c.provider='razorpayx' AND c.purpose='payroll'
   WHERE i.root_realm_id=$1 AND i.id=$2 AND b.method='BANK'`,[t.root_realm_id,t.item_ref,t.provider_connection_ref,t.provider_credential_revision])).rows[0];
  const result=c&&source&&c.bank===source.payment_account_ref&&c.reference===source.secret_reference?await readOriginalPayout(c,{id:t.id,root:t.root_realm_id,employee:source.employee_ref,fingerprint:source.destination_fingerprint,amount:t.amount_minor,priorRef:t.provider_ref}):{state:"UNKNOWN_WRITE_STATUS" as const,providerRef:t.provider_ref};
  const retry=["PROCESSING","UNKNOWN_WRITE_STATUS"].includes(result.state);
  const next=retry&&t.provider_checks>=8?"EXHAUSTED":result.state;
  await this.db.query(`UPDATE payroll_payout_attempt SET provider_state=$4,provider_ref=$5,provider_checked_at=now(),provider_claim=NULL,provider_claim_until=NULL,
   provider_due_at=CASE WHEN $4 IN('PROCESSING','UNKNOWN_WRITE_STATUS') THEN now()+make_interval(mins=>least(120,power(2,provider_checks)::int)) ELSE NULL END
   WHERE root_realm_id=$1 AND id=$2 AND provider_claim=$3 AND provider_claim_until>now()`,[t.root_realm_id,t.id,t.provider_claim,next,result.providerRef]);
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
