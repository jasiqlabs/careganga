import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";
import { AccountsService } from "../application/accounts.service";
@Controller("api/access")
export class AccountsController {
  constructor(private readonly accounts:AccountsService){}
  @Get("accounts")
  list(@Headers("authorization") bearer:string,@Query("search") search?:string,
      @Query("status") status?:string,@Query("roleRef") roleRef?:string,
      @Query("limit") limit?:string,@Query("offset") offset?:string){
    const numberOr=(v:string|undefined,d:number)=>{
      if(v===undefined)return d;
      if(!/^(0|[1-9]\d{0,4})$/.test(v))throw new BadRequestException();
      return Number(v);
    };
    return this.accounts.list(bearer,{search,status,roleRef,limit:numberOr(limit,20),
      offset:numberOr(offset,0)});
  }
  @Get("accounts/options")
  options(@Headers("authorization") bearer:string,@Query("search") search?:string){
    return this.accounts.options(bearer,search);
  }
  @Post("invitations")
  invite(@Headers("authorization") bearer:string,
    @Body() body:{displayName:string;email:string;roleRef:string;requestKey:string},
    @Req() req:CareGangaRequest){
    return this.accounts.invite(bearer,body,req.cgRequestId??randomUUID());
  }
  @Put("accounts/:accountRef/role")
  assign(@Headers("authorization") bearer:string,@Param("accountRef") accountRef:string,
    @Body() body:{roleRef:string;expectedRevision:number;requestKey:string},
    @Req() req:CareGangaRequest){
    return this.accounts.assign(bearer,accountRef,body,req.cgRequestId??randomUUID());
  }
  @Delete("accounts/:accountRef/role")
  revoke(@Headers("authorization") bearer:string,@Param("accountRef") accountRef:string,
    @Body() body:{expectedRevision:number;requestKey:string},
    @Req() req:CareGangaRequest){
    return this.accounts.revoke(bearer,accountRef,body,req.cgRequestId??randomUUID());
  }
  @Patch("accounts/:accountRef/status")
  status(@Headers("authorization") bearer:string,@Param("accountRef") accountRef:string,
    @Body() body:{status:"ACTIVE"|"SUSPENDED"|"DEACTIVATED";expectedRevision:number;requestKey:string},
    @Req() req:CareGangaRequest){
    return this.accounts.status(bearer,accountRef,body,req.cgRequestId??randomUUID());
  }
}
