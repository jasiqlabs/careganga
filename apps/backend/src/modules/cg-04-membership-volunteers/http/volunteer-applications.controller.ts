import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {VolunteerApplicationsService} from "../application/volunteer-applications.service";
import {VolunteerApprovalService} from "../../cg-03-registration-approvals/application/volunteer-approval.service";
import {VolunteerActivationService} from "../application/volunteer-activation.service";
@Controller("api/v1/volunteers/applications")
export class VolunteerApplicationsController{
 constructor(private readonly apps:VolunteerApplicationsService,private readonly reviews:VolunteerApprovalService,private readonly activation:VolunteerActivationService){}
 @Get("options") @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")token:string,@Query("stateRef")stateRef?:string,@Query("branchRef")branchRef?:string){
  return this.apps.options(token,{stateRef:stateRef??"",branchRef:branchRef??""});
 }
 @Get() @Header("Cache-Control","private, no-store")
 list(@Headers("authorization")token:string){return this.apps.list(token);}
 @Get(":ref") @Header("Cache-Control","private, no-store")
 detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.apps.detail(token,ref);}
 @Post() @Header("Cache-Control","private, no-store")
 create(@Headers("authorization")token:string,@Body()body:unknown){return this.apps.save(token,body);}
 @Patch(":ref") @Header("Cache-Control","private, no-store")
 update(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.apps.save(token,body,ref);}
 @Post(":ref/submit") @Header("Cache-Control","private, no-store")
 submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.reviews.submit(token,ref,body);}
 @Post(":ref/activate") @Header("Cache-Control","private, no-store")
 activate(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.activation.activate(token,ref,body);}
 @Post(":ref/cancel") @Header("Cache-Control","private, no-store")
 cancel(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.apps.cancel(token,ref,body);}
}
