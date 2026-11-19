import {Body,Controller,Get,Header,Headers,Patch,Post} from "@nestjs/common";
import {PatientProfileService} from "../application/patient-profile.service";

/** A current CG-01 password session is mandatory on every own-patient action.
 * Public consent policy alone carries no personal record.
 */
@Controller("api/v1/patients")
export class PatientProfileController{
 constructor(private readonly patients:PatientProfileService){}
 @Get("consent-policy")
 @Header("Cache-Control","no-store")
 policy(){return this.patients.consentPolicy();}
 @Get("me")
 @Header("Cache-Control","private, no-store")
 me(@Headers("authorization")token:string){return this.patients.me(token);}
 @Post("registration")
 @Header("Cache-Control","private, no-store")
 register(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.register(token,body);
 }
 @Patch("me")
 @Header("Cache-Control","private, no-store")
 update(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.update(token,body);
 }
 @Post("me/consent")
 @Header("Cache-Control","private, no-store")
 consent(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.consent(token,body);
 }
}
