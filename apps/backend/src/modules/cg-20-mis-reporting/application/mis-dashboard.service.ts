import {BadRequestException, ForbiddenException, Injectable, UnauthorizedException} from "@nestjs/common";
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
type Source={sourceKey:string;state:"AVAILABLE"|"EMPTY"|"FAILED";sourceLabel:string;
 readAt?:string;metrics:Metric[];drilldown?:string;explanation?:string;
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
  private readonly patients:PatientAdminOverviewService){}

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
      "fromDay","untilDay","status"].includes(k))||
    Object.entries(raw).some(([k,v])=>typeof v!=="string"||v.length>80||
     (v!==""&&(["yearRef","branchRef","centerRef"].includes(k)?
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
  const hasHealthFilter=Object.values(healthFilter).some(Boolean);
  const hasFinanceFilter=Boolean(filters.yearRef||filters.branchRef);
  if(hasHealthFilter&&hasFinanceFilter)
   throw new BadRequestException({code:"MIS_FILTER_FAMILIES_CONFLICT",
    message:"Choose finance filters or healthcare filters, not both."});
  if(Boolean(healthFilter.fromDay)!==Boolean(healthFilter.untilDay))
   throw new BadRequestException({code:"MIS_HEALTH_DATE_RANGE_INVALID",
    message:"Select both start and end dates."});
  const readAt=new Date().toISOString();
  let failures=0;
  const financeSource:Promise<Source|null>=hasHealthFilter?Promise.resolve(null):this.finance
   .summary(bearer,filters.yearRef,filters.branchRef)
   .then(async source=>{
    let trend:FinanceTrend={type:"MONTHLY_FINANCE",
     windowLabel:"Last six calendar months",state:"EMPTY",points:[]};
    if(source.sourceRecordState!=="NO_ROWS"){
     try{
      const projection=await this.finance.monthlyMisTrend(
       bearer,filters.yearRef,filters.branchRef);
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
     readAt:new Date().toISOString(),
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
     if(filters.branchRef)throw error;
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
  const diagnosticSource:Promise<Source|null>=(hasFinanceFilter||hasHealthFilter)?
   Promise.resolve(null):this.diagnostics.summary(bearer)
   .then(x=>({sourceKey:"CG16_FOUNDATION_DIAGNOSTICS",state:"AVAILABLE" as const,
    sourceLabel:"Foundation Diagnostics · Current catalogues",
    readAt:new Date().toISOString(),
    metrics:[
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
  const patientSource:Promise<Source|null>=hasFinanceFilter?
   Promise.resolve(null):this.patients.readMisTotals(bearer,healthFilter)
   .then(x=>({sourceKey:"CG15_APPOINTMENT_STATES",state:"AVAILABLE" as const,
    sourceLabel:"Foundation Appointments · Current state totals",
    readAt:new Date().toISOString(),
    metrics:[
     {key:"bookings",label:"Total appointments",unit:"COUNT" as const,value:x.bookings},
     {key:"completed",label:"Completed appointments",unit:"COUNT" as const,value:x.completed},
     {key:"waiting",label:"In progress or waiting",unit:"COUNT" as const,value:x.waiting},
     {key:"cancelled",label:"Cancelled appointments",unit:"COUNT" as const,value:x.cancelled}
    ],explanation:"Foundation-wide status counts only; no patient files or individual care data."}))
   .catch((error:unknown)=>{
    if(error instanceof UnauthorizedException)throw error;
    if(error instanceof ForbiddenException)return null;
    failures++;
    return {sourceKey:"CG15_APPOINTMENT_STATES",state:"FAILED" as const,
     sourceLabel:"Foundation Appointments",metrics:[]};
   });
  const results=await Promise.all([financeSource,diagnosticSource,patientSource]);
  const sources:Source[]=results.filter((x):x is Source=>x!==null);
  const available=sources.filter(s=>s.state==="AVAILABLE").length;
  const empty=sources.filter(s=>s.state==="EMPTY").length;
  return {state:available?(failures?"PARTIAL":"AVAILABLE"):
   empty?(failures?"PARTIAL":"NO_DATA"):
   failures?"FAILED":"NO_AUTHORIZED_SOURCES",readAt,
   scopeLabel:healthFilter.centerRef?"Selected verified healthcare center":
    filters.branchRef?"Permitted selected branch":"Current original-owner scope",
   periodLabel:hasHealthFilter?(healthFilter.fromDay?
    "Appointments "+healthFilter.fromDay+" to "+healthFilter.untilDay:
    "Current appointment records"):
    filters.yearRef?"Selected financial year":"All permitted posted financial years",
   sources,
   ...(failures?{message:"Some original sources could not be verified. Retry when available."}:
    sources.length===0?{message:"No reporting source is available for your current permissions."}:{})};
 }
}
