import {Controller,Get,Headers,Query} from "@nestjs/common";
import {DonationAdminService} from "../application/donation-admin.service";
@Controller("api/v1/donations")
export class DonationAdminController{
 constructor(private readonly donations:DonationAdminService){}
 @Get()
 list(@Headers("authorization")bearer:string,@Query()q:Record<string,unknown>){
  return this.donations.list(bearer,q);
 }
}
