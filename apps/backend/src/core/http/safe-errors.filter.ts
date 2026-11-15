import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

@Catch()
export class SafeErrorsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = typeof request.headers["x-request-id"] === "string"
      && /^[a-zA-Z0-9_-]{8,80}$/.test(request.headers["x-request-id"])
      ? request.headers["x-request-id"] : randomUUID();
    const message = status >= 500 ? "Service temporarily unavailable. Please try again."
      : status === 401 ? "Sign in is required."
      : status === 403 ? "You do not have access to this action."
      : status === 429 ? "Too many attempts. Please try again later."
      : status === 400 ? "Please check your information and try again."
      : status === 409 ? "This was already changed. Refresh and try again."
      : "Request could not be completed.";
    // No passwords, tokens, OTPs, raw contacts, SQL exceptions or provider payloads in response.
    response.status(status).json({ status: "error", message, requestId });
  }
}
