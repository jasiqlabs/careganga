import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {MembershipApprovalService} from "../application/membership-approval.service";
@Controller("api/v1/membership/reviews")
export class MembershipApprovalController{
 constructor(private readonly reviews:MembershipApprovalService){}
 @Get("policy") @Header("Cache-Control","private, no-store") policy(@Headers("authorization")token:string){return this.reviews.policy(token);}
 @Post("policy") @Header("Cache-Control","private, no-store") configure(@Headers("authorization")token:string,@Body()body:unknown){return this.reviews.configure(token,body);}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.reviews.inbox(token,q);}
 @Get(":ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.reviews.detail(token,ref);}
 @Post(":ref/decide") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.reviews.decide(token,ref,body);}
}
