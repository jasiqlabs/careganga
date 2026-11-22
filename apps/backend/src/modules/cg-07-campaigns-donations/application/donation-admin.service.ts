import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
const validate=(v:unknown)=>typeof v==="string"&&/^(ALL|REQUESTED|LINK_READY|PAYMENT_PENDING|VERIFIED_EXTERNAL|RECONCILIATION_PENDING|RECEIVED_POSTED|FAILED|EXPIRED)$/.test(v);
@Injectable()
export class DonationAdminService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly branches:BranchSourceFacade){}
 async list(bearer:string,input:Record<string,unknown>){
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  const status=input.status??"ALL",q=input.q??"",offset=Number(input.offset??"0");
  if(Object.keys(input).some(k=>!["status","q","offset"].includes(k))||
   !validate(status)||typeof q!=="string"||q.trim().length>80||
   /[<>\u0000-\u001f\u007f]/.test(q)||!Number.isSafeInteger(offset)||offset<0||offset>5000)
    throw new BadRequestException("Check donation filters.");
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  const args=[actor.realmId,scope.all,scope.branchRefs,status,q.trim().toLowerCase(),offset];
  const rows=await this.db.query<{
   donationNumber:string;amountMinor:string;currency:string;status:string;
   method:string|null;campaignTitle:string|null;voucher:string|null;createdAt:Date;
   donationRef:string;refundMinor:string;receiptStatus:string}>(
    "SELECT d.id AS "donationRef",d.donation_number AS \"donationNumber\",d.amount_minor::text AS \"amountMinor\","+
    "d.currency,d.source_status AS status,m.method,c.title AS \"campaignTitle\","+
    "e.voucher_reference AS voucher,d.created_at AS \"createdAt\","+
    "coalesce((SELECT sum(r.amount_minor) FROM donation_refund_request r "+
    "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
    "WHERE r.root_realm_id=d.root_realm_id AND r.donation_id=d.id "+
    "AND r.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=r.id),0)::text "+
    "AS \"refundMinor\",coalesce((SELECT rec.status FROM cg19_donation_receipt_document rec "+
    "WHERE rec.root_realm_id=d.root_realm_id AND rec.donation_id=d.id),'NOT_ISSUED') "+
    "AS \"receiptStatus\" "+
    "FROM donation d LEFT JOIN campaign c ON c.root_realm_id=d.root_realm_id AND c.id=d.campaign_id "+
    "LEFT JOIN donation_manual_evidence e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id "+
    "LEFT JOIN LATERAL (SELECT a.method FROM donation_payment_attempt a WHERE a.root_realm_id=d.root_realm_id AND a.donation_id=d.id ORDER BY a.created_at DESC,a.id DESC LIMIT 1) m ON true "+
    "WHERE d.root_realm_id=$1 AND ($2::boolean OR d.branch_ref=ANY($3::uuid[])) "+
    "AND ($4='ALL' OR d.source_status=$4) "+
    "AND ($5='' OR strpos(lower(d.donation_number),$5)>0 OR strpos(lower(coalesce(c.title,'')),$5)>0) "+
    "ORDER BY d.created_at DESC,d.id DESC LIMIT 26 OFFSET $6",args);
  const summary=await this.db.query<{total:number;received:number;pending:number;failed:number;
   receivedMinor:string}>(
    "SELECT count(*)::int AS total,count(*) FILTER(WHERE source_status='RECEIVED_POSTED')::int AS received,"+
    "count(*) FILTER(WHERE source_status IN('REQUESTED','LINK_READY','PAYMENT_PENDING','VERIFIED_EXTERNAL','RECONCILIATION_PENDING'))::int AS pending,"+
    "count(*) FILTER(WHERE source_status IN('FAILED','EXPIRED'))::int AS failed,"+
    "coalesce(sum(amount_minor) FILTER(WHERE source_status='RECEIVED_POSTED'),0)::text AS \"receivedMinor\" "+
    "FROM donation WHERE root_realm_id=$1 AND ($2::boolean OR branch_ref=ANY($3::uuid[]))",
    [actor.realmId,scope.all,scope.branchRefs]);
  const verifiedRefunds=await this.db.query<{minor:string;total:number}>(
    "SELECT coalesce(sum(r.amount_minor),0)::text AS minor,count(*)::int AS total "+
    "FROM donation_refund_request r "+
    "JOIN donation d ON d.root_realm_id=r.root_realm_id AND d.id=r.donation_id "+
    "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
    "WHERE r.root_realm_id=$1 AND ($2::boolean OR d.branch_ref=ANY($3::uuid[])) "+
    "AND r.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=r.id",
    [actor.realmId,scope.all,scope.branchRefs]);
   const refunded=BigInt(verifiedRefunds.rows[0]?.minor??"0");
   const gross=BigInt(summary.rows[0]?.receivedMinor??"0");
   return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25,offset,
   summary:{...summary.rows[0],verifiedRefundMinor:refunded.toString(),
     verifiedRefundCount:verifiedRefunds.rows[0]?.total??0,
     netReceivedMinor:(gross-refunded).toString()},message:"Only original CG09-confirmed posted receipts count as received. Pending requests are excluded."};
 }
}
