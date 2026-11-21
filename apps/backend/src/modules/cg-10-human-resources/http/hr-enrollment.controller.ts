import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {HrEnrollmentService} from "../application/hr-enrollment.service";

/** No public HR information route: current Foundation session only. */
@Controller("api/hr")
export class HrEnrollmentController{
 constructor(private readonly hr:HrEnrollmentService){}
 @Get("me")
 me(@Headers("authorization")token:string){return this.hr.myProfile(token);}
 @Get("branch-options")
 branches(@Headers("authorization")token:string){return this.hr.branchOptions(token);}
 @Get("departments")
 departments(@Headers("authorization")token:string,@Query("branch")branch:string){
  return this.hr.departmentOptions(token,branch);
 }
 @Get("applications")
 list(@Headers("authorization")token:string,@Query("offset")offset?:string,
  @Query("branch")branch?:string){return this.hr.list(token,offset,branch);}
 @Post("applications")
 create(@Headers("authorization")token:string,@Body()body:unknown){
  return this.hr.create(token,body);
 }
 @Get("applications/:applicationRef")
 detail(@Headers("authorization")token:string,@Param("applicationRef")ref:string){
  return this.hr.detail(token,ref);
 }
 @Patch("applications/:applicationRef")
 update(@Headers("authorization")token:string,@Param("applicationRef")ref:string,
  @Body()body:unknown){return this.hr.update(token,ref,body);}
}
