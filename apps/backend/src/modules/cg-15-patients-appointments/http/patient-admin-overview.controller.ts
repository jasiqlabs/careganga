import {Controller,Get,Header,Headers,Query} from "@nestjs/common";
import {PatientAdminOverviewService} from "../application/patient-admin-overview.service";
@Controller("api/v1/appointments/admin/patients")
export class PatientAdminOverviewController{
 constructor(private readonly admin:PatientAdminOverviewService){}
 @Get()
 @Header("Cache-Control","private, no-store")
 overview(@Headers("authorization")bearer:string,
  @Query("centerRef")centerRef?:string,@Query("status")status?:string,
  @Query("after")after?:string,@Query("limit")limit?:string){
  return this.admin.overview(bearer,{centerRef,status,after,limit});
 }
}
