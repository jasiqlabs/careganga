import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {ProjectsService} from "../application/projects.service";
@Controller("api/v1/projects")
export class ProjectsController{
 constructor(private readonly projects:ProjectsService){}
 @Get() list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.projects.list(t,q);}
 @Get("me") mine(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.projects.list(t,q,true);}
 @Get("options") options(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.projects.options(t,q);}
 @Get("export") export(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.projects.list(t,q,false,true);}
 @Post() create(@Headers("authorization")t:string,@Body()v:unknown){return this.projects.create(t,v);}
 @Get(":ref") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.projects.detail(t,r);}
 @Patch(":ref") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.projects.edit(t,r,v);}
 @Post(":ref/change-status") status(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.projects.status(t,r,v);}
 @Post(":ref/branch-change") branch(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.projects.branchChange(t,r,v);}
}
