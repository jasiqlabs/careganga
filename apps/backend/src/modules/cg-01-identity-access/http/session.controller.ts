import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { SessionService } from "../application/session.service";

type SignInBody = { email?: unknown; password?: unknown; totp?: unknown; deviceLabel?: unknown };

@Controller("api/identity")
export class SessionController {
  constructor(private readonly service: SessionService) {}

  @Post("login")
  @HttpCode(200)
  async signIn(@Body() body: SignInBody, @Req() request: Request) {
    if (!body || typeof body.email !== "string" || body.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
      || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 1024
      || typeof body.totp !== "string" || !/^\d{6}$/.test(body.totp)
      || (body.deviceLabel !== undefined && (typeof body.deviceLabel !== "string" || body.deviceLabel.length > 60)))
      throw new BadRequestException();
    return this.service.signIn({
      email:body.email,password:body.password,totp:body.totp,
      remoteAddress:request.ip ?? "unknown", deviceLabel:typeof body.deviceLabel === "string" ? body.deviceLabel : "Unknown device"
    });
  }

  @Get("me")
  async me(@Headers("authorization") bearer: string) {
    const actor = await this.service.verifySession(bearer);
    return { displayName:actor.displayName,roleName:actor.roleName,scope:"Foundation" };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Headers("authorization") bearer: string) {
    await this.service.signOut(bearer);
    return { signedOut:true };
  }

  // Recovery remains unavailable until a real, configured delivery provider exists.
  // No fake "code sent" response, no publicly exposed one-time root bootstrap API.
}
