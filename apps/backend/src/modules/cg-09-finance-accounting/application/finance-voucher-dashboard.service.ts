import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
/** U33 original voucher dashboard is a root-scoped projection of the one CG09 voucher.
 * Counts are derived from real records, never sample values or future masters.
 */
@Injectable()
export class FinanceVoucherDashboardService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly sessions:SessionService){}
 async summary(bearer:string,filterInput?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.vouchers.view");
  const status=filterInput??"ALL";
  if(!["ALL","DRAFT","SUBMITTED","APPROVED","REJECTED","RETURNED","PAYMENT_REQUESTED","PAID_VERIFIED","POSTED"].includes(status))
   throw new BadRequestException({code:"FINANCE_FILTER_INVALID",field:"status"});
  const totals=await this.db.query<{total:number;pending:number;approved:number;
   rejected:number;paid:number;posted:number;totalMinor:string;pendingMinor:string;
   approvedMinor:string;paidMinor:string}>(`
   SELECT count(*)::int AS total,
    count(*) FILTER(WHERE status='SUBMITTED')::int AS pending,
    count(*) FILTER(WHERE status IN('APPROVED','PAYMENT_REQUESTED','PAID_VERIFIED','POSTED'))::int AS approved,
    count(*) FILTER(WHERE status='REJECTED')::int AS rejected,
    count(*) FILTER(WHERE status IN('PAID_VERIFIED','POSTED') AND voucher_type IN('PAYMENT','CONTRA'))::int AS paid,
    count(*) FILTER(WHERE status='POSTED')::int AS posted,
    COALESCE(sum(total_minor),0)::text AS "totalMinor",
    COALESCE(sum(total_minor) FILTER(WHERE status='SUBMITTED'),0)::text AS "pendingMinor",
    COALESCE(sum(total_minor) FILTER(WHERE status IN('APPROVED','POSTED')),0)::text AS "approvedMinor",
    COALESCE(sum(total_minor) FILTER(WHERE status='PAID_VERIFIED' AND voucher_type IN('PAYMENT','CONTRA')),0)::text AS "paidMinor"
   FROM finance_voucher WHERE root_realm_id=$1`,[actor.realmId]);
  const months=await this.db.query<{month:string;count:number;totalMinor:string}>(`
   SELECT to_char(date_trunc('month',posting_date),'YYYY-MM') AS month,
    count(*)::int AS count,COALESCE(sum(total_minor),0)::text AS "totalMinor"
   FROM finance_voucher
   WHERE root_realm_id=$1 AND posting_date>=date_trunc('month',current_date)-interval '11 months'
     AND posting_date<date_trunc('month',current_date)+interval '1 month'
   GROUP BY date_trunc('month',posting_date)
   ORDER BY date_trunc('month',posting_date)`,[actor.realmId]);
  const expense=await this.db.query<{category:string;count:number;totalMinor:string}>(`
   SELECT g.name AS category,count(*)::int AS count,
    COALESCE(sum(v.total_minor),0)::text AS "totalMinor"
   FROM finance_voucher v JOIN finance_account a
      ON a.id=v.debit_account_id AND a.root_realm_id=v.root_realm_id
    JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=v.root_realm_id
   WHERE v.root_realm_id=$1 AND v.voucher_type='EXPENSE'
   GROUP BY g.id,g.name ORDER BY sum(v.total_minor) DESC,g.name LIMIT 8`,
   [actor.realmId]);
  return {cards:totals.rows[0],monthly:months.rows,categories:expense.rows,
   filterApplied:status,updatedFrom:"ORIGINAL_FINANCE_VOUCHERS"};
 }
}
