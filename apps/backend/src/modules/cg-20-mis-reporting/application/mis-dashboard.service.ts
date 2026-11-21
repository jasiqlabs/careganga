import {BadRequestException, ForbiddenException, Injectable} from "@nestjs/common";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceReportsService} from "../../cg-09-finance-accounting/application/finance-reports.service";
import {DiagnosticsCatalogService} from "../../cg-16-healthcare-diagnostics/application/diagnostics-catalog.service";
import {PatientAdminOverviewService} from "../../cg-15-patients-appointments/application/patient-admin-overview.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Filters={yearRef?:string;branchRef?:string};
type Metric={key:string;label:string;unit:"INR_MINOR"|"COUNT";value:string};
type Source={sourceKey:string;state:"AVAILABLE"|"EMPTY"|"FAILED";sourceLabel:string;
 readAt?:string;metrics:Metric[];drilldown?:string;explanation?:string};

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
  try{
   const source=await this.finance.options(bearer);
   return {state:"AVAILABLE",sourceKey:"CG09_POSTED_FINANCE",
    years:source.years.map(y=>({ref:y.ref,name:y.name})),
    branches:source.branches.map(b=>({ref:b.branchRef,name:b.name})),
    allBranches:source.allBranches};
  }catch(error){
   if(error instanceof ForbiddenException)return {
    state:"NO_FINANCE_ACCESS",years:[],branches:[],allBranches:false};
   return {state:"FAILED",years:[],branches:[],allBranches:false};
  }
 }

 async dashboard(bearer:string,raw:Record<string,unknown>){
  await this.sessions.requireAction(bearer,"mis.dashboard.view");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>!["yearRef","branchRef"].includes(k))||
    Object.values(raw).some(v=>typeof v!=="string"||v.length>80||
      (v!==""&&!UUID.test(v))))
   throw new BadRequestException({code:"MIS_DASHBOARD_FILTER_INVALID",
    message:"Choose a valid financial year or permitted branch."});
  const filters:Filters={
   yearRef:typeof raw.yearRef==="string"&&raw.yearRef?raw.yearRef:undefined,
   branchRef:typeof raw.branchRef==="string"&&raw.branchRef?raw.branchRef:undefined
  };
  const readAt=new Date().toISOString();
  let failures=0;
  const financeSource:Promise<Source|null>=this.finance
   .summary(bearer,filters.yearRef,filters.branchRef)
   .then(source=>({sourceKey:"CG09_POSTED_FINANCE",
    state:source.sourceRecordState==="NO_ROWS"?"EMPTY" as const:"AVAILABLE" as const,
    sourceLabel:"Foundation Finance · Posted journals",readAt:new Date().toISOString(),
    metrics:source.sourceRecordState==="NO_ROWS"?[]:[
     {key:"income",label:"Posted income",unit:"INR_MINOR" as const,value:source.incomeMinor},
     {key:"expense",label:"Posted expenses",unit:"INR_MINOR" as const,value:source.expenseMinor},
     {key:"surplus",label:"Posted surplus",unit:"INR_MINOR" as const,value:source.surplusMinor},
     {key:"cashBank",label:"Posted cash and bank",unit:"INR_MINOR" as const,value:source.cashBankMinor}
    ],drilldown:"/admin/finance/reports",explanation:source.explanation}))
   .catch((error:unknown)=>{
    // Never downgrade an explicit foreign-branch access attempt to a 200 OK.
    if(error instanceof ForbiddenException){
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
  const diagnosticSource:Promise<Source|null>=(filters.yearRef||filters.branchRef)?
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
    if(error instanceof ForbiddenException)return null;
    failures++;
    return {sourceKey:"CG16_FOUNDATION_DIAGNOSTICS",state:"FAILED" as const,
     sourceLabel:"Foundation Diagnostics",metrics:[]};
   });
  // Foundation-only CG-15 counts from a narrow original-owner read facade.
  // Neither row-level patient names nor center/branch extrapolations are allowed.
  const patientSource:Promise<Source|null>=(filters.yearRef||filters.branchRef)?
   Promise.resolve(null):this.patients.readMisTotals(bearer)
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
   scopeLabel:filters.branchRef?"Permitted selected branch":"Current original-owner scope",
   periodLabel:filters.yearRef?"Selected financial year":"All permitted posted financial years",
   sources,
   ...(failures?{message:"Some original sources could not be verified. Retry when available."}:
    sources.length===0?{message:"No reporting source is available for your current permissions."}:{})};
 }
}
