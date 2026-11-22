import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {FieldVisitReviewService} from "../application/field-visit-review.service";
@Controller("api/v1/field-visit-review")
export class FieldVisitReviewController{
 constructor(private readonly service:FieldVisitReviewService){}
 @Get("policy") @Header("Cache-Control","private, no-store") policy(@Headers("authorization")t:string){return this.service.policy(t);}
 @Post("policy") @Header("Cache-Control","private, no-store") configure(@Headers("authorization")t:string,@Body()v:unknown){return this.service.configure(t,v);}
 @Get("visits/:ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.service.detail(t,r);}
 @Post("visits/:ref/submit") @Header("Cache-Control","private, no-store") submit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.submit(t,r,v);}
 @Post("cases/:ref/decide") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.decide(t,r,v);}
}
