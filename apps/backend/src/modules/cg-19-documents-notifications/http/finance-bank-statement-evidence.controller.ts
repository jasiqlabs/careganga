import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {FinanceBankStatementEvidenceService} from "../application/finance-bank-statement-evidence.service";
/** Original private statement upload and reviewer-only source download.
 * The reviewer must inspect real bytes before signing a bank match.
 */
@Controller("api/documents/finance-bank-statements")
export class FinanceBankStatementEvidenceController{
 constructor(private readonly files:FinanceBankStatementEvidenceService){}
 @Post("intents")
 initiate(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.files.initiate(bearer,body);
 }
 @Get("intents/:uploadRef")
 status(@Headers("authorization")bearer:string,@Param("uploadRef")ref:string){
  return this.files.status(bearer,ref);
 }
 @Post("intents/:uploadRef/confirm")
 confirm(@Headers("authorization")bearer:string,@Param("uploadRef")ref:string){
  return this.files.confirm(bearer,ref);
 }
 @Get("matches/:matchRef/files")
 reviewFiles(@Headers("authorization")bearer:string,@Param("matchRef")ref:string){
  return this.files.listForReviewer(bearer,ref);
 }
 @Get("files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")bearer:string,@Param("fileRef")ref:string){
  const result=await this.files.download(bearer,ref);
  return new StreamableFile(result.data,{type:result.mime,
   disposition:'attachment; filename="CareGanga-private-bank-statement"'});
 }
}
