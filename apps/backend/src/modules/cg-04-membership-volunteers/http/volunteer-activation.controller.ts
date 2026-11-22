import {Controller,Get,Header,Headers} from "@nestjs/common";
import {VolunteerActivationService} from "../application/volunteer-activation.service";
@Controller("api/v1/volunteers")
export class VolunteerActivationController{
 constructor(private readonly volunteers:VolunteerActivationService){}
 @Get("me") @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")token:string){return this.volunteers.me(token);}
}
