import {Controller,Get,Header,Param,Query,Req} from "@nestjs/common";
import {DoctorAvailabilityService} from "../application/doctor-availability.service";
import {HealthPublicRequestThrottleService}
 from "../../cg-14-healthcare-network/application/health-public-request-throttle.service";

@Controller("api/v1/appointments/public")
export class DoctorAvailabilityController{
 constructor(private readonly availability:DoctorAvailabilityService,
  private readonly ingress:HealthPublicRequestThrottleService){}
 @Get("doctor/:doctorRef/center-options")
 @Header("Cache-Control","no-store")
 async centerOptions(@Req()request:object,@Param("doctorRef")doctor:string,
  @Query("date")date:unknown){
  await this.ingress.hit(request,"availability");
  return this.availability.centerOptions(doctor,date);
 }
 @Get("center-first")
 @Header("Cache-Control","no-store")
 async centerFirst(@Req()request:object,@Query("doctorRef")doctor:unknown,
  @Query("centerRef")center:unknown,@Query("date")date:unknown){
  await this.ingress.hit(request,"availability");
  return this.availability.dayForCenter(String(doctor??""),String(center??""),date);
 }
 @Get("slot-first")
 @Header("Cache-Control","no-store")
 async slotFirst(@Req()request:object,@Query("doctorRef")doctor:unknown,
  @Query("date")date:unknown,@Query("time")time:unknown){
  await this.ingress.hit(request,"availability");
  return this.availability.slotFirst(String(doctor??""),date,time);
 }
}
