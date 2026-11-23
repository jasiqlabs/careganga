import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {CsrPartnerReviewService} from "../application/csr-partner-review.service";
@Controller("api/v1/csr-partner-reviews")
@Header("Cache-Control","private, no-store")
export class CsrPartnerReviewController {
 constructor(private readonly review:CsrPartnerReviewService){}
 @Get() inbox(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.review.inbox(token,q);}
 @Get("policy") policy(@Headers("authorization")token:string){return this.review.policy(token);}
 @Post("policy") configure(@Headers("authorization")token:string,@Body()data:unknown){return this.review.configure(token,data);}
 @Get(":ref") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.review.detail(token,ref);}
 @Post(":ref/decide") decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()data:unknown){return this.review.decide(token,ref,data);}
}
@Controller("api/v1/csr/partners")
@Header("Cache-Control","private, no-store")
export class CsrPartnerSubmissionController {
 constructor(private readonly review:CsrPartnerReviewService){}
 @Post(":ref/submit") submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()data:unknown){return this.review.submit(token,ref,data);}
 @Get(":ref/review-history") history(@Headers("authorization")token:string,@Param("ref")ref:string){return this.review.partnerHistory(token,ref);}
}
