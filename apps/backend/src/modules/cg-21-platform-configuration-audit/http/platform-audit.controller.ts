import {Controller,Get,Headers,Param,Query} from "@nestjs/common";
import {PlatformAuditService} from "../application/platform-audit.service";
@Controller("api/platform-configuration-audit/audit")
export class PlatformAuditController{
  constructor(private readonly audit:PlatformAuditService){}
  @Get()
  list(@Headers("authorization") bearer:string,@Query("cursor") cursor?:string,
    @Query("limit") limit?:string,@Query("source") source?:string,
    @Query("from") from?:string,@Query("to") to?:string){
    return this.audit.list(bearer,{cursor,limit,source,from,to});
  }
  @Get("export")
  export(@Headers("authorization") bearer:string,@Query("source") source?:string,
    @Query("from") from?:string,@Query("to") to?:string){
    return this.audit.export(bearer,{source,from,to});
  }
  @Get("detail/:eventRef")
  detail(@Headers("authorization") bearer:string,@Param("eventRef") eventRef:string){
    return this.audit.detail(bearer,eventRef);
  }
}
