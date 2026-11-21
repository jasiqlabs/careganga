import {
 BadRequestException,ForbiddenException,Injectable,UnauthorizedException
} from "@nestjs/common";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceReportsService} from "../../cg-09-finance-accounting/application/finance-reports.service";
import {PatientAdminOverviewService} from "../../cg-15-patients-appointments/application/patient-admin-overview.service";

export const REPORT_KINDS=[
 "FINANCE_POSTED_LEDGER","FINANCE_POSTED_SUMMARY",
 "FINANCE_POSTED_TREND","APPOINTMENT_STATUS"
] as const;
export type ReportKind=typeof REPORT_KINDS[number];
export type ReportView="TABLE"|"SUMMARY"|"CHART";
export type SafeReportRequest={
 kind:ReportKind;view:ReportView;yearRef?:string;branchRef?:string;
 centerRef?:string;fromDay?:string;untilDay?:string;status?:string;
 offset:number
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const statusSet=new Set(["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION",
 "COMPLETED","NO_SHOW","CANCELLED"]);
const kindSet=new Set<string>(REPORT_KINDS);
const day=(v:string)=>{
 if(!DATE.test(v))return false;
 const d=new Date(v+"T00:00:00.000Z");
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
};
const allowedFields=new Set(["kind","view","yearRef","branchRef",
 "centerRef","fromDay","untilDay","status","offset"]);
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
export const FINANCE_KINDS:readonly ReportKind[]=[
 "FINANCE_POSTED_LEDGER","FINANCE_POSTED_SUMMARY","FINANCE_POSTED_TREND"
];
export function parseSafeReport(raw:unknown):SafeReportRequest{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"Choose a supported report."});
 const o=raw as Record<string,unknown>;
 if(Object.keys(o).some(k=>!allowedFields.has(k)))
  throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"This report option is unavailable."});
 const kind=text(o.kind),view=text(o.view);
 if(!kindSet.has(kind)||!["TABLE","SUMMARY","CHART"].includes(view))
  throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"Choose a supported report and view."});
 const legalViews:Record<ReportKind,readonly string[]>={
  FINANCE_POSTED_LEDGER:["TABLE"],
  FINANCE_POSTED_SUMMARY:["SUMMARY"],
  FINANCE_POSTED_TREND:["CHART"],
  APPOINTMENT_STATUS:["SUMMARY","CHART"]
 };
 if(!legalViews[kind as ReportKind].includes(view))
  throw new BadRequestException({code:"MIS_REPORT_VIEW_INVALID",
   message:"The selected report does not support that view."});
 const fields=["yearRef","branchRef","centerRef","fromDay","untilDay","status"] as const;
 for(const f of fields){
  if(o[f]!==undefined&&(typeof o[f]!=="string"||o[f].length>80))
   throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"Choose valid filters."});
 }
 const yearRef=text(o.yearRef),branchRef=text(o.branchRef),
  centerRef=text(o.centerRef),fromDay=text(o.fromDay),
  untilDay=text(o.untilDay),status=text(o.status);
 const isFinance=FINANCE_KINDS.includes(kind as ReportKind);
 if([yearRef,branchRef,centerRef].some(v=>v!==""&&!UUID.test(v))||
  isFinance&&(centerRef!==""||status!=="")||
  !isFinance&&(yearRef!==""||branchRef!=="")||
  status!==""&&!statusSet.has(status)||
  Boolean(fromDay)!==Boolean(untilDay)||
  fromDay!==""&&(!day(fromDay)||!day(untilDay)||fromDay>untilDay||
   Date.parse(untilDay+"T00:00:00Z")-Date.parse(fromDay+"T00:00:00Z")>366*86400000)||
  fromDay!==""&&kind!=="FINANCE_POSTED_LEDGER"&&kind!=="APPOINTMENT_STATUS")
  throw new BadRequestException({code:"MIS_REPORT_FILTER_INVALID",
   message:"Choose an allowed center, year, status and date range for this report."});
 const offset=o.offset===undefined?0:o.offset;
 if(typeof offset!=="number"||!Number.isInteger(offset)||
  offset<0||offset>500||offset%50!==0||
  offset>0&&kind!=="FINANCE_POSTED_LEDGER")
  throw new BadRequestException({code:"MIS_REPORT_PAGE_INVALID",
   message:"This page is unavailable. Select an earlier page."});
 return {kind:kind as ReportKind,view:view as ReportView,
  ...(yearRef?{yearRef}:{}),...(branchRef?{branchRef}:{}),
  ...(centerRef?{centerRef}:{}),...(fromDay?{fromDay,untilDay}:{}),
  ...(status?{status}:{}),offset};
}
export function suppressAppointmentCells(rows:{
 bookings:string;completed:string;waiting:string;cancelled:string
}):boolean{
 const total=BigInt(rows.bookings);
 const parts=[BigInt(rows.completed),BigInt(rows.waiting),BigInt(rows.cancelled)];
 const remainder=total-parts.reduce((n,v)=>n+v,0n);
 return total>0n&&(total<5n||[...parts,remainder].some(v=>v>0n&&v<5n));
}
type ReportRow=Record<string,string>;
type ReportPreview={
 state:"READY"|"EMPTY"|"SUPPRESSED";kind:ReportKind;view:ReportView;
 label:string;columns:{key:string;label:string;unit?:"INR_MINOR"|"COUNT"|"TEXT"}[];
 rows:ReportRow[];nextOffset:number|null;
 sourceAsOf?:string;sourceCutoffKind:string;sourceReadAt:string;
 explanation:string;scopeLabel:string
};
/** Single code-owned registry. Only real CG09 and CG15 owner facades are
 * registered; future modules add their own permissioned bounded readers.
 * Never accept table names, SQL, arbitrary expressions, joins or raw records.
 */
