import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {HealthcareFoundationPostingFacade}
 from "../../cg-09-finance-accounting/application/healthcare-foundation-posting.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(v:unknown):string{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"HEALTHCARE_JOURNAL_REFERENCE_INVALID"});
 return v;
}
type Source={id:string;center_ref:string;source_ref:string;amount_minor:string;
 service_local_date:string;source_digest:string;effect_id:string;
 effect_amount_minor:string;effect_digest:string;effect_key:string;
 posting_state:string;original_cg09_ref:string|null};
@Injectable()
/** CG17 records posting status, CG09 alone owns balanced journal and accounts.
 * One local database transaction prevents a lost reply from double-posting.
 */
export class FoundationJournalReconciliationService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly cg09:HealthcareFoundationPostingFacade){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let open=false;
  try{
   await c.query("BEGIN");open=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const v=await run(c);await c.query("COMMIT");open=false;return v;
  }catch(e){if(open)try{await c.query("ROLLBACK")}catch{}throw e;}
  finally{c.release()}
 }
 private async actor(c:PoolClient,token:string,post:boolean){
  const action=post?"healthcare.assistance.liabilities.manage":
   "healthcare.assistance.liabilities.view";
  const a=await this.sessions.requireAction(token,action);
  await this.identity.assertCurrent(c,a,action);
  await this.identity.assertCurrent(c,a,post?
   "finance.journals.post":"finance.accounts.view");
  return a;
 }
 private async source(c:PoolClient,root:string,center:string,ref:string,lock=false){
  const q=await c.query<Source>(
   "SELECT l.id,l.center_ref,l.source_ref,l.amount_minor::text,"+
   "l.service_local_date::text,l.source_digest,e.id AS effect_id,"+
   "e.amount_minor::text AS effect_amount_minor,"+
   "e.source_digest AS effect_digest,e.idempotency_key AS effect_key,"+
   "e.posting_state,e.original_cg09_ref FROM foundation_liability l "+
   "JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id "+
   "AND e.liability_ref=l.id AND e.effect_kind='LIABILITY_ACCRUAL' "+
   "WHERE l.root_realm_id=$1 AND l.center_ref=$2 AND l.id=$3 "+
   (lock?"FOR UPDATE OF e":"FOR SHARE OF e"),[root,center,ref]);
  const row=q.rows[0];
  if(!row||row.effect_amount_minor!==row.amount_minor||
    row.effect_digest!==row.source_digest||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.service_local_date))
   throw new NotFoundException({code:"HEALTHCARE_LIABILITY_SOURCE_UNAVAILABLE"});
  return row;
 }
 private view(s:Source){
  return {liabilityRef:s.id,amountMinor:s.amount_minor,
   currency:"INR" as const,postingDate:s.service_local_date,
   postingState:s.posting_state,
   foundationJournalPosted:s.posting_state==="POSTED"&&!!s.original_cg09_ref};
 }
 async options(token:string,centerRaw:string,liabilityRaw:string){
  const center=id(centerRaw),liability=id(liabilityRaw);
  return this.tx(async c=>{
   const a=await this.actor(c,token,false);
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.view",false);
   const s=await this.source(c,a.realmId,center,liability);
   const account=s.posting_state==="POSTED"?
    {financialYears:[],accounts:[],complete:true}:
    await this.cg09.options(c,a,s.service_local_date);
   return {...this.view(s),...account,originalRequestKey:s.effect_key};
  });
 }
 async post(token:string,centerRaw:string,liabilityRaw:string,raw:unknown){
  const center=id(centerRaw),liability=id(liabilityRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==4||
    !["requestKey","financialYearRef","expenseAccountRef","liabilityAccountRef"]
      .every(k=>k in raw))
   throw new BadRequestException({code:"HEALTHCARE_JOURNAL_INVALID"});
  const data=raw as Record<string,unknown>;
  const requestKey=id(data.requestKey),year=id(data.financialYearRef),
   expense=id(data.expenseAccountRef),payable=id(data.liabilityAccountRef);
  return this.tx(async c=>{
   const a=await this.actor(c,token,true);
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.manage",false);
   const s=await this.source(c,a.realmId,center,liability,true);
   if(requestKey!==s.effect_key)
    throw new ConflictException({code:"HEALTHCARE_JOURNAL_ORIGINAL_REQUEST_REQUIRED"});
   if(s.posting_state==="POSTED"){
    if(!s.original_cg09_ref)
     throw new ConflictException({code:"HEALTHCARE_JOURNAL_UNVERIFIED"});
    const ok=await c.query(
     "SELECT 1 FROM journal j "+
     "JOIN journal_line debit ON debit.journal_id=j.id "+
     "AND debit.root_realm_id=j.root_realm_id "+
     "JOIN journal_line credit ON credit.journal_id=j.id "+
     "AND credit.root_realm_id=j.root_realm_id "+
     "WHERE j.id=$1 AND j.root_realm_id=$2 AND j.source_owner='CG-09' "+
     "AND j.source_ref=$3 AND j.posting_kind='GENERAL' "+
     "AND j.immutable_source_event_key=$4 "+
     "AND j.immutable_payload_digest=$5 "+
     "AND j.financial_year_id=$6 AND j.posting_date=$7::date "+
     "AND j.status='POSTED' AND debit.account_id=$8 "+
     "AND debit.debit_minor=$9::bigint AND debit.credit_minor=0 "+
     "AND debit.branch_id IS NULL AND credit.account_id=$10 "+
     "AND credit.credit_minor=$9::bigint AND credit.debit_minor=0 "+
     "AND credit.branch_id IS NULL AND j.reversal_of_id IS NULL "+
     "AND NOT EXISTS (SELECT 1 FROM journal offset_j "+
     "WHERE offset_j.root_realm_id=j.root_realm_id "+
     "AND offset_j.reversal_of_id=j.id AND offset_j.status='POSTED') "+
     "AND (SELECT count(*) FROM journal_line exact "+
     "WHERE exact.root_realm_id=j.root_realm_id "+
     "AND exact.journal_id=j.id)=2",
     [s.original_cg09_ref,a.realmId,s.effect_id,s.effect_key,
      s.effect_digest,year,s.service_local_date,expense,s.amount_minor,payable]);
    if(!ok.rowCount)
     throw new ConflictException({code:"HEALTHCARE_JOURNAL_REPLAY_CONFLICT"});
    return {...this.view(s),replayed:true};
   }
   if(s.posting_state!=="PENDING"&&s.posting_state!=="UNKNOWN")
    throw new ConflictException({code:"HEALTHCARE_JOURNAL_NOT_READY"});
   const journal=await this.cg09.postAccrual(c,a,{
    financialYearRef:year,expenseAccountRef:expense,
    liabilityAccountRef:payable,effectRef:s.effect_id,
    effectKey:s.effect_key,immutableDigest:s.effect_digest,
    amountMinor:s.amount_minor,postingDate:s.service_local_date
   });
   const saved=await c.query(
    "UPDATE cg17_financial_effect SET posting_state='POSTED',"+
    "original_cg09_ref=$4,updated_at=now() WHERE root_realm_id=$1 "+
    "AND id=$2 AND liability_ref=$3 AND posting_state IN('PENDING','UNKNOWN') "+
    "AND original_cg09_ref IS NULL RETURNING id",
    [a.realmId,s.effect_id,liability,journal]);
   if(!saved.rowCount)
    throw new ConflictException({code:"HEALTHCARE_JOURNAL_CONCURRENT_RETRY"});
   return {...this.view({...s,posting_state:"POSTED",original_cg09_ref:journal}),
    replayed:false};
  });
 }
}
