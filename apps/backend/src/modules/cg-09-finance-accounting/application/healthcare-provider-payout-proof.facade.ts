import {ConflictException,Injectable} from "@nestjs/common";
import type {PoolClient} from "pg";
import type {VerifiedFoundationActor}
 from "../../cg-01-identity-access/public-api";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Payout={
 reconciliation_ref:string;bank_item_ref:string;journal_ref:string;
 bank_account_ref:string;liability_account_ref:string;amount_minor:string;
 statement_date:string;verified_at:Date
};
/** CG09-only read facade for genuinely independently VERIFIED bank
 * disbursements. No CG17 import, no second bank ledger, no transfer API.
 * Only a verified actual TWO-LINE Foundation liability-debit and
 * Foundation-bank-credit journal can be allocated by CG17.
 */
@Injectable()
export class HealthcareProviderPayoutProofFacade{
 constructor(private readonly identity:FoundationStructureIdentityFacade){}
 private async current(c:PoolClient,actor:VerifiedFoundationActor,
  ref?:string){
  await this.identity.assertCurrent(c,actor,"finance.reconciliation.manage");
  const rows=await c.query<Payout>(
   "SELECT bank.id AS reconciliation_ref,bank.bank_item_ref,"+
   "j.id AS journal_ref,bank.bank_account_id AS bank_account_ref,"+
   "pay.account_id AS liability_account_ref,"+
   "(-bank.statement_amount_minor)::text AS amount_minor,"+
   "bank.statement_date::text,bank.verified_at "+
   "FROM finance_bank_reconciliation bank "+
   "JOIN journal j ON j.id=bank.journal_id AND j.root_realm_id=bank.root_realm_id "+
   "AND j.status='POSTED' AND j.source_owner='CG-09' "+
   "AND j.posting_kind IN('GENERAL','VOUCHER') "+
   "JOIN journal_line cash ON cash.root_realm_id=j.root_realm_id "+
   "AND cash.journal_id=j.id AND cash.account_id=bank.bank_account_id "+
   "JOIN journal_line pay ON pay.root_realm_id=j.root_realm_id "+
   "AND pay.journal_id=j.id AND pay.id<>cash.id "+
   "JOIN finance_account liability ON liability.id=pay.account_id "+
   "AND liability.root_realm_id=pay.root_realm_id "+
   "JOIN account_group group_ref ON group_ref.id=liability.group_id "+
   "AND group_ref.root_realm_id=liability.root_realm_id "+
   "JOIN finance_account cash_account ON cash_account.id=bank.bank_account_id "+
   "AND cash_account.root_realm_id=bank.root_realm_id "+
   "WHERE bank.root_realm_id=$1 AND bank.status='VERIFIED' "+
   "AND bank.variance_minor=0 AND bank.statement_amount_minor<0 "+
   "AND bank.posted_amount_minor=bank.statement_amount_minor "+
   "AND cash.debit_minor=0 AND cash.credit_minor=-bank.statement_amount_minor "+
   "AND cash.branch_id IS NULL "+
   "AND pay.credit_minor=0 AND pay.debit_minor=-bank.statement_amount_minor "+
   "AND pay.branch_id IS NULL "+
   "AND liability.status='ACTIVE' AND liability.account_kind='GENERAL' "+
   "AND liability.scope_kind='FOUNDATION' AND group_ref.category='LIABILITY' "+
   "AND cash_account.status='ACTIVE' AND cash_account.account_kind='BANK' "+
   "AND cash_account.scope_kind='FOUNDATION' "+
   "AND (SELECT count(*) FROM journal_line jline "+
   "WHERE jline.root_realm_id=j.root_realm_id AND jline.journal_id=j.id)=2 "+
   "AND ($2::uuid IS NULL OR bank.id=$2::uuid) "+
   "ORDER BY bank.verified_at DESC,bank.id DESC LIMIT 51",
   [actor.realmId,ref??null]);
  return rows.rows;
 }
 async options(c:PoolClient,actor:VerifiedFoundationActor){
  const rows=await this.current(c,actor);
  return {bankDisbursements:rows.slice(0,50).map(x=>({
   bankMatchRef:x.reconciliation_ref,
   bankItemLabel:x.bank_item_ref,
   statementDate:x.statement_date,
   amountMinor:x.amount_minor
  })),complete:rows.length<=50};
 }
 async verify(c:PoolClient,actor:VerifiedFoundationActor,ref:string){
  if(!ID.test(ref))throw new ConflictException({
   code:"CG09_VERIFIED_PROVIDER_PAYOUT_NOT_FOUND"});
  const rows=await this.current(c,actor,ref);
  if(rows.length!==1)throw new ConflictException({
   code:"CG09_VERIFIED_PROVIDER_PAYOUT_NOT_FOUND"});
  const x=rows[0];
  return {bankMatchRef:x.reconciliation_ref,
   journalRef:x.journal_ref,
   liabilityAccountRef:x.liability_account_ref,
   bankAccountRef:x.bank_account_ref,
   amountMinor:x.amount_minor,
   originalBankItemLabel:x.bank_item_ref,
   verifiedAt:x.verified_at.toISOString()};
 }
}
