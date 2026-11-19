import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthClinicianIdentityService} from "../application/health-clinician-identity.service";

/** Existing CG14 physician verification authority; never public.
 * Reviewer proposes/revokes; a separately signed-in professional accepts.
 */
@Controller("api/v1/health-network/clinician-accounts")
export class HealthClinicianIdentityController{
 constructor(private readonly clinicians:HealthClinicianIdentityService){}
 @Post("doctors/:doctorRef/propose")
 propose(@Headers("authorization")bearer:string,
  @Param("doctorRef")doctor:string,@Body()body:unknown){
  return this.clinicians.propose(bearer,doctor,body);
 }
 @Get("me/pending")
 pending(@Headers("authorization")bearer:string){
  return this.clinicians.pendingForMe(bearer);
 }
 @Post("me/:linkRef/accept")
 accept(@Headers("authorization")bearer:string,
  @Param("linkRef")link:string){
  return this.clinicians.accept(bearer,link);
 }
 @Post(":linkRef/revoke")
 revoke(@Headers("authorization")bearer:string,
  @Param("linkRef")link:string){
  return this.clinicians.revoke(bearer,link);
 }
}
