import {Body,Controller,Get,Header,Headers,Param,Patch,Post,StreamableFile} from "@nestjs/common";
import {MisReportSourceService} from "../application/mis-report-source.service";
import {MisSavedReportService} from "../application/mis-saved-report.service";
import {MisReportRunService} from "../application/mis-report-run.service";
import {MisReportScheduleService} from "../application/mis-report-schedule.service";

/** Private report catalog and live source preview. No arbitrary SQL or
 * persisted rows, and no anonymous/public route.
 */
@Controller("api/v1/mis/reports")
export class MisReportsController{
 constructor(private readonly source:MisReportSourceService,
  private readonly saved:MisSavedReportService,
  private readonly runs:MisReportRunService,
  private readonly schedule:MisReportScheduleService){}
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
 @Post("runs")
 @Header("Cache-Control","private, no-store")
 createRun(@Headers("authorization")token:string,@Body()body:unknown){
  return this.runs.create(token,body);
 }
 @Get("runs")
 @Header("Cache-Control","private, no-store")
 listRuns(@Headers("authorization")token:string){return this.runs.list(token);}
 @Get("runs/:runRef")
 @Header("Cache-Control","private, no-store")
 runStatus(@Headers("authorization")token:string,@Param("runRef")ref:string){
  return this.runs.status(token,ref);
 }
 @Get("runs/:runRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,
  @Param("runRef")ref:string){
  const file=await this.runs.download(token,ref);
  return new StreamableFile(file.bytes,{type:file.mime,
   disposition:'attachment; filename="'+file.filename+'"'});
 }

 @Get("schedules")
 @Header("Cache-Control","private, no-store")
 scheduleList(@Headers("authorization")token:string){
  return this.schedule.list(token);
 }
 @Post("schedules")
 @Header("Cache-Control","private, no-store")
 scheduleCreate(@Headers("authorization")token:string,@Body()body:unknown){
  return this.schedule.create(token,body);
 }
 @Post("schedules/:scheduleRef/pause")
 @Header("Cache-Control","private, no-store")
 schedulePause(@Headers("authorization")token:string,@Param("scheduleRef")ref:string,
  @Body()body:unknown){return this.schedule.pause(token,ref,body);}
 @Post("schedules/:scheduleRef/resume")
 @Header("Cache-Control","private, no-store")
 scheduleResume(@Headers("authorization")token:string,@Param("scheduleRef")ref:string){
  return this.schedule.resume(token,ref);
 }
 @Get("schedules/:scheduleRef/history")
 @Header("Cache-Control","private, no-store")
 scheduleHistory(@Headers("authorization")token:string,@Param("scheduleRef")ref:string){
  return this.schedule.history(token,ref);
 }

}
