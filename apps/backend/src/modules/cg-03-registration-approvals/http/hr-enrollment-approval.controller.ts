import {Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile} from "@nestjs/common";
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
 @Get(":caseRef/proof/:classification")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async proof(@Headers("authorization")token:string,
  @Param("caseRef")ref:string,@Param("classification")kind:string){
  const file=await this.review.originalProof(token,ref,kind);
  return new StreamableFile(file.data,{type:file.mime,
   disposition:'attachment; filename="Private-employee-review-proof"'});
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.review.decide(token,ref,body);}
}
