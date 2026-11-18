import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {FinanceInvoiceApprovalService} from "../application/finance-invoice-approval.service";
@Controller("api/approvals/finance-invoices")
export class FinanceInvoiceApprovalController{
 constructor(private readonly service:FinanceInvoiceApprovalService){}
 @Get("process") process(@Headers("authorization")a:string){
  return this.service.processStatus(a);
 }
 @Post("process") initialize(@Headers("authorization")a:string,@Body()b:unknown){
  return this.service.initialize(a,b);
 }
 @Get("cases") cases(@Headers("authorization")a:string,@Query("offset")o?:string){
  return this.service.list(a,o);
 }
 @Get("cases/:caseRef") detail(@Headers("authorization")a:string,@Param("caseRef")r:string){
  return this.service.detail(a,r);
 }
 @Post("cases/:caseRef/decisions")
 decide(@Headers("authorization")a:string,@Param("caseRef")r:string,@Body()b:unknown){
  return this.service.decide(a,r,b);
 }
}
