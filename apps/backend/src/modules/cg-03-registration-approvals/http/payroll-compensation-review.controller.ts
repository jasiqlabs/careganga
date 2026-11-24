import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {PayrollCompensationReviewService} from "../application/payroll-compensation-review.service";
@Controller("api/v1/payroll")
export class PayrollCompensationReviewController{
 constructor(private readonly review:PayrollCompensationReviewService){}
 @Post("sources/:kind/:ref/submit") @Header("Cache-Control","private, no-store") submit(@Headers("authorization")token:string,@Param("kind")kind:string,@Param("ref")ref:string,@Body()raw:unknown){return this.review.submit(token,kind,ref,raw);}
 @Get("review-cases") @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string){return this.review.list(token);}
 @Get("review-cases/:ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.review.detail(token,ref);}
 @Post("review-cases/:ref/decide") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.review.decide(token,ref,raw);}
}
