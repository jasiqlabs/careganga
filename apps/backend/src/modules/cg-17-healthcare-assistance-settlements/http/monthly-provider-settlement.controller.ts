import {Body,Controller,Get,Header,Headers,Param,Post}
 from "@nestjs/common";
import {MonthlyProviderSettlementService}
 from "../application/monthly-provider-settlement.service";
import {VerifiedProviderPayoutService}
 from "../application/verified-provider-payout.service";
/** One original CG17 monthly posted-liability claim; none of these
 * routes assert a bank transfer or a CG09 payout journal.
 */
@Controller("api/v1/healthcare-assistance/provider-settlements")
export class MonthlyProviderSettlementController{
 constructor(private readonly service:MonthlyProviderSettlementService,
  private readonly payout:VerifiedProviderPayoutService){}
 @Get("my-centers/eligible")
 @Header("Cache-Control","private, no-store")
 ownEligible(@Headers("authorization")token:string){
  return this.service.ownCenters(token);
 }
 @Get("my-centers/:centerRef/months/:month")
 @Header("Cache-Control","private, no-store")
 ownCenterMonth(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("month")month:string){
  return this.service.ownCenterStatement(token,center,month);
 }
 @Get("centers/eligible")
 @Header("Cache-Control","private, no-store")
 eligible(@Headers("authorization")token:string){
  return this.service.eligibleCenters(token);
 }
 @Get("centers/:centerRef/months/:month")
 @Header("Cache-Control","private, no-store")
 statement(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("month")month:string){
  return this.service.statement(token,center,month);
 }
 @Post("centers/:centerRef/months/:month/propose")
 @Header("Cache-Control","private, no-store")
 propose(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("month")month:string,
  @Body()payload:unknown){
  return this.service.propose(token,center,month,payload);
 }
 @Post("centers/:centerRef/months/:month/review")
 @Header("Cache-Control","private, no-store")
 review(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("month")month:string,
  @Body()payload:unknown){
  return this.service.review(token,center,month,payload);
 }
 @Get("centers/:centerRef/months/:month/payout-options")
 @Header("Cache-Control","private, no-store")
 payoutOptions(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("month")month:string){
  return this.payout.options(token,center,month);
 }
 @Post("centers/:centerRef/months/:month/confirm-payout")
 @Header("Cache-Control","private, no-store")
 confirmPayout(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("month")month:string,
  @Body()payload:unknown){
  return this.payout.allocate(token,center,month,payload);
 }

}
