import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FinanceInvoiceDraftService} from "../application/finance-invoice-draft.service";
@Controller("api/finance-accounting/invoices")
export class FinanceInvoiceDraftController{
 constructor(private readonly service:FinanceInvoiceDraftService){}
 @Get("options")
 options(@Headers("authorization")bearer:string){return this.service.options(bearer);}
 @Get("posting-accounts")
 postingAccounts(@Headers("authorization")bearer:string,@Query("q")q?:string){
  return this.service.accounts(bearer,q);
 }
 @Get("dashboard")
 dashboard(@Headers("authorization")bearer:string){return this.service.dashboard(bearer);}
 @Get("drafts")
 list(@Headers("authorization")bearer:string,@Query("offset")offset?:string,
  @Query("status")status?:string){return this.service.list(bearer,offset,status);}

 @Post("drafts")
 create(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.save(bearer,body);
 }
 @Patch("drafts/:invoiceRef/stages")
 update(@Headers("authorization")bearer:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.save(bearer,body,ref);}
 @Get("drafts/:invoiceRef")
 detail(@Headers("authorization")bearer:string,@Param("invoiceRef")ref:string){
  return this.service.detail(bearer,ref);
 }
 @Get("draft-commands/:requestKey")
 command(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.service.command(bearer,key);
 }
}
