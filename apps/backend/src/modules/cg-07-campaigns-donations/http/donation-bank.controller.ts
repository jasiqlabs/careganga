import {Body,Controller,Headers,Post} from "@nestjs/common";
import {DonationBankService} from "../application/donation-bank.service";
@Controller("api/v1/donations/bank")
export class DonationBankController{
 constructor(private readonly bank:DonationBankService){}
 @Post("options")
 options(@Headers("authorization")token:string,@Body()body:unknown){
  return this.bank.options(token,body);
 }
 @Post("prepare")
 prepare(@Headers("authorization")token:string,@Body()body:unknown){
  return this.bank.prepare(token,body);
 }
}
