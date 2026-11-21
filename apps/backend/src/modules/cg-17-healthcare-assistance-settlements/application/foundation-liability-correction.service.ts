import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException}
 from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {ProtectedAccessOwnerService}
 from "../../cg-01-identity-access/application/protected-access-owner.service";
import {HealthCenterSupportScopeFacade}
 from "../../cg-14-healthcare-network/application/health-center-support-scope.facade";
import {HealthcareFoundationPostingFacade}
 from "../../cg-09-finance-accounting/application/healthcare-foundation-posting.facade";
import {HealthcareProviderPayoutProofFacade}
 from "../../cg-09-finance-accounting/application/healthcare-provider-payout-proof.facade";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(raw:unknown)=>{
 if(typeof raw!=="string"||!ID.test(raw))
  throw new BadRequestException({code:"CG17_CORRECTION_INVALID_REFERENCE"});
 return raw;
};
const day=(raw:unknown)=>{
 if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw)||
    !Number.isFinite(Date.parse(raw+"T00:00:00Z"))||
    new Date(raw+"T00:00:00Z").toISOString().slice(0,10)!==raw)
  throw new BadRequestException({code:"CG17_CORRECTION_INVALID_DATE"});
 return raw;
};
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Original={liability_ref:string;center_ref:string;source_ref:string;
 source_kind:string;amount_minor:string;source_digest:string;
 effect_ref:string;effect_digest:string;posting_state:string;
 original_journal_ref:string|null;original_poster:string|null};
type Existing={id:string;reviewed_by_account:string;request_digest:string;
 reversal_journal_ref:string;reason:string;created_at:Date};
type Claim={id:string;approved_total_minor:string;paid_minor:string;proposed_by:string;state:string};
type ClaimedPrior={reviewed_by_account:string;request_digest:string;
 reversal_journal_ref:string;reason:string;recovery_minor:string;
 recovery_bank_ref:string|null};
type Summary={liabilityRef:string;sourcePosted:boolean;canCorrect:boolean;
 claimAlreadyCreated:boolean;originalReversed:boolean;corrected:boolean;
 correctionReason:string|null;reversalJournalRef:string|null};
@Injectable()
/** CG17 owns corrected liability source. CG09 alone creates the opposite
 * balanced journal; neither original record nor any payout is modified.
 * Supports genuine independently accepted CG17 partner services using the
 * SAME original liability, independent CG09 reversal, and verified recovery.
 * Historical already-proposed/paid settlements require independent real bank
 * recovery/reconciliation and are deliberately NOT fake-reversed here.
 */
