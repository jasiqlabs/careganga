import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FinanceBudgetService} from "../application/finance-budget.service";
@Controller("api/finance-accounting/budgets")
export class FinanceBudgetController{
 constructor(private readonly budgets:FinanceBudgetService){}
 @Get("options") options(@Headers("authorization")a:string){
  return this.budgets.options(a);
 }
 @Get("dashboard") dashboard(@Headers("authorization")a:string){
  return this.budgets.dashboard(a);
 }
 @Get("list") list(@Headers("authorization")a:string,@Query("offset")offset?:string){
  return this.budgets.list(a,offset);
 }
 @Post("drafts") create(@Headers("authorization")a:string,@Body()b:unknown){
  return this.budgets.save(a,b);
 }
 @Patch("drafts/:budgetRef") revise(@Headers("authorization")a:string,
  @Param("budgetRef")ref:string,@Body()b:unknown){return this.budgets.save(a,b,ref);}
 @Get("commands/:requestKey")
 command(@Headers("authorization")a:string,@Param("requestKey")key:string){
  return this.budgets.commandStatus(a,key);
 }
 @Get(":budgetRef/eligible-expenses")
 eligible(@Headers("authorization")a:string,@Param("budgetRef")ref:string){
  return this.budgets.eligibleExpenses(a,ref);
 }
 @Get(":budgetRef") detail(@Headers("authorization")a:string,
  @Param("budgetRef")ref:string){return this.budgets.detail(a,ref);}
 @Post(":budgetRef/submit") submit(@Headers("authorization")a:string,
  @Param("budgetRef")ref:string,@Body()b:unknown){return this.budgets.submit(a,ref,b);}
 @Post(":budgetRef/reconcile") reconcile(@Headers("authorization")a:string,
  @Param("budgetRef")ref:string,@Body()b:unknown){return this.budgets.reconcile(a,ref,b);}
 @Post(":budgetRef/events") event(@Headers("authorization")a:string,
  @Param("budgetRef")ref:string,@Body()b:unknown){return this.budgets.recordEvent(a,ref,b);}
}
