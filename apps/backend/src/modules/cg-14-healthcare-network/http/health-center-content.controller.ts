import {Body,Controller,Get,Headers,Param,Patch,Post} from "@nestjs/common";
import {HealthCenterContentService} from "../application/health-center-content.service";
@Controller("api/v1/health-network/my-centers")
export class HealthCenterContentController{
 constructor(private readonly content:HealthCenterContentService){}
 @Get(":centerRef/content")
 own(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.content.own(token,center);
 }
 @Patch(":centerRef/content")
 save(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){
  return this.content.save(token,center,body);
 }
 @Post(":centerRef/content/submit")
 submit(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){
  return this.content.submit(token,center,body);
 }
 @Post(":centerRef/content/reviews/:caseRef/reopen")
 reopen(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")caseRef:string){
  return this.content.reopen(token,center,caseRef);
 }
 @Post("content/reviews/:caseRef/apply")
 apply(@Headers("authorization")token:string,@Param("caseRef")caseRef:string){
  return this.content.apply(token,caseRef);
 }
 @Post(":centerRef/content/withdraw")
 withdraw(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.content.withdraw(token,center);
 }
}
