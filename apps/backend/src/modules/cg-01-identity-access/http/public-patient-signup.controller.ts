import {Body,Controller,Header,HttpCode,Post,Req} from "@nestjs/common";
import {PublicPatientSignupService} from "../application/public-patient-signup.service";
import type {CareGangaRequest} from "../../../core/observability/request-correlation";
/** Public creation is an unprivileged CG01 account ONLY.
 * Registered-mobile proof is separate and required before CG15 patient record.
 */
@Controller("api/identity/patients")
export class PublicPatientSignupController{
 constructor(private readonly signup:PublicPatientSignupService){}
 @Post("start")
 @HttpCode(200)
 @Header("Cache-Control","no-store")
 start(@Body()raw:unknown,@Req()request:CareGangaRequest){
  return this.signup.requestCode(raw,request.ip??"unknown");
 }
 @Post("register")
 @HttpCode(200)
 @Header("Cache-Control","no-store")
 register(@Body()raw:unknown,@Req()request:CareGangaRequest){
  const remote=request.ip??"unknown";
  return this.signup.register(raw,remote);
 }
}
