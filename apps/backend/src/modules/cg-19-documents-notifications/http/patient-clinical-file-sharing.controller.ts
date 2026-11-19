import {
 Body,Controller,Get,Header,Headers,Param,Post,Query,StreamableFile
} from "@nestjs/common";
import {PatientClinicalFileSharingService}
 from "../application/patient-clinical-file-sharing.service";

/** CG19 patient consent is exact scanned file + original appointment.
 * Clinician reads only after CG01 role, CG14 current accepted doctor,
 * actual booked doctor and center, checked-in CG15 visit, active care
 * consent and active file grant are independently enforced in the service.
 */
@Controller("api/documents/patient-clinical")
export class PatientClinicalFileSharingController{
 constructor(private readonly sharing:PatientClinicalFileSharingService){}
 @Get("me/files/:fileRef/shares")
 @Header("Cache-Control","private, no-store")
 myShares(@Headers("authorization")bearer:string,
  @Param("fileRef")file:string){
  return this.sharing.myShares(bearer,file);
 }
 @Post("me/files/:fileRef/shares")
 @Header("Cache-Control","private, no-store")
 share(@Headers("authorization")bearer:string,
  @Param("fileRef")file:string,@Body()payload:unknown){
  return this.sharing.share(bearer,file,payload);
 }
 @Post("me/shares/:grantRef/revoke")
 @Header("Cache-Control","private, no-store")
 revoke(@Headers("authorization")bearer:string,
  @Param("grantRef")ref:string,@Body()payload:unknown){
  return this.sharing.revoke(bearer,ref,payload);
 }
 @Get("centers/:centerRef/bookings/:bookingRef/files")
 @Header("Cache-Control","private, no-store")
 clinicalFiles(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string,@Param("bookingRef")booking:string){
  return this.sharing.availableForClinician(bearer,center,booking);
 }
 @Get("centers/:centerRef/bookings/:bookingRef/files/:fileRef/download")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async clinicalDownload(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string,@Param("bookingRef")booking:string,
  @Param("fileRef")file:string){
  const result=await this.sharing.clinicianRead(bearer,center,booking,file);
  return new StreamableFile(result.bytes,{
   type:result.mime,disposition:'attachment; filename="CareGanga-patient-provided-file"'
  });
 }
}
