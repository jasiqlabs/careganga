import {BadRequestException,Inject,Injectable} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
const validate=(v:unknown)=>typeof v==="string"&&/^(ALL|REQUESTED|LINK_READY|PAYMENT_PENDING|VERIFIED_EXTERNAL|RECONCILIATION_PENDING|RECEIVED_POSTED|FAILED|EXPIRED)$/.test(v);

type Filter=Readonly<{
 status:string;q:string;offset:number;method:string;minMinor:string|null;maxMinor:string|null;
 from:string|null;to:string|null;campaign:string}>;
const date=(raw:unknown):string|null=>{
 if(raw===undefined||raw==="")return null;
 if(typeof raw!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(raw)||
  !Number.isFinite(Date.parse(raw+"T00:00:00Z"))||
  new Date(raw+"T00:00:00Z").toISOString().slice(0,10)!==raw)
  throw new BadRequestException("Choose a valid donation date.");
 return raw;
};
const minor=(raw:unknown):string|null=>{
 if(raw===undefined||raw==="")return null;
 if(typeof raw!=="string"||!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(raw))
  throw new BadRequestException("Enter a valid donation amount.");
 const [whole,frac=""]=raw.split(".");
 const n=BigInt(whole)*100n+BigInt(frac.padEnd(2,"0"));
 if(n>99999999999999n)throw new BadRequestException("Donation amount is too large.");
 return n.toString();
};
const filters=(v:Record<string,unknown>):Filter=>{
 if(Object.keys(v).some(k=>!["status","q","offset","method","minAmount","maxAmount",
  "dateFrom","dateTo","campaign"].includes(k)))
  throw new BadRequestException("Unknown donation filter.");
 const status=v.status??"ALL",q=v.q??"",offset=Number(v.offset??0),
  method=v.method??"ALL",campaign=v.campaign??"ALL";
 if((!validate(status)&&status!=="REFUNDED")||typeof q!=="string"||q.length>80||
  /[<>\u0000-\u001f\u007f]/.test(q)||!Number.isSafeInteger(offset)||offset<0||offset>5000||
  typeof method!=="string"||!["ALL","CASH","BANK","CHEQUE","NEFT","ONLINE"].includes(method)||
  typeof campaign!=="string"||(campaign!=="ALL"&&!/^cg-camp-[0-9]{8}$/.test(campaign)))
  throw new BadRequestException("Check donation filter options.");
 const from=date(v.dateFrom),to=date(v.dateTo);
 if(from&&to&&from>to)throw new BadRequestException("End date must not precede start date.");
 const minMinor=minor(v.minAmount),maxMinor=minor(v.maxAmount);
 if(minMinor!==null&&maxMinor!==null&&BigInt(minMinor)>BigInt(maxMinor))
  throw new BadRequestException("Maximum amount must be at least the minimum amount.");
 return {status,q:q.trim().toLowerCase(),offset,method,campaign,from,to,minMinor,maxMinor};
};
const where=String.raw`
 WHERE d.root_realm_id=$1 AND ($2::boolean OR d.branch_ref=ANY($3::uuid[]))
 AND ($4='ALL' OR d.source_status=$4 OR ($4='REFUNDED' AND EXISTS(
   SELECT 1 FROM donation_refund_request r
   JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref
   WHERE r.root_realm_id=d.root_realm_id AND r.donation_id=d.id
    AND r.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=r.id)))
 AND ($5='' OR strpos(lower(d.donation_number),$5)>0
  OR strpos(lower(coalesce(c.title,'')),$5)>0)
 AND ($7='ALL' OR m.method=$7)
 AND ($8::bigint IS NULL OR d.amount_minor>=$8::bigint)
 AND ($9::bigint IS NULL OR d.amount_minor<=$9::bigint)
 AND ($10::date IS NULL OR d.created_at>=$10::date)
 AND ($11::date IS NULL OR d.created_at<($11::date+interval '1 day'))
 AND ($12='ALL' OR lower(c.code_norm)=$12)
`;
const csvCell=(raw:unknown)=>{
 const clean=String(raw??"").slice(0,256).replace(/[\u0000-\u001f\u007f]/g," ");
 const safe=/^[=+\-@]/.test(clean.trimStart())?"'"+clean:clean;
 return '"' + safe.replace(/"/g,'""') + '"';
};

@Injectable()
export class DonationAdminService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly branches:BranchSourceFacade){}
 async list(bearer:string,input:Record<string,unknown>){
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  const f=filters(input);
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  const args=[actor.realmId,scope.all,scope.branchRefs,f.status,f.q,f.offset,f.method,
   f.minMinor,f.maxMinor,f.from,f.to,f.campaign];
  const rows=await this.db.query<{
   donationNumber:string;amountMinor:string;currency:string;status:string;
   method:string|null;campaignTitle:string|null;voucher:string|null;createdAt:Date;
   donationRef:string;refundMinor:string;receiptStatus:string}>(
    "SELECT d.id AS \"donationRef\",d.donation_number AS \"donationNumber\",d.amount_minor::text AS \"amountMinor\","+
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
    where+" ORDER BY d.created_at DESC,d.id DESC LIMIT 26 OFFSET $6",args);
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
 /** Role-checked, branch-scoped, bounded original report export.
  * No unmasked donor identity, PAN, bank credentials or technical UUIDs. */
 async exportCsv(bearer:string,input:Record<string,unknown>):Promise<Buffer>{
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  await this.sessions.requireAction(bearer,"documents.files.view");
  const f=filters({...input,offset:"0"});
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  const args=[actor.realmId,scope.all,scope.branchRefs,f.status,f.q,0,f.method,
   f.minMinor,f.maxMinor,f.from,f.to,f.campaign];
  const records=await this.db.query<{donation_number:string;amount_minor:string;
    currency:string;source_status:string;method:string|null;title:string|null;
    receipt_number:string|null;created_on:string}>(`
    SELECT d.donation_number,d.amount_minor::text,d.currency,d.source_status,m.method,
     c.title,r.receipt_number,d.created_at::date::text AS created_on
    FROM donation d LEFT JOIN campaign c ON c.root_realm_id=d.root_realm_id AND c.id=d.campaign_id
    LEFT JOIN LATERAL (SELECT a.method FROM donation_payment_attempt a
      WHERE a.root_realm_id=d.root_realm_id AND a.donation_id=d.id
      ORDER BY a.created_at DESC,a.id DESC LIMIT 1) m ON true
    LEFT JOIN cg19_donation_receipt_document r ON r.root_realm_id=d.root_realm_id
      AND r.donation_id=d.id AND r.status='ISSUED'
  `+where+" ORDER BY d.created_at DESC,d.id DESC LIMIT 501",args);
  if(records.rows.length>500)throw new BadRequestException(
   "Narrow the dates or campaign to export up to 500 records per report.");
  const lines=[["Donation number","Campaign","Amount INR","Status","Method",
   "Date","Issued receipt"].map(csvCell).join(",")];
  for(const r of records.rows){
   const n=BigInt(r.amount_minor);
   const amount=(n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");
   lines.push([r.donation_number,r.title??"General donation",amount,
    r.source_status,r.method??"Not selected",r.created_on,
    r.receipt_number??""].map(csvCell).join(","));
  }
  return Buffer.from(lines.join("\r\n")+"\r\n","utf8");
 }

}
