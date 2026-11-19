import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {PatientAdminOverviewService} from "../application/patient-admin-overview.service";
@Controller("api/v1/appointments/admin/patients")
export class PatientAdminOverviewController{
 constructor(private readonly admin:PatientAdminOverviewService){}
 @Get("duplicate-reviews")
 @Header("Cache-Control","private, no-store")
 duplicateReviews(@Headers("authorization")bearer:string){
  return this.admin.duplicateReviews(bearer);
 }
 @Post("duplicate-reviews")
 @Header("Cache-Control","private, no-store")
 proposeDuplicate(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.admin.proposeDuplicate(bearer,body);
 }
 @Get("duplicate-reviews/:reviewRef/evidence")
 @Header("Cache-Control","private, no-store")
 duplicateEvidence(@Headers("authorization")bearer:string,
  @Param("reviewRef")ref:string){
  return this.admin.duplicateReviewEvidence(bearer,ref);
 }
 @Post("duplicate-reviews/:reviewRef/decision")
 @Header("Cache-Control","private, no-store")
 decideDuplicate(@Headers("authorization")bearer:string,
  @Param("reviewRef")reviewRef:string,@Body()body:unknown){
  return this.admin.decideDuplicate(bearer,reviewRef,body);
 }
 @Post(":bookingRef/print-authorization")
 @Header("Cache-Control","private, no-store")
 authorizePrint(@Headers("authorization")bearer:string,
  @Param("bookingRef")id:string,@Body()body:unknown){
  return this.admin.authorizePrint(bearer,id,body);
 }
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
  @Query("districtRef")districtRef?:string,@Query("centerType")centerType?:string,
  @Query("search")search?:string,@Query("centerSearch")centerSearch?:string,
  @Query("fromDay")fromDay?:string,@Query("untilDay")untilDay?:string){
  return this.admin.overview(bearer,{centerRef,status,after,limit,day,
   stateRef,districtRef,centerType,search,centerSearch,fromDay,untilDay});
 }
}
