import {Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile} from "@nestjs/common";
import {VolunteerApprovalService} from "../application/volunteer-approval.service";
@Controller("api/v1/volunteers/reviews")
export class VolunteerApprovalController{
 constructor(private readonly reviews:VolunteerApprovalService){}
 @Get("policy") @Header("Cache-Control","private, no-store") policy(@Headers("authorization")token:string){return this.reviews.policy(token);}
 @Post("policy") @Header("Cache-Control","private, no-store") configure(@Headers("authorization")token:string,@Body()body:unknown){return this.reviews.configure(token,body);}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.reviews.inbox(token,q);}
 @Get(":ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.reviews.detail(token,ref);}
 @Get(":ref/files/:file/download") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async proof(@Headers("authorization")token:string,@Param("ref")ref:string,@Param("file")file:string){const f=await this.reviews.proof(token,ref,file);return new StreamableFile(f.bytes,{type:f.mime,disposition:'attachment; filename="CareGanga-volunteer-proof"'});}
 @Post(":ref/decide") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.reviews.decide(token,ref,body);}
}
