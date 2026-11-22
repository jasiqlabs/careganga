import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {InventoryOperationService} from "../application/inventory-operation.service";
import {InventoryAdjustmentApprovalService} from "../../cg-03-registration-approvals/application/inventory-adjustment-approval.service";
@Controller("api/v1/inventory/operations")
export class InventoryOperationController{
 constructor(private readonly operations:InventoryOperationService,private readonly approval:InventoryAdjustmentApprovalService){}
 @Get() list(@Headers("authorization")t:string,@Query("location")l:string,@Query("review")r?:string){return this.operations.drafts(t,l,r==="true");}
 @Get("recipients") recipients(@Headers("authorization")t:string,@Query("location")l:string,@Query("q")q?:string){return this.operations.recipients(t,l,q);}
 @Get("held-requests") held(@Headers("authorization")t:string,@Query("location")l:string){return this.operations.held(t,l);}
 @Post() create(@Headers("authorization")t:string,@Body()v:unknown){return this.operations.create(t,v);}
 @Post(":ref/confirm") confirm(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.operations.confirm(t,r,v);}
 @Post("process") configure(@Headers("authorization")t:string,@Body()v:unknown){return this.approval.configure(t,v);}
 @Post("reviews/:ref/decide") decide(@Headers("authorization")t:string,@Param("ref")r:string,@Body()v:unknown){return this.approval.decide(t,r,v);}
}
