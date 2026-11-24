import {Body,Controller,Get,Header,Headers,NotFoundException,Param,Post,Put,Query,Res,StreamableFile} from "@nestjs/common";
import type {Response} from "express";
import {createHash} from "node:crypto";
import {CmsEditorialService} from "../application/cms-editorial.service";
@Controller("api/cms")
export class CmsEditorialController{
 constructor(private readonly cms:CmsEditorialService){}
 @Get("beneficiary-impact-source") @Header("Cache-Control","private, no-store")
 beneficiaryImpact(@Headers("authorization")auth:string){return this.cms.beneficiaryImpact(auth);}
 @Get("event-sources") @Header("Cache-Control","private, no-store")
 eventSources(@Headers("authorization")auth:string){return this.cms.eventSources(auth);}
 @Get("campaign-sources") @Header("Cache-Control","private, no-store")
 campaignSources(@Headers("authorization")auth:string){return this.cms.campaignSources(auth);}
 @Get("team-sources") @Header("Cache-Control","private, no-store")
 teamSources(@Headers("authorization")auth:string){return this.cms.teamSources(auth);}
 @Get("partner-sources") @Header("Cache-Control","private, no-store")
 partnerSources(@Headers("authorization")auth:string){return this.cms.partnerSources(auth);}
 @Get("project-sources") @Header("Cache-Control","private, no-store")
 projectSources(@Headers("authorization")auth:string){return this.cms.projectSources(auth);}
 @Get("pages")
 @Header("Cache-Control","private, no-store")
 pages(@Headers("authorization")auth:string,@Query("scope")scope?:string){return this.cms.list(auth,scope);}
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
 @Get("events")
 @Header("Cache-Control","no-store")
 events(@Query("cursor")cursor?:string){return this.cms.publicArticles(undefined,cursor,true);}
 @Get("notices")
 @Header("Cache-Control","no-store")
 @Header("X-Content-Type-Options","nosniff")
 notices(){return this.cms.publicNotices();}
 @Get("donations/readiness") @Header("Cache-Control","no-store")
 donationReadiness(){return this.cms.publicDonationReadiness();}
 @Get("campaigns") @Header("Cache-Control","no-store")
 campaigns(){return this.cms.publicCampaignCatalogue();}
 @Get("campaigns/:slug") @Header("Cache-Control","no-store")
 async campaign(@Param("slug")slug:string){
  const result=await this.cms.publicCampaignCatalogue(slug);
  if(result.cards.length!==1)throw new NotFoundException("Campaign is not currently available.");
  return result.cards[0];
 }
 @Get("release-media/:key") @Header("Cache-Control","no-store") @Header("X-Content-Type-Options","nosniff")
 async releaseMedia(@Param("key")key:string){const bytes=await this.cms.releaseMedia(key);return new StreamableFile(bytes,{type:"image/webp",length:bytes.length,disposition:"inline"});}
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
