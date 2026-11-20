import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthCenterContentApprovalService} from "../application/health-center-content-approval.service";
@Controller("api/health/content-reviews")
export class HealthCenterContentApprovalController{
 constructor(private readonly reviews:HealthCenterContentApprovalService){}
 @Get()
 inbox(@Headers("authorization")bearer:string){return this.reviews.inbox(bearer);}
 @Get(":caseRef")
 detail(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
  return this.reviews.detail(bearer,ref);
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")bearer:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.reviews.decide(bearer,ref,body);}
}
