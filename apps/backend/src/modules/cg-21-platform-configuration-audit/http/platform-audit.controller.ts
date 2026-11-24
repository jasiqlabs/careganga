import {BadRequestException,Controller,Get,Headers,Param,Query} from "@nestjs/common";
import {PlatformAuditService} from "../application/platform-audit.service";
@Controller("api/platform-configuration-audit/audit")
export class PlatformAuditController{
  constructor(private readonly audit:PlatformAuditService){}
  private validateQuery(input:Record<string,unknown>,allowed:readonly string[]){
    if(Object.keys(input).some(key=>!allowed.includes(key)))
      throw new BadRequestException("This audit filter is not supported");
  }
  @Get()
  list(@Headers("authorization") bearer:string,@Query() query:Record<string,unknown>={}){
    this.validateQuery(query,["cursor","limit","source","from","to","category"]);
    return this.audit.list(bearer,{
      cursor:query.cursor,limit:query.limit,source:query.source,
      from:query.from,to:query.to,category:query.category
    });
  }
  @Get("export")
  export(@Headers("authorization") bearer:string,@Query() query:Record<string,unknown>={}){
    this.validateQuery(query,["source","from","to","category"]);
    return this.audit.export(bearer,{
      source:query.source,from:query.from,to:query.to,category:query.category
    });
  }
  @Get("detail/:eventRef")
  detail(@Headers("authorization") bearer:string,@Param("eventRef") eventRef:string){
    return this.audit.detail(bearer,eventRef);
  }
}
