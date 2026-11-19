import {Body,Controller,Get,Header,Headers,Param,Post,Put,Query} from "@nestjs/common";
import {DoctorScheduleService} from "../application/doctor-schedule.service";

/** All H07 private endpoints are guarded by current CG01 actions and CG14
 * original provider/center/doctor/affiliation and current center membership.
 * No public availability/booking route is synthesized by US001. */
@Controller("api/v1/appointments/schedules")
export class DoctorScheduleController{
 constructor(private readonly schedule:DoctorScheduleService){}
 @Get("admin")
 @Header("Cache-Control","private, no-store")
 admin(@Headers("authorization")token:string,@Query("centerRef")center?:string,
  @Query("stateRef")state?:string,@Query("districtRef")district?:string,
  @Query("blockRef")block?:string){
  return this.schedule.roster(token,"foundation",center,
   {stateRef:state,districtRef:district,blockRef:block});
 }
 @Get("admin/:associationRef")
 @Header("Cache-Control","private, no-store")
 adminDetail(@Headers("authorization")token:string,@Param("associationRef")assoc:string){
  return this.schedule.detail(token,"foundation",assoc);
 }
 @Put("admin/:associationRef")
 adminSave(@Headers("authorization")token:string,@Param("associationRef")assoc:string,
  @Body()body:unknown){
  return this.schedule.save(token,"foundation",assoc,body);
 }
 @Post("admin/:associationRef/exceptions")
 adminException(@Headers("authorization")token:string,@Param("associationRef")assoc:string,
  @Body()body:unknown){
  return this.schedule.exception(token,"foundation",assoc,body);
 }
 @Get("leave/ready")
 @Header("Cache-Control","private, no-store")
 readyLeaves(@Headers("authorization")token:string){
  return this.schedule.readyLeaves(token);
 }
 @Post("leave/:caseRef/apply")
 applyLeave(@Headers("authorization")token:string,@Param("caseRef")caseRef:string,
  @Body()body:unknown){return this.schedule.applyLeave(token,caseRef,body);}
 @Post("admin/:associationRef/exceptions/:exceptionRef/cancel")
 adminCancel(@Headers("authorization")token:string,
  @Param("associationRef")assoc:string,@Param("exceptionRef")exceptionRef:string,
  @Body()body:unknown){
  return this.schedule.cancelException(token,"foundation",assoc,exceptionRef,body);
 }
 @Post("my-centers/:centerRef/:associationRef/exceptions/:exceptionRef/cancel")
 centerCancel(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("associationRef")assoc:string,
  @Param("exceptionRef")exceptionRef:string,@Body()body:unknown){
  return this.schedule.cancelException(token,"center",assoc,exceptionRef,body,center);
 }
 @Get("my-centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 center(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.schedule.roster(token,"center",center);
 }
 @Get("my-centers/:centerRef/:associationRef")
 @Header("Cache-Control","private, no-store")
 centerDetail(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("associationRef")assoc:string){
  return this.schedule.detail(token,"center",assoc,center);
 }
 @Put("my-centers/:centerRef/:associationRef")
 centerSave(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("associationRef")assoc:string,@Body()body:unknown){
  return this.schedule.save(token,"center",assoc,body,center);
 }
 @Post("my-centers/:centerRef/:associationRef/exceptions")
 centerException(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("associationRef")assoc:string,@Body()body:unknown){
  return this.schedule.exception(token,"center",assoc,body,center);
 }
}
