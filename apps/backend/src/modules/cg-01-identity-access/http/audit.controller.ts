import { BadRequestException, Controller, Get, Headers, Query } from "@nestjs/common";
import { AccessAuditReader } from "../application/access-audit-reader";
@Controller("api/access")
export class AuditController {
  constructor(private readonly audit:AccessAuditReader){}
  @Get("audit")
  async history(@Headers("authorization") bearer:string,@Query("limit") limit?:string,
    @Query("cursor") cursor?:string,@Query("from") from?:string,
    @Query("to") to?:string,@Query("action") action?:string,
    @Query("targetRef") targetRef?:string) {
    if(limit!==undefined&&!/^[1-9]\d?$/.test(limit))throw new BadRequestException();
    return this.audit.listAccessAudit(bearer,{
      limit:limit===undefined?20:Number(limit),cursor,from,to,action,targetRef
    });
  }
}
