import { BadRequestException, Body, Controller, HttpCode, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import type { Request } from "express";
import { RecoveryService } from "../application/recovery.service";

@Controller("api/identity/recovery")
export class RecoveryController{
  constructor(private readonly service:RecoveryService){}
  @Post("request")
  @HttpCode(202)
  async request(@Body() body:{email?:unknown;requestKey?:unknown},@Req() req:Request){
    if(!body||typeof body.email!=="string" || body.email.length>254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
      ||typeof body.requestKey!=="string"|| !/^[0-9a-f-]{36}$/i.test(body.requestKey))
      throw new BadRequestException();
    const outcome=await this.service.requestRecovery(body.email,body.requestKey,req.ip??"unknown");
    if(outcome.status==="UNAVAILABLE")throw new ServiceUnavailableException("Credential recovery is unavailable");
    return outcome;
  }
  @Post("confirm")
  @HttpCode(200)
  async confirm(@Body() body:{email?:unknown;token?:unknown;password?:unknown;totp?:unknown},@Req() req:Request){
    if(!body||typeof body.email!=="string"||body.email.length>254||
      typeof body.token!=="string"||!/^[a-zA-Z0-9_-]{40,100}$/.test(body.token)||
      typeof body.password!=="string"||body.password.length<14||Buffer.byteLength(body.password)>1024||
      typeof body.totp!=="string"|| !/^\d{6}$/.test(body.totp))
      throw new BadRequestException();
    return this.service.confirmRecovery({
      email:body.email,token:body.token,password:body.password,totp:body.totp
    },req.ip??"unknown");
  }
}
