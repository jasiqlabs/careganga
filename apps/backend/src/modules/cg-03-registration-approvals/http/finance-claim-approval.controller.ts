import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {FinanceClaimApprovalService} from "../application/finance-claim-approval.service";
@Controller("api/approvals/finance-claims")
export class FinanceClaimApprovalController{
 constructor(private readonly reviewer:FinanceClaimApprovalService){}
 @Get("process")
 status(@Headers("authorization")bearer:string){
  return this.reviewer.processStatus(bearer);
 }
 @Post("process")
 initialize(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.reviewer.initialize(bearer,body);
 }
 @Get("cases")
 list(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
  return this.reviewer.list(bearer,offset);
 }
 @Get("cases/:caseRef")
 detail(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
  return this.reviewer.detail(bearer,ref);
 }
 @Post("cases/:caseRef/decisions")
 decide(@Headers("authorization")bearer:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.reviewer.decide(bearer,ref,body);}
}