@Injectable()
export class MisReportSourceService{
 constructor(private readonly sessions:SessionService,
  private readonly finance:FinanceReportsService,
  private readonly patients:PatientAdminOverviewService){}
 async catalog(token:string){
  await this.sessions.requireAction(token,"mis.reports.view");
  const [finance,appointments]=await Promise.all([
   this.finance.options(token).then(x=>({
    ready:true,years:x.years.map(y=>({ref:y.ref,name:y.name})),
    branches:x.branches.map(b=>({ref:b.branchRef,name:b.name})),
    allBranches:x.allBranches
   })).catch((e:unknown)=>{
    if(e instanceof UnauthorizedException)throw e;
    return {ready:false,years:[],branches:[],allBranches:false};
   }),
   this.patients.readMisOptions(token).then(x=>({
    ready:true,centers:x.centers.map(c=>({ref:c.centerRef,name:c.name})),
    complete:x.complete
   })).catch((e:unknown)=>{
    if(e instanceof UnauthorizedException)throw e;
    return {ready:false,centers:[],complete:false};
   })
  ]);
  const templates=[
   ...(finance.ready?[
    {kind:"FINANCE_POSTED_LEDGER",label:"Posted finance ledger",
     views:["TABLE"],description:"Only posted journal lines (up to 50 per page)"},
    {kind:"FINANCE_POSTED_SUMMARY",label:"Posted finance summary",
     views:["SUMMARY"],description:"Income, expenses, surplus and cash/bank balances"},
    {kind:"FINANCE_POSTED_TREND",label:"Finance trend",
     views:["CHART"],description:"Actual posted income and expenses by month"}
   ]:[]),
   ...(appointments.ready?[{kind:"APPOINTMENT_STATUS",
    label:"Appointment status summary",views:["SUMMARY","CHART"],
    description:"Protected aggregate status counts without patient details"}]:[])
  ];
  return {templates,finance,appointments,sourceReadAt:new Date().toISOString()};
 }
 async preview(token:string,raw:unknown):Promise<ReportPreview>{
  await this.sessions.requireAction(token,"mis.reports.view");
  const q=parseSafeReport(raw);
  const sourceReadAt=new Date().toISOString();
  const finance=FINANCE_KINDS.includes(q.kind);
  if(finance){
   if(q.kind==="FINANCE_POSTED_LEDGER"){
    const result=await this.finance.ledger(token,{
     yearRef:q.yearRef,branchRef:q.branchRef,
     from:q.fromDay,to:q.untilDay,offset:String(q.offset)
    });
    const rows=result.lines.map(item=>({
     postingDate:item.postingDate,accountName:item.accountName,
     accountCode:item.accountCode,category:item.category,
     description:item.description,postingKind:item.postingKind,
     debitMinor:item.debitMinor,creditMinor:item.creditMinor
    }));
    return {kind:q.kind,view:q.view,label:"Posted finance ledger",
     state:rows.length?"READY":"EMPTY",
     columns:[
      {key:"postingDate",label:"Posted on",unit:"TEXT"},
      {key:"accountName",label:"Account",unit:"TEXT"},
      {key:"accountCode",label:"Account code",unit:"TEXT"},
      {key:"category",label:"Category",unit:"TEXT"},
      {key:"description",label:"Description",unit:"TEXT"},
      {key:"postingKind",label:"Entry type",unit:"TEXT"},
      {key:"debitMinor",label:"Debit",unit:"INR_MINOR"},
      {key:"creditMinor",label:"Credit",unit:"INR_MINOR"}
     ],rows,nextOffset:result.nextOffset,sourceReadAt,
     sourceCutoffKind:"OWNER_READ_COMPLETED_NOT_SNAPSHOT",
     explanation:result.explanation,
     scopeLabel:"Current permitted finance source scope"};
   }
   if(q.kind==="FINANCE_POSTED_SUMMARY"){
    const x=await this.finance.summary(token,q.yearRef,q.branchRef);
    return {kind:q.kind,view:q.view,label:"Posted finance summary",
     state:x.sourceRecordState==="NO_ROWS"?"EMPTY":"READY",
     columns:[
      {key:"incomeMinor",label:"Posted income",unit:"INR_MINOR"},
      {key:"expenseMinor",label:"Posted expenses",unit:"INR_MINOR"},
      {key:"surplusMinor",label:"Posted surplus",unit:"INR_MINOR"},
      {key:"cashBankMinor",label:"Posted cash and bank",unit:"INR_MINOR"}
     ],rows:x.sourceRecordState==="NO_ROWS"?[]:[{
      incomeMinor:x.incomeMinor,expenseMinor:x.expenseMinor,
      surplusMinor:x.surplusMinor,cashBankMinor:x.cashBankMinor
     }],nextOffset:null,sourceReadAt,sourceAsOf:x.sourceAsOf,
     sourceCutoffKind:x.sourceCutoffKind,explanation:x.explanation,
     scopeLabel:"Current permitted finance source scope"};
   }
   const x=await this.finance.monthlyMisTrend(token,q.yearRef,q.branchRef);
   return {kind:q.kind,view:q.view,label:"Posted finance monthly trend",
    state:x.months.length?"READY":"EMPTY",
    columns:[{key:"month",label:"Month",unit:"TEXT"},
     {key:"incomeMinor",label:"Posted income",unit:"INR_MINOR"},
     {key:"expenseMinor",label:"Posted expenses",unit:"INR_MINOR"}],
    rows:x.months,nextOffset:null,sourceReadAt,
    sourceCutoffKind:"OWNER_READ_COMPLETED_NOT_SNAPSHOT",
    explanation:x.explanation,scopeLabel:"Current permitted finance source scope"};
  }
  const x=await this.patients.readMisTotals(token,{
   centerRef:q.centerRef,fromDay:q.fromDay,untilDay:q.untilDay,status:q.status});
  const suppressed=suppressAppointmentCells(x);
  return {kind:q.kind,view:q.view,label:"Appointment status summary",
   state:suppressed?"SUPPRESSED":x.bookings==="0"?"EMPTY":"READY",
   columns:[{key:"bookings",label:"Total appointments",unit:"COUNT"},
    {key:"completed",label:"Completed",unit:"COUNT"},
    {key:"waiting",label:"Waiting or in consultation",unit:"COUNT"},
    {key:"cancelled",label:"Cancelled",unit:"COUNT"}],
   rows:suppressed||x.bookings==="0"?[]:[{
    bookings:x.bookings,completed:x.completed,
    waiting:x.waiting,cancelled:x.cancelled
   }],nextOffset:null,sourceReadAt,sourceAsOf:x.sourceAsOf,
   sourceCutoffKind:x.sourceCutoffKind,
   explanation:suppressed?"Small appointment groups are hidden to protect private patient information.":
    "Status counts from original permitted appointments only. No personal records.",
   scopeLabel:q.centerRef?"Selected verified center":"Permitted Foundation appointment scope"};
 }
}
