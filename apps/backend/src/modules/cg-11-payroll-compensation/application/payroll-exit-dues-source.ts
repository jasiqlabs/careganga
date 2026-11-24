import type {PoolClient} from "pg";
export type ExitSalaryStatus="NOT_AVAILABLE"|"PENDING_DUES"|"APPROVED_NOT_PAID"|"PAID_VERIFIED";
/** Status-only CG10 consumer; caller must have authorized the original employee exit.
 * Absence of a frozen final-period entitlement is never proof of settlement.
 * No amounts, bank details, or general finance clearance are returned. */
export async function payrollExitDues(tx:PoolClient,realm:string,employee:string,lastWorkingDate:string|null):Promise<ExitSalaryStatus>{
 if(!lastWorkingDate)return "NOT_AVAILABLE";
 const rows=(await tx.query<{period:string;due:string;paid:string;reversed:boolean}>(`
 SELECT l.period_key period,l.net_minor::text due,coalesce(p.paid,0)::text paid,coalesce(p.reversed,false) reversed
 FROM payroll_line l JOIN payroll_run r ON r.root_realm_id=l.root_realm_id AND r.id=l.run_id AND r.status='APPROVED_FROZEN'
 LEFT JOIN payroll_batch_item i ON i.root_realm_id=l.root_realm_id AND i.line_ref=l.id
 LEFT JOIN LATERAL (SELECT sum(x.paid_minor) paid,bool_or(x.reversed) reversed FROM payroll_attempt_outcome x WHERE x.root_realm_id=i.root_realm_id AND x.item_ref=i.id) p ON true
 WHERE l.root_realm_id=$1 AND l.employee_ref=$2 AND l.period_key<=to_char($3::date,'YYYY-MM') ORDER BY l.period_key`,[realm,employee,lastWorkingDate])).rows;
 if(!rows.some(x=>x.period===lastWorkingDate.slice(0,7)))return "PENDING_DUES";
 if(rows.some(x=>x.reversed||BigInt(x.paid)>BigInt(x.due)))return "PENDING_DUES";
 const outstanding=rows.filter(x=>BigInt(x.paid)<BigInt(x.due));
 if(outstanding.length===0)return "PAID_VERIFIED";
 return outstanding.some(x=>BigInt(x.paid)>0n)||outstanding.length>1?"PENDING_DUES":"APPROVED_NOT_PAID";
}
