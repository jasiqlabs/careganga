import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HrEmployeeEvidenceService} from "../application/hr-employee-evidence.service";
@Controller("api/documents/hr")
export class HrEmployeeEvidenceController{
 constructor(private readonly files:HrEmployeeEvidenceService){}
 @Post("intents")
 initiate(@Headers("authorization")token:string,@Body()body:unknown){
  return this.files.initiate(token,body);
 }
 @Get("intents/:uploadRef")
 status(@Headers("authorization")token:string,@Param("uploadRef")ref:string){
  return this.files.status(token,ref);
 }
 @Post("intents/:uploadRef/confirm")
 confirm(@Headers("authorization")token:string,@Param("uploadRef")ref:string){
  return this.files.confirm(token,ref);
 }
 @Get("applications/:applicationRef")
 list(@Headers("authorization")token:string,@Param("applicationRef")ref:string){
  return this.files.list(token,ref);
 }
}
