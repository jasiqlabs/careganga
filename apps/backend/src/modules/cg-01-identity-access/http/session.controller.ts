import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { SessionService } from "../application/session.service";
import { SessionGuard, type AuthenticatedRequest } from "./session.guard";
import { randomUUID } from "node:crypto";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";

type SignInBody = { email?: unknown; password?: unknown; totp?: unknown; deviceLabel?: unknown };

@Controller("api/identity")
export class SessionController {
  constructor(private readonly service: SessionService) {}

  @Post("login")
  @HttpCode(200)
  async signIn(@Body() body: SignInBody, @Req() request: CareGangaRequest) {
    if (!body || typeof body.email !== "string" || body.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
      || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 1024
      || typeof body.totp !== "string" || !/^\d{6}$/.test(body.totp)
      || (body.deviceLabel !== undefined && (typeof body.deviceLabel !== "string" || body.deviceLabel.length > 60)))
      throw new BadRequestException();
    return this.service.signIn({
      email:body.email,password:body.password,totp:body.totp,
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

  @Post("logout")
  @HttpCode(200)
  async logout(@Headers("authorization") bearer: string) {
    await this.service.signOut(bearer);
    return { signedOut:true };
  }

  // One-time root provisioning is deliberately an offline operator-only action.
}
