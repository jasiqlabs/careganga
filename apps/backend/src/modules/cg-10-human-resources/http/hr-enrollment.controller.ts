import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {HrEnrollmentService} from "../application/hr-enrollment.service";

/** No public HR information route: current Foundation session only. */
@Controller("api/hr")
export class HrEnrollmentController{
 constructor(private readonly hr:HrEnrollmentService){}
 @Get("me")
 me(@Headers("authorization")token:string){return this.hr.myProfile(token);}
 @Get("my-pending-link")
 pendingLink(@Headers("authorization")token:string){return this.hr.myPendingLink(token);}
 @Post("my-link/accept")
 accept(@Headers("authorization")token:string,@Body()body:unknown){
  return this.hr.acceptMyApprovedLink(token,body);
 }
 @Get("employees")
 employees(@Headers("authorization")token:string,@Query("offset")offset?:string,
   @Query("branch")branch?:string){return this.hr.employeeDirectory(token,offset,branch);}
 @Get("branch-options")
 branches(@Headers("authorization")token:string){return this.hr.branchOptions(token);}
 @Get("departments")
 departments(@Headers("authorization")token:string,@Query("branch")branch:string){
  return this.hr.departmentOptions(token,branch);
 }
 @Get("managers")
 managers(@Headers("authorization")token:string,@Query("branch")branch:string){
  return this.hr.managerOptions(token,branch);
 }
 @Get("account-options")
 accounts(@Headers("authorization")token:string,@Query("search")search?:string){
  return this.hr.accountOptions(token,search??"");
 }
 @Get("applications")
 list(@Headers("authorization")token:string,@Query("offset")offset?:string,
  @Query("branch")branch?:string){return this.hr.list(token,offset,branch);}
 @Post("applications")
 create(@Headers("authorization")token:string,@Body()body:unknown){
  return this.hr.create(token,body);
 }
 @Get("applications/:applicationRef/review")
 review(@Headers("authorization")token:string,@Param("applicationRef")ref:string){
  return this.hr.reviewStatus(token,ref);
 }
 @Post("applications/:applicationRef/submit")
 submit(@Headers("authorization")token:string,@Param("applicationRef")ref:string,
  @Body()body:unknown){return this.hr.submit(token,ref,body);}
 @Post("applications/:applicationRef/finalize")
 finalize(@Headers("authorization")token:string,@Param("applicationRef")ref:string,
  @Body()body:unknown){return this.hr.finalize(token,ref,body);}
 @Get("applications/:applicationRef")
 detail(@Headers("authorization")token:string,@Param("applicationRef")ref:string){
  return this.hr.detail(token,ref);
 }
 @Patch("applications/:applicationRef")
 update(@Headers("authorization")token:string,@Param("applicationRef")ref:string,
  @Body()body:unknown){return this.hr.update(token,ref,body);}
}
