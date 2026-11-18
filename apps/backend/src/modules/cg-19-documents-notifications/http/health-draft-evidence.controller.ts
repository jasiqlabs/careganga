import {Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile} from "@nestjs/common";
import {HealthDraftEvidenceService} from "../application/health-draft-evidence.service";

@Controller("api/documents/health-draft")
export class HealthDraftEvidenceController{
  constructor(private readonly evidence:HealthDraftEvidenceService){}
  @Post("intents")
  start(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.evidence.initiate(bearer,body);
  }
  @Get("intents/:intentRef")
  status(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
    return this.evidence.status(bearer,ref);
  }
  @Post("intents/:intentRef/confirm")
  confirm(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
    return this.evidence.confirm(bearer,ref);
  }
  @Get("providers/:providerRef")
  list(@Headers("authorization")bearer:string,@Param("providerRef")ref:string,
    @Query("centerRef")centerRef?:string){
    return this.evidence.list(bearer,ref,centerRef);
  }
  @Post("files/:fileRef/revoke")
  revoke(@Headers("authorization")bearer:string,@Param("fileRef")ref:string,
    @Body()body:unknown){
    return this.evidence.revoke(bearer,ref,
      body&&typeof body==="object"&&"expectedRevision" in body?
        body.expectedRevision:undefined);
  }
  @Get("reviews/:caseRef/download")
  @Header("Cache-Control","private, no-store")
  @Header("X-Content-Type-Options","nosniff")
  async downloadForReview(@Headers("authorization")bearer:string,
    @Param("caseRef")caseRef:string){
    const result=await this.evidence.reviewDownload(bearer,caseRef);
    return new StreamableFile(result.data,{type:result.mime,
      disposition:'attachment; filename="Private-healthcare-review-evidence"'});
  }
  @Get("files/:fileRef/download")
  @Header("Cache-Control","private, no-store")
  @Header("X-Content-Type-Options","nosniff")
  async download(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
    const result=await this.evidence.download(bearer,ref);
    return new StreamableFile(result.data,{type:result.mime,
      disposition:'attachment; filename="Private-healthcare-evidence"'});
  }
}
