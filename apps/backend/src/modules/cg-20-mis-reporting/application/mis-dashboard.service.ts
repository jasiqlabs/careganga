import {BadRequestException, ForbiddenException, Injectable} from "@nestjs/common";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FinanceReportsService} from "../../cg-09-finance-accounting/application/finance-reports.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Filters={yearRef?:string;branchRef?:string};

/**
 * CG-20 US-001: read-only reporting composition. Each source authenticates
 * independently in its ORIGINAL owner (CG-09), including branch and field
 * restrictions. No copied journal/healthcare rows or speculative source joins.
 */
@Injectable()
export class MisDashboardService {
 constructor(private readonly sessions:SessionService,
  private readonly finance:FinanceReportsService){}

 async dashboard(bearer:string,raw:Record<string,unknown>){
  await this.sessions.requireAction(bearer,"mis.dashboard.view");
  if(Object.keys(raw).some(k=>!["yearRef","branchRef"].includes(k))||
    Object.values(raw).some(v=>typeof v!=="string"||v.length>80||
      (v!==""&&!UUID.test(v))))
   throw new BadRequestException({code:"MIS_DASHBOARD_FILTER_INVALID",
    message:"Choose a valid financial year or permitted branch."});
  const filters:Filters={
   yearRef:typeof raw.yearRef==="string"&&raw.yearRef?raw.yearRef:undefined,
   branchRef:typeof raw.branchRef==="string"&&raw.branchRef?raw.branchRef:undefined
  };
  // Retrieved-at is NOT an invented multi-owner financial transaction watermark.
  // No source data is cached or persisted by the MIS module.
  try{
   const source=await this.finance.summary(bearer,filters.yearRef,filters.branchRef);
   const readAt=new Date().toISOString();
   return {state:"AVAILABLE",readAt,scopeLabel:filters.branchRef?
    "Permitted selected branch":"Permitted Foundation finance scope",
    periodLabel:filters.yearRef?"Selected financial year":"All permitted posted financial years",
    sources:[{sourceKey:"CG09_POSTED_FINANCE",state:"AVAILABLE",
     readAt,sourceLabel:"Foundation Finance · Posted journal only",
     metrics:[
      {key:"income",label:"Posted income",unit:"INR_MINOR",value:source.incomeMinor},
      {key:"expense",label:"Posted expenses",unit:"INR_MINOR",value:source.expenseMinor},
      {key:"surplus",label:"Posted surplus",unit:"INR_MINOR",value:source.surplusMinor},
      {key:"cashBank",label:"Posted cash and bank",unit:"INR_MINOR",value:source.cashBankMinor}
     ],
     drilldown:"/admin/finance/reports",
     explanation:source.explanation}]};
  }catch(error){
   // No user who lacks the original finance grant may infer its amounts.
   if(error instanceof ForbiddenException)return {
    state:"NO_AUTHORIZED_SOURCES",readAt:new Date().toISOString(),
    sources:[],message:"No reporting sources are available for your current permissions."};
   if(error instanceof BadRequestException)throw error;
   // Fail closed with a truthful source status; never substitute zeros.
   return {state:"PARTIAL",readAt:new Date().toISOString(),
    sources:[{sourceKey:"CG09_POSTED_FINANCE",state:"FAILED",
     sourceLabel:"Foundation Finance",metrics:[]}],
    message:"The financial source could not be verified. Refresh to try again."};
  }
 }
}
