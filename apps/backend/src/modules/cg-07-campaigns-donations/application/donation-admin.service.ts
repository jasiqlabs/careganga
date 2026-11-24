import {BadRequestException,ForbiddenException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {readPrivateDonor} from "./donation-receipt-source.facade";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
const validate=(v:unknown)=>typeof v==="string"&&/^(ALL|REQUESTED|LINK_READY|PAYMENT_PENDING|VERIFIED_EXTERNAL|RECONCILIATION_PENDING|RECEIVED_POSTED|FAILED|EXPIRED)$/.test(v);

type Filter=Readonly<{
 status:string;q:string;offset:number;method:string;minMinor:string|null;maxMinor:string|null;
 from:string|null;to:string|null;campaign:string;branchRef:string;cursorTime:string|null;cursorId:string|null}>;
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
  "dateFrom","dateTo","campaign","cursor","branchRef"].includes(k)))
  throw new BadRequestException("Unknown donation filter.");
 const status=typeof v.status==="string"?v.status:"ALL",q=typeof v.q==="string"?v.q:"",offset=Number(v.offset??0),
  method=typeof v.method==="string"?v.method:"ALL",campaign=typeof v.campaign==="string"?v.campaign:"ALL",branchRef=typeof v.branchRef==="string"?v.branchRef:"ALL";
 if((!validate(status)&&status!=="REFUNDED")||typeof q!=="string"||q.length>80||
  /[<>\u0000-\u001f\u007f]/.test(q)||!Number.isSafeInteger(offset)||offset<0||offset>5000||
  typeof method!=="string"||!["ALL","CASH","BANK","CHEQUE","NEFT","ONLINE"].includes(method)||
  typeof campaign!=="string"||(campaign!=="ALL"&&!/^cg-camp-[0-9]{8}$/.test(campaign))||
   typeof branchRef!=="string"||
   !/^(ALL|FOUNDATION|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(branchRef))
  throw new BadRequestException("Check donation filter options.");
 const from=date(v.dateFrom),to=date(v.dateTo);
 if(from&&to&&from>to)throw new BadRequestException("End date must not precede start date.");
 const minMinor=minor(v.minAmount),maxMinor=minor(v.maxAmount);
 if(minMinor!==null&&maxMinor!==null&&BigInt(minMinor)>BigInt(maxMinor))
  throw new BadRequestException("Maximum amount must be at least the minimum amount.");
 let cursorTime:string|null=null,cursorId:string|null=null;
 if(v.cursor!==undefined&&v.cursor!==""){
  if(typeof v.cursor!=="string"||!/^[-_A-Za-z0-9]{30,170}$/.test(v.cursor))
   throw new BadRequestException("Report cursor is invalid.");
  try{
   const decoded:unknown=JSON.parse(Buffer.from(v.cursor,"base64url").toString("utf8"));
   if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))throw Error();
   const item=decoded as Record<string,unknown>;
   if(typeof item.t!=="string"||typeof item.id!=="string"||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)||
    !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T/.test(item.t)||
    new Date(item.t).toISOString()!==item.t)throw Error();
   cursorTime=item.t;cursorId=item.id;
  }catch{throw new BadRequestException("Report cursor is invalid.");}
 }
 return {status,q:q.trim().toLowerCase(),offset,method,campaign,branchRef,from,to,minMinor,maxMinor,cursorTime,cursorId};
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
// The branch selector can only narrow the current CG02 actor permission.
const branchSql=(n:number)=>" AND ($"+n+"::text='ALL' OR ($"+n+"::text='FOUNDATION' AND d.branch_ref IS NULL) OR d.branch_ref=$"+(n+1)+"::uuid)";
const selected=(v:string)=>v==="ALL"||v==="FOUNDATION"?null:v;
const csvCell=(raw:unknown)=>{
 const clean=String(raw??"").slice(0,256).replace(/[\u0000-\u001f\u007f]/g," ");
 const safe=/^[=+\-@]/.test(clean.trimStart())?"'"+clean:clean;
 return '"' + safe.replace(/"/g,'""') + '"';
};

@Injectable()
export class DonationAdminService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly branches:BranchSourceFacade){}
 private async reportScope(bearer:string,branchRef:string){
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  const active=await this.branches.financeBranches(bearer,"finance.reports.view");
  if(branchRef==="FOUNDATION"&&!scope.all)
   throw new ForbiddenException("Foundation-wide donations require administrator access.");
  if(!["ALL","FOUNDATION"].includes(branchRef)&&
   !active.some(x=>x.branchRef===branchRef))
   throw new ForbiddenException("Choose an accessible active branch.");
  return {scope,active};
 }
 /** Recheck live roles and original CG02 source before disclosing data.
  * Grant end or account revoke cannot return a stale authorized A+B page.
  */
 private async ensureReportScopeStillCurrent(bearer:string,filter:string,
  original:{all:boolean;branchRefs:string[]},privateExport=false){
  await this.sessions.requireAction(bearer,"finance.reports.view");
  if(privateExport)await this.sessions.requireAction(bearer,"documents.files.view");
  const latest=(await this.reportScope(bearer,filter)).scope;
  if(original.all&&!latest.all||!latest.all&&original.branchRefs.some(ref=>
      !latest.branchRefs.includes(ref)))
   throw new ForbiddenException("Your current branch reporting access changed. Refresh this report.");
 }
 /** Current reconciled owner totals, one SQL statement, no donor identity. */
 private async verifiedSummary(root:string,scope:{all:boolean;branchRefs:string[]},branchRef:string){
  const result=await this.db.query<{total:number;received:number;pending:number;failed:number;unverified:number;
   receiptsIssued:number;receivedMinor:string;verifiedRefundMinor:string;verifiedRefundCount:number;invalidRefunds:number;sourceAsOf:Date}>(`
   WITH scoped AS (
    SELECT d.id,d.root_realm_id,d.source_status,d.amount_minor,d.currency FROM donation d
    WHERE d.root_realm_id=$1 AND ($2::boolean OR d.branch_ref=ANY($3::uuid[]))
     AND ($4::text='ALL' OR ($4::text='FOUNDATION' AND d.branch_ref IS NULL) OR d.branch_ref=$5::uuid)
   ), verified AS (
    SELECT s.*,EXISTS(SELECT 1 FROM donation_finance_effect e JOIN journal j
     ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
     WHERE e.root_realm_id=s.root_realm_id AND e.donation_id=s.id AND e.status='POSTED'
      AND j.status='POSTED' AND j.source_ref=s.id AND j.immutable_source_event_key=e.source_event_key
      AND j.immutable_payload_digest=e.immutable_digest) AS posted
    FROM scoped s
   ), receipts AS (
    SELECT v.id FROM verified v WHERE v.source_status='RECEIVED_POSTED' AND v.posted
      AND EXISTS(SELECT 1 FROM cg19_donation_receipt_document rec JOIN donation_finance_effect e
       ON e.root_realm_id=rec.root_realm_id AND e.donation_id=rec.donation_id
       JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
       WHERE rec.root_realm_id=v.root_realm_id AND rec.donation_id=v.id AND rec.status='ISSUED'
        AND rec.source_digest=e.immutable_digest AND e.status='POSTED'
        AND j.status='POSTED' AND j.source_ref=v.id AND j.immutable_source_event_key=e.source_event_key
        AND j.immutable_payload_digest=e.immutable_digest)
   ), refunds AS (
    SELECT r.id,r.amount_minor,(v.posted AND v.source_status='RECEIVED_POSTED' AND EXISTS(
     SELECT 1 FROM journal j WHERE j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref
      AND j.status='POSTED' AND j.source_ref=r.id AND j.immutable_source_event_key=r.approval_request_key)) AS valid
    FROM donation_refund_request r JOIN verified v ON v.root_realm_id=r.root_realm_id AND v.id=r.donation_id
    WHERE r.status='FINANCE_REVERSED'
   )
   SELECT count(*)::int total,
    count(*) FILTER(WHERE source_status='RECEIVED_POSTED' AND posted)::int received,
    count(*) FILTER(WHERE source_status IN('REQUESTED','LINK_READY','PAYMENT_PENDING','VERIFIED_EXTERNAL','RECONCILIATION_PENDING'))::int pending,
    count(*) FILTER(WHERE source_status IN('FAILED','EXPIRED'))::int failed,
    count(*) FILTER(WHERE source_status='RECEIVED_POSTED' AND NOT posted OR posted AND source_status<>'RECEIVED_POSTED' OR currency<>'INR')::int unverified,
    (SELECT count(*)::int FROM receipts) AS "receiptsIssued",
    coalesce(sum(amount_minor) FILTER(WHERE source_status='RECEIVED_POSTED' AND posted AND currency='INR'),0)::text AS "receivedMinor",
    (SELECT coalesce(sum(amount_minor) FILTER(WHERE valid),0)::text FROM refunds) AS "verifiedRefundMinor",
    (SELECT count(*) FILTER(WHERE valid)::int FROM refunds) AS "verifiedRefundCount",
    (SELECT count(*) FILTER(WHERE NOT valid)::int FROM refunds) AS "invalidRefunds",
    statement_timestamp() AS "sourceAsOf"
   FROM verified`,[root,scope.all,scope.branchRefs,branchRef,selected(branchRef)]);
  const x=result.rows[0];
  if(!x)throw Error("Donation summary unavailable");
  const gross=BigInt(x.receivedMinor),refund=BigInt(x.verifiedRefundMinor);
  const requiresReview=x.unverified>0||x.invalidRefunds>0||refund>gross||
    x.received+x.pending+x.failed!==x.total;
  return {...x,netReceivedMinor:(gross-refund).toString(),requiresReview};
 }
 async misSummary(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  const {scope}=await this.reportScope(bearer,"ALL");
  const x=await this.verifiedSummary(actor.realmId,scope,"ALL");
  await this.ensureReportScopeStillCurrent(bearer,"ALL",scope);
  return x;
 }
 async list(bearer:string,input:Record<string,unknown>){
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  const f=filters(input);
  const {scope,active}=await this.reportScope(bearer,f.branchRef);
  const args=[actor.realmId,scope.all,scope.branchRefs,f.status,f.q,f.offset,f.method,
   f.minMinor,f.maxMinor,f.from,f.to,f.campaign,f.cursorTime,f.cursorId,f.branchRef,selected(f.branchRef)];
  const rows=await this.db.query<{
   donationNumber:string;amountMinor:string;currency:string;status:string;
   method:string|null;campaignTitle:string|null;branchName:string|null;voucher:string|null;createdAt:Date;
   donationRef:string;refundMinor:string;receiptStatus:string;latestCorrectionNumber:string|null}>(
    "SELECT d.id AS \"donationRef\",d.donation_number AS \"donationNumber\",d.amount_minor::text AS \"amountMinor\","+
    "d.currency,d.source_status AS status,m.method,c.title AS \"campaignTitle\","+
    "b.name AS \"branchName\",e.voucher_reference AS voucher,d.created_at AS \"createdAt\","+
    "coalesce((SELECT sum(r.amount_minor) FROM donation_refund_request r "+
    "JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref "+
    "WHERE r.root_realm_id=d.root_realm_id AND r.donation_id=d.id "+
    "AND r.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=r.id),0)::text "+
    "AS \"refundMinor\",coalesce((SELECT rec.status FROM cg19_donation_receipt_document rec "+
    "WHERE rec.root_realm_id=d.root_realm_id AND rec.donation_id=d.id),'NOT_ISSUED') "+
    "AS \"receiptStatus\","+
    "(SELECT corr.correction_number FROM cg19_donation_receipt_correction corr "+
    "WHERE corr.root_realm_id=d.root_realm_id AND corr.donation_id=d.id "+
    "AND corr.status='ISSUED' ORDER BY corr.issued_at DESC,corr.id DESC LIMIT 1) "+
    "AS \"latestCorrectionNumber\" "+
    "FROM donation d LEFT JOIN branch b ON b.root_realm_id=d.root_realm_id AND b.id=d.branch_ref "+
    "LEFT JOIN campaign c ON c.root_realm_id=d.root_realm_id AND c.id=d.campaign_id "+
    "LEFT JOIN donation_manual_evidence e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id "+
    "LEFT JOIN LATERAL (SELECT a.method FROM donation_payment_attempt a WHERE a.root_realm_id=d.root_realm_id AND a.donation_id=d.id ORDER BY a.created_at DESC,a.id DESC LIMIT 1) m ON true "+
    where+branchSql(15)+" AND ($13::timestamptz IS NULL OR (d.created_at,d.id)<($13::timestamptz,$14::uuid)) ORDER BY d.created_at DESC,d.id DESC LIMIT 26 OFFSET $6",args);
  const summary=await this.verifiedSummary(actor.realmId,scope,f.branchRef);
   const trends=await this.db.query<{month:string;grossMinor:string;refundMinor:string;netMinor:string}>(`
    WITH entries AS (
     SELECT j.posting_date AS day,d.amount_minor::numeric AS gross,0::numeric AS refund
     FROM donation d JOIN donation_finance_effect e ON e.root_realm_id=d.root_realm_id AND e.donation_id=d.id
     JOIN journal j ON j.root_realm_id=e.root_realm_id AND j.id=e.journal_id
     WHERE d.root_realm_id=$1 AND ($2::boolean OR d.branch_ref=ANY($3::uuid[]))
      AND ($4::text='ALL' OR ($4::text='FOUNDATION' AND d.branch_ref IS NULL) OR d.branch_ref=$5::uuid)
      AND d.source_status='RECEIVED_POSTED' AND e.status='POSTED'
      AND j.status='POSTED' AND j.source_ref=d.id
      AND j.immutable_source_event_key=e.source_event_key
      AND j.immutable_payload_digest=e.immutable_digest
      AND j.posting_date>=date_trunc('month',current_date)-interval '11 months'
     UNION ALL
     SELECT j.posting_date AS day,0::numeric,r.amount_minor::numeric AS refund
     FROM donation_refund_request r JOIN donation d
      ON d.root_realm_id=r.root_realm_id AND d.id=r.donation_id
     JOIN journal j ON j.root_realm_id=r.root_realm_id AND j.id=r.reversal_journal_ref
     WHERE r.root_realm_id=$1 AND ($2::boolean OR d.branch_ref=ANY($3::uuid[]))
      AND ($4::text='ALL' OR ($4::text='FOUNDATION' AND d.branch_ref IS NULL) OR d.branch_ref=$5::uuid)
      AND r.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=r.id
      AND j.posting_date>=date_trunc('month',current_date)-interval '11 months'
    )
    SELECT to_char(date_trunc('month',day),'YYYY-MM') AS month,
     sum(gross)::text AS "grossMinor",sum(refund)::text AS "refundMinor",
     (sum(gross)-sum(refund))::text AS "netMinor"
    FROM entries GROUP BY date_trunc('month',day) ORDER BY month ASC`,
    [actor.realmId,scope.all,scope.branchRefs,f.branchRef,selected(f.branchRef)]);
   await this.ensureReportScopeStillCurrent(bearer,f.branchRef,scope);
   const last=rows.rows.slice(0,25).at(-1);
   const nextCursor=rows.rows.length>25&&last?
    Buffer.from(JSON.stringify({t:last.createdAt.toISOString(),id:last.donationRef})).toString("base64url"):null;
   return {items:rows.rows.slice(0,25),hasMore:rows.rows.length>25,offset:f.offset,nextCursor,
   branchSelection:f.branchRef,branchOptions:[
      {value:"ALL",label:scope.all?"Foundation and all branches":"All permitted branches"},
      ...(scope.all?[{value:"FOUNDATION",label:"Foundation-wide only"}]:[]),
      ...active.map(x=>({value:x.branchRef,label:x.name}))],
    summary,monthlyTrend:trends.rows,message:summary.requiresReview?"Some original donations or refunds require finance reconciliation. Verified totals may be incomplete.":"Only original CG09-confirmed posted receipts count as received. Pending requests are excluded."};
 }
 /** Role-checked, branch-scoped, bounded original report export.
  * No unmasked donor identity, PAN, bank credentials or technical UUIDs. */
 async exportCsv(bearer:string,input:Record<string,unknown>):Promise<Buffer>{
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  await this.sessions.requireAction(bearer,"documents.files.view");
  const f=filters({...input,offset:"0"});
  const {scope}=await this.reportScope(bearer,f.branchRef);
  const args=[actor.realmId,scope.all,scope.branchRefs,f.status,f.q,0,f.method,
   f.minMinor,f.maxMinor,f.from,f.to,f.campaign,f.branchRef,selected(f.branchRef)];
  const records=await this.db.query<{donation_number:string;amount_minor:string;
    currency:string;source_status:string;method:string|null;title:string|null;branch_name:string|null;
    receipt_number:string|null;correction_number:string|null;created_on:string;refund_minor:string}>(`
    SELECT d.donation_number,d.amount_minor::text,d.currency,d.source_status,m.method,
     c.title,b.name AS branch_name,r.receipt_number,d.created_at::date::text AS created_on,
      coalesce((SELECT sum(x.amount_minor) FROM donation_refund_request x
       JOIN journal j ON j.root_realm_id=x.root_realm_id AND j.id=x.reversal_journal_ref
       WHERE x.root_realm_id=d.root_realm_id AND x.donation_id=d.id
        AND x.status='FINANCE_REVERSED' AND j.status='POSTED' AND j.source_ref=x.id),0)::text AS refund_minor,
    (SELECT corr.correction_number FROM cg19_donation_receipt_correction corr
     WHERE corr.root_realm_id=d.root_realm_id AND corr.donation_id=d.id AND corr.status='ISSUED'
     ORDER BY corr.issued_at DESC,corr.id DESC LIMIT 1) AS correction_number
    FROM donation d LEFT JOIN branch b ON b.root_realm_id=d.root_realm_id AND b.id=d.branch_ref
     LEFT JOIN campaign c ON c.root_realm_id=d.root_realm_id AND c.id=d.campaign_id
    LEFT JOIN LATERAL (SELECT a.method FROM donation_payment_attempt a
      WHERE a.root_realm_id=d.root_realm_id AND a.donation_id=d.id
      ORDER BY a.created_at DESC,a.id DESC LIMIT 1) m ON true
    LEFT JOIN cg19_donation_receipt_document r ON r.root_realm_id=d.root_realm_id
      AND r.donation_id=d.id AND r.status='ISSUED'
  `+where+branchSql(13)+" AND $6::integer=0 ORDER BY d.created_at DESC,d.id DESC LIMIT 501",args);
  if(records.rows.length>500)throw new BadRequestException(
   "Narrow the dates or campaign to export up to 500 records per report.");
  const lines=[["Donation number","Branch","Campaign","Requested amount INR","Verified gross INR",
   "Verified refund INR","Verified net INR","Status","Method","Date","Original receipt","Latest correction"].map(csvCell).join(",")];
  for(const r of records.rows){
   const money=(v:bigint)=>(v/100n).toString()+"."+(v%100n).toString().padStart(2,"0");
   const requested=BigInt(r.amount_minor),posted=r.source_status==="RECEIVED_POSTED";
   const gross=posted?requested:0n,refunded=posted?BigInt(r.refund_minor):0n;
   lines.push([r.donation_number,r.branch_name??"Foundation-wide",r.title??"General donation",money(requested),
    money(gross),money(refunded),money(gross-refunded),
    r.source_status,r.method??"Not selected",r.created_on,
    r.receipt_number??"",r.correction_number??""].map(csvCell).join(","));
  }
  await this.ensureReportScopeStillCurrent(bearer,f.branchRef,scope,true);
  return Buffer.from(lines.join("\r\n")+"\r\n","utf8");
 }
 async donorDetail(bearer:string,raw:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.reports.view");
  await this.sessions.requireAction(bearer,"documents.files.view");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>k!=="donationNumber"))
   throw new BadRequestException("Select a donation from your current report.");
  const number=(raw as Record<string,unknown>).donationNumber;
  if(typeof number!=="string"||!/^CG-DON-[0-9]{8}$/.test(number))
   throw new BadRequestException("Select a valid original donation number.");
  const scope=await this.branches.financeReportScope(bearer,"finance.reports.view");
  const row=(await this.db.query<{donation_number:string;donor_private_ciphertext:string}>(
    "SELECT d.donation_number,d.donor_private_ciphertext FROM donation d "+
    "WHERE d.root_realm_id=$1 AND d.donation_number=$2 "+
    "AND ($3::boolean OR d.branch_ref=ANY($4::uuid[])) LIMIT 1",
    [actor.realmId,number,scope.all,scope.branchRefs])).rows[0];
  if(!row)throw new NotFoundException("Donation unavailable to your Foundation branch.");
  const donor=readPrivateDonor(row.donor_private_ciphertext);
  const mobile=donor.mobile?"*".repeat(Math.max(0,donor.mobile.length-4))+donor.mobile.slice(-4):"";
  const email=donor.email.includes("@")?donor.email.slice(0,1)+"***"+
   donor.email.slice(donor.email.indexOf("@")):"";
  const pan=donor.pan?donor.pan.slice(0,2)+"*******"+donor.pan.slice(-1):"";
  await this.sessions.requireAction(bearer,"finance.reports.view");
  await this.sessions.requireAction(bearer,"documents.files.view");
  const latest=await this.branches.financeReportScope(bearer,"finance.reports.view");
  if(scope.all&&!latest.all||!latest.all&&
    scope.branchRefs.some(ref=>!latest.branchRefs.includes(ref)))
   throw new ForbiddenException("Your donation access changed. Refresh this record.");
  return {donationNumber:row.donation_number,name:donor.name||"Anonymous",
   mobileMasked:mobile,emailMasked:email,panMasked:pan,location:donor.geography||"Not provided"};
 }

}
