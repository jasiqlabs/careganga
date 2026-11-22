import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {InventoryMovementEvidenceService} from "../application/inventory-movement-evidence.service";
@Controller("api/v1/inventory/movement-evidence")
export class InventoryMovementEvidenceController{
 constructor(private readonly evidence:InventoryMovementEvidenceService){}
 @Get("operations/:ref") list(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.list(t,ref);}
 @Post("intents") initiate(@Headers("authorization")t:string,@Body()v:unknown){return this.evidence.initiate(t,v);}
 @Get("intents/:ref") status(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.status(t,ref);}
 @Post("intents/:ref/confirm") confirm(@Headers("authorization")t:string,@Param("ref")ref:string){return this.evidence.confirm(t,ref);}
}
