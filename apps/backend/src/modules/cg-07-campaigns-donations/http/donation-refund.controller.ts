import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {DonationRefundService} from "../application/donation-refund.service";
@Controller("api/v1/donations/refunds")
export class DonationRefundController{
 constructor(private readonly refunds:DonationRefundService){}
 @Get("queue")
 queue(@Headers("authorization")auth:string){return this.refunds.queue(auth);}
 @Post("request")
 request(@Headers("authorization")auth:string,@Body()body:unknown){return this.refunds.request(auth,body);}
 @Post(":ref/confirm-cash")
 confirm(@Headers("authorization")auth:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.refunds.confirmCash(auth,ref,body);
 }
}
