import {Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile} from "@nestjs/common";
import {ClinicalLabOrderService} from "../application/clinical-lab-order.service";
import {ClinicalLabOptionsService} from "../application/clinical-lab-options.service";
import {ClinicalLabCustodyService} from "../application/clinical-lab-custody.service";
import {ClinicalLabResultEvidenceService}
 from "../application/clinical-lab-result-evidence.service";
import {ClinicalLabGeneratedResultService}
 from "../application/clinical-lab-generated-result.service";
import {ClinicalLabProfessionalReviewService} from "../application/clinical-lab-professional-review.service";
import {ClinicalLabPatientReleaseService} from "../application/clinical-lab-patient-release.service";

/** Internal authenticated CG16 clinical operations, NEVER public checkout.
 * Backend CG01 + current center grant + real CG15 care consent are mandatory.
 */
@Controller("api/v1/diagnostics/clinical")
export class ClinicalLabOrderController{
 constructor(private readonly orders:ClinicalLabOrderService,
  private readonly options:ClinicalLabOptionsService,
  private readonly custody:ClinicalLabCustodyService,
  private readonly reports:ClinicalLabResultEvidenceService,
  private readonly generated:ClinicalLabGeneratedResultService,
  private readonly professional:ClinicalLabProfessionalReviewService,
  private readonly patientRelease:ClinicalLabPatientReleaseService){}
 @Get("centers/eligible")
 eligible(@Headers("authorization")token:string){
  return this.options.centers(token);
 }
 @Get("centers/:centerRef/patients/eligible")
 patients(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.options.patients(token,center);
 }
 @Get("centers/:centerRef/catalog/eligible")
 catalog(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.options.catalog(token,center);
 }
 @Get("centers/:centerRef/orders")
 centerOrders(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Query("q")q?:string,@Query("offset")offset?:string){
  return this.orders.centerOrders(token,center,q,offset);
 }
 @Post("centers/:centerRef/orders")
 create(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Body()data:unknown){
  return this.orders.create(token,center,data);
 }
 @Post("centers/:centerRef/orders/:orderRef/samples/:sampleRef/:action")
 custodyChange(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Param("sampleRef")sample:string,@Param("action")action:string,
  @Body()body:unknown){
  return this.custody.change(token,center,order,sample,action,body);
 }
 @Get("centers/:centerRef/orders/:orderRef/results/entry")
 @Header("Cache-Control","private, no-store")
 resultEntry(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.generated.eligible(token,center,order);
 }
 @Post("centers/:centerRef/orders/:orderRef/results/generate")
 @Header("Cache-Control","private, no-store")
 generateReport(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Body()body:unknown){
  return this.generated.generate(token,center,order,body);
 }
 @Get("centers/:centerRef/orders/:orderRef/reports/current")
 reportCurrent(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.reports.current(token,center,order);
 }
 @Post("centers/:centerRef/orders/:orderRef/reports/prepare")
 reportPrepare(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Body()body:unknown){
  return this.reports.prepare(token,center,order,body);
 }
 @Get("centers/:centerRef/orders/:orderRef/reports/:uploadRef/status")
 reportStatus(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Param("uploadRef")upload:string){
  return this.reports.status(token,center,order,upload);
 }
 @Post("centers/:centerRef/orders/:orderRef/reports/:uploadRef/confirm")
 reportConfirm(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Param("uploadRef")upload:string){
  return this.reports.confirm(token,center,order,upload);
 }
 @Get("centers/:centerRef/orders/:orderRef/reviews/current")
 currentReview(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.professional.reviewable(token,center,order);
 }
 @Get("centers/:centerRef/orders/:orderRef/reports/reviewer-file")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async reviewerPdf(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  const bytes=await this.professional.reviewerFile(token,center,order);
  return new StreamableFile(bytes,{type:"application/pdf",
   disposition:'attachment; filename="careganga-private-review.pdf"',
   length:bytes.length});
 }
 @Post("centers/:centerRef/orders/:orderRef/reviews")
 review(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Body()body:unknown){return this.professional.decide(token,center,order,body);}
 @Get("centers/:centerRef/orders/:orderRef/release")
 @Header("Cache-Control","private, no-store")
 releaseState(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.patientRelease.state(token,center,order);
 }
 @Post("centers/:centerRef/orders/:orderRef/release")
 @Header("Cache-Control","private, no-store")
 releaseReport(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Body()body:unknown){
  return this.patientRelease.release(token,center,order,body);
 }
 @Get("centers/:centerRef/orders/:orderRef")
 detail(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.orders.detail(token,center,order);
 }
}
