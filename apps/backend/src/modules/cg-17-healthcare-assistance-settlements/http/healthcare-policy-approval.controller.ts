import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthcarePolicyApprovalService}
 from "../application/healthcare-policy-approval.service";
/** Independent protected CG03 reviewer; policy owner finalizes separately. */
@Controller("api/v1/approvals/healthcare-assistance")
export class HealthcarePolicyApprovalController{
 constructor(private readonly review:HealthcarePolicyApprovalService){}
 @Get("cases")
 inbox(@Headers("authorization")token:string){return this.review.inbox(token);}
 @Get("cases/:caseRef")
 detail(@Headers("authorization")token:string,@Param("caseRef")ref:string){
  return this.review.detail(token,ref);
 }
 @Post("cases/:caseRef/decision")
 decide(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.review.decide(token,ref,body);}
}
