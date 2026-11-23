import {Body,Controller,Get,Headers,Param,Post,Req,Header} from "@nestjs/common";
import {DonationProviderRefundService} from "../application/donation-provider-refund.service";
import {assertDonationPublicIngress} from "../domain/public-donation-ingress";
@Controller("api/v1/donations/refunds")
export class DonationProviderRefundController{
 constructor(private readonly refunds:DonationProviderRefundService){}
 @Post(":ref/authorize-provider")
 authorize(@Headers("authorization")auth:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.refunds.initiate(auth,ref,body);
 }
 @Get(":ref/reconcile-provider")
 reconcile(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.refunds.reconcile(auth,ref);
 }
 @Post(":ref/post-provider")
 post(@Headers("authorization")auth:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.refunds.finalize(auth,ref,body);
 }
}
@Controller("api/public/donations")
export class DonationProviderRefundWebhookController{
 constructor(private readonly refunds:DonationProviderRefundService){}
 @Post("webhooks/razorpay-refunds")
 @Header("Cache-Control","no-store")
 webhook(@Req()req:object){
  assertDonationPublicIngress(req,"webhook");
  return this.refunds.webhook(req);
 }
}
