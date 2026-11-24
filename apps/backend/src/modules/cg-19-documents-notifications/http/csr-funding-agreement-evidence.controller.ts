import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {CsrFundingAgreementEvidenceService} from "../application/csr-funding-agreement-evidence.service";
@Controller("api/v1/csr-funding-agreements")
export class CsrFundingAgreementEvidenceController{
 constructor(private readonly proof:CsrFundingAgreementEvidenceService){}
 @Post("intents")
 initiate(@Headers("authorization")token:string,@Body()data:unknown){
  return this.proof.initiate(token,data);
 }
 @Get("intents/:ref")
 status(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.proof.status(token,ref);
 }
 @Post("intents/:ref/confirm")
 confirm(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.proof.confirm(token,ref);
 }
 @Get("proposals/:ref")
 list(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.proof.list(token,ref);
 }
 @Get("files/:ref")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("ref")ref:string){
  const f=await this.proof.download(token,ref);
  return new StreamableFile(f.bytes,{type:f.mime,
   disposition:'attachment; filename="CareGanga-private-CSR-funding-agreement"'});
 }
}
