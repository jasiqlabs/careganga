import {Controller,Get,Header,Headers,Param,StreamableFile}
 from "@nestjs/common";
import {ClinicalLabPatientReleaseService}
 from "../application/clinical-lab-patient-release.service";
/** Patient-only access. CG15 owns identity; no public PDF or presigned link. */
@Controller("api/v1/diagnostics/patient-reports")
export class ClinicalLabPatientReportController{
 constructor(private readonly source:ClinicalLabPatientReleaseService){}
 @Get("me")
 @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")token:string){
  return this.source.patientReports(token);
 }
 @Get("me/:releaseRef/pdf")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async pdf(@Headers("authorization")token:string,
  @Param("releaseRef")ref:string){
  const bytes=await this.source.patientPdf(token,ref);
  return new StreamableFile(bytes,{type:"application/pdf",
   disposition:'attachment; filename="careganga-laboratory-report.pdf"',
   length:bytes.length});
 }
}
