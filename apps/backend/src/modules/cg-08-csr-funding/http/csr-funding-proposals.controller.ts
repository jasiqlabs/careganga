import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {CsrFundingProposalsService} from "../application/csr-funding-proposals.service";
/** CG08 owns intended funding, not CG09 posted cash and not CG03 approval. */
@Controller("api/v1/csr/funding-proposals")
export class CsrFundingProposalsController{
 constructor(private readonly source:CsrFundingProposalsService){}
 @Get() list(@Headers("authorization")auth:string,@Query()query:Record<string,unknown>){
  return this.source.list(auth,query);
 }
 @Get("options") options(@Headers("authorization")auth:string){return this.source.options(auth);}
 @Get(":ref/finance")
 verifiedFinance(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.source.verifiedFinance(auth,ref);
 }
 @Get(":ref/finance/eligible-receipts")
 eligibleReceipts(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.source.eligibleVerifiedReceipts(auth,ref);
 }
 @Post(":ref/finance/receipts")
 linkVerifiedReceipt(@Headers("authorization")auth:string,@Param("ref")ref:string,
  @Body()body:unknown){return this.source.linkVerifiedReceipt(auth,ref,body);}
 @Get(":ref/finance/budgets")
 budgets(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.source.eligibleFinanceBudgets(auth,ref);
 }
 @Get(":ref/finance/budgets/:budgetRef/expenses")
 expenses(@Headers("authorization")auth:string,@Param("ref")ref:string,
  @Param("budgetRef")budgetRef:string){
  return this.source.eligibleFinanceExpenses(auth,ref,budgetRef);
 }
 @Post(":ref/finance/budget-effects")
 effect(@Headers("authorization")auth:string,@Param("ref")ref:string,
  @Body()body:unknown){return this.source.applyFinanceBudgetEffect(auth,ref,body);}
 @Get(":ref/project-context")
 projectContext(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.source.fundingProjectContext(auth,ref);
 }
 @Get(":ref") detail(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.source.detail(auth,ref);
 }
 @Post() create(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.source.create(auth,body);
 }
 @Post(":ref/resume")
 resume(@Headers("authorization")auth:string,@Param("ref")ref:string,
  @Body()body:unknown){return this.source.resumeReturned(auth,ref,body);}
 @Patch(":ref") edit(@Headers("authorization")auth:string,@Param("ref")ref:string,
  @Body()body:unknown){return this.source.edit(auth,ref,body);}
}
