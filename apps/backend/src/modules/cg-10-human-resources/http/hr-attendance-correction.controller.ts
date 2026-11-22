import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HrAttendanceCorrectionService} from "../application/hr-attendance-correction.service";
import {HrAttendanceCorrectionApprovalService} from "../../cg-03-registration-approvals/application/hr-attendance-correction-approval.service";
@Controller("api/hr")
export class HrAttendanceCorrectionController{
 constructor(private readonly source:HrAttendanceCorrectionService,private readonly reviews:HrAttendanceCorrectionApprovalService){}
 @Get("attendance-corrections")
 history(@Headers("authorization")token:string,@Query("employeeReference")employeeReference?:string){
  return this.source.history(token,employeeReference);
 }
 @Post("attendance-corrections")
 submit(@Headers("authorization")token:string,@Body()body:unknown){return this.source.submit(token,body);}
 @Get("attendance-correction-reviews")
 list(@Headers("authorization")token:string,@Query("offset")offset?:string,@Query("status")status?:string){
  return this.reviews.inbox(token,offset,status);
 }
 @Get("attendance-correction-reviews/:ref")
 detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.reviews.detail(token,ref);}
 @Post("attendance-correction-reviews/:ref/decide")
 decide(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.reviews.decide(token,ref,body);}
}
