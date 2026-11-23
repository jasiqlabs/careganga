import {Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile} from "@nestjs/common";
import {CsrFundingReviewService} from "../application/csr-funding-review.service";
@Controller("api/v1/csr-funding-reviews")
@Header("Cache-Control","private, no-store")
export class CsrFundingReviewController{
 constructor(private readonly review:CsrFundingReviewService){}
 @Get()
 inbox(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){
  return this.review.inbox(token,q);
 }
 @Get("policy")
 policy(@Headers("authorization")token:string){return this.review.policy(token);}
 @Post("policy")
 configure(@Headers("authorization")token:string,@Body()body:unknown){
  return this.review.configure(token,body);
 }
 @Get(":ref")
 detail(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.review.detail(token,ref);
 }
 @Get(":ref/agreement")
 @Header("X-Content-Type-Options","nosniff")
 async agreement(@Headers("authorization")token:string,@Param("ref")ref:string){
  const proof=await this.review.verifiedAgreement(token,ref);
  return new StreamableFile(proof.bytes,{
   type:proof.mime,disposition:'attachment; filename="CareGanga-private-funding-review-proof"'});
 }
 @Post(":ref/decide")
 decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.review.decide(token,ref,body);
 }
}
@Controller("api/v1/csr/funding-proposals")
@Header("Cache-Control","private, no-store")
export class CsrFundingSubmissionController{
 constructor(private readonly review:CsrFundingReviewService){}
 @Post(":ref/submit")
 submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.review.submit(token,ref,body);
 }
 @Get(":ref/review-history")
 history(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.review.history(token,ref);
 }
}
