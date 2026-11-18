import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {FinanceVoucherWorkflowService} from "../application/finance-voucher-workflow.service";

@Controller("api/finance-accounting/vouchers")
export class FinanceVoucherWorkflowController{
 constructor(private readonly workflow:FinanceVoucherWorkflowService){}
 @Post("drafts/:voucherRef/submit")
 submit(@Headers("authorization")bearer:string,
  @Param("voucherRef")ref:string,@Body()body:unknown){
  return this.workflow.submit(bearer,ref,body);
 }
 @Post(":voucherRef/settle")
 settle(@Headers("authorization")bearer:string,
  @Param("voucherRef")ref:string,@Body()body:unknown){
  return this.workflow.settle(bearer,ref,body);
 }
 @Get("workflow-commands/:requestKey")
 command(@Headers("authorization")bearer:string,
  @Param("requestKey")key:string){
  return this.workflow.commandStatus(bearer,key);
 }
}
