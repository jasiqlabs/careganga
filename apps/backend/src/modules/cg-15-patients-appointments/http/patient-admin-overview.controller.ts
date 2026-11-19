import {Controller,Get,Header,Headers,Param,Query} from "@nestjs/common";
import {PatientAdminOverviewService} from "../application/patient-admin-overview.service";
@Controller("api/v1/appointments/admin/patients")
export class PatientAdminOverviewController{
 constructor(private readonly admin:PatientAdminOverviewService){}
 @Get(":bookingRef/history")
 @Header("Cache-Control","private, no-store")
 history(@Headers("authorization")bearer:string,@Param("bookingRef")id:string,
  @Query("before")before?:string){
  return this.admin.bookingHistory(bearer,id,before);
 }
 @Get()
 @Header("Cache-Control","private, no-store")
 overview(@Headers("authorization")bearer:string,
  @Query("centerRef")centerRef?:string,@Query("status")status?:string,
  @Query("after")after?:string,@Query("limit")limit?:string,
  @Query("day")day?:string,@Query("stateRef")stateRef?:string,
  @Query("districtRef")districtRef?:string,@Query("centerType")centerType?:string){
  return this.admin.overview(bearer,{centerRef,status,after,limit,day,
   stateRef,districtRef,centerType});
 }
}
