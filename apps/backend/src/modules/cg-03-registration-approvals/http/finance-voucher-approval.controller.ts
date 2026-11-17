import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {FinanceVoucherApprovalService} from "../application/finance-voucher-approval.service";

@Controller("api/registration-approvals/finance-vouchers")
export class FinanceVoucherApprovalController{
 constructor(private readonly approvals:FinanceVoucherApprovalService){}
 @Get("process")
 process(@Headers("authorization")bearer:string){
  return this.approvals.processStatus(bearer);
 }
 @Post("process/initialize")
 initialize(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.approvals.initializeProcess(bearer,input);
 }
 @Get()
 list(@Headers("authorization")bearer:string){return this.approvals.list(bearer);}
 @Get(":caseRef")
 detail(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
  return this.approvals.detail(bearer,ref);
 }
 @Post(":caseRef/decisions")
 decide(@Headers("authorization")bearer:string,@Param("caseRef")ref:string,
  @Body()input:unknown){
  return this.approvals.decide(bearer,ref,input);
 }
}
