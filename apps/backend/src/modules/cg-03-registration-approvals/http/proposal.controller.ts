import {Body,Controller,Get,Headers,Param,Post,Query,Req} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {CareGangaRequest} from "../../../core/observability/request-correlation";
import {ApprovalProposalService} from "../application/proposal.service";

@Controller("api/registration-approvals")
export class ApprovalProposalController{
  constructor(private readonly proposals:ApprovalProposalService){}
  @Get("process")
  process(@Headers("authorization") bearer:string){
    return this.proposals.process(bearer);
  }
  @Get("process/changes/:key")
  processLookup(@Headers("authorization") bearer:string,@Param("key") key:string){
    return this.proposals.processLookup(bearer,key);
  }
  @Post("process/versions")
  version(@Headers("authorization") bearer:string,@Body() body:unknown){
    return this.proposals.newProcessVersion(bearer,body);
  }
  @Get("options/:kind")
  options(@Headers("authorization") bearer:string,@Param("kind") kind:string,
    @Query("search") search?:string){
    return this.proposals.options(bearer,kind,search??"");
  }
  @Post("cases")
  create(@Headers("authorization") bearer:string,@Body() body:unknown,
    @Req() req:CareGangaRequest){
    return this.proposals.create(bearer,body,req.cgRequestId??randomUUID());
  }
  @Get("cases")
  list(@Headers("authorization") bearer:string,@Query("status") status?:string,
    @Query("limit") limit?:string){
    return this.proposals.list(bearer,{status,limit});
  }
  @Get("cases/requests/:key")
  lookup(@Headers("authorization") bearer:string,@Param("key") key:string){
    return this.proposals.lookup(bearer,key);
  }
  @Get("cases/:caseRef")
  detail(@Headers("authorization") bearer:string,@Param("caseRef") caseRef:string){
    return this.proposals.detail(bearer,caseRef);
  }
}
