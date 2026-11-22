import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {MembershipFeesService} from "../application/membership-fees.service";
@Controller("api/v1/membership/finance")
export class MembershipFeesController{
 constructor(private readonly fees:MembershipFeesService){}
 @Get(":ref/options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string,@Param("ref")ref:string,@Query()q:Record<string,unknown>){return this.fees.options(token,ref,q);}
 @Get(":ref/status") @Header("Cache-Control","private, no-store") status(@Headers("authorization")token:string,@Param("ref")ref:string){return this.fees.status(token,ref);}
 @Post(":ref/record") @Header("Cache-Control","private, no-store") record(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fees.record(token,ref,raw);}
 @Post(":ref/refund") @Header("Cache-Control","private, no-store") refund(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fees.approveRefund(token,ref,raw);}
}
