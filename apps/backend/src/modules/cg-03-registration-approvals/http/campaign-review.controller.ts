import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {CampaignReviewService} from "../application/campaign-review.service";
/** One original CG03 campaign-launch process, cases and protected decisions. */
@Controller("api/v1/campaign-reviews")
export class CampaignReviewController{
 constructor(private readonly service:CampaignReviewService){}
 @Get() inbox(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){
  return this.service.inbox(token,query);
 }
 @Get("policy") policy(@Headers("authorization")token:string){return this.service.policy(token);}
 @Post("policy") configure(@Headers("authorization")token:string,@Body()body:unknown){
  return this.service.configure(token,body);
 }
 @Get(":ref") detail(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.service.detail(token,ref);
 }
 @Post(":ref/decide") decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.service.decide(token,ref,body);
 }
}
@Controller("api/v1/campaigns")
export class CampaignSubmissionController{
 constructor(private readonly service:CampaignReviewService){}
 @Post(":ref/submit") submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.service.submit(token,ref,body);
 }
 @Get(":ref/review-history") history(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.service.campaignHistory(token,ref);
 }
}
