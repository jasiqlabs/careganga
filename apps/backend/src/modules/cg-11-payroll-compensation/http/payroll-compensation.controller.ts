import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {PayrollCompensationService} from "../application/payroll-compensation.service";
@Controller("api/v1/payroll")
export class PayrollCompensationController{
 constructor(private readonly source:PayrollCompensationService){}
 @Get("me") @Header("Cache-Control","private, no-store") ownPay(@Headers("authorization")token:string){return this.source.ownPay(token);}
 @Get("employee-options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string,@Query("branchRef")branch?:string,@Query("q")q?:string,@Query("offset")offset?:string,@Query("department")department?:string,@Query("employmentType")employmentType?:string,@Query("employmentStatus")employmentStatus?:string,@Query("salaryStatus")salaryStatus?:string){return this.source.options(token,branch,q,offset??0,{department,employmentType,employmentStatus,salaryStatus});}
 @Get("leave-rule-options") @Header("Cache-Control","private, no-store") leaveRules(@Headers("authorization")token:string,@Query("branchRef")branch:string){return this.source.leaveRuleOptions(token,branch);}
 @Get("bank-options") @Header("Cache-Control","private, no-store") banks(@Headers("authorization")token:string,@Query("branchRef")branch:string){return this.source.bankOptions(token,branch);}
 @Get("policies") @Header("Cache-Control","private, no-store") policies(@Headers("authorization")token:string,@Query("branchRef")branch:string){return this.source.policies(token,branch);}
 @Post("policies") @Header("Cache-Control","private, no-store") createPolicy(@Headers("authorization")token:string,@Body()raw:unknown){return this.source.createPolicy(token,raw);}
 @Get("employees/:ref/hr-proposals") @Header("Cache-Control","private, no-store") hrProposals(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.hrProposals(token,ref);}
 @Get("employees/:ref/compensation") @Header("Cache-Control","private, no-store") history(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.history(token,ref);}
 @Get("employees/:ref/payout-instruction") @Header("Cache-Control","private, no-store") payout(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.payoutHistory(token,ref);}
 @Post("employees/:ref/payout-instruction") @Header("Cache-Control","private, no-store") createPayout(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.source.createPayout(token,ref,raw);}
 @Get("employees/:ref/salary-history") @Header("Cache-Control","private, no-store") salaryHistory(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.history(token,ref);}
 @Post("employees/:ref/compensation") @Header("Cache-Control","private, no-store") createSalary(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.source.createSalary(token,ref,raw);}
}
