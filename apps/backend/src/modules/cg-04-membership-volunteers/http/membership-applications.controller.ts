import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {MembershipApprovalService} from "../../cg-03-registration-approvals/application/membership-approval.service";
import {MembershipApplicationsService} from "../application/membership-applications.service";
@Controller("api/v1/membership/applications")
export class MembershipApplicationsController{
 constructor(private readonly applications:MembershipApplicationsService,private readonly reviews:MembershipApprovalService){}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string){return this.applications.list(token);}
 @Get("options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.applications.options(token,q);}
 @Get(":ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.applications.detail(token,ref);}
 @Post() @Header("Cache-Control","private, no-store") create(@Headers("authorization")token:string,@Body()body:unknown){return this.applications.save(token,body);}
 @Patch(":ref") @Header("Cache-Control","private, no-store") edit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.applications.save(token,body,ref);}
 @Post(":ref/submit") @Header("Cache-Control","private, no-store") submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.reviews.submit(token,ref,body);}
 @Post(":ref/cancel") @Header("Cache-Control","private, no-store") cancel(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.applications.cancel(token,ref,body);}
}
