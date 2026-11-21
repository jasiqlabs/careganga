import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthcareAssistancePolicyService} from "../application/healthcare-assistance-policy.service";

/** CG17 original policies. No patient-charge, payment capture, or CMS
 * publication route exists here: those belong to US002–007.
 */
@Controller("api/v1/healthcare-assistance/policies")
export class HealthcareAssistancePolicyController{
 constructor(private readonly policies:HealthcareAssistancePolicyService){}
 @Get("centers/eligible")
 centers(@Headers("authorization")token:string){return this.policies.options(token);}
 @Get("centers/:centerRef/doctors")
 doctors(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.policies.doctors(token,center);
 }
 @Get("centers/:centerRef/doctors/:doctorRef/estimate")
 estimate(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("doctorRef")doctor:string){
  return this.policies.preview(token,center,doctor);
 }
 @Get("centers/:centerRef")
 list(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.policies.list(token,center);
 }
 @Post("submit")
 submit(@Headers("authorization")token:string,@Body()body:unknown){
  return this.policies.submit(token,body);
 }
 @Post("cases/:caseRef/activate")
 activate(@Headers("authorization")token:string,@Param("caseRef")ref:string,
  @Body()body:unknown){return this.policies.activate(token,ref,body);}
 @Post(":policyRef/withdraw")
 withdraw(@Headers("authorization")token:string,@Param("policyRef")ref:string,
  @Body()body:unknown){return this.policies.withdraw(token,ref,body);}
}
