import {Body,Controller,Header,Ip,Post} from "@nestjs/common";
import {ReferralResolveService} from "../application/referral-resolve.service";

/** Public code check is NOT membership validation, identity proof or credit.
 * Return only coarse programme eligibility (never a referrer/contact/branch).
 */
@Controller("api/v1/referrals")
export class ReferralResolveController{
 constructor(private readonly resolver:ReferralResolveService){}
 @Post("resolve")
 @Header("Cache-Control","no-store")
 resolve(@Body()body:unknown,@Ip()requestIp:string){
  return this.resolver.resolve(body,requestIp);
 }
}
