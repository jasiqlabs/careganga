import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {ProjectActivitiesService} from "../application/project-activities.service";
@Controller("api/v1")
export class ProjectActivitiesController{
 constructor(private readonly activities:ProjectActivitiesService){}
 @Get("activities") @Header("Cache-Control","private, no-store") list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.activities.list(t,q);}
 @Get("field/me/activities") @Header("Cache-Control","private, no-store") mine(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.activities.list(t,q,true);}
 @Get("activities/export") @Header("Cache-Control","private, no-store") export(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.activities.list(t,q,false,true);}
 @Get("field/me/activities/export") @Header("Cache-Control","private, no-store") exportMine(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.activities.list(t,q,true,true);}
 @Get("activities/options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.activities.options(t,q);}
 @Get("activities/geography") @Header("Cache-Control","private, no-store") geography(@Headers("authorization")t:string,@Query("stateRef")q?:string){return this.activities.geography(t,q);}
 @Post("activities") @Header("Cache-Control","private, no-store") create(@Headers("authorization")t:string,@Body()body:unknown){return this.activities.create(t,body);}
 @Get("activities/:ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")t:string,@Param("ref")r:string){return this.activities.detail(t,r);}
 @Patch("activities/:ref") @Header("Cache-Control","private, no-store") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.activities.edit(t,r,body);}
 @Post("activities/:ref/status") @Header("Cache-Control","private, no-store") status(@Headers("authorization")t:string,@Param("ref")r:string,@Body()body:unknown){return this.activities.status(t,r,body);}
}
