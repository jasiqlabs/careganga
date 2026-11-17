import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {FinanceExpenseClaimService} from "../application/finance-expense-claim.service";

/** CG-09 expense claim intake: a draft is not submitted, approved, posted or paid. */
@Controller("api/finance-accounting/claims")
export class FinanceExpenseClaimController{
 constructor(private readonly claims:FinanceExpenseClaimService){}
 @Post("drafts")
 create(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.claims.create(bearer,body);
 }
 @Get("mine")
 mine(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
  return this.claims.mine(bearer,offset);
 }
 @Get("draft-commands/:requestKey")
 command(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.claims.command(bearer,key);
 }
}
