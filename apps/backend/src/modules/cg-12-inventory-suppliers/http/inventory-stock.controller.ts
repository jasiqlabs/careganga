import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {InventoryStockService} from "../application/inventory-stock.service";
@Controller("api/v1/inventory/stock")
export class InventoryStockController{
 constructor(private readonly stock:InventoryStockService){}
 @Post("drafts") create(@Headers("authorization")t:string,@Body()v:unknown){return this.stock.createDraft(t,v);}
 @Get("drafts") drafts(@Headers("authorization")t:string,@Query("location")l:string){return this.stock.drafts(t,l);}
 @Get("drafts/:ref") draft(@Headers("authorization")t:string,@Param("ref")ref:string){return this.stock.draft(t,ref);}
 @Post("drafts/:ref/confirm") confirm(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()v:unknown){return this.stock.confirm(t,ref,v);}
 @Get("events") events(@Headers("authorization")t:string,@Query("location")l:string,@Query("q")q?:string,@Query("offset")o?:string,@Query("kind")k?:string,@Query("from")f?:string,@Query("to")to?:string){return this.stock.events(t,l,q,o,k,f,to);}
 @Post("events/:ref/reverse") reverse(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()v:unknown){return this.stock.reverseReceipt(t,ref,v);}
 @Get("summary") summary(@Headers("authorization")t:string,@Query("location")l:string){return this.stock.summary(t,l);}
}
