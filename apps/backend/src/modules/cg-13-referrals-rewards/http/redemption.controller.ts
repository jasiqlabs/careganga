import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {RedemptionService} from "../application/redemption.service";

/** Exact same-root CG01 self-only DIGITAL hold; never an external payout,
 * CG12 warehouse issue, recipient-acknowledgement or caller-set fulfilled flag.
 */
@Controller("api/v1/rewards")
export class RedemptionController {
 constructor(private readonly rewards:RedemptionService){}
 @Post("redemptions")
 @Header("Cache-Control","private, no-store")
 request(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.rewards.request(auth,body);
 }
 @Post("redemptions/:redemptionRef/cancel")
 @Header("Cache-Control","private, no-store")
 cancel(@Headers("authorization")auth:string,@Param("redemptionRef")id:string){
  return this.rewards.cancel(auth,id);
 }
 @Get("redemptions/my-history")
 @Header("Cache-Control","private, no-store")
 history(@Headers("authorization")auth:string,@Query("page")page?:string){
  return this.rewards.myHistory(auth,page);
 }
}
