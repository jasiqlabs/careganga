import {Controller,Get,Header,Headers,Query} from "@nestjs/common";
import {MembershipRosterService} from "../application/membership-roster.service";
@Controller("api/v1/membership/members")
export class MembershipRosterController{
 constructor(private readonly members:MembershipRosterService){}
 @Get() @Header("Cache-Control","private, no-store")
 list(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.members.list(token,query);}
 @Get("export") @Header("Cache-Control","private, no-store")
 export(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.members.export(token,query);}
}