export class FoundationLiabilityCorrectionService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly cg09:HealthcareFoundationPostingFacade,
  private readonly recovery:HealthcareProviderPayoutProofFacade){}
 private async tx<T>(run:(c:PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.db.connect();let started=false;
  try{
   await c.query("BEGIN");started=true;
   await c.query("SET LOCAL statement_timeout='12s'");
   await c.query("SET LOCAL lock_timeout='3s'");
   const value=await run(c);
   await c.query("COMMIT");started=false;return value;
  }catch(e){
   if(started)try{await c.query("ROLLBACK")}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
      ["23505","P1719","P1720","P0929"].includes(String(e.code)))
    throw new ConflictException({code:"CG17_CORRECTION_SOURCE_CONFLICT"});
   throw e;
  }finally{c.release();}
 }
 private async actor(c:PoolClient,token:string){
  const a=await this.sessions.requireAction(token,
   "healthcare.assistance.liabilities.manage");
  await this.sessions.requireAction(token,"finance.journals.post");
  await this.sessions.requireAction(token,"approvals.review");
  for(const action of ["healthcare.assistance.liabilities.manage",
    "finance.journals.post","approvals.review"])
   await this.identity.assertCurrent(c,a,action);
  await this.protectedOwner.verifyReviewer(c,a,"approvals.review",true);
  return a;
 }
 private async original(c:PoolClient,root:string,center:string,liability:string,
  lock:boolean){
  const q=await c.query<Original>(
   "SELECT l.id AS liability_ref,l.center_ref,l.source_ref,l.source_kind,"+
   "l.amount_minor::text,l.source_digest,e.id AS effect_ref,"+
   "e.source_digest AS effect_digest,e.posting_state,"+
   "e.original_cg09_ref AS original_journal_ref,j.created_by AS original_poster "+
   "FROM foundation_liability l "+
   "JOIN cg17_financial_effect e ON e.root_realm_id=l.root_realm_id "+
   "AND e.liability_ref=l.id AND e.effect_kind='LIABILITY_ACCRUAL' "+
   "LEFT JOIN journal j ON j.root_realm_id=e.root_realm_id "+
   "AND j.id=e.original_cg09_ref AND j.source_owner='CG-09' "+
   "AND j.posting_kind='GENERAL' AND j.status='POSTED' "+
   "AND j.source_ref=e.id AND j.immutable_source_event_key=e.idempotency_key "+
   "AND j.immutable_payload_digest=e.source_digest "+
   "WHERE l.root_realm_id=$1 AND l.center_ref=$2 AND l.id=$3 "+
   (lock?"FOR UPDATE OF l":"FOR SHARE OF l"),
   [root,center,liability]);
  const v=q.rows[0];
  if(!v||!["CG15_CONSULTATION","CG17_PARTNER_SERVICE"].includes(v.source_kind)||
    v.source_digest!==v.effect_digest)
   throw new NotFoundException({code:"CG17_CORRECTION_ORIGINAL_UNAVAILABLE"});
  return v;
 }
 private async prior(c:PoolClient,root:string,liability:string){
  const q=await c.query<Existing>(
   "SELECT id,reviewed_by_account,request_digest,reversal_journal_ref,"+
   "reason,created_at FROM cg17_liability_correction "+
   "WHERE root_realm_id=$1 AND liability_ref=$2",
   [root,liability]);
  return q.rows[0]??null;
 }

 /** Lock the original claim FIRST, matching the existing payout writer,
  * so a concurrent bank payout cannot race correction acceptance.
  */
 private async claim(c:PoolClient,root:string,center:string,liability:string,
  lock:boolean):Promise<Claim|null>{
  const q=await c.query<Claim>(
   "SELECT s.id,s.approved_total_minor::text,s.paid_minor::text,"+
   "s.proposed_by,s.state FROM provider_settlement_line line "+
   "JOIN provider_settlement s ON s.root_realm_id=line.root_realm_id "+
   "AND s.id=line.settlement_ref AND s.center_ref=line.center_ref "+
   "WHERE line.root_realm_id=$1 AND line.center_ref=$2 "+
   "AND line.liability_ref=$3 "+(lock?"FOR UPDATE OF s":"FOR SHARE OF s"),
   [root,center,liability]);
  return q.rows[0]??null;
 }
 private async claimedPrior(c:PoolClient,root:string,liability:string){
  const q=await c.query<ClaimedPrior>(
   "SELECT reviewed_by_account,request_digest,reversal_journal_ref,reason,"+
   "recovery_minor::text,recovery_bank_ref FROM cg17_provider_claim_correction "+
   "WHERE root_realm_id=$1 AND liability_ref=$2",[root,liability]);
  return q.rows[0]??null;
 }
 private async claimBalances(c:PoolClient,root:string,claim:Claim,
  correctionMinor:string){
  const q=await c.query<{adjusted:string;recovered:string}>(
   "SELECT coalesce(sum(amount_minor),0)::text AS adjusted,"+
   "coalesce(sum(recovery_minor),0)::text AS recovered "+
   "FROM cg17_provider_claim_correction "+
   "WHERE root_realm_id=$1 AND settlement_ref=$2",
   [root,claim.id]);
  const adjusted=BigInt(q.rows[0].adjusted),recovered=BigInt(q.rows[0].recovered);
  const total=BigInt(claim.approved_total_minor),paid=BigInt(claim.paid_minor);
  const effective=total-adjusted-BigInt(correctionMinor);
  if(effective<0n||recovered>paid)
   throw new ConflictException({code:"CG17_CORRECTION_CLAIM_BALANCE_INVALID"});
  const need=paid-recovered>effective?paid-recovered-effective:0n;
  return {need:need.toString(),effective:effective.toString(),
   historicalPaid:paid.toString(),priorAdjusted:adjusted.toString()};
 }
 private async reversed(c:PoolClient,root:string,journal:string|null){
  if(!journal)return false;
  const q=await c.query(
   "SELECT 1 FROM journal WHERE root_realm_id=$1 AND "+
   "reversal_of_id=$2 AND status='POSTED' LIMIT 1",
   [root,journal]);
  return !!q.rowCount;
 }
 async options(token:string,centerRaw:string,liabilityRaw:string){
  const center=id(centerRaw),liability=id(liabilityRaw);
  return this.tx(async c=>{
   const actor=await this.actor(c,token);
   await this.centers.assertFoundationCenter(c,actor,center,
    "healthcare.assistance.liabilities.manage",false);
   const v=await this.original(c,actor.realmId,center,liability,false);
   const [existing,claim,claimCorrection,offset,date]=await Promise.all([
    this.prior(c,actor.realmId,liability),
    this.claim(c,actor.realmId,center,liability,false),
    this.claimedPrior(c,actor.realmId,liability),
    this.reversed(c,actor.realmId,v.original_journal_ref),
    c.query<{date:string}>("SELECT current_date::text AS date")
   ]);
   const canCorrect=!!v.original_journal_ref&&v.posting_state==="POSTED"&&
     !!v.original_poster&&v.original_poster!==actor.accountId&&
     !existing&&!claimCorrection&&!offset&&
     (!claim||claim.proposed_by!==actor.accountId);
   const finance=canCorrect?await this.cg09.options(c,actor,date.rows[0].date):
    {financialYears:[],accounts:[],complete:true};
   let recoveryComplete=true;
   let needed="0",bankRecoveries:{
    bankMatchRef:string;bankItemLabel:string;amountMinor:string}[]=[];
   if(canCorrect&&claim&&v.original_journal_ref){
    const balance=await this.claimBalances(c,actor.realmId,claim,v.amount_minor);
    needed=balance.need;
    if(BigInt(needed)>0n){
     const payable=await this.cg09.payableAccountForAccrual(
      c,actor,v.original_journal_ref,v.amount_minor);
     const bank=await this.recovery.recoveryOptions(c,actor,payable,needed);
     const refs=bank.bankRecoveries.map(x=>x.bankMatchRef);
     const used=refs.length?await c.query<{bank_match_ref:string}>(
      "SELECT bank_reconciliation_ref AS bank_match_ref "+
      "FROM provider_settlement_payment WHERE root_realm_id=$1 "+
      "AND bank_reconciliation_ref=ANY($2::uuid[]) "+
      "UNION ALL SELECT recovery_bank_ref AS bank_match_ref "+
      "FROM cg17_provider_claim_correction WHERE root_realm_id=$1 "+
      "AND recovery_bank_ref=ANY($2::uuid[])",
      [actor.realmId,refs]):null;
     const claimed=new Set((used?.rows??[]).map(x=>x.bank_match_ref));
     bankRecoveries=bank.bankRecoveries.filter(x=>!claimed.has(x.bankMatchRef));
     recoveryComplete=bank.complete;
    }
   }
   const result:Summary={liabilityRef:liability,
    sourcePosted:v.posting_state==="POSTED"&&!!v.original_journal_ref,
    canCorrect,claimAlreadyCreated:!!claim,originalReversed:offset,
    corrected:!!existing||!!claimCorrection,
    correctionReason:existing?.reason??claimCorrection?.reason??null,
    reversalJournalRef:existing?.reversal_journal_ref??
     claimCorrection?.reversal_journal_ref??null};
   return {...result,postingDate:date.rows[0].date,
    financialYears:finance.financialYears,
    complete:finance.complete&&recoveryComplete,
    claimState:claim?.state??"NOT_CLAIMED",
    requiredVerifiedRecoveryMinor:needed,bankRecoveries,
    recoveredFromProviderMinor:claimCorrection?.recovery_minor??"0"};
  });
 }
 async reverse(token:string,centerRaw:string,liabilityRaw:string,raw:unknown){
  const center=id(centerRaw),liability=id(liabilityRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"CG17_CORRECTION_REQUEST_INVALID"});
  const x=raw as Record<string,unknown>;
  if(![5,7].includes(Object.keys(x).length)||
     Object.keys(x).some(k=>!["requestKey","financialYearRef",
      "postingDate","reason","currentPassword","bankMatchRef",
      "payerMatched"].includes(k))||
     !["requestKey","financialYearRef","postingDate","reason",
       "currentPassword"].every(k=>k in x)||
     (Object.keys(x).length===7&&
      (!("bankMatchRef" in x)||!("payerMatched" in x)))||
     typeof x.reason!=="string"||x.reason.trim().length<12||
     x.reason.trim().length>300||
     typeof x.currentPassword!=="string"||x.currentPassword.length<8||
     Buffer.byteLength(x.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"CG17_CORRECTION_REQUEST_INVALID"});
  const key=id(x.requestKey),year=id(x.financialYearRef);
  const postingDate=day(x.postingDate);
  const reason=x.reason.trim().replace(/\s+/g," ");
  const currentPassword=x.currentPassword as string;
  const actor=await this.sessions.requireAction(token,
   "healthcare.assistance.liabilities.manage");
  await this.sessions.limitFoundationRootProof(actor);
  return this.tx(async c=>{
   const a=await this.actor(c,token);
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.manage",false);
   // Lock the provider claim before the source liability, matching the
   // original payout writer; both corrections and payouts serialize on it.
   const claim=await this.claim(c,a.realmId,center,liability,true);
   if(!!claim !== (Object.keys(x).length===7))
    throw new BadRequestException({code:"CG17_CORRECTION_CLAIM_PROOF_REQUIRED"});
   const v=await this.original(c,a.realmId,center,liability,true);
   const originalJournal=v.original_journal_ref;
   if(!originalJournal||v.posting_state!=="POSTED"||
     !v.original_poster||v.original_poster===a.accountId)
    throw new ConflictException({code:"CG17_CORRECTION_INDEPENDENT_ORIGINAL_REQUIRED"});
   if(claim&&claim.proposed_by===a.accountId)
    throw new ConflictException({code:"CG17_CORRECTION_INDEPENDENT_CLAIM_REVIEWER"});
   const bankMatch=x.bankMatchRef;
   const payerMatched=x.payerMatched;
   const existing=claim?
    await this.claimedPrior(c,a.realmId,liability):
    await this.prior(c,a.realmId,liability);
   // Replay must read its frozen amount, not recalculate a NEW required
   // recovery against the already-reduced payable.
   if(existing){
    const replayNeeded=claim?
     (existing as ClaimedPrior).recovery_minor:"0";
    const hash=claim?
     digest(["CG17_CLAIMED_LIABILITY_REVERSAL_V1",a.realmId,
      center,liability,claim.id,originalJournal,v.source_digest,v.amount_minor,
      replayNeeded,bankMatch,year,postingDate,reason,a.accountId,key]):
     digest(["CG17_ORIGINAL_LIABILITY_REVERSAL_V1",a.realmId,
      center,liability,originalJournal,v.source_digest,v.amount_minor,
      year,postingDate,reason,a.accountId,key]);
    if(existing.reviewed_by_account!==a.accountId||
      existing.request_digest!==hash||
      (claim&&(existing as ClaimedPrior).recovery_bank_ref!==bankMatch))
     throw new ConflictException({code:"CG17_CORRECTION_ALREADY_RECORDED"});
    return {status:"REVERSED",replayed:true,
     corrected:true,reversalJournalRef:existing.reversal_journal_ref};
   }
   const balance=claim?await this.claimBalances(c,a.realmId,claim,v.amount_minor):null;
   const needed=balance?.need??"0";
   if(claim){
    if(BigInt(needed)>0n){
     if(typeof bankMatch!=="string"||!ID.test(bankMatch)||
        payerMatched!==true)
      throw new ConflictException({code:"CG17_CORRECTION_VERIFIED_BANK_RECOVERY_REQUIRED"});
    }else if(bankMatch!==null||payerMatched!==false)
     throw new BadRequestException({code:"CG17_CORRECTION_NO_BANK_MOVEMENT_REQUIRED"});
   }
   const hash=claim?
    digest(["CG17_CLAIMED_LIABILITY_REVERSAL_V1",a.realmId,
     center,liability,claim.id,originalJournal,v.source_digest,v.amount_minor,
     needed,bankMatch,year,postingDate,reason,a.accountId,key]):
    digest(["CG17_ORIGINAL_LIABILITY_REVERSAL_V1",a.realmId,
     center,liability,originalJournal,v.source_digest,v.amount_minor,
     year,postingDate,reason,a.accountId,key]);
   if(await this.reversed(c,a.realmId,originalJournal))
    throw new ConflictException({code:"CG17_CORRECTION_SOURCE_ALREADY_REVERSED"});
   // The existing CG01 password owner validates this *current* password.
   // Missing/invalid proof never writes an offset journal or audit row.
   await this.sessions.requireFreshFoundationRootProof(c,a,currentPassword);
   let recoveryProof:{
    bankMatchRef:string;journalRef:string;amountMinor:string}|null=null;
   if(claim&&BigInt(needed)>0n){
    const consumed=await c.query(
     "SELECT 1 FROM provider_settlement_payment "+
     "WHERE root_realm_id=$1 AND bank_reconciliation_ref=$2 "+
     "UNION ALL SELECT 1 FROM cg17_provider_claim_correction "+
     "WHERE root_realm_id=$1 AND recovery_bank_ref=$2 LIMIT 1",
     [a.realmId,bankMatch]);
    if(consumed.rowCount)throw new ConflictException({
     code:"CG17_PROVIDER_RECOVERY_ALREADY_USED"});
    const payable=await this.cg09.payableAccountForAccrual(
     c,a,originalJournal,v.amount_minor);
    recoveryProof=await this.recovery.verifyRecovery(
     c,a,bankMatch as string,payable,needed);
   }
   const effect=await c.query<{id:string}>(
    "INSERT INTO cg17_financial_effect(root_realm_id,liability_ref,"+
    "effect_kind,source_kind,source_ref,source_revision,idempotency_key,"+
    "amount_minor,source_digest) "+
    "VALUES($1,$2,'LIABILITY_REVERSAL',$3,$4,1,$5,$6,$7) RETURNING id",
    [a.realmId,liability,v.source_kind,v.source_ref,key,v.amount_minor,hash]);
   const reversal=await this.cg09.reverseAccrual(c,a,{
    originalJournalRef:originalJournal,originalEffectRef:v.effect_ref,
    originalDigest:v.effect_digest,amountMinor:v.amount_minor,
    requestKey:key,correctionDigest:hash,financialYearRef:year,
    postingDate,reason});
   const posted=await c.query(
    "UPDATE cg17_financial_effect SET posting_state='POSTED',"+
    "original_cg09_ref=$3,updated_at=now() WHERE root_realm_id=$1 "+
    "AND id=$2 AND posting_state='PENDING' AND original_cg09_ref IS NULL",
    [a.realmId,effect.rows[0].id,reversal]);
   if(posted.rowCount!==1)throw new ConflictException({
    code:"CG17_CORRECTION_EFFECT_CONCURRENT_CHANGE"});
   if(claim){
    await c.query(
     "INSERT INTO cg17_provider_claim_correction("+
     "root_realm_id,center_ref,settlement_ref,liability_ref,"+
     "original_effect_ref,reversal_effect_ref,original_journal_ref,"+
     "reversal_journal_ref,amount_minor,recovery_minor,recovery_bank_ref,"+
     "recovery_journal_ref,recovery_payer_attested,reviewed_by_account,"+
     "request_key,request_digest,reason,password_verified_at) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())",
     [a.realmId,center,claim.id,liability,v.effect_ref,effect.rows[0].id,
      originalJournal,reversal,v.amount_minor,needed,
      recoveryProof?.bankMatchRef??null,recoveryProof?.journalRef??null,
      !!recoveryProof,a.accountId,key,hash,reason]);
   }else{
    await c.query(
     "INSERT INTO cg17_liability_correction(root_realm_id,center_ref,"+
     "liability_ref,original_effect_ref,reversal_effect_ref,"+
     "original_journal_ref,reversal_journal_ref,reviewed_by_account,"+
     "request_key,request_digest,reason,password_verified_at) "+
     "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())",
     [a.realmId,center,liability,v.effect_ref,effect.rows[0].id,
      originalJournal,reversal,a.accountId,key,hash,reason]);
   }
   return {status:"REVERSED",replayed:false,corrected:true,
    reversalJournalRef:reversal,
    verifiedRecoveredMinor:needed,
    notice:"The source correction is recorded. Any required bank recovery was already independently verified in CG09; no bank transfer or patient refund was initiated."};
  });
 }
}
