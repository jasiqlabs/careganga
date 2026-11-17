import {Body,Controller,Get,Header,Headers,Param,Post,Put} from "@nestjs/common";
import {CmsEditorialService} from "../application/cms-editorial.service";
@Controller("api/cms")
export class CmsEditorialController{
 constructor(private readonly cms:CmsEditorialService){}
 @Get("pages")
 @Header("Cache-Control","private, no-store")
 pages(@Headers("authorization")auth:string){return this.cms.list(auth);}
 @Post("pages")
 create(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.cms.create(auth,body);
 }
 @Get("pages/:pageRef")
 @Header("Cache-Control","private, no-store")
 detail(@Headers("authorization")auth:string,@Param("pageRef")ref:string){
  return this.cms.detail(auth,ref);
 }
 @Put("pages/:pageRef/draft")
 save(@Headers("authorization")auth:string,@Param("pageRef")ref:string,
  @Body()body:unknown){return this.cms.save(auth,ref,body);}
 @Get("pages/:pageRef/preview")
 @Header("Cache-Control","private, no-store")
 @Header("X-Robots-Tag","noindex, nofollow, noarchive")
 preview(@Headers("authorization")auth:string,@Param("pageRef")ref:string){
  return this.cms.detail(auth,ref);
 }
 @Post("pages/:pageRef/submit")
 submit(@Headers("authorization")auth:string,@Param("pageRef")ref:string,
  @Body()body:unknown){return this.cms.submit(auth,ref,body);}
 @Post("pages/:pageRef/publish")
 publish(@Headers("authorization")auth:string,@Param("pageRef")ref:string,
  @Body()body:unknown){return this.cms.publish(auth,ref,body);}
 @Post("pages/:pageRef/withdraw")
 withdraw(@Headers("authorization")auth:string,@Param("pageRef")ref:string,
  @Body()body:unknown){return this.cms.withdraw(auth,ref,body);}
}
@Controller("api/public/content")
export class CmsPublicPagesController{
 constructor(private readonly cms:CmsEditorialService){}
 @Get("navigation")
 @Header("Cache-Control","no-store")
 navigation(){return this.cms.publicNavigation();}
 @Get("pages/:slug")
 @Header("Cache-Control","public, max-age=0, must-revalidate")
 publicPage(@Param("slug")slug:string){return this.cms.publicPage(slug);}
}
