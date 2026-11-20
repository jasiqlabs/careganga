import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile}
 from "@nestjs/common";
import {ClinicalLabEquipmentService}
 from "../application/clinical-lab-equipment.service";
import {ClinicalLabQualityEvidenceService}
 from "../application/clinical-lab-quality-evidence.service";

/** Existing CG16 owner; own CG14 verified and LAB_ERP-granted center only.
 * No public patient, CG12 stock, second CG19 object store or CG17 finance.
 */
@Controller("api/v1/diagnostics/equipment")
export class ClinicalLabEquipmentController{
 constructor(private readonly equipment:ClinicalLabEquipmentService,
  private readonly evidence:ClinicalLabQualityEvidenceService){}
 @Get("foundation/summary")
 summary(@Headers("authorization")token:string){
  return this.equipment.foundationSummary(token);
 }
 @Get("centers/eligible")
 eligible(@Headers("authorization")token:string){
  return this.equipment.eligibleCenters(token);
 }
 @Get("centers/:centerRef/items")
 list(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.equipment.list(token,center);
 }
 @Post("centers/:centerRef/items")
 create(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.equipment.create(token,center,body);}
 @Get("centers/:centerRef/items/:equipmentRef/history")
 history(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string){
  return this.equipment.history(token,center,equipment);
 }
 @Post("centers/:centerRef/items/:equipmentRef/maintenance")
 maintenance(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string,@Body()body:unknown){
  return this.equipment.update(token,center,equipment,body);
 }
 @Get("centers/:centerRef/items/:equipmentRef/evidence/current")
 current(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string){
  return this.evidence.current(token,center,equipment);
 }
 @Post("centers/:centerRef/items/:equipmentRef/evidence/prepare")
 prepare(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string,@Body()body:unknown){
  return this.evidence.prepare(token,center,equipment,body);
 }
 @Get("centers/:centerRef/items/:equipmentRef/evidence/:uploadRef/status")
 status(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string,@Param("uploadRef")upload:string){
  return this.evidence.status(token,center,equipment,upload);
 }
 @Post("centers/:centerRef/items/:equipmentRef/evidence/:uploadRef/confirm")
 confirm(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string,@Param("uploadRef")upload:string){
  return this.evidence.confirm(token,center,equipment,upload);
 }
 @Get("centers/:centerRef/items/:equipmentRef/evidence/files/:fileRef")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async file(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("equipmentRef")equipment:string,@Param("fileRef")file:string){
  const bytes=await this.evidence.file(token,center,equipment,file);
  return new StreamableFile(bytes,{type:"application/pdf",
   disposition:'attachment; filename="careganga-private-lab-quality.pdf"',
   length:bytes.length});
 }
}
