import { Body,Controller,Get,Headers,Param,Patch,Req } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";
import { SecurityPolicyService } from "../application/security-policy.service";

@Controller("api/identity/security-policy")
export class SecurityPolicyController {
  constructor(private readonly service:SecurityPolicyService){}
  @Get()
  read(@Headers("authorization") bearer:string){
    return this.service.read(bearer);
  }
  @Get("changes/:requestKey")
  lookup(@Headers("authorization") bearer:string,@Param("requestKey") requestKey:string){
    return this.service.lookup(bearer,requestKey);
  }
  @Patch()
  update(@Headers("authorization") bearer:string,@Body() body:unknown,
    @Req() request:CareGangaRequest){
    return this.service.update(bearer,body,request.cgRequestId??randomUUID());
  }
}
