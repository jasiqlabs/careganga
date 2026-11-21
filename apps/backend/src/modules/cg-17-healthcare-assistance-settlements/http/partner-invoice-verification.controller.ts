import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {PartnerInvoiceVerificationService} from
 "../application/partner-invoice-verification.service";

/** Separate original source validation from the patient-only intake routes.
 * No endpoint reports Foundation money paid until original CG09 reconciles it.
 */
@Controller("api/v1/healthcare-assistance/partner-verification")
export class PartnerInvoiceVerificationController{
 constructor(private readonly original:PartnerInvoiceVerificationService){}
 @Get("partner/centers/:centerRef/claims/:claimCode")
 @Header("Cache-Control","private, no-store")
 partnerStatus(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("claimCode")code:string){
  return this.original.status(token,center,code,true);
 }
 @Post("partner/centers/:centerRef/claims/:claimCode/attest")
 @Header("Cache-Control","private, no-store")
 attest(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("claimCode")code:string,@Body()body:unknown){
  return this.original.attest(token,center,code,body);
 }
 @Get("foundation/centers/:centerRef/claims/:claimCode")
 @Header("Cache-Control","private, no-store")
 foundationStatus(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("claimCode")code:string){
  return this.original.status(token,center,code,false);
 }
 @Get("foundation/centers/:centerRef/claims/:claimCode/evidence/:kind")
 @Header("Cache-Control","private, no-store")
 @Header("X-Content-Type-Options","nosniff")
 async evidence(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("claimCode")code:string,
  @Param("kind")kind:string){
  const file=await this.original.evidence(token,center,code,kind);
  return new StreamableFile(file.bytes,{
   type:file.mime,disposition:'attachment; filename="CareGanga-reviewed-partner-evidence"'
  });
 }
 @Post("foundation/centers/:centerRef/claims/:claimCode/decide")
 @Header("Cache-Control","private, no-store")
 decide(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("claimCode")code:string,@Body()body:unknown){
  return this.original.decide(token,center,code,body);
 }
}
