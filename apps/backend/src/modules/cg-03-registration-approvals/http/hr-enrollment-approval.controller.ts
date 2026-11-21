import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HrEnrollmentApprovalService} from "../application/hr-enrollment-approval.service";
@Controller("api/hr/reviews")
export class HrEnrollmentApprovalController{
 constructor(private readonly review:HrEnrollmentApprovalService){}
 @Get()
 inbox(@Headers("authorization")token:string,
  @Query("offset")offset?:string,@Query("status")status?:string){
  return this.review.inbox(token,offset,status);
 }
 @Get(":caseRef")
 detail(@Headers("authorization")token:string,@Param("caseRef")ref:string){
  return this.review.detail(token,ref);
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.review.decide(token,ref,body);}
}
