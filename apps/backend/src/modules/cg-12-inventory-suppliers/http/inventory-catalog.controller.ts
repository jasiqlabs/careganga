import {Body,Controller,Get,Headers,Post,Query,Param,Patch} from "@nestjs/common";
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
 @Get("items/:ref") item(@Headers("authorization")t:string,@Param("ref")ref:string){return this.catalog.detail(t,"ITEM",ref);}
 @Get("suppliers/:ref") supplier(@Headers("authorization")t:string,@Param("ref")ref:string){return this.catalog.detail(t,"SUPPLIER",ref);}
 @Get("locations/:ref") location(@Headers("authorization")t:string,@Param("ref")ref:string){return this.catalog.detail(t,"LOCATION",ref);}
 @Patch("items/:ref") updateItem(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()v:unknown){return this.catalog.update(t,"ITEM",ref,v);}
 @Patch("suppliers/:ref") updateSupplier(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()v:unknown){return this.catalog.update(t,"SUPPLIER",ref,v);}
 @Patch("locations/:ref") updateLocation(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()v:unknown){return this.catalog.update(t,"LOCATION",ref,v);}
 @Post("threshold") threshold(@Headers("authorization")t:string,@Body()v:unknown){return this.catalog.threshold(t,v);}
 @Get("suppliers/:ref/private") privateRead(@Headers("authorization")t:string,@Param("ref")ref:string){return this.catalog.readSupplierPrivate(t,ref);}
 @Patch("suppliers/:ref/private") privateWrite(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()v:unknown){return this.catalog.writeSupplierPrivate(t,ref,v);}
}
