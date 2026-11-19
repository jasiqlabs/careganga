import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {CenterPatientIntakeService} from "../application/center-patient-intake.service";

/** Only currently authorized staff at their own verified CG-14 center.
 * No patient search, all-patients list, share or account-claim endpoint.
 */
@Controller("api/v1/appointments/patients")
export class CenterPatientIntakeController{
 constructor(private readonly intake:CenterPatientIntakeService){}
 @Get("my-centers/intake-options")
 @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")bearer:string){
  return this.intake.options(bearer);
 }
 @Post("my-centers/:centerRef/claims")
 @Header("Cache-Control","private, no-store")
 issueClaim(@Headers("authorization")bearer:string,
  @Param("centerRef")centerRef:string,@Body()body:unknown){
  return this.intake.issueClaim(bearer,centerRef,body);
 }

 @Post("my-centers/:centerRef/verify-identity")
 @Header("Cache-Control","private, no-store")
 verifyIdentity(@Headers("authorization")bearer:string,
  @Param("centerRef")centerRef:string,@Body()body:unknown){
  return this.intake.verifyIdentity(bearer,centerRef,body);
 }

 @Post("my-centers/:centerRef/intakes")
 @Header("Cache-Control","private, no-store")
 create(@Headers("authorization")bearer:string,
  @Param("centerRef")centerRef:string,@Body()body:unknown){
  return this.intake.create(bearer,centerRef,body);
 }
 @Get("my-centers/:centerRef/intakes/:requestKey")
 @Header("Cache-Control","private, no-store")
 result(@Headers("authorization")bearer:string,
  @Param("centerRef")centerRef:string,@Param("requestKey")key:string){
  return this.intake.get(bearer,centerRef,key);
 }
}
