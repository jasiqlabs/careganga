import {Body,Controller,Get,Headers,Post} from "@nestjs/common";
import {HrPublicBioConsentService} from "../application/hr-public-bio-consent.service";
@Controller("api/hr/my-bio-consent")
export class HrPublicBioConsentController{
 constructor(private readonly consent:HrPublicBioConsentService){}
 @Get()
 mine(@Headers("authorization")token:string){return this.consent.mine(token);}
 @Post()
 decide(@Headers("authorization")token:string,@Body()body:unknown){
  return this.consent.decide(token,body);
 }
}
