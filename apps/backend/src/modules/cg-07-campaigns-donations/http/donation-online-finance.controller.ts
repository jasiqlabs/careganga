import {Body,Controller,Headers,Post} from "@nestjs/common";
import {DonationOnlineFinanceService} from "../application/donation-online-finance.service";
@Controller("api/v1/donations/online")
export class DonationOnlineFinanceController{
 constructor(private readonly verified:DonationOnlineFinanceService){}
 @Post("options")
 options(@Headers("authorization")t:string,@Body()b:unknown){return this.verified.options(t,b);}
 @Post("post")
 post(@Headers("authorization")t:string,@Body()b:unknown){return this.verified.post(t,b);}
}
