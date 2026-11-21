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
  ref?:string,liabilityAccountRef?:string){
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
   "AND ($3::uuid IS NULL OR pay.account_id=$3::uuid) "+
   "ORDER BY bank.verified_at DESC,bank.id DESC LIMIT 51",
   [actor.realmId,ref??null,liabilityAccountRef??null]);
  return rows.rows;
 }
 async options(c:PoolClient,actor:VerifiedFoundationActor,liabilityAccountRef?:string){
  if(liabilityAccountRef&&!ID.test(liabilityAccountRef))
   throw new ConflictException({code:"CG09_PROVIDER_PAYABLE_ACCOUNT_INVALID"});
  const rows=await this.current(c,actor,undefined,liabilityAccountRef);
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
 /** Exact verified incoming Foundation BANK debit and original provider
  * liability credit. No new bank ledger and no assumption that a screenshot
  * proves a provider reimbursed a payout; CG17 requires human payer match.
  */
 private async recoveries(c:PoolClient,actor:VerifiedFoundationActor,
  payableRef:string,bankMatchRef?:string){
  await this.identity.assertCurrent(c,actor,"finance.reconciliation.manage");
  if(!ID.test(payableRef)||(bankMatchRef&&!ID.test(bankMatchRef)))
   throw new ConflictException({code:"CG09_PROVIDER_RECOVERY_INVALID"});
  const rows=await c.query<{
   reconciliation_ref:string;journal_ref:string;bank_account_ref:string;
   payable_account_ref:string;amount_minor:string;bank_item_ref:string
  }>(
   "SELECT bank.id AS reconciliation_ref,j.id AS journal_ref,"+
   "bank.bank_account_id AS bank_account_ref,"+
   "pay.account_id AS payable_account_ref,"+
   "bank.statement_amount_minor::text AS amount_minor,bank.bank_item_ref "+
   "FROM finance_bank_reconciliation bank "+
   "JOIN journal j ON j.id=bank.journal_id "+
   "AND j.root_realm_id=bank.root_realm_id AND j.status='POSTED' "+
   "AND j.source_owner='CG-09' AND j.reversal_of_id IS NULL "+
   "AND j.posting_kind IN('GENERAL','VOUCHER') "+
   "JOIN journal_line cash ON cash.root_realm_id=j.root_realm_id "+
   "AND cash.journal_id=j.id AND cash.account_id=bank.bank_account_id "+
   "AND cash.branch_id IS NULL AND cash.credit_minor=0 "+
   "AND cash.debit_minor=bank.statement_amount_minor "+
   "JOIN journal_line pay ON pay.root_realm_id=j.root_realm_id "+
   "AND pay.journal_id=j.id AND pay.account_id=$2 "+
   "AND pay.branch_id IS NULL AND pay.debit_minor=0 "+
   "AND pay.credit_minor=bank.statement_amount_minor "+
   "JOIN finance_account liability ON liability.id=pay.account_id "+
   "AND liability.root_realm_id=pay.root_realm_id "+
   "AND liability.status='ACTIVE' AND liability.account_kind='GENERAL' "+
   "AND liability.scope_kind='FOUNDATION' "+
   "JOIN account_group g ON g.id=liability.group_id "+
   "AND g.root_realm_id=liability.root_realm_id "+
   "AND g.category='LIABILITY' "+
   "JOIN finance_account bank_account ON bank_account.id=bank.bank_account_id "+
   "AND bank_account.root_realm_id=bank.root_realm_id "+
   "AND bank_account.account_kind='BANK' AND bank_account.scope_kind='FOUNDATION' "+
   "AND bank_account.status='ACTIVE' "+
   "WHERE bank.root_realm_id=$1 AND bank.status='VERIFIED' "+
   "AND bank.variance_minor=0 AND bank.statement_amount_minor>0 "+
   "AND bank.posted_amount_minor=bank.statement_amount_minor "+
   "AND ($3::uuid IS NULL OR bank.id=$3::uuid) "+
   "AND (SELECT count(*) FROM journal_line exact "+
   "WHERE exact.root_realm_id=j.root_realm_id AND exact.journal_id=j.id)=2 "+

   "ORDER BY bank.verified_at DESC,bank.id DESC LIMIT 51",
   [actor.realmId,payableRef,bankMatchRef??null]);
  return rows.rows;
 }
 async recoveryOptions(c:PoolClient,actor:VerifiedFoundationActor,
  payableRef:string,neededMinor:string){
  if(!/^[1-9][0-9]{0,10}$/.test(neededMinor))
   throw new ConflictException({code:"CG09_PROVIDER_RECOVERY_INVALID"});
  const rows=await this.recoveries(c,actor,payableRef);
  return {bankRecoveries:rows.filter(x=>x.amount_minor===neededMinor)
   .slice(0,50).map(x=>({bankMatchRef:x.reconciliation_ref,
    bankItemLabel:x.bank_item_ref,amountMinor:x.amount_minor})),
   complete:rows.length<=50};
 }
 async verifyRecovery(c:PoolClient,actor:VerifiedFoundationActor,
  bankMatchRef:string,payableRef:string,neededMinor:string){
  if(!/^[1-9][0-9]{0,10}$/.test(neededMinor))
   throw new ConflictException({code:"CG09_PROVIDER_RECOVERY_INVALID"});
  const rows=await this.recoveries(c,actor,payableRef,bankMatchRef);
  const x=rows[0];
  if(rows.length!==1||!x||x.amount_minor!==neededMinor)
   throw new ConflictException({code:"CG09_PROVIDER_RECOVERY_NOT_VERIFIED"});
  return {bankMatchRef:x.reconciliation_ref,journalRef:x.journal_ref,
   bankAccountRef:x.bank_account_ref,payableAccountRef:x.payable_account_ref,
   amountMinor:x.amount_minor,bankItemLabel:x.bank_item_ref};
 }

}
