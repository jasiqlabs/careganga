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
    if (!body || typeof body.identifier !== "string" || body.identifier.length > 254
      || !(/^[6-9][0-9]{9}$/.test(body.identifier.trim()) ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.identifier.trim()))
      || typeof body.password !== "string" || body.password.length < 1 || Buffer.byteLength(body.password,"utf8") > 1024
      || (body.deviceLabel !== undefined && (typeof body.deviceLabel !== "string" || body.deviceLabel.length > 60)))
      throw new BadRequestException();
    return this.service.signIn({
      identifier:body.identifier,password:body.password,
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
      typeof body.newPassword!=="string"||body.newPassword.length<8||
      Buffer.byteLength(body.currentPassword,"utf8")>1024||
      Buffer.byteLength(body.newPassword,"utf8")>1024)
      throw new BadRequestException("Check current and new password");
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
