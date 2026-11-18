import {BadRequestException,Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HealthVerificationApprovalService} from "../application/health-verification-approval.service";
@Controller("api/health/reviews")
export class HealthVerificationApprovalController{
 constructor(private readonly reviews:HealthVerificationApprovalService){}
 @Get()
 list(@Headers("authorization")auth:string,@Query("offset")offset?:string,
  @Query("status")status?:string,@Query("kind")kind?:string,@Query("q")query?:string){
  if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset)||
    !["ALL","SUBMITTED","IN_REVIEW","RETURNED","REJECTED",
      "PENDING_OWNER","OWNER_COMPLETED"].includes(status??"ALL")||
    !["ALL","HEALTH_PROVIDER_VERIFICATION","HEALTH_CENTER_VERIFICATION","HEALTH_DOCTOR_VERIFICATION"].includes(kind??"ALL")||
    (query!==undefined&&(query.length>80||/[\u0000-\u001f\u007f]/.test(query))))
   throw new BadRequestException({code:"HEALTH_REVIEW_INVALID"});
  return this.reviews.inbox(auth,Number(offset??0),status??"ALL",kind??"ALL",query?.trim()??"");
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
