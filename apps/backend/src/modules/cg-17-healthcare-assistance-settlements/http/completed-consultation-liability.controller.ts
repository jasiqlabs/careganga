import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {CompletedConsultationLiabilityService}
 from "../application/completed-consultation-liability.service";
/** CG17 US005: only source-backed approved Foundation liability.
 * Not a patient collection, a CG09 posted entry or a bank disbursement.
 */
@Controller("api/v1/healthcare-assistance/foundation-liabilities")
export class CompletedConsultationLiabilityController{
 constructor(private readonly source:CompletedConsultationLiabilityService){}
 @Get("centers/eligible")
 @Header("Cache-Control","private, no-store")
 centers(@Headers("authorization")token:string){
  return this.source.eligibleCenters(token);
 }
 @Get("centers/:centerRef/completed-options")
 @Header("Cache-Control","private, no-store")
 candidates(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.source.completedOptions(token,center);
 }
 @Get("centers/:centerRef/appointments/:bookingRef")
 @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("bookingRef")booking:string){
  return this.source.status(token,center,booking);
 }
 @Post("centers/:centerRef/appointments/:bookingRef/recognize")
 @Header("Cache-Control","private, no-store")
 recognize(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("bookingRef")booking:string,
  @Body()body:unknown){
  return this.source.recognize(token,center,booking,body);
 }
}
