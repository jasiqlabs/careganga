import {BadRequestException,Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HealthVerificationApprovalService} from "../application/health-verification-approval.service";
@Controller("api/health/reviews")
export class HealthVerificationApprovalController{
 constructor(private readonly reviews:HealthVerificationApprovalService){}
 @Get()
 list(@Headers("authorization")auth:string,@Query("offset")offset?:string){
  if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  return this.reviews.inbox(auth,Number(offset??0));
 }
 @Get(":caseRef")
 detail(@Headers("authorization")auth:string,@Param("caseRef")ref:string){
  return this.reviews.detail(auth,ref);
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")auth:string,@Param("caseRef")ref:string,
  @Body()body:unknown){
  return this.reviews.decide(auth,ref,body);
 }
}
