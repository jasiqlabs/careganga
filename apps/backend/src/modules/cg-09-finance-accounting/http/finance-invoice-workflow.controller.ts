import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {FinanceInvoiceWorkflowService} from "../application/finance-invoice-workflow.service";
import {FinanceInvoiceCancellationService} from "../application/finance-invoice-cancellation.service";
import {FinanceInvoiceAdjustmentService} from "../application/finance-invoice-adjustment.service";
@Controller("api/finance-accounting/invoices")
export class FinanceInvoiceWorkflowController{
 constructor(private readonly service:FinanceInvoiceWorkflowService,
  private readonly corrections:FinanceInvoiceCancellationService,
  private readonly adjustments:FinanceInvoiceAdjustmentService){}
 @Get(":invoiceRef/adjustment")
 adjustment(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return this.adjustments.detail(auth,ref);
 }
 @Get(":invoiceRef/adjustment-options")
 adjustmentOptions(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return this.adjustments.options(auth,ref);
 }
 @Post(":invoiceRef/credit-note")
 creditNote(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.adjustments.credit(auth,ref,body);}
 @Get(":invoiceRef/credit-note/pdf")
 @Header("Content-Type","application/pdf")
 @Header("Content-Disposition","attachment; filename=CareGanga-Credit-Note.pdf")
 async creditPdf(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return new StreamableFile(await this.adjustments.creditPdf(auth,ref));
 }
 @Post(":invoiceRef/refunds")
 refundRequest(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string,
  @Body()body:unknown){return this.adjustments.requestRefund(auth,ref,body);}
 @Post("refunds/:refundRef/approve")
 refundApprove(@Headers("authorization")auth:string,@Param("refundRef")ref:string,
  @Body()body:unknown){return this.adjustments.approveRefund(auth,ref,body);}
 @Get("cancel-eligibility")
 cancelEligibility(@Headers("authorization")auth:string){
  return this.corrections.eligibility(auth);
 }
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
