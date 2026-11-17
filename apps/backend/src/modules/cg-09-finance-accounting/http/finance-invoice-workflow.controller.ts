import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {FinanceInvoiceWorkflowService} from "../application/finance-invoice-workflow.service";
import {FinanceInvoiceCancellationService} from "../application/finance-invoice-cancellation.service";
@Controller("api/finance-accounting/invoices")
export class FinanceInvoiceWorkflowController{
 constructor(private readonly service:FinanceInvoiceWorkflowService,
  private readonly corrections:FinanceInvoiceCancellationService){}
 @Get("cancel-commands/:requestKey")
 cancelStatus(@Headers("authorization")auth:string,@Param("requestKey")key:string){
  return this.corrections.status(auth,key);
 }
 @Post(":invoiceRef/cancel-posted")
 cancelPosted(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.corrections.cancelUnissued(auth,ref,body);}
 @Post(":invoiceRef/submit")
 submit(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.submit(auth,ref,body);}
 @Post(":invoiceRef/reconcile")
 reconcile(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.reconcile(auth,ref,body);}
 @Post(":invoiceRef/post")
 post(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.post(auth,ref,body);}
 @Post(":invoiceRef/issue")
 issue(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.issue(auth,ref,body);}
 @Get(":invoiceRef/collection-options")
 collectionOptions(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return this.service.collectionOptions(auth,ref);
 }
 @Post(":invoiceRef/record-collection")
 collection(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.recordCollection(auth,ref,body);}
 @Get(":invoiceRef/receipt-options")
 receiptOptions(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return this.service.receiptOptions(auth,ref);
 }
 @Get(":invoiceRef/receipt")
 receiptStatus(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return this.service.receiptStatus(auth,ref);
 }
 @Post(":invoiceRef/link-receipt")
 linkReceipt(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.service.linkReceipt(auth,ref,body);}
 @Get("workflow-commands/:requestKey")
 command(@Headers("authorization")auth:string,@Param("requestKey")ref:string){
  return this.service.commandStatus(auth,ref);
 }
}
