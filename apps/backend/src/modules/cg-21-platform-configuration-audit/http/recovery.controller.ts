import {Body,Controller,Get,Headers,Param,Post,Req} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {CareGangaRequest} from "../../../core/observability/request-correlation";
import {RecoveryService} from "../application/recovery.service";

@Controller("api/platform-configuration-audit/recovery")
export class RecoveryController{
  constructor(private readonly recovery:RecoveryService){}
  @Get("availability")
  availability(@Headers("authorization") bearer:string){
    return this.recovery.availability(bearer);
  }
  @Get("operations")
  list(@Headers("authorization") bearer:string){
    return this.recovery.list(bearer);
  }
  @Post("request")
  request(@Headers("authorization") bearer:string,@Body() body:unknown,
    @Req() request:CareGangaRequest){
    return this.recovery.request(bearer,body,request.cgRequestId??randomUUID());
  }
  @Post("operations/:operationRef/authorize")
  authorize(@Headers("authorization") bearer:string,
    @Param("operationRef") operationRef:string,@Body() body:unknown,
    @Req() request:CareGangaRequest){
    return this.recovery.authorizeRecovery(bearer,operationRef,body,
      request.cgRequestId??randomUUID());
  }
  @Get("authorization/changes/:requestKey")
  authorizationLookup(@Headers("authorization") bearer:string,
    @Param("requestKey") key:string){
    return this.recovery.lookupAuthorization(bearer,key);
  }
  @Get("changes/:requestKey")
  lookup(@Headers("authorization") bearer:string,@Param("requestKey") key:string){
    return this.recovery.lookup(bearer,key);
  }
}
