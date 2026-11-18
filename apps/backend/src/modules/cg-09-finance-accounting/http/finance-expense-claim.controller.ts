import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {FinanceExpenseClaimService} from "../application/finance-expense-claim.service";

/** CG-09 expense claim intake: a draft is not submitted, approved, posted or paid. */
@Controller("api/finance-accounting/claims")
export class FinanceExpenseClaimController{
 constructor(private readonly claims:FinanceExpenseClaimService){}
 @Get("dashboard")
 dashboard(@Headers("authorization")bearer:string){return this.claims.dashboard(bearer);}
 @Get("managed")
 managed(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
  return this.claims.managed(bearer,offset);
 }
 @Get("approved-options")
 approvedOptions(@Headers("authorization")bearer:string,@Query("q")q?:string){
  return this.claims.approvedOptions(bearer,q);
 }
 @Get("workflow-commands/:requestKey")
 workflowCommand(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.claims.workflowCommand(bearer,key);
 }
 @Get(":claimRef/eligible-vouchers")
 eligibleVouchers(@Headers("authorization")bearer:string,@Param("claimRef")ref:string){
  return this.claims.eligibleVouchers(bearer,ref);
 }
 @Post(":claimRef/correct")
 correct(@Headers("authorization")bearer:string,@Param("claimRef")ref:string,
  @Body()body:unknown){return this.claims.correctReturned(bearer,ref,body);}
 @Post(":claimRef/submit")
 submit(@Headers("authorization")bearer:string,@Param("claimRef")ref:string,
  @Body()body:unknown){return this.claims.submit(bearer,ref,body);}
 @Post(":claimRef/reconcile")
 reconcile(@Headers("authorization")bearer:string,@Param("claimRef")ref:string,
  @Body()body:unknown){return this.claims.reconcile(bearer,ref,body);}
 @Post(":claimRef/link-voucher")
 linkVoucher(@Headers("authorization")bearer:string,@Param("claimRef")ref:string,
  @Body()body:unknown){return this.claims.linkVoucher(bearer,ref,body);}
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
 @Get(":claimRef")
 detail(@Headers("authorization")bearer:string,@Param("claimRef")ref:string){
  return this.claims.detail(bearer,ref);
 }
}
