import {Body,Controller,Get,Header,Headers,Param,Patch,Post} from "@nestjs/common";
import {MisReportSourceService} from "../application/mis-report-source.service";
import {MisSavedReportService} from "../application/mis-saved-report.service";

/** Private report catalog and live source preview. No arbitrary SQL or
 * persisted rows, and no anonymous/public route.
 */
@Controller("api/v1/mis/reports")
export class MisReportsController{
 constructor(private readonly source:MisReportSourceService,
  private readonly saved:MisSavedReportService){}
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
 @Get("saved")
 @Header("Cache-Control","private, no-store")
 savedList(@Headers("authorization")token:string){return this.saved.list(token);}
 @Post("saved")
 @Header("Cache-Control","private, no-store")
 savedCreate(@Headers("authorization")token:string,@Body()body:unknown){
  return this.saved.create(token,body);
 }
 @Get("saved/:reportRef")
 @Header("Cache-Control","private, no-store")
 savedDetail(@Headers("authorization")token:string,@Param("reportRef")ref:string){
  return this.saved.get(token,ref);
 }
 @Patch("saved/:reportRef")
 @Header("Cache-Control","private, no-store")
 savedRevise(@Headers("authorization")token:string,@Param("reportRef")ref:string,
  @Body()body:unknown){return this.saved.revise(token,ref,body);}
 @Post("saved/:reportRef/copy")
 @Header("Cache-Control","private, no-store")
 savedCopy(@Headers("authorization")token:string,@Param("reportRef")ref:string,
  @Body()body:unknown){return this.saved.copy(token,ref,body);}
 @Post("saved/:reportRef/retire")
 @Header("Cache-Control","private, no-store")
 savedRetire(@Headers("authorization")token:string,@Param("reportRef")ref:string,
  @Body()body:unknown){return this.saved.retire(token,ref,body);}
}
