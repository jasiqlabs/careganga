import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FieldVisitsService} from "../application/field-visits.service";
@Controller("api/v1/field-visits")
export class FieldVisitsController{
 constructor(private readonly visits:FieldVisitsService){}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.visits.list(t,q);}
 @Get("export") @Header("Cache-Control","private, no-store") export(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.visits.list(t,q,true);}
 @Get("options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.visits.options(t,q);}
 @Get("geography") @Header("Cache-Control","private, no-store") geography(@Headers("authorization")t:string,@Query("stateRef")s?:string){return this.visits.geography(t,s);}
 @Post() @Header("Cache-Control","private, no-store") create(@Headers("authorization")t:string,@Body()body:unknown){return this.visits.create(t,body);}
 @Get("commands/:key") @Header("Cache-Control","private, no-store") command(@Headers("authorization")t:string,@Param("key")k:string){return this.visits.commandStatus(t,k);}
 @Get(":ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.visits.detail(t,r);}
 @Patch(":ref") @Header("Cache-Control","private, no-store") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.edit(t,r,body);}
 @Post(":ref/check-in") @Header("Cache-Control","private, no-store") checkIn(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.capture(t,r,body,"CHECK_IN");}
 @Post(":ref/check-out") @Header("Cache-Control","private, no-store") checkOut(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.capture(t,r,body,"CHECK_OUT");}
 @Post(":ref/cancel") @Header("Cache-Control","private, no-store") cancel(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.cancel(t,r,body);}
 @Post(":ref/comments") @Header("Cache-Control","private, no-store") comment(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.comment(t,r,body);}
}
