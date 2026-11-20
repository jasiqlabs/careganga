import {Body,Controller,Get,Header,Headers,Param,Post,Req} from "@nestjs/common";
import {CenterMerchantProvisioningService}
 from "../application/center-merchant-provisioning.service";
import {CenterMerchantCheckoutService}
 from "../application/center-merchant-checkout.service";
/** CG17 owns only genuine center merchant checkout; no Foundation gateway.
 * The webhook deliberately has no session auth and MUST authenticate its raw
 * Razorpay bytes against that center's independently provisioned secret.
 */
@Controller("api/v1/healthcare-assistance/merchant")
export class CenterMerchantController{
 constructor(private readonly binding:CenterMerchantProvisioningService,
  private readonly payment:CenterMerchantCheckoutService){}
 @Get("staff/centers/:centerRef/binding")
 @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.binding.status(token,center);
 }
 @Post("staff/centers/:centerRef/binding/propose")
 propose(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.binding.propose(token,center,body);}
 @Post("staff/centers/:centerRef/binding/verify")
 verify(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.binding.verify(token,center,body);}
 @Post("staff/centers/:centerRef/binding/revoke")
 revoke(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.binding.revoke(token,center,body);}
 @Get("me/appointments/:bookingRef")
 @Header("Cache-Control","private, no-store")
 patient(@Headers("authorization")token:string,@Param("bookingRef")booking:string){
  return this.payment.current(token,booking);
 }
 @Post("me/appointments/:bookingRef/checkout")
 @Header("Cache-Control","private, no-store")
 patientStart(@Headers("authorization")token:string,@Param("bookingRef")booking:string,
  @Body()body:unknown){return this.payment.start(token,booking,body);}
 @Get("staff/centers/:centerRef/appointments/:bookingRef")
 @Header("Cache-Control","private, no-store")
 staff(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("bookingRef")booking:string){return this.payment.current(token,booking,center);}
 @Post("staff/centers/:centerRef/appointments/:bookingRef/checkout")
 @Header("Cache-Control","private, no-store")
 staffStart(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("bookingRef")booking:string,@Body()body:unknown){
  return this.payment.start(token,booking,body,center);
 }
 @Post("webhooks/razorpay/:centerRef")
 webhook(@Param("centerRef")center:string,
  @Headers("x-razorpay-signature")sig:string,
  @Headers("x-razorpay-event-id")event:string,
  @Req()req:{rawBody?:Buffer}){
  return this.payment.webhook(center,req.rawBody,sig,event);
 }
}
