import {Body,Controller,Get,Headers,Param,Post,StreamableFile,Header} from "@nestjs/common";
import {CsrAgreementEvidenceService} from "../application/csr-agreement-evidence.service";
@Controller("api/v1/csr-agreements")
@Header("Cache-Control","private, no-store")
export class CsrAgreementEvidenceController{
 constructor(private readonly evidence:CsrAgreementEvidenceService){}
 @Post("intents") initiate(@Headers("authorization")token:string,@Body()body:unknown){return this.evidence.initiate(token,body);}
 @Get("intents/:ref") status(@Headers("authorization")token:string,@Param("ref")ref:string){return this.evidence.status(token,ref);}
 @Post("intents/:ref/confirm") confirm(@Headers("authorization")token:string,@Param("ref")ref:string){return this.evidence.confirm(token,ref);}
 @Get("partners/:ref") list(@Headers("authorization")token:string,@Param("ref")ref:string){return this.evidence.list(token,ref);}
 @Get("files/:ref") @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("ref")ref:string){
  const f=await this.evidence.download(token,ref);
  return new StreamableFile(f.bytes,{type:f.mime,disposition:'attachment; filename="CareGanga-private-CSR-agreement"'});
 }
}
