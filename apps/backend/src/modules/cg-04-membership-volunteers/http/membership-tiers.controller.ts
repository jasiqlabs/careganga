import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {MembershipTiersService} from "../application/membership-tiers.service";
@Controller("api/v1/membership/tiers")
@Header("Cache-Control","private, no-store")
export class MembershipTiersController{
 constructor(private readonly tiers:MembershipTiersService){}
 @Get() list(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.tiers.list(token,q);}
 @Get("export") export(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.tiers.list(token,q,true);}
 @Post() create(@Headers("authorization")token:string,@Body()body:unknown){return this.tiers.save(token,body);}
 @Patch(":ref") edit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.tiers.save(token,body,ref);}
}
@Controller("api/v1/public/membership/tiers")
@Header("Cache-Control","no-store")
export class PublicMembershipTiersController{
 constructor(private readonly tiers:MembershipTiersService){}
 @Get() list(@Query()q:Record<string,unknown>){return this.tiers.publicList(q);}
}
