import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {DoctorLeaveApprovalService} from "../application/doctor-leave-approval.service";
/** The one protected original CG03 leave reviewer, not an editable CG15 decision. */
@Controller("api/health/doctor-leave-reviews")
export class DoctorLeaveApprovalController{
 constructor(private readonly approval:DoctorLeaveApprovalService){}
 @Get()
 @Header("Cache-Control","private, no-store")
 inbox(@Headers("authorization")token:string){return this.approval.inbox(token);}
 @Get(":caseRef")
 @Header("Cache-Control","private, no-store")
 detail(@Headers("authorization")token:string,@Param("caseRef")ref:string){
  return this.approval.detail(token,ref);
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.approval.decide(token,ref,body);}
}
