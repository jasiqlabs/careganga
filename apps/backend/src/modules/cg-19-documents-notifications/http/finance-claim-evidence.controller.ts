import {BadRequestException,Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile} from "@nestjs/common";
import {FinanceClaimEvidenceService} from "../application/finance-claim-evidence.service";
@Controller("api/documents/finance-claim-bills")
export class FinanceClaimEvidenceController{
 constructor(private readonly service:FinanceClaimEvidenceService){}
 @Post("intents")
 initiate(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.initiate(bearer,body);
 }
 @Get("intents/:uploadRef")
 status(@Headers("authorization")bearer:string,@Param("uploadRef")ref:string){
  return this.service.status(bearer,ref);
 }
 @Post("intents/:uploadRef/confirm")
 confirm(@Headers("authorization")bearer:string,@Param("uploadRef")ref:string){
  return this.service.confirm(bearer,ref);
 }
 @Get("claims/:claimRef/files")
 list(@Headers("authorization")bearer:string,@Param("claimRef")ref:string,
  @Query("version")version?:string){
  if(!version||!/^[1-9][0-9]{0,5}$/.test(version))
   throw new BadRequestException({code:"FINANCE_CLAIM_BILL_INVALID",field:"claimRef"});
  return this.service.list(bearer,ref,Number(version));
 }
 @Get("review/files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async reviewerDownload(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
  const result=await this.service.download(bearer,ref,true);
  return new StreamableFile(result.data,{type:result.mime,
   disposition:'attachment; filename="CareGanga-protected-review-bill"'});
 }
 @Get("files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
  const result=await this.service.download(bearer,ref);
  return new StreamableFile(result.data,{type:result.mime,
   disposition:'attachment; filename="CareGanga-private-claim-bill"'});
 }
}
