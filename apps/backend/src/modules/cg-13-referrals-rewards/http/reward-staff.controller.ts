import {Controller,Header,Headers,Param,Post} from "@nestjs/common";
import {RewardStaffService} from "../application/reward-staff.service";
@Controller("api/v1/rewards/admin")
export class RewardStaffController{
 constructor(private readonly staff:RewardStaffService){}
 @Post("redemptions/:redemptionRef/prepare-issue")
 @Header("Cache-Control","private, no-store")
 prepare(@Headers("authorization")token:string,
  @Param("redemptionRef")ref:string){
  return this.staff.prepareIssue(token,ref);
 }
}
