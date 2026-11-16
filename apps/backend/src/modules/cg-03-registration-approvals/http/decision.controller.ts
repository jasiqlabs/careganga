import {Body,Controller,Get,Headers,Param,Post,Req} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {CareGangaRequest} from "../../../core/observability/request-correlation";
import {ApprovalDecisionService} from "../application/decision.service";

@Controller("api/registration-approvals")
export class ApprovalDecisionController{
  constructor(private readonly decisions:ApprovalDecisionService){}
  @Post("cases/:caseRef/decisions")
  decide(@Headers("authorization") bearer:string,@Param("caseRef") ref:string,
    @Body() body:unknown,@Req() request:CareGangaRequest){
    return this.decisions.decide(bearer,ref,body,request.cgRequestId??randomUUID());
  }
  @Get("cases/:caseRef/decisions/requests/:requestKey")
  lookup(@Headers("authorization") bearer:string,@Param("caseRef") ref:string,
    @Param("requestKey") key:string){
    return this.decisions.lookup(bearer,ref,key);
  }
}
