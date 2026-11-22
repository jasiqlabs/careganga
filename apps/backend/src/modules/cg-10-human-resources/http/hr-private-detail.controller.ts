import {Body,Controller,Get,Headers,Param,Patch,Query} from "@nestjs/common";
import {HrPrivateDetailService} from "../application/hr-private-detail.service";
/** Separate original private/PII authority; never in ordinary employee lists. */
@Controller("api/hr/private")
export class HrPrivateDetailController{
 constructor(private readonly details:HrPrivateDetailService){}
 @Get("birthdays")
 birthdays(@Headers("authorization")token:string,@Query("offset")offset?:string){return this.details.birthdays(token,offset);}
 @Get(":applicationRef")
 privateRead(@Headers("authorization")token:string,@Param("applicationRef")ref:string){
  return this.details.read(token,ref);
 }
 @Patch(":applicationRef")
 privateUpdate(@Headers("authorization")token:string,@Param("applicationRef")ref:string,
  @Body()body:unknown){return this.details.update(token,ref,body);}
}
