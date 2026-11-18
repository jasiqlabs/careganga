import {
 Body,Controller,Get,Header,Headers,Param,Post,StreamableFile
} from "@nestjs/common";
import {CenterSupportAttachmentService} from "../application/center-support-attachment.service";
@Controller("api/support/centers/:centerRef/cases/:caseRef/attachments")
export class CenterSupportAttachmentController{
 constructor(private readonly files:CenterSupportAttachmentService){}
 @Get()
 list(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")ref:string){
  return this.files.list(token,center,ref);
 }
 @Post()
 initiate(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")ref:string,@Body()body:unknown){
  return this.files.initiate(token,center,ref,body);
 }
 @Get("intents/:intentRef")
 status(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")ref:string,@Param("intentRef")intent:string){
  return this.files.status(token,center,ref,intent);
 }
 @Post("intents/:intentRef/confirm")
 confirm(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")ref:string,@Param("intentRef")intent:string){
  return this.files.confirm(token,center,ref,intent);
 }
 @Post("files/:fileRef/revoke")
 revoke(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")ref:string,@Param("fileRef")file:string,
  @Body()body:unknown){
  return this.files.revoke(token,center,ref,file,
   body&&typeof body==="object"&&"expectedVersion" in body?
    body.expectedVersion:undefined);
 }
 @Get("files/:fileRef")
 @Header("Cache-Control","no-store, max-age=0, must-revalidate")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("caseRef")ref:string,@Param("fileRef")file:string){
  const doc=await this.files.download(token,center,ref,file);
  return new StreamableFile(doc.bytes,{type:doc.mime,
   disposition:'attachment; filename="private-support-attachment"'});
 }
}
