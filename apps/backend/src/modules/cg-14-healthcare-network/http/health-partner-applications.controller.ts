import {BadRequestException,Body,Controller,Get,Header,Headers,Param,Post,Query,Req} from "@nestjs/common";
import {HealthPartnerApplicationsService} from "../application/health-partner-applications.service";
import {HealthPublicRequestThrottleService} from "../application/health-public-request-throttle.service";

/** Anonymous application intake is NOT the authenticated provider registration
 * command, which remains original CG14 Foundation staff-only. */
@Controller("api/v1/public/health-network")
export class HealthPublicPartnerApplicationsController{
 constructor(private readonly applications:HealthPartnerApplicationsService,
  private readonly throttle:HealthPublicRequestThrottleService){}
 @Post("partner-applications")
 @Header("Cache-Control","no-store")
 async submit(@Req()request:object,@Body()body:unknown){
  await this.throttle.hit(request,"partnerApply");
  return this.applications.apply(body);
 }
 @Post("partner-applications/status")
 @Header("Cache-Control","no-store")
 async status(@Req()request:object,@Body()body:unknown){
  await this.throttle.hit(request,"partnerStatus");
  return this.applications.status(body);
 }
}

@Controller("api/v1/health-network")
export class HealthPartnerApplicationsController{
 constructor(private readonly applications:HealthPartnerApplicationsService){}
 @Get("partner-applications")
 @Header("Cache-Control","no-store")
 list(@Headers("authorization")bearer:string,@Query("status")status?:string,
  @Query("offset")offset?:string){
  if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field:"offset"});
  return this.applications.list(bearer,status??"ALL",Number(offset??"0"));
 }
 @Post("partner-applications/:applicationRef/review")
 @Header("Cache-Control","no-store")
 decide(@Headers("authorization")bearer:string,
  @Param("applicationRef")applicationRef:string,@Body()body:unknown){
  return this.applications.decide(bearer,applicationRef,body);
 }
 @Post("partner-applications/:applicationRef/link-original")
 @Header("Cache-Control","no-store")
 linkOriginal(@Headers("authorization")bearer:string,
  @Param("applicationRef")applicationRef:string,@Body()body:unknown){
  return this.applications.linkOriginal(bearer,applicationRef,body);
 }
}
