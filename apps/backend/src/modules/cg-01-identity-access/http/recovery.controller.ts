import { BadRequestException, Body, Controller, HttpCode, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";
import { randomUUID } from "node:crypto";
import { RecoveryService } from "../application/recovery.service";

@Controller("api/identity/recovery")
export class RecoveryController {
  constructor(private readonly service: RecoveryService) {}

  @Post("request")
  @HttpCode(202)
  async request(@Body() body: { email?: unknown; phone?: unknown; identifier?: unknown; channel?: unknown; requestKey?: unknown }, @Req() req: CareGangaRequest) {
    if (!body || typeof body.requestKey !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestKey))
      throw new BadRequestException("Request key is required");

    const channel = body.channel === "SMS" ? "SMS" : "EMAIL";
    const identifier = typeof body.identifier === "string" ? body.identifier
      : typeof body.email === "string" ? body.email
      : typeof body.phone === "string" ? body.phone
      : "";

    if (!identifier || identifier.length > 254)
      throw new BadRequestException("Valid contact identifier is required");

    const outcome = await this.service.requestRecovery({
      identifier,
      channel,
      requestKey: body.requestKey
    }, req.ip ?? "unknown");

    if (outcome.status === "UNAVAILABLE") throw new ServiceUnavailableException(outcome.message);
    return outcome;
  }

  @Post("confirm")
  @HttpCode(200)
  async confirm(@Body() body: { email?: unknown; phone?: unknown; identifier?: unknown; token?: unknown; password?: unknown; totp?: unknown }, @Req() req: CareGangaRequest) {
    const identifier = typeof body.identifier === "string" ? body.identifier
      : typeof body.email === "string" ? body.email
      : typeof body.phone === "string" ? body.phone
      : "";

    if (!body || !identifier || identifier.length > 254 ||
      typeof body.token !== "string" || !/^[a-zA-Z0-9_-]{40,100}$/.test(body.token) ||
      typeof body.password !== "string" || body.password.length < 14 || Buffer.byteLength(body.password) > 1024 ||
      typeof body.totp !== "string" || !/^\d{6}$/.test(body.totp))
      throw new BadRequestException();

    return this.service.confirmRecovery({
      identifier,
      token: body.token,
      password: body.password,
      totp: body.totp
    }, req.ip ?? "unknown", req.cgRequestId ?? randomUUID());
  }
}
