import {Body,Controller,Get,Headers,Post} from "@nestjs/common";
import {DonationOnlineFinanceService} from "../application/donation-online-finance.service";
@Controller("api/v1/donations/online")
export class DonationOnlineFinanceController{
 constructor(private readonly verified:DonationOnlineFinanceService){}
 @Get("reconcile-queue")
 queue(@Headers("authorization")token:string){return this.verified.reconciliationQueue(token);}
 @Post("options")
 options(@Headers("authorization")t:string,@Body()b:unknown){return this.verified.options(t,b);}
 @Post("post")
 post(@Headers("authorization")t:string,@Body()b:unknown){return this.verified.post(t,b);}
}
