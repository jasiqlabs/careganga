import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {AssistanceFulfillmentService} from "../application/assistance-fulfillment.service";
import {AssistanceService} from "../application/assistance.service";
@Controller("api/v1/assistance")
export class AssistanceController{
 constructor(private readonly source:AssistanceService,private readonly fulfillment:AssistanceFulfillmentService){}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string,@Query("beneficiaryRef")ref:string){return this.source.list(token,ref);}
 @Get("options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string,@Query("beneficiaryRef")ref:string){return this.source.options(token,ref);}
 @Post() @Header("Cache-Control","private, no-store") create(@Headers("authorization")token:string,@Body()raw:unknown){return this.source.create(token,raw);}
 @Get(":ref/history") @Header("Cache-Control","private, no-store") history(@Headers("authorization")token:string,@Param("ref")ref:string){return this.source.history(token,ref);}
 @Get(":ref/fulfillment") @Header("Cache-Control","private, no-store") allocations(@Headers("authorization")token:string,@Param("ref")ref:string){return this.fulfillment.list(token,ref);}
 @Get(":ref/payment-options") @Header("Cache-Control","private, no-store") paymentOptions(@Headers("authorization")token:string,@Param("ref")ref:string){return this.fulfillment.paymentOptions(token,ref);}
 @Post(":ref/deliver-material") @Header("Cache-Control","private, no-store") material(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fulfillment.prepareStock(token,ref,raw);}
 @Post(":ref/deliver-financial") @Header("Cache-Control","private, no-store") financial(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fulfillment.preparePayment(token,ref,raw);}
 @Post(":ref/return") @Header("Cache-Control","private, no-store") returnStock(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fulfillment.prepareStock(token,ref,raw,true);}
 @Post(":ref/prepare-recovery") @Header("Cache-Control","private, no-store") recovery(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fulfillment.prepareRecovery(token,ref,raw);}
 @Post(":ref/confirm-recovery") @Header("Cache-Control","private, no-store") recovered(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fulfillment.confirmRecovery(token,ref,raw);}
 @Post(":ref/confirm-handover") @Header("Cache-Control","private, no-store") handover(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.fulfillment.confirm(token,ref,raw);}
}
