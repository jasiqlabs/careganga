import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {FinanceReceiptDocumentService} from "../application/finance-receipt-document.service";
@Controller("api/documents/finance-receipts")
export class FinanceReceiptDocumentController{
 constructor(private readonly service:FinanceReceiptDocumentService){}
 @Get("receipts/:receiptRef/status")
 status(@Headers("authorization")auth:string,@Param("receiptRef")ref:string){
  return this.service.status(auth,ref);
 }
 @Post("receipts/:receiptRef/issue")
 issue(@Headers("authorization")auth:string,@Param("receiptRef")ref:string,
  @Body()body:unknown){
  if(!body||typeof body!=="object"||Array.isArray(body)||
     !("requestKey" in body)||typeof body.requestKey!=="string")
   return {confirmed:false,status:"INVALID_REQUEST"};
  return this.service.issue(auth,ref,body.requestKey);
 }
 @Get("files/:documentRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")auth:string,@Param("documentRef")ref:string){
  const bytes=await this.service.download(auth,ref);
  return new StreamableFile(bytes,{type:"application/pdf",
   disposition:'attachment; filename="CareGanga-Finance-Receipt.pdf"'});
 }
}
