import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {InventoryReceiptEvidenceService} from "../application/inventory-receipt-evidence.service";
@Controller("api/v1/inventory/evidence")
export class InventoryReceiptEvidenceController{
 constructor(private readonly evidence:InventoryReceiptEvidenceService){}
 @Post("intents") initiate(@Headers("authorization")t:string,@Body()v:unknown){return this.evidence.initiate(t,v);}
 @Get("intents/:ref") status(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.status(t,ref);}
 @Post("intents/:ref/confirm") confirm(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.confirm(t,ref);}
}
