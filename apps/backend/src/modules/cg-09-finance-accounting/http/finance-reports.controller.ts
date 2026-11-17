import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {FinanceReportsService} from "../application/finance-reports.service";
@Controller("api/finance-accounting/reports")
export class FinanceReportsController{
 constructor(private readonly reports:FinanceReportsService){}
 @Get("options") options(@Headers("authorization")auth:string){
  return this.reports.options(auth);
 }
 @Get("summary") summary(@Headers("authorization")auth:string,@Query("yearRef")year?:string){
  return this.reports.summary(auth,year);
 }
 @Get("general-ledger")
 ledger(@Headers("authorization")auth:string,@Query()q:Record<string,string>){
  return this.reports.ledger(auth,q);
 }
 @Get("trial-balance")
 trial(@Headers("authorization")auth:string,@Query("yearRef")year:string,
   @Query("branchRef")branch?:string){return this.reports.trialBalance(auth,year,branch);}
 @Get("day-book")
 daybook(@Headers("authorization")auth:string,@Query()q:Record<string,string>){
  return this.reports.books(auth,"DAY",q);
 }
 @Get("cash-book")
 cashbook(@Headers("authorization")auth:string,@Query()q:Record<string,string>){
  return this.reports.books(auth,"CASH",q);
 }
 @Get("bank-book")
 bankbook(@Headers("authorization")auth:string,@Query()q:Record<string,string>){
  return this.reports.books(auth,"BANK",q);
 }
 @Get("reconciliation/banks")
 banks(@Headers("authorization")auth:string){
  return this.reports.reconciliationOptions(auth);
 }
 @Get("reconciliation/banks/:accountRef/entries")
 bankEntries(@Headers("authorization")auth:string,@Param("accountRef")ref:string){
  return this.reports.bankLines(auth,ref);
 }
 @Post("reconciliation/matches")
 match(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.reports.recordBankMatch(auth,body);
 }
 @Get("reconciliation/matches")
 list(@Headers("authorization")auth:string,@Query("offset")offset?:string){
  return this.reports.reconciliationList(auth,offset);
 }
 @Post("reconciliation/matches/:matchRef/decision")
 decide(@Headers("authorization")auth:string,@Param("matchRef")ref:string,@Body()body:unknown){
  return this.reports.verifyBankMatch(auth,ref,body);
 }
}
