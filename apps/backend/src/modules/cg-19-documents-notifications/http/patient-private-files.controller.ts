import {
 Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile
} from "@nestjs/common";
import {PatientPrivateFilesService} from "../application/patient-private-files.service";

/** CG19 original scanner-verifiable PATIENT-OWNED private file workflow.
 * A center/doctor/staff token alone can never use these routes; every method
 * resolves the same current verified patient link from CG01.
 */
@Controller("api/documents/patient-files")
export class PatientPrivateFilesController{
 constructor(private readonly original:PatientPrivateFilesService){}
 @Post("intents")
 @Header("Cache-Control","private, no-store")
 initiate(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.original.initiate(bearer,body);
 }
 @Get("intents/:intentRef")
 @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
  return this.original.status(bearer,ref);
 }
 @Post("intents/:intentRef/confirm")
 @Header("Cache-Control","private, no-store")
 confirm(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
  return this.original.confirm(bearer,ref);
 }
 @Get("files")
 @Header("Cache-Control","private, no-store")
 list(@Headers("authorization")bearer:string,@Query("after")after?:string){
  return this.original.list(bearer,after);
 }
 @Get("files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")bearer:string,
  @Param("fileRef")file:string){
  const source=await this.original.download(bearer,file);
  return new StreamableFile(source.bytes,{type:source.mime,
   disposition:'attachment; filename="CareGanga-private-patient-file"'});
 }
 @Post("files/:fileRef/revoke")
 @Header("Cache-Control","private, no-store")
 revoke(@Headers("authorization")bearer:string,
  @Param("fileRef")file:string,@Body()body:unknown){
  return this.original.revoke(bearer,file,body);
 }
}
