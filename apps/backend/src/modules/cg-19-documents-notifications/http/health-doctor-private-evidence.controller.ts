import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {HealthDoctorPrivateEvidenceService} from "../application/health-doctor-private-evidence.service";

@Controller("api/documents/doctor-evidence")
export class HealthDoctorPrivateEvidenceController{
  constructor(private readonly evidence:HealthDoctorPrivateEvidenceService){}
  @Post("intents")
  begin(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.evidence.initiate(bearer,body);
  }
  @Get("intents/:intentRef")
  status(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
    return this.evidence.status(bearer,ref);
  }
  @Post("intents/:intentRef/confirm")
  confirm(@Headers("authorization")bearer:string,@Param("intentRef")ref:string){
    return this.evidence.confirm(bearer,ref);
  }
  @Get("doctors/:doctorRef")
  list(@Headers("authorization")bearer:string,@Param("doctorRef")ref:string){
    return this.evidence.list(bearer,ref);
  }
  @Post("files/:fileRef/revoke")
  revoke(@Headers("authorization")bearer:string,@Param("fileRef")ref:string,
    @Body()body:unknown){
    return this.evidence.revoke(bearer,ref,
      body&&typeof body==="object"&&"expectedRevision" in body?
        body.expectedRevision:undefined);
  }
}
