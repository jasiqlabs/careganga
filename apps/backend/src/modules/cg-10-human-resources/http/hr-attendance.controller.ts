import {Body,Controller,Get,Headers,Post,Query} from "@nestjs/common";
import {HrAttendanceService} from "../application/hr-attendance.service";
/** CG-10 US-002 genuine employee attendance; no synthetic leave/approval endpoints. */
@Controller("api/hr")
export class HrAttendanceController{
 constructor(private readonly attendance:HrAttendanceService){}
 @Get("shift-policies")
 policies(@Headers("authorization")token:string,@Query("branch")branch:string){
  return this.attendance.policies(token,branch);
 }
 @Post("shift-policies")
 createPolicy(@Headers("authorization")token:string,@Body()body:unknown){
  return this.attendance.createPolicy(token,body);
 }
 @Post("shift-assignments")
 assign(@Headers("authorization")token:string,@Body()body:unknown){
  return this.attendance.assign(token,body);
 }
 @Get("me/attendance")
 mine(@Headers("authorization")token:string){return this.attendance.mine(token);}
 @Post("me/attendance/check-in")
 checkIn(@Headers("authorization")token:string,@Body()body:unknown){
  return this.attendance.checkIn(token,body);
 }
}
