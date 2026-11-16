import {BadRequestException,Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {BranchWorkflowService} from "../application/branch-workflow.service";

@Controller("api/foundation-structure/branch-workflow")
export class BranchWorkflowController{
 constructor(private readonly workflow:BranchWorkflowService){}
 @Post("registrations/:registrationRef/submit")
 submit(@Headers("authorization")bearer:string,
   @Param("registrationRef")ref:string,@Body()body:unknown){
   return this.workflow.submit(bearer,ref,body);
 }
 @Get("registrations/:registrationRef/status")
 status(@Headers("authorization")bearer:string,@Param("registrationRef")ref:string){
   return this.workflow.status(bearer,ref);
 }
 @Post("operating-branches/:branchRef/status")
 changeOperatingStatus(@Headers("authorization")bearer:string,
   @Param("branchRef")ref:string,@Body()body:unknown){
   return this.workflow.changeOperatingStatus(bearer,ref,body);
 }
 @Post("operating-branches/:branchRef/update")
 updateOperating(@Headers("authorization")bearer:string,
   @Param("branchRef")ref:string,@Body()body:unknown){
   return this.workflow.updateOperating(bearer,ref,body);
 }
 @Get("approval-process")
 processStatus(@Headers("authorization")bearer:string){
   return this.workflow.processStatus(bearer);
 }
 @Post("approval-process/initialize")
 initializeProcess(@Headers("authorization")bearer:string){
   return this.workflow.initializeProcess(bearer);
 }
 @Get("cases")
 cases(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
   if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
     throw new BadRequestException("Check approval page");
   return this.workflow.cases(bearer,offset?Number(offset):0);
 }
 @Get("cases/:caseRef")
 detail(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
   return this.workflow.caseDetail(bearer,ref);
 }
 @Post("cases/:caseRef/decide")
 decide(@Headers("authorization")bearer:string,@Param("caseRef")ref:string,
   @Body()body:unknown){
   return this.workflow.decide(bearer,ref,body);
 }
 @Post("cases/:caseRef/reconcile")
 reconcile(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
   return this.workflow.reconcile(bearer,ref);
 }
 @Post("cases/:caseRef/finalize")
 finalize(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
   return this.workflow.finalize(bearer,ref);
 }
}
