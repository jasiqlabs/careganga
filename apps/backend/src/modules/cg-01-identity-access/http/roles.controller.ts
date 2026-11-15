import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";
import { randomUUID } from "node:crypto";
import { RolesService } from "../application/roles.service";
import { SessionService } from "../application/session.service";

type RoleBody={
  name:string;description?:string;colorKey?:string|null;actionKeys:unknown;
  requestKey:string;expectedRevision?:number;
};
@Controller("api/access")
export class RolesController {
  constructor(private readonly roles:RolesService,private readonly sessions:SessionService){}
  @Get("effective")
  async effective(@Headers("authorization") bearer:string){
    return this.sessions.effectiveAccess(bearer);
  }
  @Get("capabilities")
  async catalog(@Headers("authorization") bearer:string){
    return this.roles.catalog(bearer);
  }
  @Get("roles")
  async list(@Headers("authorization") bearer:string,
    @Query("search") search?:string,@Query("limit") limit?:string,@Query("offset") offset?:string){
    const numberOr=(v:string|undefined,d:number)=>{
      if(v===undefined)return d;
      if(!/^(0|[1-9]\d{0,4})$/.test(v))throw new BadRequestException();
      return Number(v);
    };
    return this.roles.list(bearer,{search,limit:numberOr(limit,20),offset:numberOr(offset,0)});
  }
  @Get("roles/options")
  async options(@Headers("authorization") bearer:string,@Query("search") search?:string){
    return this.roles.options(bearer,search);
  }
  @Post("roles")
  async create(@Headers("authorization") bearer:string,@Body() body:RoleBody,@Req() req:CareGangaRequest){
    return this.roles.create(bearer,body,req.cgRequestId??randomUUID());
  }
  @Patch("roles/:roleRef")
  async edit(@Headers("authorization") bearer:string,@Param("roleRef") roleRef:string,
    @Body() body:RoleBody,@Req() req:CareGangaRequest){
    return this.roles.edit(bearer,roleRef,body,req.cgRequestId??randomUUID());
  }
  @Post("roles/:roleRef/copy")
  async copy(@Headers("authorization") bearer:string,@Param("roleRef") roleRef:string,
    @Body() body:RoleBody,@Req() req:CareGangaRequest){
    return this.roles.copy(bearer,roleRef,body,req.cgRequestId??randomUUID());
  }
  @Post("roles/:roleRef/retire")
  async retire(@Headers("authorization") bearer:string,@Param("roleRef") roleRef:string,
    @Body() body:{expectedRevision:number;requestKey:string},@Req() req:CareGangaRequest){
    if(!body||typeof body!=="object")throw new BadRequestException();
    return this.roles.retire(bearer,roleRef,body.expectedRevision,body.requestKey,req.cgRequestId??randomUUID());
  }
}
