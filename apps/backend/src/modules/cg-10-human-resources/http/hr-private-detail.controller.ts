import {Body,Controller,Get,Headers,Param,Patch} from "@nestjs/common";
import {HrPrivateDetailService} from "../application/hr-private-detail.service";
/** Separate original private/PII authority; never in ordinary employee lists. */
@Controller("api/hr/private")
export class HrPrivateDetailController{
 constructor(private readonly details:HrPrivateDetailService){}
 @Get(":applicationRef")
 privateRead(@Headers("authorization")token:string,@Param("applicationRef")ref:string){
  return this.details.read(token,ref);
 }
 @Patch(":applicationRef")
 privateUpdate(@Headers("authorization")token:string,@Param("applicationRef")ref:string,
  @Body()body:unknown){return this.details.update(token,ref,body);}
}
