import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {ProjectPublicEligibilityService} from "../application/project-public-eligibility.service";
@Controller("api/v1/project-public-eligibility")
@Header("Cache-Control","private, no-store")
export class ProjectPublicEligibilityController{
 constructor(private readonly service:ProjectPublicEligibilityService){}
 @Get("projects/:ref") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.service.detail(t,r);}
 @Post("projects/:ref/submit") submit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.submit(t,r,v);}
 @Post("projects/:ref/withdraw") withdraw(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.withdraw(t,r,v);}
 @Post("cases/:ref/decide") decide(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.decide(t,r,v);}
}
