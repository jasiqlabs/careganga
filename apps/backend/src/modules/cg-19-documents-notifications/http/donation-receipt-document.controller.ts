import {Body,Controller,Get,Header,Headers,Param,Post,Req,StreamableFile} from "@nestjs/common";
import {DonationReceiptDocumentService} from "../application/donation-receipt-document.service";
import {assertDonationPublicIngress} from "../../cg-07-campaigns-donations/domain/public-donation-ingress";
@Controller("api/documents/donation-receipts")
export class DonationReceiptDocumentController{
 constructor(private readonly source:DonationReceiptDocumentService){}
 @Get(":donationRef/status") @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")token:string,@Param("donationRef")id:string){
  return this.source.status(token,id);
 }
 @Post(":donationRef/issue") @Header("Cache-Control","private, no-store")
 issue(@Headers("authorization")token:string,@Param("donationRef")id:string,@Body()body:unknown){
  if(!body||typeof body!=="object"||Array.isArray(body)||!("requestKey" in body))
   return {status:"INVALID_REQUEST"};
  return this.source.issue(token,id,body.requestKey as string);
 }
}
@Controller("api/public/donations/receipt")
export class DonorOwnReceiptController{
 constructor(private readonly source:DonationReceiptDocumentService){}
 @Post("download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async own(@Req()req:object,@Body()proof:unknown){
  assertDonationPublicIngress(req,"donor");
  const bytes=await this.source.downloadWithProof(proof);
  return new StreamableFile(bytes,{type:"application/pdf",
    disposition:'attachment; filename="CareGanga-Donation-Receipt.pdf"'});
 }
}
