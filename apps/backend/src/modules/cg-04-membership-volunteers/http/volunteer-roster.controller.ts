import {Controller,Get,Header,Headers,Param,Query} from "@nestjs/common";
import {VolunteerRosterService} from "../application/volunteer-roster.service";
@Controller("api/v1/volunteers/roster")
export class VolunteerRosterController{
 constructor(private readonly roster:VolunteerRosterService){}
 @Get() @Header("Cache-Control","private, no-store")
 list(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.roster.list(token,query);}
 @Get(":ref/reimbursement-options") @Header("Cache-Control","private, no-store")
 reimburseOptions(@Headers("authorization")token:string,@Param("ref")ref:string){return this.roster.reimbursementOptions(token,ref);}
 @Get("export") @Header("Cache-Control","private, no-store")
 export(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.roster.export(token,query);}
}
