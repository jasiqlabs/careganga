import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import type { CareGangaRequest } from "../observability/request-correlation";

@Catch()
export class SafeErrorsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<CareGangaRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.cgRequestId??randomUUID();
    const message = status >= 500 ? "Service temporarily unavailable. Please try again."
      : status === 401 ? "Sign in is required."
      : status === 403 ? "You do not have access to this action."
      : status === 429 ? "Too many attempts. Please try again later."
      : status === 400 ? "Please check your information and try again."
      : status === 409 ? "This was already changed. Refresh and try again."
      : "Request could not be completed.";
    // Only these reviewed application error codes may cross the API boundary.
    const safeCodes:Record<string,string>={
      DUPLICATE_ROLE:"A role with this name already exists. Choose another name.",
      STALE_ROLE:"This role changed elsewhere. Refresh before saving.",
      ROLE_RETIRED:"This role was already retired.",
      ROLE_ASSIGNED:"Reassign accounts using this role before retiring it.",
      REPLAY_CONFLICT:"This request reference has already been used. Refresh before retrying.",
      DUPLICATE_ACCOUNT_OR_ASSIGNMENT:"This account or assignment already exists.",
      STALE_ACCOUNT:"This staff account changed. Refresh before saving.",
      ROLE_ALREADY_ASSIGNED:"That role is already assigned to the account.",
      ROLE_ALREADY_REVOKED:"The account's role was already removed.",
      ACCOUNT_ALREADY_IN_STATUS:"The account already has that status.",
      POLICY_STALE:"Security policy changed elsewhere. Refresh before saving.",
      POLICY_REPLAY_CONFLICT:"This policy request reference was already used. Refresh before retrying."
    };
    const payload=error instanceof HttpException?error.getResponse():null;
    const rawCode=payload&&typeof payload==="object"&&"code" in payload?payload.code:null;
    const code=status===409&&typeof rawCode==="string"&&Object.hasOwn(safeCodes,rawCode)
      ?rawCode:null;
    // No passwords, tokens, OTPs, raw contacts, SQL exceptions or provider payloads in response.
    response.status(status).json({status:"error",message:code?safeCodes[code]:message,
      ...(code?{code}:{}),requestId});
  }
}
