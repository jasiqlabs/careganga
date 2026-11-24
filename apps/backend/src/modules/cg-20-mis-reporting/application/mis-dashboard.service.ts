import {BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException} from "@nestjs/common";
import {OperationsSummaryService} from "../../cg-05-projects-field-operations/application/operations-summary.service";
import {DonationAdminService} from "../../cg-07-campaigns-donations/application/donation-admin.service";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceReportsService} from "../../cg-09-finance-accounting/application/finance-reports.service";
import {DiagnosticsCatalogService} from "../../cg-16-healthcare-diagnostics/application/diagnostics-catalog.service";
import {PatientAdminOverviewService} from "../../cg-15-patients-appointments/application/patient-admin-overview.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Filters={yearRef?:string;branchRef?:string};
type Metric={key:string;label:string;unit:"INR_MINOR"|"COUNT";value:string};
type FinanceTrend={type:"MONTHLY_FINANCE";windowLabel:string;
 state:"AVAILABLE"|"EMPTY"|"FAILED";
 points:{month:string;incomeMinor:string;expenseMinor:string}[]};
type Source={sourceKey:string;state:"AVAILABLE"|"EMPTY"|"SUPPRESSED"|"FAILED";sourceLabel:string;
 readAt?:string;sourceAsOf?:string;cutoffKind?:string;
 metrics:Metric[];drilldown?:string;explanation?:string;
 trend?:FinanceTrend};

/**
 * CG-20 US-001: request-driven read-only MIS. Every original owner checks
 * its own session, root, action and source-specific scope BEFORE aggregation.
 * No source table joins, hidden copies, patient details or fake totals.
 */
@Injectable()
export class MisDashboardService{
 constructor(private readonly sessions:SessionService,
  private readonly finance:FinanceReportsService,
  private readonly diagnostics:DiagnosticsCatalogService,
  private readonly patients:PatientAdminOverviewService,
  private readonly operations:OperationsSummaryService,
  private readonly donations:DonationAdminService){}

 async options(bearer:string){
  await this.sessions.requireAction(bearer,"mis.dashboard.view");
  // Each source independently checks its original capability and resource
  // scope. A finance denial is never permission to hide eligible healthcare.
  const [finance,health]=await Promise.all([
   this.finance.options(bearer).then(x=>({
    state:"AVAILABLE",years:x.years.map(y=>({ref:y.ref,name:y.name})),
    branches:x.branches.map(b=>({ref:b.branchRef,name:b.name})),
    allBranches:x.allBranches
   })).catch((error:unknown)=>{
    if(error instanceof UnauthorizedException)throw error;
    return {state:error instanceof ForbiddenException?"NO_FINANCE_ACCESS":"FAILED",
     years:[],branches:[],allBranches:false};
   }),
   this.patients.readMisOptions(bearer).then(x=>({
    healthAvailable:true,
    centers:x.centers.map(y=>({ref:y.centerRef,name:y.name})),
    centersComplete:x.complete
   })).catch((error:unknown)=>{
    if(error instanceof UnauthorizedException)throw error;
    return {healthAvailable:false,centers:[],centersComplete:false};
   })
  ]);
  return {...finance,...health,sourceKey:"CG09_POSTED_FINANCE"};
 }

