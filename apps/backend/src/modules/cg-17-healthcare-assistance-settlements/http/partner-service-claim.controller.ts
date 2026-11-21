import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {PartnerServiceClaimService} from "../application/partner-service-claim.service";

/** Patient-facing CG17 ERP-OFF evidence: only the current verified patient's
 * own records. Never a provider payout, private file download or approved bill.
 */
@Controller("api/v1/healthcare-assistance/partner-claims")
export class PartnerServiceClaimController{
 constructor(private readonly claims:PartnerServiceClaimService){}
 @Get("eligible-services")
 @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")bearer:string){
  return this.claims.options(bearer);
 }
 @Get("foundation/centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 foundation(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string){
  return this.claims.foundationCenter(bearer,center);
 }
 @Get("partner/centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 partner(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string){
  return this.claims.ownCenter(bearer,center);
 }
 @Get("mine")
 @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")bearer:string){
  return this.claims.mine(bearer);
 }
 @Post("mine")
 @Header("Cache-Control","private, no-store")
 submit(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.claims.submit(bearer,body);
 }
}
