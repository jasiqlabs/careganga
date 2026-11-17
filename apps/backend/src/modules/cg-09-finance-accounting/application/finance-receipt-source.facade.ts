import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type OriginalReceipt=Readonly<{
 receiptRef:string;receiptNumber:string;invoiceNumber:string;
 amountMinor:string;bankName:string;paidDate:string;counterparty:string;
 category:string;purpose:string;sourceDigest:string;status:string
}>;
@Injectable()
export class FinanceReceiptSourceFacade{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 async original(bearer:string,ref:string):Promise<OriginalReceipt>{
  const actor=await this.sessions.requireAction(bearer,"finance.invoices.issue");
  if(!UUID.test(ref))throw new BadRequestException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"finance.invoices.issue");
   const rows=await tx.query<{receiptRef:string;receiptNumber:string;invoiceNumber:string;
    amountMinor:string;bankName:string;paidDate:string;counterparty:string;
    category:string;purpose:string;sourceDigest:string;status:string}>(
    "SELECT r.id AS \"receiptRef\",r.receipt_number AS \"receiptNumber\","+
    "i.invoice_number AS \"invoiceNumber\",r.amount_minor::text AS \"amountMinor\","+
    "a.name AS \"bankName\",r.receipt_date::text AS \"paidDate\","+
    "i.counterparty_name AS counterparty,i.category_label AS category,"+
    "i.purpose,r.immutable_digest AS \"sourceDigest\",r.status "+
    "FROM finance_invoice_receipt r JOIN finance_invoice i "+
    "ON i.id=r.invoice_id AND i.root_realm_id=r.root_realm_id "+
    "JOIN finance_bank_reconciliation b ON b.id=r.reconciliation_id "+
    "AND b.root_realm_id=r.root_realm_id "+
    "JOIN finance_account a ON a.id=b.bank_account_id AND a.root_realm_id=b.root_realm_id "+
    "WHERE r.id=$1 AND r.root_realm_id=$2 AND r.status='PAID_VERIFIED' "+
    "AND i.status='ISSUED' AND b.status='VERIFIED' AND b.variance_minor=0 "+
    "AND EXISTS(SELECT 1 FROM finance_reconciliation_decision d "+
    "JOIN cg19_stored_file f ON f.id=d.statement_file_id "+
    "AND f.realm_id=d.root_realm_id AND f.reconciliation_id=d.reconciliation_id "+
    "AND f.revision=d.statement_file_version "+
    "JOIN cg19_upload_intent u ON u.id=f.upload_intent_id "+
    "AND u.realm_id=f.realm_id AND u.reconciliation_id=d.reconciliation_id "+
    "WHERE d.root_realm_id=b.root_realm_id AND d.reconciliation_id=b.id "+
    "AND d.action='VERIFY' AND f.owner_kind='CG09_BANK_STATEMENT' "+
    "AND u.owner_kind='CG09_BANK_STATEMENT' AND u.status='VALIDATED' "+
    "AND f.scan_status='CLEAN_VERIFIED' AND f.revoked_at IS NULL) "+
    "FOR SHARE OF r,i,b,a",
    [ref,actor.realmId]);
   const value=rows.rows[0];
   if(!value)throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
   await tx.query("COMMIT");
   return value;
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
}
