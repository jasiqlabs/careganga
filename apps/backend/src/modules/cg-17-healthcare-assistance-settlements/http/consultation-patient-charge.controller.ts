import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {ConsultationPatientChargeService}
 from "../application/consultation-patient-charge.service";
/** Original CG15 consultation only, not collection or financial settlement. */
@Controller("api/v1/healthcare-assistance/consultation-charges")
export class ConsultationPatientChargeController{
 constructor(private readonly charges:ConsultationPatientChargeService){}
 @Get("me/holds/:holdRef/quote")
 @Header("Cache-Control","private, no-store")
 holdQuote(@Headers("authorization")token:string,@Param("holdRef")ref:string){
  return this.charges.quoteHold(token,ref);
 }
 @Get("me/appointments/:bookingRef")
 @Header("Cache-Control","private, no-store")
 self(@Headers("authorization")token:string,@Param("bookingRef")ref:string){
  return this.charges.previewBooking(token,ref);
 }
 @Post("me/appointments/:bookingRef/accept")
 @Header("Cache-Control","private, no-store")
 selfAccept(@Headers("authorization")token:string,@Param("bookingRef")ref:string,
  @Body()raw:unknown){return this.charges.accept(token,ref,raw);}
 @Get("staff/centers/:centerRef/holds/:holdRef/quote")
 @Header("Cache-Control","private, no-store")
 staffHold(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("holdRef")ref:string){return this.charges.quoteHold(token,ref,center);}
 @Get("staff/centers/:centerRef/appointments/:bookingRef")
 @Header("Cache-Control","private, no-store")
 staff(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("bookingRef")ref:string){return this.charges.previewBooking(token,ref,center);}
 @Post("staff/centers/:centerRef/appointments/:bookingRef/accept")
 @Header("Cache-Control","private, no-store")
 staffAccept(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("bookingRef")ref:string,@Body()raw:unknown){
  return this.charges.accept(token,ref,raw,center);
 }
}
