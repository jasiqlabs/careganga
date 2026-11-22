import {Body,Controller,Get,Header,Headers,Param,Post,Put,Query,Res} from "@nestjs/common";
import type {Response} from "express";
import {createHash} from "node:crypto";
import {CmsEditorialService} from "../application/cms-editorial.service";
@Controller("api/cms")
export class CmsEditorialController{
 constructor(private readonly cms:CmsEditorialService){}
 @Get("project-sources") @Header("Cache-Control","private, no-store")
 projectSources(@Headers("authorization")auth:string){return this.cms.projectSources(auth);}
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
 @Get("articles")
 @Header("Cache-Control","no-store")
 articles(@Query("category")category?:string,@Query("cursor")cursor?:string){
  return this.cms.publicArticles(category,cursor);
 }
 @Get("notices")
 @Header("Cache-Control","no-store")
 @Header("X-Content-Type-Options","nosniff")
 notices(){return this.cms.publicNotices();}
 @Get("pages/:slug")
 @Header("Cache-Control","no-store")
 async publicPage(@Param("slug")slug:string,
  @Headers("if-none-match")requestEtag:string|undefined,
  @Res({passthrough:true})response:Response){
  // Recheck the effective publication and image rights on EVERY request
  // before a conditional 304. Revoked files change the ETag even if the
  // original page revision is unchanged.
  const page=slug==="our-work"||slug==="upcoming-projects"?await this.cms.publicProjectCatalogue(slug):await this.cms.publicPage(slug);
  const etag='"'+createHash("sha256").update(JSON.stringify(page)).digest("hex")+'"';
  response.setHeader("ETag",etag);
  response.setHeader("X-Content-Type-Options","nosniff");
  if(requestEtag===etag){response.status(304);return null;}
  return page;
 }
}
