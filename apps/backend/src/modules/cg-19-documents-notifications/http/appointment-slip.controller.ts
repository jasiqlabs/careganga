import {
 BadRequestException,Body,Controller,Get,Header,Headers,Param,Post,Res,Req
} from "@nestjs/common";
import type {Response} from "express";
import {AppointmentSlipDocumentService} from "../application/appointment-slip-document.service";
import {HealthPublicRequestThrottleService}
 from "../../cg-14-healthcare-network/application/health-public-request-throttle.service";
@Controller("api/v1/appointments/slips")
export class AppointmentSlipController{
 constructor(private readonly slips:AppointmentSlipDocumentService,
  private readonly throttle:HealthPublicRequestThrottleService){}
 @Get("me/:bookingRef/status")
 @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")bearer:string,@Param("bookingRef")ref:string){
  return this.slips.status(bearer,ref);
 }
 @Post("me/:bookingRef/issue")
 @Header("Cache-Control","private, no-store")
 issue(@Headers("authorization")bearer:string,@Param("bookingRef")ref:string,
  @Body()raw:unknown){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).length!==1||!("requestKey" in raw)||
   typeof raw.requestKey!=="string")
   throw new BadRequestException({code:"CG19_SLIP_UNAVAILABLE"});
  return this.slips.issue(bearer,ref,raw.requestKey);
 }
 @Get("me/:bookingRef/file")
 @Header("Cache-Control","private, no-store")
 async file(@Headers("authorization")bearer:string,@Param("bookingRef")ref:string,
  @Res()reply:Response){
  const pdf=await this.slips.download(bearer,ref);
  reply.setHeader("Content-Type","application/pdf");
  reply.setHeader("Content-Disposition","attachment; filename=careganga-consultation.pdf");
  reply.setHeader("Cache-Control","private, no-store");
  reply.status(200).end(pdf);
 }
 @Post("verify")
 @Header("Cache-Control","no-store")
 async verify(@Req()request:object,@Body()raw:unknown){
  await this.throttle.hit(request,"slip");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).length!==1||!("token" in raw))
   throw new BadRequestException({code:"CG19_SLIP_VERIFY_INVALID"});
  return this.slips.verifyPublic(raw.token);
 }
}
