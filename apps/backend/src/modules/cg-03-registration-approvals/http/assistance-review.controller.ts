import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {AssistanceReviewService} from "../application/assistance-review.service";
@Controller("api/v1/assistance")
export class AssistanceReviewController{
 constructor(private readonly review:AssistanceReviewService){}
 @Get(":ref/review") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.review.detail(token,ref);}
 @Post(":ref/submit") @Header("Cache-Control","private, no-store") submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.review.submit(token,ref,raw);}
 @Post("review-cases/:ref/decide") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.review.decide(token,ref,raw);}
}
