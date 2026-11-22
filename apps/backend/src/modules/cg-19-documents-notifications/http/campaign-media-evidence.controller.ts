import {Body,Controller,Get,Headers,Param,Post,StreamableFile,Header} from "@nestjs/common";
import {CampaignMediaEvidenceService} from "../application/campaign-media-evidence.service";

/** Only authenticated current Foundation operators. No public CGI file URL. */
@Controller("api/v1/campaign-media")
export class CampaignMediaEvidenceController{
 constructor(private readonly evidence:CampaignMediaEvidenceService){}
 @Get("campaigns/:ref") list(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.evidence.list(token,ref);
 }
 @Post("intents") initiate(@Headers("authorization")token:string,@Body()body:unknown){
  return this.evidence.initiate(token,body);
 }
 @Get("intents/:ref") status(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.evidence.status(token,ref);
 }
 @Post("intents/:ref/confirm") confirm(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.evidence.confirm(token,ref);
 }
 @Get("files/:ref") @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async preview(@Headers("authorization")token:string,@Param("ref")ref:string){
  const file=await this.evidence.preview(token,ref);
  return new StreamableFile(file.bytes,{type:file.mime,disposition:"inline"});
 }
}
