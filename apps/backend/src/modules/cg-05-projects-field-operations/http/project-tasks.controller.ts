import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {ProjectTasksService} from "../application/project-tasks.service";
@Controller("api/v1")
@Header("Cache-Control","private, no-store")
export class ProjectTasksController {
 constructor(private readonly tasks:ProjectTasksService){}
 @Get("project-tasks") list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q);}
 @Get("project-tasks/options") options(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.options(t,q);}
 @Get("project-tasks/export") export(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,false,true);}
 @Get("field/me/tasks") assigned(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,true);}
 @Get("projects/:ref/tasks") byProject(@Headers("authorization")t:string,@Param("ref")r:string,@Query()q:Record<string,unknown>){return this.tasks.list(t,q,false,false,r);}
 @Post("projects/:ref/tasks") create(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.create(t,r,v);}
 @Get("project-tasks/:ref") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.tasks.detail(t,r);}
 @Patch("project-tasks/:ref") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.edit(t,r,v);}
 @Post("project-tasks/:ref/assign") assign(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.assign(t,r,v);}
 @Post("project-tasks/:ref/progress") progress(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.tasks.progress(t,r,v);}
}
