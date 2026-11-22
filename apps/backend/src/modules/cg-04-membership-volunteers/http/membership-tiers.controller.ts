import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {MembershipTiersService} from "../application/membership-tiers.service";
@Controller("api/v1/membership/tiers")
export class MembershipTiersController{
 constructor(private readonly tiers:MembershipTiersService){}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.tiers.list(token,q);}
 @Get("export") @Header("Cache-Control","private, no-store") export(@Headers("authorization")token:string,@Query()q:Record<string,unknown>){return this.tiers.list(token,q,true);}
 @Post() @Header("Cache-Control","private, no-store") create(@Headers("authorization")token:string,@Body()body:unknown){return this.tiers.save(token,body);}
 @Patch(":ref") @Header("Cache-Control","private, no-store") edit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.tiers.save(token,body,ref);}
}
@Controller("api/v1/public/membership/tiers")
export class PublicMembershipTiersController{
 constructor(private readonly tiers:MembershipTiersService){}
 @Get() @Header("Cache-Control","no-store") list(@Query()q:Record<string,unknown>){return this.tiers.publicList(q);}
}
