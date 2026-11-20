import {
 BadRequestException,ConflictException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {HealthcareProviderPayoutProofFacade}
 from "../../cg-09-finance-accounting/application/healthcare-provider-payout-proof.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ref=(v:unknown)=>{
 if(typeof v!=="string"||!ID.test(v))
  throw new BadRequestException({code:"CG17_PROVIDER_PAYOUT_INVALID_REFERENCE"});
 return v;
};
const month=(v:unknown)=>{
 if(typeof v!=="string"||!/^20[2-9]\d-(0[1-9]|1[0-2])$/.test(v))
  throw new BadRequestException({code:"CG17_PROVIDER_PAYOUT_INVALID_MONTH"});
 return v+"-01";
};
const sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
type Claim={id:string;root_realm_id:string;center_ref:string;
 provider_ref:string;state:string;approved_total_minor:string;paid_minor:string;
 destination_file_ref:string;destination_version:number;source_digest:string;
 proposed_by:string;revision:number};
@Injectable()
/** Applies proof of an EXISTING independently verified CG09 disbursement.
 * Never initiates bank transfer, creates CG09 journal, reads patient cash,
 * or claims provider paid on a proposed-but-unverified bank item.
 */
export class VerifiedProviderPayoutService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly cg09:HealthcareProviderPayoutProofFacade){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>){
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const result=await run(c);await c.query("COMMIT");started=false;return result;
  }catch(e){
   if(started)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_ALREADY_RECORDED"});
   throw e;
  }finally{c.release();}
 }
 private async actor(c:PoolClient,token:string){
  const a=await this.sessions.requireAction(token,
   "healthcare.assistance.settlements.pay");
  await this.identity.assertCurrent(c,a,
   "healthcare.assistance.settlements.pay");
  return a;
 }
 private async claim(c:PoolClient,root:string,center:string,period:string){
  const q=await c.query<Claim>(
   "SELECT id,root_realm_id,center_ref,provider_ref,state,"+
   "approved_total_minor::text,paid_minor::text,destination_file_ref,"+
   "destination_version,source_digest,proposed_by,revision "+
   "FROM provider_settlement WHERE root_realm_id=$1 AND center_ref=$2 "+
   "AND period_start=$3::date FOR UPDATE",[root,center,period]);
  const x=q.rows[0];
  if(!x||!["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(x.state))
   throw new NotFoundException({code:"CG17_PROVIDER_PAYOUT_APPROVED_CLAIM_REQUIRED"});
  return x;
 }
 private view(x:Claim){
  const total=BigInt(x.approved_total_minor),paid=BigInt(x.paid_minor);
  if(total<1n||paid<0n||paid>total)
   throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_AMOUNT_INVALID"});
  return {settlementRef:x.id,state:x.state,
   approvedFoundationMinor:total.toString(),actualPaidMinor:paid.toString(),
   outstandingMinor:(total-paid).toString(),currency:"INR" as const,
   paidVerified:x.state==="SETTLED",patientCollectionNotFoundationIncome:true};
 }
 async options(token:string,centerRaw:string,monthRaw:string){
  const center=ref(centerRaw),period=month(monthRaw);
  return this.tx(async c=>{
   const a=await this.actor(c,token);
   const bank=await this.centers.verifiedFoundationSettlementDestination(
    c,a,center,"healthcare.assistance.settlements.pay");
   const claim=await this.claim(c,a.realmId,center,period);
   if(bank.providerRef!==claim.provider_ref||
    bank.fileRef!==claim.destination_file_ref||
    bank.version!==claim.destination_version)
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_DESTINATION_CHANGED"});
   const prior=await c.query<{amount_minor:string;bank_item_ref:string;
    verified_at:Date}>(
    "SELECT payout.amount_minor::text,bank.bank_item_ref,payout.verified_at "+
    "FROM provider_settlement_payment payout "+
    "JOIN finance_bank_reconciliation bank ON "+
    "bank.id=payout.bank_reconciliation_ref "+
    "AND bank.root_realm_id=payout.root_realm_id "+
    "WHERE payout.root_realm_id=$1 AND payout.settlement_ref=$2 "+
    "ORDER BY payout.verified_at DESC,payout.id DESC LIMIT 101",
    [a.realmId,claim.id]);
   if(prior.rows.length>100)
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_HISTORY_TOO_LARGE"});
   const payoutHistory=prior.rows.map(x=>({
    bankItemLabel:x.bank_item_ref,amountMinor:x.amount_minor,
    verifiedAt:x.verified_at.toISOString()
   }));
   if(claim.state==="SETTLED")
    return {...this.view(claim),bankDisbursements:[],
     protectedDestinationLabel:bank.maskedLabel,payoutHistory,complete:true};
   const evidence=await this.cg09.options(c,a);
   const outstanding=BigInt(claim.approved_total_minor)-BigInt(claim.paid_minor);
   const refs=evidence.bankDisbursements.map(x=>x.bankMatchRef);
   const used=refs.length?await c.query<{bank_reconciliation_ref:string}>(
    "SELECT bank_reconciliation_ref FROM provider_settlement_payment "+
    "WHERE root_realm_id=$1 AND bank_reconciliation_ref=ANY($2::uuid[])",
    [a.realmId,refs]):null;
   const set=new Set((used?.rows??[]).map(x=>x.bank_reconciliation_ref));
   return {...this.view(claim),
    protectedDestinationLabel:bank.maskedLabel,payoutHistory,
    bankDisbursements:evidence.bankDisbursements.filter(x=>!set.has(x.bankMatchRef)&&
     BigInt(x.amountMinor)>0n&&BigInt(x.amountMinor)<=outstanding),
    complete:evidence.complete};
  });
 }
 async allocate(token:string,centerRaw:string,monthRaw:string,raw:unknown){
  const center=ref(centerRaw),period=month(monthRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).length!==3||!("requestKey" in raw)||
   !("bankMatchRef" in raw)||!("payeeMatched" in raw))
   throw new BadRequestException({code:"CG17_PROVIDER_PAYOUT_INVALID_REQUEST"});
  const o=raw as Record<string,unknown>;
  const key=ref(o.requestKey),bankMatch=ref(o.bankMatchRef);
  if(o.payeeMatched!==true)
   throw new BadRequestException({
    code:"CG17_PROVIDER_PAYOUT_BANK_BENEFICIARY_CONFIRMATION_REQUIRED"});
  return this.tx(async c=>{
   const a=await this.actor(c,token);
   const bank=await this.centers.verifiedFoundationSettlementDestination(
    c,a,center,"healthcare.assistance.settlements.pay");
   const claim=await this.claim(c,a.realmId,center,period);
   if(bank.providerRef!==claim.provider_ref||
    bank.fileRef!==claim.destination_file_ref||
    bank.version!==claim.destination_version)
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_DESTINATION_CHANGED"});
   if(a.accountId===claim.proposed_by)
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_INDEPENDENT_CONFIRMATION_REQUIRED"});
   const previous=await c.query<{bank_reconciliation_ref:string}>(
    "SELECT bank_reconciliation_ref FROM provider_settlement_payment "+
    "WHERE root_realm_id=$1 AND verified_by_account=$2 AND request_key=$3 "+
    "AND settlement_ref=$4",[a.realmId,a.accountId,key,claim.id]);
   if(previous.rows[0]){
    if(previous.rows[0].bank_reconciliation_ref!==bankMatch)
     throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_REPLAY_CONFLICT"});
    return {...this.view(claim),replayed:true};
   }
   if(claim.state==="SETTLED")
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_ALREADY_SETTLED"});
   const proof=await this.cg09.verify(c,a,bankMatch);
   const amount=BigInt(proof.amountMinor),
    remaining=BigInt(claim.approved_total_minor)-BigInt(claim.paid_minor);
   if(amount<=0n||amount>remaining)
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_EXCEEDS_APPROVED_BALANCE"});
   const digest=sha(["CG17_VERIFIED_PROVIDER_PAYOUT_V1",a.realmId,
    claim.id,claim.source_digest,bank.fileRef,bank.version,
    proof.bankMatchRef,proof.journalRef,proof.liabilityAccountRef,
    proof.bankAccountRef,proof.amountMinor,proof.originalBankItemLabel,
    a.accountId,key]);
   await c.query(
    "INSERT INTO provider_settlement_payment(root_realm_id,settlement_ref,"+
    "center_ref,bank_reconciliation_ref,cg09_journal_ref,"+
    "liability_account_ref,bank_account_ref,amount_minor,"+
    "payee_matched_attested,source_digest,request_key,verified_by_account) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11)",
    [a.realmId,claim.id,center,proof.bankMatchRef,proof.journalRef,
     proof.liabilityAccountRef,proof.bankAccountRef,proof.amountMinor,
     digest,key,a.accountId]);
   const updatedPaid=BigInt(claim.paid_minor)+amount;
   const next=updatedPaid===BigInt(claim.approved_total_minor)?
    "SETTLED":"PARTIALLY_SETTLED";
   const updated=await c.query<Claim>(
    "UPDATE provider_settlement SET paid_minor=$4,state=$5,revision=revision+1 "+
    "WHERE root_realm_id=$1 AND center_ref=$2 AND id=$3 "+
    "AND revision=$6 AND paid_minor=$7 AND "+
    "state IN('APPROVED','PARTIALLY_SETTLED') "+
    "RETURNING id,root_realm_id,center_ref,provider_ref,state,"+
    "approved_total_minor::text,paid_minor::text,destination_file_ref,"+
    "destination_version,source_digest,proposed_by,revision",
    [a.realmId,center,claim.id,updatedPaid.toString(),next,
     claim.revision,claim.paid_minor]);
   if(!updated.rows[0])
    throw new ConflictException({code:"CG17_PROVIDER_PAYOUT_CONCURRENT_CHANGE"});
   return {...this.view(updated.rows[0]),replayed:false};
  });
 }
}
