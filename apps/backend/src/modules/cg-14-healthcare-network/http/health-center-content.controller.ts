import {Body,Controller,Get,Headers,Param,Patch,Post} from "@nestjs/common";
import {HealthCenterContentService} from "../application/health-center-content.service";
@Controller("api/v1/health-network/my-centers")
export class HealthCenterContentController{
 constructor(private readonly content:HealthCenterContentService){}
 @Get(":centerRef/content")
 own(@Headers("authorization")bearer:string,@Param("centerRef")center:string){
  return this.content.own(bearer,center);
 }
 @Patch(":centerRef/content")
 save(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Body()body:unknown){
  return this.content.save(bearer,center,body);
 }
}
