import {Body,Controller,Headers,Post,Req,Header} from "@nestjs/common";
import {DonationOnlineService} from "../application/donation-online.service";
/** Never accept client 'paid', payment URLs, merchant IDs or event outcomes. */
@Controller("api/public/donations")
export class DonationOnlineController{
 constructor(private readonly online:DonationOnlineService){}
 @Post("payment-link")
 @Header("Cache-Control","private, no-store")
 link(@Body()body:unknown){return this.online.link(body);}
 @Post("webhooks/razorpay")
 @Header("Cache-Control","no-store")
 webhook(@Req()req:object){return this.online.webhook(req);}
}
