import {Body,Controller,Header,HttpCode,Post,Req} from "@nestjs/common";
import type {CareGangaRequest} from "../../../core/observability/request-correlation";
import {PublicPatientSignupService} from "../application/public-patient-signup.service";
/** One CG01 identity, verified contact and no staff grant. Membership/
 * volunteer ownership comes only from their separately verified workflows. */
@Controller("api/identity/community")
export class PublicCommunitySignupController{
 constructor(private readonly signup:PublicPatientSignupService){}
 @Post("start") @HttpCode(200) @Header("Cache-Control","no-store")
 start(@Body()raw:unknown,@Req()req:CareGangaRequest){return this.signup.requestCode(raw,req.ip??"unknown");}
 @Post("register") @HttpCode(200) @Header("Cache-Control","no-store")
 register(@Body()raw:unknown,@Req()req:CareGangaRequest){return this.signup.register(raw,req.ip??"unknown","COMMUNITY");}
}
