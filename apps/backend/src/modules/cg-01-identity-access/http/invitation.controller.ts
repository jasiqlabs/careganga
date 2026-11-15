import { BadRequestException, Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";
import { InvitationEnrollmentService } from "../application/invitation-enrollment.service";
@Controller("api/identity")
export class InvitationController {
  constructor(private readonly enrollment:InvitationEnrollmentService){}
  @Post("invitation/enroll")
  @HttpCode(200)
  begin(@Body() body:{email?:unknown;token?:unknown},@Req() req:CareGangaRequest){
    if(!body||typeof body!=="object")throw new BadRequestException();
    return this.enrollment.begin(body,req.ip??"unknown");
  }
  @Post("invitation/confirm")
  @HttpCode(200)
  confirm(@Body() body:{email?:unknown;token?:unknown;password?:unknown;totp?:unknown},
      @Req() req:CareGangaRequest){
    if(!body||typeof body!=="object")throw new BadRequestException();
    return this.enrollment.confirm(body,req.ip??"unknown",req.cgRequestId??randomUUID());
  }
}
