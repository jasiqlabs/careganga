import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {ConsultationQueueService} from "../application/consultation-queue.service";
@Controller("api/v1/appointments/queue")
export class ConsultationQueueController{
 constructor(private readonly queue:ConsultationQueueService){}
 @Get("my-clinician/assignments")
 @Header("Cache-Control","private, no-store")
 ownClinicalAssignments(@Headers("authorization")bearer:string){
  return this.queue.ownClinicianAssignments(bearer);
 }
 @Get("my-clinician/centers/:centerRef/doctors/:doctorRef/summary")
 @Header("Cache-Control","private, no-store")
 ownClinicalSummary(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string,@Param("doctorRef")doctor:string,
  @Query("date")day:string){
  return this.queue.ownClinicianSummary(bearer,center,doctor,day);
 }
 @Get("my-centers")
 @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")bearer:string){return this.queue.options(bearer);}
 @Get("my-centers/:centerRef/bookings/:bookingRef/clinical-history")
 @Header("Cache-Control","private, no-store")
 clinicalHistory(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string,@Param("bookingRef")booking:string,
  @Query("before")before?:string){
  return this.queue.clinicalHistory(bearer,center,booking,before);
 }
 @Get("my-centers/:centerRef/bookings/:bookingRef/history")
 @Header("Cache-Control","private, no-store")
 history(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Param("bookingRef")booking:string,@Query("before")before?:string){
  return this.queue.bookingHistory(bearer,center,booking,before);
 }
 @Get("my-centers/:centerRef/summary")
 @Header("Cache-Control","private, no-store")
 summary(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Query("date")day:string){return this.queue.summary(bearer,center,day);}
 @Get("my-centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 list(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Query("date")day:string,@Query("after")after?:string){return this.queue.list(bearer,center,day,after);}
 @Post("my-centers/:centerRef/verify-slip")
 @Header("Cache-Control","private, no-store")
 verifySlip(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Body()value:unknown){return this.queue.verifySlipAtMyCenter(bearer,center,value);}
 @Post("my-centers/:centerRef/check-in")
 @Header("Cache-Control","private, no-store")
 checkIn(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Body()value:unknown){return this.queue.checkIn(bearer,center,value);}
 @Post("my-centers/:centerRef/no-show")
 @Header("Cache-Control","private, no-store")
 noShow(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Body()value:unknown){return this.queue.markNoShow(bearer,center,value);}
 @Post("my-centers/:centerRef/visits/:visitRef/transition")
 @Header("Cache-Control","private, no-store")
 transition(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Param("visitRef")visit:string,@Body()value:unknown){
  return this.queue.transition(bearer,center,visit,value);
 }
}
