import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {BranchPrivateEvidenceService} from "../application/branch-private-evidence.service";

@Controller("api/documents/branch-evidence")
export class BranchPrivateEvidenceController{
 constructor(private readonly files:BranchPrivateEvidenceService){}
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
 @Get("registration/:registrationRef")
 list(@Headers("authorization")bearer:string,@Param("registrationRef")ref:string){
   return this.files.list(bearer,ref);
 }
 @Post("files/:fileRef/revoke")
 revoke(@Headers("authorization")bearer:string,@Param("fileRef")ref:string,@Body()body:unknown){
   const input=body as {expectedRevision?:unknown}|undefined;
   return this.files.revoke(bearer,ref,input?.expectedRevision);
 }
 @Get("files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
   const result=await this.files.download(bearer,ref);
   return new StreamableFile(result.data,{type:result.mime,
     disposition:'attachment; filename="Private-branch-evidence"'});
 }
}
