import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HrLeaveService} from "../application/hr-leave.service";
import {HrLeaveApprovalService} from "../../cg-03-registration-approvals/application/hr-leave-approval.service";
@Controller("api/hr")
export class HrLeaveController{
 constructor(private readonly leave:HrLeaveService,private readonly reviews:HrLeaveApprovalService){}
 @Get("me/leave")
 mine(@Headers("authorization")token:string,@Query("year")year?:string){return this.leave.mine(token,year);}
 @Post("me/leave")
 submit(@Headers("authorization")token:string,@Body()body:unknown){return this.leave.submit(token,body);}
 @Post("me/leave/:reference/cancel")
 cancel(@Headers("authorization")token:string,@Param("reference")reference:string,@Body()body:unknown){
  return this.leave.withdraw(token,reference,body);
 }
 @Get("leave-reviews")
 inbox(@Headers("authorization")token:string,@Query("offset")offset?:string,@Query("status")status?:string,
  @Query("from")from?:string,@Query("to")to?:string,@Query("type")type?:string,@Query("employee")employee?:string){
  return this.reviews.inbox(token,offset,status,{from,to,type,employee});
 }
 @Get("leave-reviews/:ref")
 detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.reviews.detail(token,ref);}
 @Post("leave-reviews/:ref/decide")
 decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.reviews.decide(token,ref,body);
 }
}
