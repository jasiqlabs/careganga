import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {CmsDraftMediaService} from "../application/cms-draft-media.service";
@Controller("api/cms/media")
export class CmsDraftMediaController{
 constructor(private readonly media:CmsDraftMediaService){}
 @Post("initiate")
 initiate(@Headers("authorization")auth:string,@Body()v:unknown){
  return this.media.initiate(auth,v);
 }
 @Get(":uploadRef")
 status(@Headers("authorization")auth:string,@Param("uploadRef")ref:string){
  return this.media.status(auth,ref);
 }
 @Get("preview/:fileRef")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async preview(@Headers("authorization")auth:string,@Param("fileRef")ref:string){
  const file=await this.media.previewBytes(auth,ref);
  return new StreamableFile(file.bytes,{type:file.mime,disposition:"inline"});
 }
 @Post(":uploadRef/confirm")
 confirm(@Headers("authorization")auth:string,@Param("uploadRef")ref:string){
  return this.media.confirm(auth,ref);
 }
}
@Controller("api/public/content")
export class CmsPublicMediaController{
 constructor(private readonly media:CmsDraftMediaService){}
 @Get("media/:fileRef")
 @Header("Cache-Control","public, max-age=0, must-revalidate")
 @Header("X-Content-Type-Options","nosniff")
 async originalImage(@Param("fileRef")ref:string){
  const x=await this.media.publicBytes(ref);
  return new StreamableFile(x.bytes,{type:x.mime,disposition:"inline"});
 }
}
