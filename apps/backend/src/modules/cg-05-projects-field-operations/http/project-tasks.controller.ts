import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {ProjectTasksService} from "../application/project-tasks.service";
@Controller("api/v1")
export class ProjectTasksController {
 constructor(private readonly tasks:ProjectTasksService){}
 @Get("project-tasks") @Header("Cache-Control","private, no-store") list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q);}
 @Get("project-tasks/options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.options(t,q);}
 @Get("project-tasks/export") @Header("Cache-Control","private, no-store") export(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,false,true);}
 @Get("field/me/tasks/export") @Header("Cache-Control","private, no-store") exportAssigned(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,true,true);}
 @Get("field/me/tasks") @Header("Cache-Control","private, no-store") assigned(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,true);}
 @Get("projects/:ref/tasks") @Header("Cache-Control","private, no-store") byProject(@Headers("authorization")t:string,@Param("ref")r:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,false,false,r);}
 @Post("projects/:ref/tasks") @Header("Cache-Control","private, no-store") create(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.create(t,r,v);}
 @Get("project-tasks/:ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.tasks.detail(t,r);}
 @Patch("project-tasks/:ref") @Header("Cache-Control","private, no-store") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.edit(t,r,v);}
 @Post("project-tasks/:ref/assign") @Header("Cache-Control","private, no-store") assign(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.assign(t,r,v);}
 @Post("project-tasks/:ref/progress") @Header("Cache-Control","private, no-store") progress(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.progress(t,r,v);}
}
