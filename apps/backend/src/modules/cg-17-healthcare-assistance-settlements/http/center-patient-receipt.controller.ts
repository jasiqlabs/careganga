import {
 Body,Controller,Get,Header,Headers,Param,Post,StreamableFile
} from "@nestjs/common";
import {CenterPatientReceiptService}
 from "../application/center-patient-receipt.service";

/** Protected CG19 private PDF for the original CG17 verified center cash.
 * Public anonymous visitors cannot request a staff or patient receipt. */
@Controller("api/v1/healthcare-assistance/center-receipts")
export class CenterPatientReceiptController{
 constructor(private readonly receipts:CenterPatientReceiptService){}
 @Get("staff/centers/:centerRef/collections/:collectionRef")
 @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("collectionRef")collection:string){
  return this.receipts.status(token,center,collection);
 }
 @Post("staff/centers/:centerRef/collections/:collectionRef/issue")
 @Header("Cache-Control","private, no-store")
 issue(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("collectionRef")collection:string,
  @Body()payload:unknown){
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||
   Object.keys(payload).length!==1||!("requestKey" in payload))
   return this.receipts.issue(token,center,collection,"");
  return this.receipts.issue(token,center,collection,
   String((payload as {requestKey:unknown}).requestKey));
 }
 @Get("staff/centers/:centerRef/collections/:collectionRef/pdf")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async staffPdf(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("collectionRef")collection:string){
  const bytes=await this.receipts.staffDownload(token,center,collection);
  return new StreamableFile(bytes,{type:"application/pdf",
   disposition:'attachment; filename="careganga-center-cash-receipt.pdf"',
   length:bytes.length});
 }
 @Get("me/appointments/:bookingRef/collections/:collectionRef")
 @Header("Cache-Control","private, no-store")
 patientStatus(@Headers("authorization")token:string,
  @Param("bookingRef")booking:string,@Param("collectionRef")collection:string){
  return this.receipts.patientStatus(token,booking,collection);
 }
 @Get("me/appointments/:bookingRef/collections/:collectionRef/online-pdf")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async onlinePdf(@Headers("authorization")token:string,@Param("bookingRef")booking:string,@Param("collectionRef")collection:string){
  const bytes=await this.receipts.patientOnlineConfirmation(token,booking,collection);
  return new StreamableFile(bytes,{type:"application/pdf",disposition:'attachment; filename="careganga-online-payment-confirmation.pdf"',length:bytes.length});
 }
 @Get("me/appointments/:bookingRef/collections/:collectionRef/pdf")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async patientPdf(@Headers("authorization")token:string,
  @Param("bookingRef")booking:string,@Param("collectionRef")collection:string){
  const bytes=await this.receipts.patientDownload(token,booking,collection);
  return new StreamableFile(bytes,{type:"application/pdf",
   disposition:'attachment; filename="careganga-center-cash-receipt.pdf"',
   length:bytes.length});
 }
}
