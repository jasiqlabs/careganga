import { BadRequestException, Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";
import { randomUUID } from "node:crypto";
import { RecoveryService } from "../application/recovery.service";

const identifierValid=(value:unknown):value is string =>
  typeof value==="string" && value.length<=254 && (
    /^[6-9][0-9]{9}$/.test(value.trim()) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );

@Controller("api/identity/recovery")
export class RecoveryController {
  constructor(private readonly service:RecoveryService) {}
  @Post("request")
  @HttpCode(202)
  async request(@Body() body:{identifier?:unknown;channel?:unknown;requestKey?:unknown},
    @Req() req:CareGangaRequest) {
    if(!body||!identifierValid(body.identifier)||
      (body.channel!==undefined&&body.channel!=="email"&&body.channel!=="sms")||
      typeof body.requestKey!=="string"||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestKey))
      throw new BadRequestException("Check recovery information");
    return this.service.requestRecovery(body.identifier,
      body.channel as "email"|"sms"|undefined,body.requestKey,req.ip??"unknown");
  }
  @Post("confirm")
  @HttpCode(200)
  async confirm(@Body() body:{identifier?:unknown;otp?:unknown;newPassword?:unknown},
    @Req() req:CareGangaRequest) {
    if(!body||!identifierValid(body.identifier)||
      typeof body.otp!=="string"|| !/^\d{6}$/.test(body.otp)||
      typeof body.newPassword!=="string"||body.newPassword.length<8||
      Buffer.byteLength(body.newPassword,"utf8")>1024)
      throw new BadRequestException("Check the code and new password");
    return this.service.confirmRecovery({identifier:body.identifier,otp:body.otp,
      newPassword:body.newPassword},req.ip??"unknown",req.cgRequestId??randomUUID());
  }
}
