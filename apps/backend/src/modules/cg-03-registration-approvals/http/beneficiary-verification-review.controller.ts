import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {BeneficiaryVerificationReviewService} from "../application/beneficiary-verification-review.service";

/** Original CG03 protected-case routes under the existing CG06 beneficiary namespace. */
@Controller("api/v1/beneficiaries")
export class BeneficiaryVerificationReviewController{
 constructor(private readonly verification:BeneficiaryVerificationReviewService){}
 @Get(":ref/verification-review") @Header("Cache-Control","private, no-store")
 detail(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.verification.detail(token,ref);
 }
 @Post(":ref/submit-verification") @Header("Cache-Control","private, no-store")
 submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.verification.submit(token,ref,body);
 }
 @Post("verification-cases/:ref/decide") @Header("Cache-Control","private, no-store")
 decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.verification.decide(token,ref,body);
 }
}
