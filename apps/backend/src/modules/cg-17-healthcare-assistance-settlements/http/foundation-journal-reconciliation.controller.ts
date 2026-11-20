import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {FoundationJournalReconciliationService}
 from "../application/foundation-journal-reconciliation.service";
/** US006: actual CG09 original journal is the sole posting authority.
 * No center patient cash, no unverified bank transfer or provider settlement.
 */
@Controller("api/v1/healthcare-assistance/foundation-journals")
export class FoundationJournalReconciliationController{
 constructor(private readonly accounting:FoundationJournalReconciliationService){}
 @Get("centers/:centerRef/liabilities/:liabilityRef/options")
 @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("liabilityRef")ref:string){
  return this.accounting.options(token,center,ref);
 }
 @Post("centers/:centerRef/liabilities/:liabilityRef/post")
 @Header("Cache-Control","private, no-store")
 post(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("liabilityRef")ref:string,
  @Body()body:unknown){
  return this.accounting.post(token,center,ref,body);
 }
}
