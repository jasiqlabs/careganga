import {Body,Controller,Get,Headers,Post,Query} from "@nestjs/common";
import {InventoryCatalogService} from "../application/inventory-catalog.service";
@Controller("api/v1/inventory")
export class InventoryCatalogController {
 constructor(private readonly catalog:InventoryCatalogService){}
 @Get("options") options(@Headers("authorization")t:string){return this.catalog.options(t);}
 @Get("items") items(@Headers("authorization")t:string,@Query("location")l?:string,@Query("q")q?:string,@Query("offset")o?:string){return this.catalog.list(t,"ITEM",l,q,o);}
 @Get("suppliers") suppliers(@Headers("authorization")t:string,@Query("location")l?:string,@Query("q")q?:string,@Query("offset")o?:string){return this.catalog.list(t,"SUPPLIER",l,q,o);}
 @Post("items") createItem(@Headers("authorization")t:string,@Body()v:unknown){return this.catalog.create(t,"ITEM",v);}
 @Post("suppliers") createSupplier(@Headers("authorization")t:string,@Body()v:unknown){return this.catalog.create(t,"SUPPLIER",v);}
 @Post("locations") createLocation(@Headers("authorization")t:string,@Body()v:unknown){return this.catalog.create(t,"LOCATION",v);}
}
