import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { SessionService } from "../application/session.service";
import { SessionGuard, type AuthenticatedRequest } from "./session.guard";
import { randomUUID } from "node:crypto";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";

type SignInBody = { identifier?: unknown; password?: unknown; deviceLabel?: unknown };

@Controller("api/identity")
export class SessionController {
  constructor(@Inject(SessionService) private readonly service: SessionService) {}

  @Post("login")
  @HttpCode(200)
  async signIn(@Body() body: SignInBody, @Req() request: CareGangaRequest) {
    const identifier=typeof body?.identifier==="string"?body.identifier.trim():"";
    if(!identifier)
      throw new BadRequestException({code:"IDENTITY_IDENTIFIER_REQUIRED",field:"identifier"});
    if(identifier.length>254||!(/^[6-9][0-9]{9}$/.test(identifier)||
       /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)))
      throw new BadRequestException({code:"IDENTITY_IDENTIFIER_INVALID",field:"identifier"});
    if(typeof body.password!=="string"||body.password.length===0)
      throw new BadRequestException({code:"IDENTITY_PASSWORD_REQUIRED",field:"password"});
    if(Buffer.byteLength(body.password,"utf8")>1024)
      throw new BadRequestException({code:"IDENTITY_PASSWORD_TOO_LONG",field:"password"});
    if(body.deviceLabel!==undefined&&
      (typeof body.deviceLabel!=="string"||body.deviceLabel.length>60))
      throw new BadRequestException({code:"IDENTITY_DEVICE_INVALID"});
    return this.service.signIn({
      identifier,password:body.password,
      remoteAddress:request.ip ?? "unknown", deviceLabel:typeof body.deviceLabel === "string" ? body.deviceLabel : "Unknown device",
      correlationRef:request.cgRequestId??randomUUID()
    });
  }

  @Get("me")
  @UseGuards(SessionGuard)
  async me(@Req() req: AuthenticatedRequest) {
    const actor = req.cgActor!;
    return { displayName:actor.displayName,roleName:actor.roleName,scope:"Foundation" };
  }

  @Post("password/change")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  async changePassword(@Headers("authorization") bearer:string,
    @Body() body:{currentPassword?:unknown;newPassword?:unknown},
    @Req() request:CareGangaRequest){
    if(!body||typeof body.currentPassword!=="string"||
      body.currentPassword.length===0||Buffer.byteLength(body.currentPassword,"utf8")>1024)
      throw new BadRequestException({code:"IDENTITY_CURRENT_PASSWORD_REQUIRED",field:"currentPassword"});
    if(typeof body.newPassword!=="string"||body.newPassword.length<8)
      throw new BadRequestException({code:"IDENTITY_NEW_PASSWORD_TOO_SHORT",field:"newPassword"});
    if(Buffer.byteLength(body.newPassword,"utf8")>1024)
      throw new BadRequestException({code:"IDENTITY_PASSWORD_TOO_LONG",field:"newPassword"});
    return this.service.changePassword(bearer,body.currentPassword,body.newPassword,
      request.cgRequestId??randomUUID());
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Headers("authorization") bearer: string) {
    await this.service.signOut(bearer);
    return { signedOut:true };
  }

  // One-time root provisioning is deliberately an offline operator-only action.
}
