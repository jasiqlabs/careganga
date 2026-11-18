import {Body,Controller,Get,Header,Headers,Param,Post,Res,StreamableFile} from "@nestjs/common";
import type {Response} from "express";
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
 @Header("Cache-Control","no-store")
 @Header("X-Content-Type-Options","nosniff")
 async originalImage(@Param("fileRef")ref:string,
  @Headers("range")requestedRange:string|undefined,
  @Res({passthrough:true})response:Response){
  // CG19's publicBytes first verifies current public placement, CG03 publication,
  // media scan/rights and SHA-256, then rechecks revocation after storage read.
  // A Range header never bypasses those checks or grants direct object storage access.
  const x=await this.media.publicBytes(ref);
  if(x.mime!=="video/mp4"){
   return new StreamableFile(x.bytes,{type:x.mime,
    disposition:x.mime==="application/pdf"?"attachment":"inline"});
  }
  const total=x.bytes.length;
  response.setHeader("Accept-Ranges","bytes");
  if(!requestedRange){
   return new StreamableFile(x.bytes,{type:"video/mp4",disposition:"inline"});
  }
  // One bounded HTTP byte range only; no multipart or unchecked integers.
  const m=/^bytes=(\\d*)-(\\d*)$/.exec(requestedRange.trim());
  const first=m?.[1],last=m?.[2];
  let start=0,end=total-1;
  if(!m||(!first&&!last)||total<1){
   response.status(416);
   response.setHeader("Content-Range","bytes */"+total);
   return new StreamableFile(Buffer.alloc(0),{type:"video/mp4"});
  }
  if(!first){
   const suffix=Number(last);
   start=total-Math.min(total,suffix);
  }else{
   start=Number(first);
   if(last)end=Number(last);
  }
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
    start<0||start>=total||end<start||(!first&&Number(last)===0)){
   response.status(416);
   response.setHeader("Content-Range","bytes */"+total);
   return new StreamableFile(Buffer.alloc(0),{type:"video/mp4"});
  }
  end=Math.min(end,total-1);
  response.status(206);
  response.setHeader("Content-Range",`bytes ${start}-${end}/${total}`);
  response.setHeader("Content-Length",String(end-start+1));
  return new StreamableFile(x.bytes.subarray(start,end+1),{
   type:"video/mp4",disposition:"inline"});
 }
}