 async dashboard(bearer:string,raw:Record<string,unknown>){
  await this.sessions.requireAction(bearer,"mis.dashboard.view");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>!["yearRef","branchRef","centerRef",
      "fromDay","untilDay","status","view"].includes(k))||
    Object.entries(raw).some(([k,v])=>typeof v!=="string"||v.length>80||
     (k==="view"&&v==="")||
     (v!==""&&(k==="view"?!["OVERVIEW","FINANCE","HEALTH"].includes(v):
      ["yearRef","branchRef","centerRef"].includes(k)?
       !UUID.test(v):k==="fromDay"||k==="untilDay"?
       !/^\d{4}-\d{2}-\d{2}$/.test(v):!["COMPLETED","CONFIRMED",
       "ARRIVED","WAITING","IN_CONSULTATION","NO_SHOW","CANCELLED"].includes(v)))))
   throw new BadRequestException({code:"MIS_DASHBOARD_FILTER_INVALID",
    message:"Choose a permitted source, center, year, date and status filter."});
  const filters:Filters={
   yearRef:typeof raw.yearRef==="string"&&raw.yearRef?raw.yearRef:undefined,
   branchRef:typeof raw.branchRef==="string"&&raw.branchRef?raw.branchRef:undefined
  };
  const healthFilter={
   centerRef:typeof raw.centerRef==="string"&&raw.centerRef?raw.centerRef:undefined,
   fromDay:typeof raw.fromDay==="string"&&raw.fromDay?raw.fromDay:undefined,
   untilDay:typeof raw.untilDay==="string"&&raw.untilDay?raw.untilDay:undefined,
   status:typeof raw.status==="string"&&raw.status?raw.status:undefined
  };
  const view=raw.view===undefined?"OVERVIEW":raw.view as string;
  const hasHealthFilter=Object.values(healthFilter).some(Boolean);
  const hasFinanceFilter=Boolean(filters.yearRef||filters.branchRef);
  if((view==="OVERVIEW"&&(hasHealthFilter||hasFinanceFilter))||
     (view==="FINANCE"&&hasHealthFilter)||(view==="HEALTH"&&hasFinanceFilter))
   throw new BadRequestException({code:"MIS_FILTER_FAMILIES_CONFLICT",
    message:"Choose filters that belong to your selected dashboard view."});
  if(Boolean(healthFilter.fromDay)!==Boolean(healthFilter.untilDay))
   throw new BadRequestException({code:"MIS_HEALTH_DATE_RANGE_INVALID",
    message:"Enter both start and end dates for the appointment report."});
  // CG09 now owns one explicit source-scoped aggregation of all CURRENT
  // delegated branches, distinct from Foundation-wide admin totals.
  // A manager may view A, B, or their permitted A+B; never unrelated branches,
  // a Foundation-null journal, or a CG14 healthcare center.
  if(view==="OVERVIEW"&&!filters.branchRef){
   try{
    const choices=await this.finance.options(bearer);
    if(!choices.allBranches&&choices.branches.length===1)
     filters.branchRef=choices.branches[0].branchRef;
   }catch(error){if(error instanceof UnauthorizedException)throw error;}
  }
  let failures=0;
  const financeSource:Promise<Source|null>=view==="HEALTH"?Promise.resolve(null):
   (filters.branchRef?this.finance.summary(bearer,filters.yearRef,filters.branchRef):
    this.finance.assignedMisSummary(bearer,filters.yearRef))
   .then(async source=>{
    let trend:FinanceTrend={type:"MONTHLY_FINANCE",
     windowLabel:"Last six calendar months",state:"EMPTY",points:[]};
    if(source.sourceRecordState!=="NO_ROWS"){
     try{
      const projection=filters.branchRef?
       await this.finance.monthlyMisTrend(bearer,filters.yearRef,filters.branchRef):
       await this.finance.assignedMisMonthlyTrend(bearer,filters.yearRef);
      trend={type:"MONTHLY_FINANCE",windowLabel:projection.windowLabel,
       state:projection.months.length?"AVAILABLE":"EMPTY",points:projection.months};
     }catch(error){
      if(error instanceof UnauthorizedException||error instanceof ForbiddenException||
         error instanceof BadRequestException)throw error;
      failures++;
      trend={type:"MONTHLY_FINANCE",windowLabel:"Last six calendar months",
       state:"FAILED",points:[]};
     }
    }
    return {sourceKey:"CG09_POSTED_FINANCE",
     state:source.sourceRecordState==="NO_ROWS"?"EMPTY" as const:"AVAILABLE" as const,
     sourceLabel:"Foundation Finance · Posted journals",
     readAt:new Date().toISOString(),sourceAsOf:source.sourceAsOf,
     cutoffKind:source.sourceCutoffKind,
     metrics:source.sourceRecordState==="NO_ROWS"?[]:[
      {key:"income",label:"Posted income",unit:"INR_MINOR" as const,value:source.incomeMinor},
      {key:"expense",label:"Posted expenses",unit:"INR_MINOR" as const,value:source.expenseMinor},
      {key:"surplus",label:"Posted surplus",unit:"INR_MINOR" as const,value:source.surplusMinor},
      {key:"cashBank",label:"Posted cash and bank",unit:"INR_MINOR" as const,value:source.cashBankMinor}
     ],trend,drilldown:"/admin/finance/reports",explanation:source.explanation};
   })
   .catch((error:unknown)=>{
    if(error instanceof UnauthorizedException)throw error;
    if(error instanceof ForbiddenException){
     // Never convert a rejected requested branch into an apparently valid total.
     if(filters.branchRef||view==="FINANCE")throw error;
     return null;
    }
    if(error instanceof BadRequestException)throw error;
    failures++;
    return {sourceKey:"CG09_POSTED_FINANCE",state:"FAILED" as const,
     sourceLabel:"Foundation Finance",metrics:[]};
   });

  // CG-16's original authenticated Foundation-wide catalogue projection.
  // It has no branch/year dimension; never mislabel it as the selected period.
  // Published offers are ACTUAL verified offers, not all draft tariffs.
  const diagnosticSource:Promise<Source|null>=view!=="OVERVIEW"?
   Promise.resolve(null):this.diagnostics.summary(bearer)
   .then(x=>({sourceKey:"CG16_FOUNDATION_DIAGNOSTICS",
    state:(x.totalTests===0&&x.activeTests===0&&x.packages===0&&x.publishedOffers===0?
     "EMPTY":"AVAILABLE") as "EMPTY"|"AVAILABLE",
    sourceLabel:"Foundation Diagnostics · Current catalogues",
    readAt:new Date().toISOString(),
    metrics:x.totalTests===0&&x.activeTests===0&&x.packages===0&&x.publishedOffers===0?[]:[
     {key:"tests",label:"Catalogue tests",unit:"COUNT" as const,value:String(x.totalTests)},
     {key:"activeTests",label:"Active approved tests",unit:"COUNT" as const,value:String(x.activeTests)},
     {key:"packages",label:"Active packages",unit:"COUNT" as const,value:String(x.packages)},
     {key:"publishedOffers",label:"Published verified offers",unit:"COUNT" as const,value:String(x.publishedOffers)}
    ],explanation:"Current Foundation-wide catalogue, independent of financial-year and branch filters."}))
   .catch((error:unknown)=>{
    if(error instanceof UnauthorizedException)throw error;
    if(error instanceof ForbiddenException)return null;
    failures++;
    return {sourceKey:"CG16_FOUNDATION_DIAGNOSTICS",state:"FAILED" as const,
     sourceLabel:"Foundation Diagnostics",metrics:[]};
   });
  // Foundation-only CG-15 counts from a narrow original-owner read facade.
  // Neither row-level patient names nor center/branch extrapolations are allowed.
  const patientSource:Promise<Source|null>=view==="FINANCE"?
   Promise.resolve(null):this.patients.readMisTotals(bearer,healthFilter)
   .then(x=>{
    // Prevent small-cell or membership inference from status filters.
    // A requested single-center/date/status slice with 1–4 people, or a
    // nonzero 1–4 status breakdown, is not safe to publish as a dashboard.
    const values=[x.completed,x.waiting,x.cancelled].map(BigInt);
    const total=BigInt(x.bookings);
    const other=total-values.reduce((a,v)=>a+v,0n);
    const restricted=total>0n&&(total<5n||
     [...values,other].some(n=>n>0n&&n<5n));
    return {sourceKey:"CG15_APPOINTMENT_STATES",
    state:restricted?"SUPPRESSED" as const:
     x.bookings==="0"?"EMPTY" as const:"AVAILABLE" as const,
    sourceLabel:"Foundation Appointments · Current state totals",
    readAt:new Date().toISOString(),sourceAsOf:x.sourceAsOf,
    cutoffKind:x.sourceCutoffKind,
    metrics:restricted||x.bookings==="0"?[]:[
     {key:"bookings",label:"Total appointments",unit:"COUNT" as const,value:x.bookings},
     {key:"completed",label:"Completed appointments",unit:"COUNT" as const,value:x.completed},
     {key:"waiting",label:"In progress or waiting",unit:"COUNT" as const,value:x.waiting},
     {key:"cancelled",label:"Cancelled appointments",unit:"COUNT" as const,value:x.cancelled}
    ],drilldown:"/admin/health-network/patients",explanation:restricted?
      "Appointment statistics are hidden for this small group to protect privacy.":
      "Authorized appointment status totals; no patient files or individual care data."};
   })
   .catch((error:unknown)=>{
    if(error instanceof UnauthorizedException||error instanceof BadRequestException)
     throw error;
    if(error instanceof ForbiddenException)return null;
    if(error instanceof NotFoundException&&healthFilter.centerRef)throw error;
    failures++;
    return {sourceKey:"CG15_APPOINTMENT_STATES",state:"FAILED" as const,
     sourceLabel:"Foundation Appointments",metrics:[]};
   });
  // Operational counts use CG05's current actor scope and one owner snapshot.
  // Never attach finance-year or healthcare-center filters to these metrics.
  const projectSource:Promise<Source|null>=view!=="OVERVIEW"?Promise.resolve(null):
   this.operations.read(bearer,"PERMITTED").then(x=>{
    if(!("sections" in x)||!x.sections)throw Error("Operational source unavailable");
    const metrics=x.sections.flatMap((section,index)=>section.metrics.map((metric,i)=>({
     key:"operations-"+index+"-"+i,label:section.source+" · "+metric.label,
     unit:"COUNT" as const,value:String(metric.value)
    })));
    if(metrics.some(m=>!/^\d+$/.test(m.value)))throw Error("Operational metric unavailable");
    const hasData=metrics.some(m=>BigInt(m.value)>0n);
    return {sourceKey:"CG05_PROJECT_OPERATIONS",sourceLabel:"Foundation Projects · Current operations",
     state:hasData?"AVAILABLE" as const:"EMPTY" as const,
     metrics:hasData?metrics:[],readAt:new Date().toISOString(),
     sourceAsOf:x.asOf,cutoffKind:"OWNER_TRANSACTION_SNAPSHOT",
     explanation:"Current permitted project, task, activity and visit counts; independent of financial-year filters."+
      (x.restricted.length?" Some operational sources are restricted by your current permissions.":"")};
   }).catch((error:unknown)=>{
    if(error instanceof UnauthorizedException||error instanceof BadRequestException)throw error;
    if(error instanceof ForbiddenException)return null;
    failures++;
    return {sourceKey:"CG05_PROJECT_OPERATIONS",sourceLabel:"Foundation Projects",state:"FAILED" as const,metrics:[]};
   });
  const donationSource:Promise<Source|null>=view!=="OVERVIEW"?Promise.resolve(null):
   this.donations.misSummary(bearer).then(x=>{
    if(x.requiresReview)throw Error("Donation reconciliation required");
    return {sourceKey:"CG07_DONATION_RECONCILIATION",sourceLabel:"Foundation Donations · Verified receipts",
     state:x.total?"AVAILABLE" as const:"EMPTY" as const,readAt:new Date().toISOString(),sourceAsOf:x.sourceAsOf.toISOString(),
     cutoffKind:"OWNER_STATEMENT_SNAPSHOT",metrics:x.total?[
      {key:"received",label:"Verified posted donations",unit:"COUNT" as const,value:String(x.received)},
      {key:"pending",label:"Pending donations",unit:"COUNT" as const,value:String(x.pending)},
      {key:"net",label:"Verified net donations",unit:"INR_MINOR" as const,value:x.netReceivedMinor}]:[],
     explanation:"Current permitted donation scope, independent of financial-year filters."};
   }).catch((error:unknown)=>{
    if(error instanceof UnauthorizedException||error instanceof BadRequestException)throw error;
    if(error instanceof ForbiddenException)return null;
    failures++;
    return {sourceKey:"CG07_DONATION_RECONCILIATION",sourceLabel:"Foundation Donations",state:"FAILED" as const,metrics:[],
     explanation:"Donation source unavailable or requires reconciliation. No unverified amounts displayed."};
   });
  const results=await Promise.all([financeSource,diagnosticSource,patientSource,projectSource,donationSource]);
  const sources:Source[]=results.filter((x):x is Source=>x!==null);
  const available=sources.filter(s=>s.state==="AVAILABLE").length;
  const empty=sources.filter(s=>s.state==="EMPTY").length;
  const suppressed=sources.filter(s=>s.state==="SUPPRESSED").length;
  return {state:available?(failures?"PARTIAL":"AVAILABLE"):
   empty?(failures?"PARTIAL":"NO_DATA"):
   suppressed?(failures?"PARTIAL":"SUPPRESSED"):
   failures?"FAILED":"NO_AUTHORIZED_SOURCES",readAt:new Date().toISOString(),
   scopeLabel:healthFilter.centerRef?"Selected verified healthcare center":
    filters.branchRef?"Permitted selected branch":
    "Current authorized Foundation/branch reporting scope",
   periodLabel:view==="HEALTH"?(healthFilter.fromDay?
    "Appointments "+healthFilter.fromDay+" to "+healthFilter.untilDay:
    "Current appointment records"):
    filters.yearRef?"Selected financial year":"All permitted posted financial years",
   sources,
   ...(failures?{message:"Some original sources could not be verified. Retry when available."}:
    sources.length===0?{message:"No reporting source is available for your current permissions."}:{})};
 }
}
