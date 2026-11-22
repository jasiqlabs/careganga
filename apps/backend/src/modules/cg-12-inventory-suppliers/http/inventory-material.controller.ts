import {Body,Controller,Get,Headers,HttpCode,Param,Patch,Post,Query} from "@nestjs/common";
import {InventoryMaterialService} from "../application/inventory-material.service";
import {InventoryMaterialApprovalService} from "../../cg-03-registration-approvals/application/inventory-material-approval.service";
@Controller("api/v1/inventory/material-requests")
export class InventoryMaterialController{
 constructor(private readonly material:InventoryMaterialService,private readonly approval:InventoryMaterialApprovalService){}
 @Get() list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.material.list(t,q.location,q,q.review==="true");}
 @Post() save(@Headers("authorization")t:string,@Body()v:unknown){return this.material.save(t,v);}
 @Patch(":ref") edit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.material.save(t,v,r);}
 @Post(":ref/submit") @HttpCode(202) submit(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.material.action(t,r,"submit",v);}
 @Post(":ref/reserve") reserve(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.material.action(t,r,"reserve",v);}
 @Post(":ref/cancel") cancel(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.material.action(t,r,"cancel",v);}
 @Get("process") process(@Headers("authorization")t:string){return this.approval.process(t);}
 @Post("process") configure(@Headers("authorization")t:string,@Body()v:unknown){return this.approval.configure(t,v);}
 @Post("reviews/:ref/decide") decide(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.approval.decide(t,r,v);}
}
