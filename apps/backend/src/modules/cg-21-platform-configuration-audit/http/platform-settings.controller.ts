import {
  Body,Controller,Get,Headers,Param,Patch,Post,Query,Req,BadRequestException
} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {CareGangaRequest} from "../../../core/observability/request-correlation";
import {PlatformSettingsService} from "../application/platform-settings.service";

@Controller("api/platform-configuration-audit")
export class PlatformSettingsController {
  constructor(private readonly service:PlatformSettingsService){}
  @Get("settings")
  read(@Headers("authorization") bearer:string){
    return this.service.setting(bearer);
  }
  @Get("settings/history")
  history(@Headers("authorization") bearer:string,@Query("limit") limit?:string,
      @Query("offset") offset?:string){
    const numeric=(v:string|undefined,d:number)=>{
      if(v===undefined)return d;
      if(!/^(0|[1-9][0-9]{0,3})$/.test(v))throw new BadRequestException("Invalid page");
      return Number(v);
    };
    return this.service.history(bearer,numeric(limit,20),numeric(offset,0));
  }
  @Patch("settings")
  save(@Headers("authorization") bearer:string,@Body() body:unknown,@Req() req:CareGangaRequest){
    return this.service.saveSetting(bearer,body,req.cgRequestId??randomUUID());
  }
  @Get("integrations")
  connections(@Headers("authorization") bearer:string){
    return this.service.connections(bearer);
  }
  @Post("integrations")
  configure(@Headers("authorization") bearer:string,@Body() body:unknown,@Req() req:CareGangaRequest){
    return this.service.configureConnection(bearer,body,req.cgRequestId??randomUUID());
  }
  @Post("integrations/:provider/:purpose/check")
  check(@Headers("authorization") bearer:string,@Param("provider") provider:string,
      @Param("purpose") purpose:string){
    return this.service.checkConnection(bearer,provider,purpose);
  }
  @Get("changes/:action/:requestKey")
  lookup(@Headers("authorization") bearer:string,@Param("action") action:string,
      @Param("requestKey") requestKey:string){
    return this.service.lookup(bearer,action,requestKey);
  }
}
