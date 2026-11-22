import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FieldVisitsService} from "../application/field-visits.service";
@Controller("api/v1/field-visits")
@Header("Cache-Control","private, no-store")
export class FieldVisitsController{
 constructor(private readonly visits:FieldVisitsService){}
 @Get() list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.visits.list(t,q);}
 @Get("export") export(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.visits.list(t,q,true);}
 @Get("options") options(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.visits.options(t,q);}
 @Get("geography") geography(@Headers("authorization")t:string,@Query("stateRef")s?:string){return this.visits.geography(t,s);}
 @Post() create(@Headers("authorization")t:string,@Body()body:unknown){return this.visits.create(t,body);}
 @Get(":ref") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.visits.detail(t,r);}
 @Patch(":ref") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.edit(t,r,body);}
 @Post(":ref/check-in") checkIn(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.capture(t,r,body,"CHECK_IN");}
 @Post(":ref/check-out") checkOut(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.capture(t,r,body,"CHECK_OUT");}
 @Post(":ref/cancel") cancel(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.cancel(t,r,body);}
 @Post(":ref/comments") comment(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.visits.comment(t,r,body);}
}
