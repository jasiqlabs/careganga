import {Body,Controller,Get,Header,Headers,Param,Post}
 from "@nestjs/common";
import {MonthlyProviderSettlementService}
 from "../application/monthly-provider-settlement.service";
/** One original CG17 monthly posted-liability claim; none of these
 * routes assert a bank transfer or a CG09 payout journal.
 */
@Controller("api/v1/healthcare-assistance/provider-settlements")
export class MonthlyProviderSettlementController{
 constructor(private readonly service:MonthlyProviderSettlementService){}
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
}
