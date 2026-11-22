import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import type {Pool} from "pg";
import {SAFE_MESSAGE_CATALOG} from "./safe-error-copy";
import type { CareGangaRequest } from "../observability/request-correlation";

@Catch()
export class SafeErrorsFilter implements ExceptionFilter {
  private readonly logger=new Logger(SafeErrorsFilter.name);
  private readonly cache=new Map<string,{text:string;expires:number}>();
  constructor(private readonly pool?:Pool){}
  private async editableCopy(code:string):Promise<string>{
    const fallback=SAFE_MESSAGE_CATALOG[code];
    if(!this.pool)return fallback;
    const cached=this.cache.get(code),now=Date.now();
    if(cached&&cached.expires>now)return cached.text;
    let result=fallback;
    try{
      const rows=await this.pool.query<{safe_message:string}>(`
        SELECT safe_message FROM platform_error_message
        WHERE foundation_realm_id=(SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT')
          AND message_key=$1 LIMIT 1`,[code]);
      const candidate=rows.rows[0]?.safe_message;
      if(typeof candidate==="string"&&candidate.length>=16&&candidate.length<=220&&
        !/[<>\r\n]/.test(candidate))result=candidate;
    }catch{/* Missing table/DB outage must preserve approved safe default; never expose SQL. */}
    this.cache.set(code,{text:result,expires:now+45_000});
    return result;
  }
  async catch(error: unknown, host: ArgumentsHost):Promise<void> {
    const request = host.switchToHttp().getRequest<CareGangaRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.cgRequestId??randomUUID();
    const isReadOnly=request.method==="GET"||request.method==="HEAD";
    const message = status >= 500 ? (isReadOnly
      ? "The information is temporarily unavailable. Refresh this page or try again later."
      : "We could not confirm whether your change was saved. Check its status before submitting again.")
      : status === 401 ? "Sign in is required."
      : status === 403 ? "You do not have access to this action."
      : status === 429 ? "Too many attempts. Please try again later."
      : status === 400 ? "Please check your information and try again."
      : status === 409 ? "This was already changed. Refresh and try again."
      : "Request could not be completed.";
    // Only these reviewed application error codes may cross the API boundary.
    const safeCodes=SAFE_MESSAGE_CATALOG;
    const payload=error instanceof HttpException?error.getResponse():null;
    const rawCode=payload&&typeof payload==="object"&&"code" in payload?payload.code:null;
    const code=status>=400&&status<500&&typeof rawCode==="string"&&Object.hasOwn(safeCodes,rawCode)
      ?rawCode:null;
    const rawField=payload&&typeof payload==="object"&&"field" in payload?payload.field:null;
    const field=typeof rawField==="string"&&["identifier","password","currentPassword","newPassword","description","lines","search","offset","name","code","category","startOn","endOn","scopeKind",
      "invoiceRef","invoiceDate","dueDate","counterpartyName","counterpartyAddress","receivableAccountRef","incomeAccountRef","taxAccountRef","stage","rows","terms","notes","budgetRef","budgetName","periodStart","periodEnd","fundingNote","journalRef","bankRef","bankAccountRef","date","bankItemReference","statementDate","statementAmount","reconciliationRef","from","to","yearRef","accountRef","expenseClaimRef","billFileRef","billVersion","linkKind","expenseDate","claimRef","expectedRevision","branchRef","groupRef","parentRef","financialYearRef","bankLabel","accountKind","bankLastFour","postingDate","amount","debitAccountRef",
      "creditAccountRef","fileRef","fileVersion","transactionReference","paymentMethod","paymentAccountRef","debitAccountRef","creditAccountRef","proofFileRef","proofVersion","caseRef","requestKey","voucherType","voucherRef","payeeName","purpose","quantity","unitRate","tax","charges","expectedVersion",
       "kind","slug","title","seoTitle","seoDescription","canonicalPath","sections","assets",
       "navigation","heading","body","source","asOfDate","verifiedAsOf","validUntil",
       "verification","documents","galleryMedia","categories","healthcareClaims","ctaPath",
       "ctaLabel","group","items","members","percentage","pan","mediaType","tags","publicReleaseConfirmed",
       "heroSlides","sourceNoticeRef","testCode","testRef","packageCode","packageRef","categoryRef","sampleType","tests","itemRef","mappingRef","priceRef","effectiveFromUtc","effectiveToUtc","basePriceMinor","patientPriceMinor","discountReason","expectedMappingVersion","provider","providerCode","legalName","providerType",
       "contactName","contactPhone","contactEmail","registrationRef","center","centers",
       "centerRef","centerCode","displayName","centerType","addressLine","stateRef",
       "districtRef","blockRef","pinCode","latitude","longitude","coordinates","timeZone",
       "publicPhone","hours","weekday","openLocal","closeLocal","serviceType",
       "capabilities","accountRef","maskedLabel","finance","intentRef","fileRef",
       "sourceVersion","doctor","doctorRef","fullName","registrationJurisdiction",
       "registrationNumber","qualifications","specialties","experienceYears",
       "publicBio","portraitRightsStatus","firstName","lastName","dateOfBirth","consentAccepted","granted",
       "partnerType","applicantName","contactEmail","contactPhone","registrationNumber",
       "addressLine","districtName","stateName","pinCode","receipt","applicationRef","savedRef","reportRef","runRef","scheduleRef",
       "format","view","status","fromDay","untilDay","cadence","timezone",
       "localTime","firstDate","activityType","ownerRef","projectRef","venue","scheduledStart","scheduledEnd","sourceEventRef","sourceRefs","program","reason","outcome","publicSummary"].includes(rawField)?rawField:null;
    if(status>=500){
      // Correlate unexpected failures without echoing request data, SQL parameters, paths,
      // raw driver/provider messages, contact details, or private payloads into logs.
      // Known 4xx outcomes are not logged here to avoid a high-volume denial log loop.
      const kind=error instanceof Error&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
        ?error.name:"UnexpectedFailure";
      const method=/^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)$/.test(request.method)
        ?request.method:"OTHER";
      try{this.logger.error(JSON.stringify({
        event:"cg01.http.unexpected_failure",requestId,status,method,failureType:kind
      }));}catch{/* Logging failure must never change the response or transaction outcome. */}
    }
    // No passwords, tokens, OTPs, raw contacts, SQL exceptions or provider payloads in response.
    response.status(status).json({status:"error",message:code?await this.editableCopy(code):message,
      ...(code?{code}:{}),...(field&&code?{field}:{}),requestId});
  }
}
