import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {AssistanceService} from "../application/assistance.service";
@Controller("api/v1/assistance")
export class AssistanceController{
 constructor(private readonly source:AssistanceService){}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string,@Query("beneficiaryRef")ref:string){return this.source.list(token,ref);}
 @Get("options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string,@Query("beneficiaryRef")ref:string){return this.source.options(token,ref);}
 @Post() @Header("Cache-Control","private, no-store") create(@Headers("authorization")token:string,@Body()raw:unknown){return this.source.create(token,raw);}
 @Get(":ref/history") @Header("Cache-Control","private, no-store") history(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.history(token,ref);}
}
