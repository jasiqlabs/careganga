import {Body,Controller,Headers,Post,Req,Header} from "@nestjs/common";
import {DonationOnlineService} from "../application/donation-online.service";
import {assertDonationPublicIngress} from "../domain/public-donation-ingress";
/** Never accept client 'paid', payment URLs, merchant IDs or event outcomes. */
@Controller("api/public/donations")
export class DonationOnlineController{
 constructor(private readonly online:DonationOnlineService){}
 @Post("payment-link")
 @Header("Cache-Control","private, no-store")
 link(@Req()req:object,@Body()body:unknown){assertDonationPublicIngress(req,"donor");return this.online.link(body);}
 @Post("webhooks/razorpay")
 @Header("Cache-Control","no-store")
 webhook(@Req()req:object){assertDonationPublicIngress(req,"webhook");return this.online.webhook(req);}
}
