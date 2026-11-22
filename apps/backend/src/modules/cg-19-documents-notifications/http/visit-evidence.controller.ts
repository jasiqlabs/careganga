import {Body,Controller,Get,Headers,Param,Post,StreamableFile,Header} from "@nestjs/common";
import {VisitEvidenceService} from "../application/visit-evidence.service";
@Controller("api/v1/visit-evidence")
export class VisitEvidenceController{
 constructor(private readonly evidence:VisitEvidenceService){}
 @Get("visits/:ref") @Header("Cache-Control","private, no-store") list(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.list(t,ref);}
 @Post("intents") @Header("Cache-Control","private, no-store") initiate(@Headers("authorization")t:string,@Body()v:unknown){return this.evidence.initiate(t,v);}
 @Get("intents/:ref") @Header("Cache-Control","private, no-store") status(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.status(t,ref);}
 @Post("intents/:ref/confirm") @Header("Cache-Control","private, no-store") confirm(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.confirm(t,ref);}
 @Get("files/:ref") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async preview(@Headers("authorization")t:string,@Param("ref")ref:string){const v=await this.evidence.preview(t,ref);return new StreamableFile(v.bytes,{type:v.mime,disposition:v.mime.startsWith("image/")?"inline":"attachment"});}
}
