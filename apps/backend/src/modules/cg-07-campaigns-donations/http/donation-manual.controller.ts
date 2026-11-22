import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {DonationManualService} from "../application/donation-manual.service";
@Controller("api/v1/donations/manual")
export class DonationManualController{
 constructor(private readonly cash:DonationManualService){}
 @Post("prepare") prepare(@Headers("authorization")t:string,@Body()b:unknown){
  return this.cash.prepare(t,b);
 }
 @Get("queue") queue(@Headers("authorization")t:string){return this.cash.queue(t);}
 @Post(":ref/confirm") confirm(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()b:unknown){
  return this.cash.confirm(t,ref,b);
 }
}
