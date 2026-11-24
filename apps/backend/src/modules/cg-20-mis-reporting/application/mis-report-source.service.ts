import {
 BadRequestException,ForbiddenException,Injectable,UnauthorizedException
} from "@nestjs/common";
import {BeneficiaryReportService} from "../../cg-06-beneficiaries-assistance/application/beneficiary-report.service";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceReportsService} from "../../cg-09-finance-accounting/application/finance-reports.service";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {PatientAdminOverviewService} from "../../cg-15-patients-appointments/application/patient-admin-overview.service";
import {PlatformAuditService} from "../../cg-21-platform-configuration-audit/application/platform-audit.service";
import {DiagnosticsCatalogService} from "../../cg-16-healthcare-diagnostics/application/diagnostics-catalog.service";

export const REPORT_KINDS=[
 "FINANCE_POSTED_LEDGER","FINANCE_POSTED_SUMMARY",
 "FINANCE_POSTED_TREND","FINANCE_POSTED_GROUPED",
 "APPOINTMENT_STATUS","APPOINTMENT_STATUS_GROUPED","APPOINTMENT_DOCTOR_SUMMARY",
 "PLATFORM_AUDIT_ACTIVITY","DIAGNOSTICS_CATALOG_SUMMARY","BENEFICIARY_ASSISTANCE_SUMMARY"
] as const;
export type ReportKind=typeof REPORT_KINDS[number];
export type ReportView="TABLE"|"SUMMARY"|"CHART"|"PIVOT";
export type SafeReportRequest={
 kind:ReportKind;view:ReportView;yearRef?:string;branchRef?:string;
 centerRef?:string;areaRef?:string;fromDay?:string;untilDay?:string;status?:string;
 groupBy?:"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME";
 sortBy?:"NAME"|"DEBIT"|"CREDIT";sortDirection?:"ASC"|"DESC";
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
 "centerRef","areaRef","fromDay","untilDay","status","groupBy","sortBy","sortDirection","offset"]);
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
export const FINANCE_KINDS:readonly ReportKind[]=[
 "FINANCE_POSTED_LEDGER","FINANCE_POSTED_SUMMARY","FINANCE_POSTED_TREND",
 "FINANCE_POSTED_GROUPED"
];
export function parseSafeReport(raw:unknown):SafeReportRequest{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"Choose a supported report."});
 const o=raw as Record<string,unknown>;
 if(Object.keys(o).some(k=>!allowedFields.has(k)))
  throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"This report option is unavailable."});
 const kind=text(o.kind),view=text(o.view);
 if(!kindSet.has(kind)||!["TABLE","SUMMARY","CHART","PIVOT"].includes(view))
  throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"Choose a supported report and view."});
 const legalViews:Record<ReportKind,readonly string[]>={
  FINANCE_POSTED_LEDGER:["TABLE"],
  FINANCE_POSTED_GROUPED:["TABLE","SUMMARY","CHART","PIVOT"],
  FINANCE_POSTED_SUMMARY:["SUMMARY"],
  FINANCE_POSTED_TREND:["CHART"],
  APPOINTMENT_STATUS:["SUMMARY","CHART"],
  APPOINTMENT_STATUS_GROUPED:["TABLE","CHART"],
  APPOINTMENT_DOCTOR_SUMMARY:["TABLE","CHART"],
  PLATFORM_AUDIT_ACTIVITY:["TABLE"],
  DIAGNOSTICS_CATALOG_SUMMARY:["SUMMARY"],
  BENEFICIARY_ASSISTANCE_SUMMARY:["SUMMARY"]
 };
 if(!legalViews[kind as ReportKind].includes(view))
  throw new BadRequestException({code:"MIS_REPORT_VIEW_INVALID",
   message:"The selected report does not support that view."});
 const fields=["yearRef","branchRef","centerRef","areaRef","fromDay","untilDay","status",
  "groupBy","sortBy","sortDirection"] as const;
 for(const f of fields){
  if(o[f]!==undefined&&(typeof o[f]!=="string"||o[f].length>80))
   throw new BadRequestException({code:"MIS_REPORT_INVALID",message:"Choose valid filters."});
 }
 const groupBy=text(o.groupBy),sortBy=text(o.sortBy),
  sortDirection=text(o.sortDirection),
  yearRef=text(o.yearRef),branchRef=text(o.branchRef),
  centerRef=text(o.centerRef),areaRef=text(o.areaRef),fromDay=text(o.fromDay),
  untilDay=text(o.untilDay),status=text(o.status);
 const isFinance=FINANCE_KINDS.includes(kind as ReportKind);
 if([yearRef,branchRef,centerRef,areaRef].some(v=>v!==""&&!UUID.test(v))||
  areaRef!==""&&!["FINANCE_POSTED_LEDGER","FINANCE_POSTED_GROUPED"].includes(kind)||
  isFinance&&(centerRef!==""||status!=="")||
  (kind==="PLATFORM_AUDIT_ACTIVITY"||kind==="DIAGNOSTICS_CATALOG_SUMMARY"||kind==="BENEFICIARY_ASSISTANCE_SUMMARY")&&
   (centerRef!==""||status!=="")||
  kind==="DIAGNOSTICS_CATALOG_SUMMARY"&&fromDay!==""||
  kind!=="FINANCE_POSTED_GROUPED"&&(groupBy!==""||sortBy!==""||sortDirection!=="")||
  kind==="FINANCE_POSTED_GROUPED"&&(
   groupBy!==""&&!["CATEGORY","POSTING_KIND","ACCOUNT_NAME"].includes(groupBy)||
   sortBy!==""&&!["NAME","DEBIT","CREDIT"].includes(sortBy)||
   sortDirection!==""&&!["ASC","DESC"].includes(sortDirection)
  )||
  !isFinance&&(yearRef!==""||branchRef!=="")||
  status!==""&&!statusSet.has(status)||
  Boolean(fromDay)!==Boolean(untilDay)||
  fromDay!==""&&(!day(fromDay)||!day(untilDay)||fromDay>untilDay||
   Date.parse(untilDay+"T00:00:00Z")-Date.parse(fromDay+"T00:00:00Z")>366*86400000)||
  fromDay!==""&&kind==="PLATFORM_AUDIT_ACTIVITY"&&
   Date.parse(untilDay+"T00:00:00Z")-Date.parse(fromDay+"T00:00:00Z")>89*86400000||
  fromDay!==""&&kind!=="FINANCE_POSTED_LEDGER"&&
   kind!=="FINANCE_POSTED_GROUPED"&&kind!=="APPOINTMENT_STATUS"&&
   kind!=="APPOINTMENT_STATUS_GROUPED"&&kind!=="APPOINTMENT_DOCTOR_SUMMARY"&&
   kind!=="PLATFORM_AUDIT_ACTIVITY")
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
  ...(centerRef?{centerRef}:{}),...(areaRef?{areaRef}:{}),
  ...(fromDay?{fromDay,untilDay}:{}),
  ...(status?{status}:{}),
  ...(kind==="FINANCE_POSTED_GROUPED"?{
   groupBy:(groupBy||"CATEGORY") as "CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME",
   sortBy:(sortBy||"NAME") as "NAME"|"DEBIT"|"CREDIT",
   sortDirection:(sortDirection||"ASC") as "ASC"|"DESC"
  }:{}),offset};
}
export function suppressAppointmentCells(rows:{
 bookings:string;completed:string;waiting:string;cancelled:string
}):boolean{
 const total=BigInt(rows.bookings);
 const parts=[BigInt(rows.completed),BigInt(rows.waiting),BigInt(rows.cancelled)];
 const remainder=total-parts.reduce((n,v)=>n+v,0n);
 // Inconsistent owner counts are never treated as publishable/reportable
 // grouped status cells. Fail closed before any patient-linked dimension.
 if(total<0n||parts.some(v=>v<0n)||remainder<0n)return true;
 return total>0n&&(total<5n||[...parts,remainder].some(v=>v>0n&&v<5n));
}
type ReportRow=Record<string,string>;
type ReportPreview={
 state:"READY"|"EMPTY"|"SUPPRESSED"|"PARTIAL";kind:ReportKind;view:ReportView;
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
  private readonly patients:PatientAdminOverviewService,
  private readonly audit:PlatformAuditService,
  private readonly diagnostics:DiagnosticsCatalogService,
  private readonly branches:BranchSourceFacade,
  private readonly beneficiaries:BeneficiaryReportService){}
 /** CG02 is the sole source of current permitted branch scope, never a report-provided UUID. */
 async originalFinanceScope(token:string,request:SafeReportRequest){
  if(!request.kind.startsWith("FINANCE_"))return null;
  await this.sessions.requireAction(token,"mis.reports.view");
  const scope=await this.branches.financeReportScope(token,"finance.reports.view");
  if(!scope.all&&scope.branchRefs.length===0)
   throw new ForbiddenException("No current branch is assigned for this report");
  if(request.branchRef){
   if(!scope.all&&!scope.branchRefs.includes(request.branchRef))
    throw new ForbiddenException("The requested report branch is not assigned");
   // Only that source branch entered the bytes, never the actor's unrelated
   // B/C grants. A later B revoke must not revoke a still-authorized A report.
   return {all:false,branchRefs:[request.branchRef]};
  }
  return {all:scope.all,branchRefs:[...scope.branchRefs].sort()};
 }
 async originalScheduledFinanceScope(root:string,account:string,request?:SafeReportRequest){
  const scope=await this.branches.scheduledFinanceScope(root,account);
  if(request?.branchRef){
   if(!scope.all&&!scope.branchRefs.includes(request.branchRef))
    throw new ForbiddenException("Scheduled report branch is no longer assigned");
   return {all:false,branchRefs:[request.branchRef]};
  }
  return {all:scope.all,branchRefs:[...scope.branchRefs].sort()};
 }
 async catalog(token:string){
  await this.sessions.requireAction(token,"mis.reports.view");
  const [finance,appointments]=await Promise.all([
   this.finance.options(token).then(x=>({
    ready:true,state:"AVAILABLE" as const,
    years:x.years.map(y=>({ref:y.ref,name:y.name})),
    branches:x.branches.map(b=>({ref:b.branchRef,name:b.name})),
    allBranches:x.allBranches,
    areas:x.areas.map(area=>({ref:area.ref,name:area.name,level:area.level}))
   })).catch((e:unknown)=>{
    if(e instanceof UnauthorizedException)throw e;
    return {ready:false,state:e instanceof ForbiddenException?
      "ACCESS_RESTRICTED" as const:"SOURCE_UNAVAILABLE" as const,
      years:[],branches:[],allBranches:false};
   }),
   this.patients.readMisOptions(token).then(x=>({
    ready:true,state:"AVAILABLE" as const,
    centers:x.centers.map(c=>({ref:c.centerRef,name:c.name})),
    complete:x.complete
   })).catch((e:unknown)=>{
    if(e instanceof UnauthorizedException)throw e;
    return {ready:false,state:e instanceof ForbiddenException?
      "ACCESS_RESTRICTED" as const:"SOURCE_UNAVAILABLE" as const,
      centers:[],complete:false};
   })
  ]);
  const templates=[
   ...(finance.ready?[
    {kind:"FINANCE_POSTED_LEDGER",label:"Posted finance ledger",
     views:["TABLE"],description:"Only posted journal lines (up to 50 per page)"},
    {kind:"FINANCE_POSTED_SUMMARY",label:"Posted finance summary",
     views:["SUMMARY"],description:"Income, expenses, surplus and cash/bank balances"},
    {kind:"FINANCE_POSTED_GROUPED",label:"Grouped posted finance",
     views:["TABLE","SUMMARY","CHART","PIVOT"],
     description:"Actual posted ledger grouped by category, entry type or account"},
    {kind:"FINANCE_POSTED_TREND",label:"Finance trend",
     views:["CHART"],description:"Actual posted income and expenses by month"}
   ]:[]),
   ...(appointments.ready?[
    {kind:"APPOINTMENT_STATUS",label:"Appointment status summary",
     views:["SUMMARY","CHART"],
     description:"Protected aggregate status counts without patient details"},
    {kind:"APPOINTMENT_STATUS_GROUPED",label:"Grouped appointment status",
     views:["TABLE","CHART"],
     description:"Actual status groups from one privacy-protected CG-15 source read"},
    {kind:"APPOINTMENT_DOCTOR_SUMMARY",label:"Doctor and center appointments",
     views:["TABLE","CHART"],
     description:"Only current source-scoped, privacy-protected consultation counts by doctor and center"}
   ]:[])
  ];
  const permission=async(action:string)=>{
   try{await this.sessions.requireAction(token,action);return true;}
   catch(error){if(error instanceof UnauthorizedException)throw error;return false;}
  };
  const [manage,exportAllowed,schedule,share,auditAccess,diagnosticsAccess]=await Promise.all([
   permission("mis.reports.manage"),permission("mis.reports.export"),
   permission("mis.reports.schedule"),permission("mis.reports.share"),permission("platform.audit.view"),
   permission("diagnostics.catalog.view")]);
  if(await permission("beneficiaries.view")&&await permission("beneficiaries.assistance.view"))templates.push({
   kind:"BENEFICIARY_ASSISTANCE_SUMMARY",label:"Beneficiary and assistance summary",views:["SUMMARY"],description:"Current permitted consented aggregate; small groups hidden. Live preview only."});
  if(diagnosticsAccess)templates.push({
   kind:"DIAGNOSTICS_CATALOG_SUMMARY",label:"Diagnostics services summary",
   views:["SUMMARY"],description:"Current approved service catalog counts from CG-16."});
  if(auditAccess)templates.push({kind:"PLATFORM_AUDIT_ACTIVITY",
   label:"Protected audit activity",views:["TABLE"],
   description:"Current original platform and access audit events; limited to 50 rows."});
  return {templates,finance,appointments,capabilities:{
   manage,export:exportAllowed,schedule,share},sourceReadAt:new Date().toISOString()};
 }
 /** Dedicated current-principal scheduled projection. Never passes a synthetic
  * bearer through the interactive CG09/CG15 facades. Only CG09 posted summary
  * is eligible for automatic execution until each other original source has
  * a separate delegated current-scope reader.
  */
 async previewScheduledFinance(root:string,account:string,raw:unknown):
  Promise<ReportPreview>{
  const q=parseSafeReport(raw);
  if(q.kind!=="FINANCE_POSTED_SUMMARY"||q.view!=="SUMMARY"||
     q.offset!==0)
   throw new ForbiddenException({code:"MIS_SCHEDULE_SOURCE_UNSUPPORTED",
    message:"Automatic delivery is currently available only for posted finance summaries."});
  const x=await this.finance.scheduledSummary(root,account,q.yearRef,q.branchRef);
  const readAt=new Date().toISOString();
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
   }],nextOffset:null,sourceReadAt:readAt,
   sourceAsOf:x.sourceAsOf,sourceCutoffKind:x.sourceCutoffKind,
   explanation:x.explanation,
   scopeLabel:"Current authorized posted finance scope"};
 }
 async preview(token:string,raw:unknown):Promise<ReportPreview>{
  await this.sessions.requireAction(token,"mis.reports.view");
  const q=parseSafeReport(raw);
  const sourceReadAt=new Date().toISOString();
  const finance=FINANCE_KINDS.includes(q.kind);
  if(finance){
   if(q.kind==="FINANCE_POSTED_LEDGER"){
    const result=await this.finance.ledger(token,{
     yearRef:q.yearRef,branchRef:q.branchRef,areaRef:q.areaRef,
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
   if(q.kind==="FINANCE_POSTED_GROUPED"){
    const x=await this.finance.groupedMis(token,{
     yearRef:q.yearRef,branchRef:q.branchRef,areaRef:q.areaRef,
     fromDay:q.fromDay,untilDay:q.untilDay,
     groupBy:q.groupBy??"CATEGORY",
     sortBy:q.sortBy??"NAME",sortDirection:q.sortDirection??"ASC"
    });
    // All representations derive from the SAME scoped CG09 read snapshot.
    // No client sums of a paginated 50-row journal and no arbitrary SQL fields.
    const amount=(value:string)=>BigInt(value);
    const debit=x.groups.reduce((n,row)=>n+amount(row.debitMinor),0n);
    const credit=x.groups.reduce((n,row)=>n+amount(row.creditMinor),0n);
    const groupedColumns=[
     {key:"groupLabel",label:q.groupBy==="ACCOUNT_NAME"?"Account":
       q.groupBy==="POSTING_KIND"?"Entry kind":"Category",unit:"TEXT" as const},
     {key:"debitMinor",label:"Posted debit",unit:"INR_MINOR" as const},
     {key:"creditMinor",label:"Posted credit",unit:"INR_MINOR" as const}
    ];
    const wide=x.groups.length>12;
    const pivot=q.view==="PIVOT";
    const columns=pivot?[
     {key:"metric",label:"Posted journal amount",unit:"TEXT" as const},
     ...x.groups.slice(0,12).map((row,index)=>({
      key:"group"+index,label:row.groupLabel.slice(0,80),
      unit:"INR_MINOR" as const
     }))
    ]:q.view==="SUMMARY"?[
     {key:"debitMinor",label:"Posted debit",unit:"INR_MINOR" as const},
     {key:"creditMinor",label:"Posted credit",unit:"INR_MINOR" as const}
    ]:groupedColumns;
    const rows=pivot?[
     Object.fromEntries([["metric","Posted debit"] as const,...x.groups.slice(0,12)
      .map((row,index)=>["group"+index,row.debitMinor] as const)]),
     Object.fromEntries([["metric","Posted credit"] as const,...x.groups.slice(0,12)
      .map((row,index)=>["group"+index,row.creditMinor] as const)])
    ]:q.view==="SUMMARY"&&x.groups.length?[{
     debitMinor:debit.toString(),creditMinor:credit.toString()
    }]:x.groups;
    const partial=x.partial||(pivot&&wide);
    return {kind:q.kind,view:q.view,label:"Grouped posted finance",
     state:partial?"PARTIAL":x.groups.length?"READY":"EMPTY",
     columns,rows,nextOffset:null,sourceReadAt,
     sourceAsOf:x.sourceAsOf,sourceCutoffKind:x.sourceCutoffKind,
     explanation:partial?
      "The selected grouping is too wide or incomplete. Narrow the period or choose an account category; partial results cannot be exported.":
      x.explanation,
     scopeLabel:"Current permitted posted finance scope"};
   }
   if(q.kind==="FINANCE_POSTED_SUMMARY"){
    const x=q.branchRef?
    await this.finance.summary(token,q.yearRef,q.branchRef):
    await this.finance.assignedMisSummary(token,q.yearRef);
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
   const x=q.branchRef?
   await this.finance.monthlyMisTrend(token,q.yearRef,q.branchRef):
   await this.finance.assignedMisMonthlyTrend(token,q.yearRef);
   return {kind:q.kind,view:q.view,label:"Posted finance monthly trend",
    state:x.months.length?"READY":"EMPTY",
    columns:[{key:"month",label:"Month",unit:"TEXT"},
     {key:"incomeMinor",label:"Posted income",unit:"INR_MINOR"},
     {key:"expenseMinor",label:"Posted expenses",unit:"INR_MINOR"}],
    rows:x.months,nextOffset:null,sourceReadAt,
    sourceCutoffKind:"OWNER_READ_COMPLETED_NOT_SNAPSHOT",
    explanation:x.explanation,scopeLabel:"Current permitted finance source scope"};
  }
  if(q.kind==="BENEFICIARY_ASSISTANCE_SUMMARY"){
   const x=await this.beneficiaries.misSummary(token);
   return {kind:q.kind,view:q.view,label:"Beneficiary and assistance summary",
    state:x.state,columns:[
     {key:"total",label:"Consented beneficiaries",unit:"COUNT"},
     {key:"male",label:"Male",unit:"COUNT"},{key:"female",label:"Female",unit:"COUNT"},
     {key:"other",label:"Other or not specified",unit:"COUNT"},
     {key:"children",label:"Children",unit:"COUNT"},
     {key:"active",label:"Active",unit:"COUNT"},{key:"verified",label:"Verified",unit:"COUNT"},
     {key:"recipients",label:"Recipients of delivered assistance",unit:"COUNT"}
    ],rows:x.rows,nextOffset:null,sourceReadAt:new Date().toISOString(),sourceAsOf:x.sourceAsOf,
    sourceCutoffKind:"OWNER_TRANSACTION_SNAPSHOT",
    explanation:x.state==="SUPPRESSED"?"Small groups or complements are hidden to protect privacy.":
     "Current authorized consented records and delivered assistance counts. Live preview only; no personal details or amounts.",
    scopeLabel:"Current permitted beneficiary and assistance scope"};
  }
  if(q.kind==="DIAGNOSTICS_CATALOG_SUMMARY"){
   const x=await this.diagnostics.summary(token);
   const keys=[
    {key:"totalTests",label:"Catalog tests",unit:"COUNT" as const},
    {key:"activeTests",label:"Active tests",unit:"COUNT" as const},
    {key:"categories",label:"Active categories",unit:"COUNT" as const},
    {key:"packages",label:"Active packages",unit:"COUNT" as const},
    {key:"publishedOffers",label:"Currently published verified offers",unit:"COUNT" as const}
   ];
   const rows=[Object.fromEntries(keys.map(item=>[
    item.key,String(x[item.key as keyof typeof x]??0)] as const))];
   const empty=x.totalTests===0&&x.categories===0&&x.packages===0&&
    x.publishedOffers===0;
   return {kind:q.kind,view:q.view,label:"Diagnostics catalog summary",
    state:empty?"EMPTY":"READY",columns:keys,
    rows:empty?[]:rows,nextOffset:null,sourceReadAt,
    sourceCutoffKind:"CG16_CURRENT_CATALOG_READ_COMPLETED_NOT_SNAPSHOT",
    explanation:"Original CG-16 verified active tests and published offers only. No patient tests, findings, prices or private results.",
    scopeLabel:"Current authorized diagnostics catalog scope"};
  }
  if(q.kind==="PLATFORM_AUDIT_ACTIVITY"){
   // All audit events originate in CG-21/CG-01; the audit facade owns
   // its action, root, sensitive-field, cursor and date authorization.
   // Do not store event IDs or private audit events as CG-20 business rows.
   const today=new Date();
   const from=q.fromDay?new Date(q.fromDay+"T00:00:00.000Z"):
    new Date(today.getTime()-30*86400000);
   const to=q.untilDay?new Date(q.untilDay+"T23:59:59.999Z"):today;
   const page=await this.audit.list(token,{
    from:from.toISOString(),to:to.toISOString(),limit:"50"
   });
   const rows=page.events.map(e=>({
    occurredAt:e.occurredAt,source:e.source,action:e.actionLabel,
    performedBy:e.actorDisplay,target:e.targetDisplay,outcome:e.outcome
   }));
   const partial=page.coverage!=="COMPLETE"||page.nextCursor!==null;
   return {kind:q.kind,view:q.view,label:"Protected platform audit activity",
    state:partial?"PARTIAL":rows.length?"READY":"EMPTY",
    columns:[
     {key:"occurredAt",label:"Date and time",unit:"TEXT"},
     {key:"source",label:"Audit origin",unit:"TEXT"},
     {key:"action",label:"Activity",unit:"TEXT"},
     {key:"performedBy",label:"Operator",unit:"TEXT"},
     {key:"target",label:"Affected area",unit:"TEXT"},
     {key:"outcome",label:"Result",unit:"TEXT"}
    ],rows,nextOffset:null,sourceReadAt,
    sourceCutoffKind:"ORIGINAL_AUDIT_READ_COMPLETED_NOT_SNAPSHOT",
    explanation:partial?
     "A source was unavailable or there are more than 50 results. Narrow the date range or open the protected audit ledger; a partial report cannot be exported.":
     "Only actual CG-21/CG-01 audit projections authorized for this account.",
    scopeLabel:"Current permitted Foundation audit scope"};
  }
  if(q.kind==="APPOINTMENT_DOCTOR_SUMMARY"){
   const x=await this.patients.readMisDoctorGroups(token,{
    centerRef:q.centerRef,fromDay:q.fromDay,untilDay:q.untilDay,status:q.status});
   return {kind:q.kind,view:q.view,label:"Doctor and center appointment totals",
    state:x.state,
    columns:[
     {key:"doctorName",label:"Doctor",unit:"TEXT"},
     {key:"centerName",label:"Verified center",unit:"TEXT"},
     {key:"bookings",label:"Recorded appointments",unit:"COUNT"}
    ],rows:x.groups,nextOffset:null,sourceReadAt,
    sourceAsOf:x.sourceAsOf,sourceCutoffKind:x.sourceCutoffKind,
    explanation:x.explanation,scopeLabel:q.centerRef?
     "Current authorized center":"Current authorized Foundation care centers"};
  }
  const x=await this.patients.readMisTotals(token,{
   centerRef:q.centerRef,fromDay:q.fromDay,untilDay:q.untilDay,status:q.status});
  const suppressed=suppressAppointmentCells(x);
  if(q.kind==="APPOINTMENT_STATUS_GROUPED"){
   const completed=BigInt(x.completed),waiting=BigInt(x.waiting),
    cancelled=BigInt(x.cancelled);
   const other=BigInt(x.bookings)-completed-waiting-cancelled;
   const groups=[
    {statusLabel:"Completed",count:x.completed},
    {statusLabel:"Waiting or in consultation",count:x.waiting},
    {statusLabel:"Cancelled",count:x.cancelled},
    {statusLabel:"Other recorded states",count:other.toString()}
   ];
   return {kind:q.kind,view:q.view,label:"Grouped appointment status",
    state:suppressed?"SUPPRESSED":x.bookings==="0"?"EMPTY":"READY",
    columns:[
     {key:"statusLabel",label:"Appointment status group",unit:"TEXT"},
     {key:"count",label:"Appointments",unit:"COUNT"}
    ],rows:suppressed||x.bookings==="0"?[]:groups,
    nextOffset:null,sourceReadAt,sourceAsOf:x.sourceAsOf,
    sourceCutoffKind:x.sourceCutoffKind,
    explanation:suppressed?
     "These status groups are hidden because a small cell could reveal private appointment participation.":
     "All four status groups come from the same scoped CG-15 read. No patient identities, documents or clinical notes.",
    scopeLabel:q.centerRef?"Selected verified center":
     "Current permitted Foundation appointment scope"};
  }
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
