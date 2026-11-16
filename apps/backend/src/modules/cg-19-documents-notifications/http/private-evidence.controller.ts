import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {PrivateEvidenceService} from "../application/private-evidence.service";

@Controller("api/documents")
export class PrivateEvidenceController{
  constructor(private readonly files:PrivateEvidenceService){}
  @Post("files/initiate")
  initiate(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.files.initiate(bearer,body);
  }
  @Get("files/intents/:intentRef")
  status(@Headers("authorization")bearer:string,
    @Param("intentRef")intentRef:string){
    return this.files.status(bearer,intentRef);
  }
  @Post("files/intents/:intentRef/confirm")
  confirm(@Headers("authorization")bearer:string,
    @Param("intentRef")intentRef:string){
    return this.files.confirm(bearer,intentRef);
  }
  @Get("files/case/:caseRef")
  caseFiles(@Headers("authorization")bearer:string,
    @Param("caseRef")caseRef:string){
    return this.files.listCase(bearer,caseRef);
  }
  @Post("files/:fileRef/revoke")
  revoke(@Headers("authorization")bearer:string,
    @Param("fileRef")fileRef:string,@Body()body:unknown){
    return this.files.revoke(bearer,fileRef,body);
  }
  @Get("files/:fileRef/download")
  @Header("Cache-Control","private, no-store")
  @Header("X-Content-Type-Options","nosniff")
  async download(@Headers("authorization")bearer:string,
    @Param("fileRef")fileRef:string){
    const result=await this.files.download(bearer,fileRef);
    return new StreamableFile(result.data,{
      type:result.mime,disposition:'attachment; filename="Private-case-evidence"'
    });
  }
}
