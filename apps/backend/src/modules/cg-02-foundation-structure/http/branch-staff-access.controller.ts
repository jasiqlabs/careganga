import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {BranchStaffAccessService} from "../application/branch-staff-access.service";

/** Protected Foundation staff-scope management. CG14 center affiliations are separate. */
@Controller("api/foundation-structure/branch-access")
export class BranchStaffAccessController{
 constructor(private readonly source:BranchStaffAccessService){}
 @Get("assignments")
 list(@Headers("authorization")bearer:string,@Query("accountRef")accountRef?:string){
  return this.source.list(bearer,accountRef);
 }
 @Get("options")
 options(@Headers("authorization")bearer:string,@Query("search")search=""){
  return this.source.options(bearer,search);
 }
 @Post("assignments")
 grant(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.source.grant(bearer,input);
 }
 @Post("assignments/:assignmentRef/end")
 end(@Headers("authorization")bearer:string,@Param("assignmentRef")ref:string,@Body()input:unknown){
  return this.source.end(bearer,ref,input);
 }
}
