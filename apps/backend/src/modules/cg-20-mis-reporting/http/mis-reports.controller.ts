import {Body,Controller,Get,Header,Headers,Post} from "@nestjs/common";
import {MisReportSourceService} from "../application/mis-report-source.service";

/** Private report catalog and live source preview. No arbitrary SQL or
 * persisted rows, and no anonymous/public route.
 */
@Controller("api/v1/mis/reports")
export class MisReportsController{
 constructor(private readonly source:MisReportSourceService){}
 @Get("templates")
 @Header("Cache-Control","private, no-store")
 templates(@Headers("authorization")token:string){
  return this.source.catalog(token);
 }
 @Post("preview")
 @Header("Cache-Control","private, no-store")
 preview(@Headers("authorization")token:string,@Body()body:unknown){
  return this.source.preview(token,body);
 }
}
