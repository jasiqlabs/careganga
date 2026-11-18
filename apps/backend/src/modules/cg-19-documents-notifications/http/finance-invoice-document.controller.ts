import {Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {FinanceInvoiceDocumentService} from "../application/finance-invoice-document.service";
@Controller("api/documents/finance-invoice")
export class FinanceInvoiceDocumentController{
 constructor(private readonly documents:FinanceInvoiceDocumentService){}
 @Get("invoices/:invoiceRef/status")
 status(@Headers("authorization")auth:string,@Param("invoiceRef")ref:string){
  return this.documents.status(auth,ref);
 }
 @Get("files/:documentRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")auth:string,@Param("documentRef")ref:string){
  const bytes=await this.documents.download(auth,ref);
  return new StreamableFile(bytes,{type:"application/pdf",disposition:
   'attachment; filename="CareGanga-Foundation-Invoice.pdf"'});
 }
}
