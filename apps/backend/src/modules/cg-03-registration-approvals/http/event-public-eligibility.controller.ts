import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {EventPublicEligibilityService} from "../application/event-public-eligibility.service";
@Controller("api/v1/event-public-eligibility")
export class EventPublicEligibilityController{
 constructor(private readonly service:EventPublicEligibilityService){}
 @Get("activities/:ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.service.detail(t,r);}
 @Post("activities/:ref/submit") @Header("Cache-Control","private, no-store") submit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.submit(t,r,v);}
 @Post("activities/:ref/withdraw") @Header("Cache-Control","private, no-store") withdraw(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.withdraw(t,r,v);}
 @Post("cases/:ref/decide") @Header("Cache-Control","private, no-store") decide(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.service.decide(t,r,v);}
}
