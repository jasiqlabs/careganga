import {Body,Controller,Get,Header,Headers,Post,Query,StreamableFile} from "@nestjs/common";
import {DonationAdminService} from "../application/donation-admin.service";
@Controller("api/v1/donations")
export class DonationAdminController{
 constructor(private readonly donations:DonationAdminService){}
 @Post("donor-detail") @Header("Cache-Control","private, no-store")
 donorDetail(@Headers("authorization")token:string,@Body()body:unknown){
  return this.donations.donorDetail(token,body);
 }
 @Get("export") @Header("Cache-Control","private, no-store")
 async export(@Headers("authorization")bearer:string,@Query()q:Record<string,unknown>){
  const bytes=await this.donations.exportCsv(bearer,q);
  return new StreamableFile(bytes,{type:"text/csv; charset=utf-8",
   disposition:'attachment; filename="CareGanga-Donations.csv"'});
 }
 @Get()
 list(@Headers("authorization")bearer:string,@Query()q:Record<string,unknown>){
  return this.donations.list(bearer,q);
 }
}
