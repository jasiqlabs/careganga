import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {VolunteerEvidenceService} from "../application/volunteer-evidence.service";
@Controller("api/documents/volunteer")
export class VolunteerEvidenceController{
 constructor(private readonly evidence:VolunteerEvidenceService){}
 @Post("intents") @Header("Cache-Control","private, no-store") initiate(@Headers("authorization")token:string,@Body()body:unknown){return this.evidence.initiate(token,body);}
 @Get("intents/:ref") @Header("Cache-Control","private, no-store") status(@Headers("authorization")token:string,@Param("ref")ref:string){return this.evidence.status(token,ref);}
 @Post("intents/:ref/confirm") @Header("Cache-Control","private, no-store") confirm(@Headers("authorization")token:string,@Param("ref")ref:string){return this.evidence.confirm(token,ref);}
 @Get("applications/:ref/files") @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string,@Param("ref")ref:string){return this.evidence.list(token,ref);}
 @Get("files/:ref/download") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("ref")ref:string){const f=await this.evidence.download(token,ref);return new StreamableFile(f.bytes,{type:f.mime,disposition:'attachment; filename="CareGanga-private-volunteer-document"'});}
 @Post("files/:ref/revoke") @Header("Cache-Control","private, no-store") revoke(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.evidence.revoke(token,ref,body);}
}
