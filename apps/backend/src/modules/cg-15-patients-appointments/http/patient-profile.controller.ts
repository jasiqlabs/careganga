import {Body,Controller,Get,Header,Headers,Patch,Post} from "@nestjs/common";
import {PatientProfileService} from "../application/patient-profile.service";
import {PatientPrivateDetailsService} from "../application/patient-private-details.service";

/** A current CG-01 password session is mandatory on every own-patient action.
 * Public consent policy alone carries no personal record.
 */
@Controller("api/v1/patients")
export class PatientProfileController{
 constructor(private readonly patients:PatientProfileService,
  private readonly privateDetails:PatientPrivateDetailsService){}
 @Get("me/private-details")
 @Header("Cache-Control","private, no-store")
 privateDetailsOfMe(@Headers("authorization")token:string){
  return this.privateDetails.mine(token);
 }
 @Post("me/private-details")
 @Header("Cache-Control","private, no-store")
 savePrivateDetails(@Headers("authorization")token:string,@Body()body:unknown){
  return this.privateDetails.save(token,body);
 }
 @Get("consent-policy")
 @Header("Cache-Control","no-store")
 policy(){return this.patients.consentPolicy();}
 @Get("me")
 @Header("Cache-Control","private, no-store")
 me(@Headers("authorization")token:string){return this.patients.me(token);}
 @Post("me/assisted-booking-code")
 @Header("Cache-Control","private, no-store")
 beginAssistedBooking(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.beginAssistedBooking(token,body);
 }

 @Post("me/second-account-link-code")
 @Header("Cache-Control","private, no-store")
 issueSecondAccountLink(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.issueSecondAccountLink(token,body);
 }
 @Post("me/accept-second-account")
 @Header("Cache-Control","private, no-store")
 acceptSecondAccountLink(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.acceptSecondAccountLink(token,body);
 }
 @Post("me/claim-intake")
 @Header("Cache-Control","private, no-store")
 claimCenterIntake(@Headers("authorization")token:string,@Body()body:unknown){
  return this.patients.claimCenterIntake(token,body);
 }

 @Post("me/identity-verification")
 @Header("Cache-Control","private, no-store")
 beginIdentityVerification(@Headers("authorization")token:string){
  return this.patients.beginIdentityVerification(token);
 }
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
