import {Controller,Get,Header,Headers,Query} from "@nestjs/common";
import {ReferralSelfService} from "../application/referral-self.service";

/** US002: current self member/volunteer only. No public qualification credit,
 * grant modification, applicant PII or staff impersonation endpoint.
 */
@Controller("api/v1/referrals")
export class ReferralSelfController{
 constructor(private readonly self:ReferralSelfService){}
 @Get("my-code/options")
 @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")auth:string,@Query("page")page?:string){
  return this.self.options(auth,page);
 }
 @Get("my-code")
 @Header("Cache-Control","private, no-store")
 code(@Headers("authorization")auth:string,@Query("programmeRef")programme:string,
  @Query("relationship")relationship:string){
  return this.self.myCode(auth,programme,relationship);
 }
 @Get("points/my-balance")
 @Header("Cache-Control","private, no-store")
 balance(@Headers("authorization")auth:string,@Query("programmeRef")programme:string,
  @Query("relationship")relationship:string){
  return this.self.myBalance(auth,programme,relationship);
 }
 @Get("my-history")
 @Header("Cache-Control","private, no-store")
 history(@Headers("authorization")auth:string,@Query("programmeRef")programme:string,
  @Query("relationship")relationship:string,@Query("page")page?:string){
  return this.self.myHistory(auth,programme,relationship,page);
 }
 @Get("rewards/my-rank")
 @Header("Cache-Control","private, no-store")
 rank(@Headers("authorization")auth:string,@Query("programmeRef")programme:string,
  @Query("relationship")relationship:string,@Query("page")page?:string){
  return this.self.myRank(auth,programme,relationship,page);
 }
}
