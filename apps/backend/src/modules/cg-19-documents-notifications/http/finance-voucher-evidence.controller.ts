import {
 Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile
} from "@nestjs/common";
import {FinanceVoucherEvidenceService} from "../application/finance-voucher-evidence.service";

@Controller("api/documents/finance-voucher-evidence")
export class FinanceVoucherEvidenceController{
 constructor(private readonly service:FinanceVoucherEvidenceService){}
 @Post("intents")
 initiate(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.initiate(bearer,body);
 }
 @Get("intents/:intentRef")
 status(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
  return this.service.status(bearer,ref);
 }
 @Post("intents/:intentRef/confirm")
 confirm(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
  return this.service.confirm(bearer,ref);
 }
 @Get("vouchers/:voucherRef/files")
 files(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string,
  @Query("version")version?:string){
  if(!version||!/^([1-9][0-9]{0,5})$/.test(version))
   return {files:[],status:"INVALID_VERSION"};
  return this.service.list(bearer,ref,Number(version));
 }
 @Post("files/:fileRef/revoke")
 revoke(@Headers("authorization")bearer:string,@Param("fileRef")ref:string,
  @Body()body:unknown){
  const v=body&&typeof body==="object"&&"expectedVersion" in body?
   body.expectedVersion:null;
  return this.service.revoke(bearer,ref,Number(v));
 }
 @Get("files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
  const item=await this.service.download(bearer,ref);
  return new StreamableFile(item.data,{type:item.mime,
   disposition:'attachment; filename="CareGanga-private-voucher-evidence"'});
 }
}
