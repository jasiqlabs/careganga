import {Body,Controller,Post,Req,Header} from "@nestjs/common";
import {DonationIntentsService} from "../application/donation-intents.service";
/** Anonymous donation intent is not a payment or CG09 receipt.
 * Donor proof stays in a POST body, never in URL/query/logs.
 */
@Controller("api/public/donations")
export class PublicDonationIntentsController{
 constructor(private readonly donations:DonationIntentsService){}
 @Post()
 @Header("Cache-Control","private, no-store")
 create(@Req()req:object,@Body()body:unknown){return this.donations.create(req,body);}
 @Post("status")
 @Header("Cache-Control","private, no-store")
 status(@Req()req:object,@Body()body:unknown){return this.donations.status(req,body);}
}
