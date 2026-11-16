import {Body,Controller,Get,Headers,Post} from "@nestjs/common";
import {MobileVerificationService} from "../application/mobile-verification.service";
/** CG-01-owned verification, separate from the CG-19 notification provider.
 * No anonymous phone lookup and no caller-supplied recipient number.
 */
@Controller("api/identity/mobile")
export class MobileVerificationController{
  constructor(private readonly verification:MobileVerificationService){}
  @Get("status")
  status(@Headers("authorization")bearer:string){
    return this.verification.status(bearer);
  }
  @Post("verify/start")
  start(@Headers("authorization")bearer:string){
    return this.verification.start(bearer);
  }
  @Post("verify/confirm")
  confirm(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.verification.confirm(bearer,body);
  }
}
