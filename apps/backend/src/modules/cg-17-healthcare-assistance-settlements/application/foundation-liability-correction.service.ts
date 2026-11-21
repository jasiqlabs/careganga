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
type Summary={liabilityRef:string;sourcePosted:boolean;canCorrect:boolean;
 claimAlreadyCreated:boolean;originalReversed:boolean;corrected:boolean;
 correctionReason:string|null;reversalJournalRef:string|null};
@Injectable()
/** CG17 owns corrected liability source. CG09 alone creates the opposite
 * balanced journal; neither original record nor any payout is modified.
 * Historical already-proposed/paid settlements require independent real bank
 * recovery/reconciliation and are deliberately NOT fake-reversed here.
 */
export class FoundationLiabilityCorrectionService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly protectedOwner:ProtectedAccessOwnerService,
  private readonly centers:HealthCenterSupportScopeFacade,
  private readonly cg09:HealthcareFoundationPostingFacade){}
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
      ["23505","P1719","P0929"].includes(String(e.code)))
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
  if(!v||v.source_kind!=="CG15_CONSULTATION"||
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
 private async claimed(c:PoolClient,root:string,liability:string){
  const q=await c.query(
   "SELECT 1 FROM provider_settlement_line "+
   "WHERE root_realm_id=$1 AND liability_ref=$2 LIMIT 1",
   [root,liability]);
  return !!q.rowCount;
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
   const [existing,claimed,offset,date]=await Promise.all([
    this.prior(c,actor.realmId,liability),
    this.claimed(c,actor.realmId,liability),
    this.reversed(c,actor.realmId,v.original_journal_ref),
    c.query<{date:string}>("SELECT current_date::text AS date")
   ]);
   const canCorrect=!!v.original_journal_ref&&v.posting_state==="POSTED"&&
     !!v.original_poster&&!existing&&!claimed&&!offset;
   const finance=canCorrect?await this.cg09.options(c,actor,date.rows[0].date):
    {financialYears:[],accounts:[],complete:true};
   const result:Summary={liabilityRef:liability,
    sourcePosted:v.posting_state==="POSTED"&&!!v.original_journal_ref,
    canCorrect,claimAlreadyCreated:claimed,originalReversed:offset,
    corrected:!!existing,correctionReason:existing?.reason??null,
    reversalJournalRef:existing?.reversal_journal_ref??null};
   return {...result,postingDate:date.rows[0].date,
    financialYears:finance.financialYears,complete:finance.complete};
  });
 }
 async reverse(token:string,centerRaw:string,liabilityRaw:string,raw:unknown){
  const center=id(centerRaw),liability=id(liabilityRaw);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"CG17_CORRECTION_REQUEST_INVALID"});
  const x=raw as Record<string,unknown>;
  if(Object.keys(x).length!==5||
     !["requestKey","financialYearRef","postingDate","reason",
       "currentPassword"].every(k=>k in x)||
     typeof x.reason!=="string"||x.reason.trim().length<12||
     x.reason.trim().length>300||
     typeof x.currentPassword!=="string"||x.currentPassword.length<8||
     Buffer.byteLength(x.currentPassword,"utf8")>1024)
   throw new BadRequestException({code:"CG17_CORRECTION_REQUEST_INVALID"});
  const key=id(x.requestKey),year=id(x.financialYearRef);
  const postingDate=day(x.postingDate);
  const reason=x.reason.trim().replace(/\s+/g," ");
  const actor=await this.sessions.requireAction(token,
   "healthcare.assistance.liabilities.manage");
  await this.sessions.limitFoundationRootProof(actor);
  return this.tx(async c=>{
   const a=await this.actor(c,token);
   await this.centers.assertFoundationCenter(c,a,center,
    "healthcare.assistance.liabilities.manage",false);
   const v=await this.original(c,a.realmId,center,liability,true);
   const originalJournal=v.original_journal_ref;
   if(!originalJournal||v.posting_state!=="POSTED"||
     !v.original_poster||v.original_poster===a.accountId)
    throw new ConflictException({code:"CG17_CORRECTION_INDEPENDENT_ORIGINAL_REQUIRED"});
   const hash=digest(["CG17_ORIGINAL_LIABILITY_REVERSAL_V1",a.realmId,
    center,liability,originalJournal,v.source_digest,v.amount_minor,
    year,postingDate,reason,a.accountId,key]);
   const existing=await this.prior(c,a.realmId,liability);
   if(existing){
    if(existing.reviewed_by_account!==a.accountId||
      existing.request_digest!==hash)
     throw new ConflictException({code:"CG17_CORRECTION_ALREADY_RECORDED"});
    return {status:"REVERSED",replayed:true,
     corrected:true,reversalJournalRef:existing.reversal_journal_ref};
   }
   if(await this.claimed(c,a.realmId,liability))
    throw new ConflictException({code:"CG17_CORRECTION_CLAIM_REQUIRES_RECONCILIATION"});
   if(await this.reversed(c,a.realmId,originalJournal))
    throw new ConflictException({code:"CG17_CORRECTION_SOURCE_ALREADY_REVERSED"});
   // The existing CG01 password owner validates this *current* password.
   // Missing/invalid proof never writes an offset journal or audit row.
   await this.sessions.requireFreshFoundationRootProof(c,a,x.currentPassword);
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
   await c.query(
    "INSERT INTO cg17_liability_correction(root_realm_id,center_ref,"+
    "liability_ref,original_effect_ref,reversal_effect_ref,"+
    "original_journal_ref,reversal_journal_ref,reviewed_by_account,"+
    "request_key,request_digest,reason,password_verified_at) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())",
    [a.realmId,center,liability,v.effect_ref,effect.rows[0].id,
     originalJournal,reversal,a.accountId,key,hash,reason]);
   return {status:"REVERSED",replayed:false,corrected:true,
    reversalJournalRef:reversal,
    notice:"The independent CG09 offset has been posted. No bank payment or patient refund was generated."};
  });
 }
}
