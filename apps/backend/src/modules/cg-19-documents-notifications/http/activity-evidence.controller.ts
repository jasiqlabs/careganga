import {Body,Controller,Get,Headers,Param,Post,StreamableFile,Header} from "@nestjs/common";
import {ActivityEvidenceService} from "../application/activity-evidence.service";
@Controller("api/v1/activity-evidence")
export class ActivityEvidenceController{
 constructor(private readonly evidence:ActivityEvidenceService){}
 @Get("activities/:ref") list(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.list(t,ref);}
 @Post("intents") initiate(@Headers("authorization")t:string,@Body()v:unknown){return this.evidence.initiate(t,v);}
 @Get("intents/:ref") status(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.status(t,ref);}
 @Post("intents/:ref/confirm") confirm(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.confirm(t,ref);}
 @Get("files/:ref") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async preview(@Headers("authorization")t:string,@Param("ref")ref:string){const v=await this.evidence.preview(t,ref);return new StreamableFile(v.bytes,{type:v.mime,disposition:"inline"});}
}
