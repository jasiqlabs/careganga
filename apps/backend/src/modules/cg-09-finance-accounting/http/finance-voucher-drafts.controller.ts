import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FinanceVoucherDraftService} from "../application/finance-voucher-draft.service";

/** Voucher source is DRAFT only. CG-03/19 approval/evidence route is introduced next,
 * so no endpoint can promote a draft to Approved, Paid or Posted here.
 */
@Controller("api/finance-accounting/vouchers")
export class FinanceVoucherDraftController{
 constructor(private readonly service:FinanceVoucherDraftService){}
 @Get("options")
 options(@Headers("authorization")bearer:string){return this.service.options(bearer);}
 @Get("drafts")
 drafts(@Headers("authorization")bearer:string,@Query("offset")offset?:string){return this.service.list(bearer,offset);}
 @Get("drafts/:voucherRef/revisions/:version")
 historical(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string,
  @Param("version")version:string){
  return this.service.historicalDetail(bearer,ref,version);
 }
 @Get("drafts/:voucherRef")
 detail(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string){
  return this.service.detail(bearer,ref);
 }
 @Post("drafts")
 create(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.save(bearer,body);
 }
 @Patch("drafts/:voucherRef")
 revise(@Headers("authorization")bearer:string,
  @Param("voucherRef")ref:string,@Body()body:unknown){
  return this.service.save(bearer,body,ref);
 }
 @Get("draft-commands/:requestKey")
 command(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.service.lookup(bearer,key);
 }
}
