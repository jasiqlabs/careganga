import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {ProjectPublicEligibilityService} from "../application/project-public-eligibility.service";
@Controller("api/v1/project-public-eligibility")
export class ProjectPublicEligibilityController{
 constructor(private readonly service:ProjectPublicEligibilityService){}
 @Get("projects/:ref") @Header("Cache-Control","private, no-store") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.service.detail(t,r);}
 @Post("projects/:ref/submit") @Header("Cache-Control","private, no-store") @Header("Cache-Control","private, no-store") submit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.submit(t,r,v);}
 @Post("projects/:ref/withdraw") @Header("Cache-Control","private, no-store") @Header("Cache-Control","private, no-store") withdraw(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.withdraw(t,r,v);}
 @Post("cases/:ref/decide") @Header("Cache-Control","private, no-store") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.decide(t,r,v);}
}
