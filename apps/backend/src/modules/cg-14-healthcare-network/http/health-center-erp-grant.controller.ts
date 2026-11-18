import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthCenterErpGrantService} from "../application/health-center-erp-grant.service";
/** Source-only opt-in permission; no ERP operations or patient-data API. */
@Controller("api/v1/health-network/erp-grants")
export class HealthCenterErpGrantController{
 constructor(private readonly grant:HealthCenterErpGrantService){}
 @Get("my-centers/:centerRef")
 own(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.grant.own(token,center);
 }
 @Post("my-centers/:centerRef")
 request(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.grant.request(token,center,body);}
 @Get("foundation")
 foundation(@Headers("authorization")token:string){
  return this.grant.foundation(token);
 }
 @Post("reviews/:caseRef/apply")
 apply(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.grant.apply(token,ref,body);}
 @Post("foundation/:centerRef/:capability/suspend")
 suspend(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("capability")cap:string,@Body()body:unknown){
  return this.grant.change(token,center,cap,"SUSPENDED",body);
 }
 @Post("foundation/:centerRef/:capability/withdraw")
 withdraw(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("capability")cap:string,@Body()body:unknown){
  return this.grant.change(token,center,cap,"WITHDRAWN",body);
 }
}
