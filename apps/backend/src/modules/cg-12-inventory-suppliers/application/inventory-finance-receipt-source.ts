import {ConflictException} from "@nestjs/common";
import type {Pool,PoolClient} from "pg";

/** CG12 owns physical receipt provenance. CG09 supplies its already-verified
 * finance branch scope and owns all invoice/amount/posting decisions. No private
 * supplier contact, payment status, quantity change or financial write here. */
export type InventoryFinanceReceipt={receiptRef:string;receiptNumber:string;supplierRef:string;supplierName:string;branchRef:string|null;date:string};
const sourceSql=`SELECT e.id AS "receiptRef",e.event_no AS "receiptNumber",
 s.id AS "supplierRef",s.display_name AS "supplierName",l.branch_ref AS "branchRef",
 e.effective_date::text AS date FROM stock_event e
 JOIN inventory_receipt_draft d ON d.root_realm_id=e.root_realm_id AND d.id=e.receipt_draft_id
 JOIN inventory_supplier s ON s.root_realm_id=d.root_realm_id AND s.id=d.supplier_id
 JOIN inventory_location l ON l.root_realm_id=d.root_realm_id AND l.id=d.location_id
 WHERE e.root_realm_id=$1 AND e.event_kind='RECEIPT' AND d.status='CONFIRMED'`;
const invalid=()=>new ConflictException({code:"FINANCE_INVOICE_SOURCE_INVALID",field:"inventoryReceiptRef"});
export async function listInventoryFinanceReceipts(db:Pool,root:string,all:boolean,branches:readonly string[]){
 const q=await db.query<InventoryFinanceReceipt>(sourceSql+`
 AND ($2::boolean OR l.branch_ref=ANY($3::uuid[]))
 AND NOT EXISTS (SELECT 1 FROM stock_event rev WHERE rev.root_realm_id=e.root_realm_id
 AND rev.reversal_of_ref=e.id AND rev.event_kind='RECEIPT_REVERSAL')
 ORDER BY e.occurred_at DESC,e.id DESC LIMIT 50`,[root,all,branches]);
 return q.rows;
}
export async function inventoryFinanceReceipt(tx:PoolClient,root:string,branch:string|null,receiptRef:unknown){
 if(typeof receiptRef!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(receiptRef))throw invalid();
 const q=await tx.query<InventoryFinanceReceipt>(sourceSql+` AND e.id=$2 AND l.branch_ref IS NOT DISTINCT FROM $3::uuid FOR SHARE OF e,d,l,s`,[root,receiptRef,branch]);
 const source=q.rows[0];if(!source)throw invalid();
 // Receipt reversal locks the same original event FOR UPDATE. Check after
 // acquiring our lock, in a fresh statement, to see any committed reversal.
 if((await tx.query("SELECT 1 FROM stock_event WHERE root_realm_id=$1 AND reversal_of_ref=$2 AND event_kind='RECEIPT_REVERSAL'",[root,receiptRef])).rowCount)throw invalid();
 return source;
}
