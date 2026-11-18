import {
 Body,Controller,Get,Header,Headers,Param,Post,StreamableFile
} from "@nestjs/common";
import {HealthCenterContentMediaService} from "../application/health-center-content-media.service";
@Controller("api/documents/health-center-content")
export class HealthCenterContentMediaController{
 constructor(private readonly media:HealthCenterContentMediaService){}
 @Post("intents")
 initiate(@Headers("authorization")token:string,@Body()body:unknown){
  return this.media.initiate(token,body);
 }
 @Get("intents/:intentRef")
 status(@Headers("authorization")token:string,@Param("intentRef")ref:string){
  return this.media.status(token,ref);
 }
 @Post("intents/:intentRef/confirm")
 confirm(@Headers("authorization")token:string,@Param("intentRef")ref:string){
  return this.media.confirm(token,ref);
 }
 @Get("centers/:centerRef/files")
 files(@Headers("authorization")token:string,@Param("centerRef")ref:string){
  return this.media.list(token,ref);
 }
 @Post("files/:fileRef/attest")
 attest(@Headers("authorization")token:string,@Param("fileRef")ref:string,
  @Body()body:unknown){
  return this.media.attest(token,ref,body);
 }
 @Post("files/:fileRef/revoke")
 revoke(@Headers("authorization")token:string,@Param("fileRef")ref:string,
  @Body()body:unknown){
  return this.media.revoke(token,ref,body&&typeof body==="object"&&
   "expectedVersion" in body?body.expectedVersion:undefined);
 }
 @Post("files/:fileRef/revoke-rights")
 revokeRights(@Headers("authorization")token:string,@Param("fileRef")ref:string,
  @Body()body:unknown){
  return this.media.revokeRights(token,ref,body&&typeof body==="object"&&
   "expectedVersion" in body?body.expectedVersion:undefined);
 }
 @Get("public/:slug/:fileRef")
 @Header("Cache-Control","public, no-store, max-age=0, must-revalidate")
 @Header("X-Content-Type-Options","nosniff")
 async publicPhoto(@Param("slug")slug:string,@Param("fileRef")fileRef:string){
  const safe=await this.media.publicImage(slug,fileRef);
  return new StreamableFile(safe.data,{type:safe.mime,
   disposition:'inline; filename="approved-center-photo"'});
 }
}
