import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {PayrollCompensationService} from "../application/payroll-compensation.service";
@Controller("api/v1/payroll")
@Header("Cache-Control","private, no-store")
export class PayrollCompensationController{
 constructor(private readonly source:PayrollCompensationService){}
 @Get("employee-options") options(@Headers("authorization")token:string,@Query("branchRef")branch?:string,@Query("q")q?:string){return this.source.options(token,branch,q);}
 @Get("policies") policies(@Headers("authorization")token:string,@Query("branchRef")branch:string){return this.source.policies(token,branch);}
 @Post("policies") createPolicy(@Headers("authorization")token:string,@Body()raw:unknown){return this.source.createPolicy(token,raw);}
 @Get("employees/:ref/compensation") history(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.history(token,ref);}
 @Get("employees/:ref/salary-history") salaryHistory(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.history(token,ref);}
 @Post("employees/:ref/compensation") createSalary(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.source.createSalary(token,ref,raw);}
}
