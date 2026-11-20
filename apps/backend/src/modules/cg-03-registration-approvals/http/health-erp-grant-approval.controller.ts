import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthErpGrantApprovalService} from "../application/health-erp-grant-approval.service";
/** Original CG-03 case/decision API. Never lets the Center Portal self-approve. */
@Controller("api/health/erp-grant-reviews")
export class HealthErpGrantApprovalController{
 constructor(private readonly approvals:HealthErpGrantApprovalService){}
 @Get()
 inbox(@Headers("authorization")token:string){return this.approvals.inbox(token);}
 @Get(":caseRef")
 detail(@Headers("authorization")token:string,@Param("caseRef")ref:string){
  return this.approvals.detail(token,ref);
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.approvals.decide(token,ref,body);}
}
