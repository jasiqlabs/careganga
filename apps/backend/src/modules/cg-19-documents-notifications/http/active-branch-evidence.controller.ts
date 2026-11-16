import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {ActiveBranchEvidenceService} from "../application/active-branch-evidence.service";

@Controller("api/documents/active-branch-files")
export class ActiveBranchEvidenceController{
 constructor(private readonly files:ActiveBranchEvidenceService){}
 @Post("intents")
 initiate(@Headers("authorization")bearer:string,@Body()body:unknown){
   return this.files.initiate(bearer,body);
 }
 @Get("intents/:intentRef")
 status(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
   return this.files.status(bearer,ref);
 }
 @Post("intents/:intentRef/confirm")
 confirm(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
   return this.files.confirm(bearer,ref);
 }
 @Get("branches/:branchRef")
 list(@Headers("authorization")bearer:string,@Param("branchRef")ref:string){
   return this.files.list(bearer,ref);
 }
 @Post("files/:fileRef/revoke")
 revoke(@Headers("authorization")bearer:string,@Param("fileRef")ref:string,
   @Body()body:unknown){
   const r=body as {expectedRevision?:unknown}|undefined;
   return this.files.revoke(bearer,ref,r?.expectedRevision);
 }
 @Get("files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
   const result=await this.files.download(bearer,ref);
   return new StreamableFile(result.data,{type:result.mime,
     disposition:'attachment; filename="Private-branch-document"'});
 }
}
