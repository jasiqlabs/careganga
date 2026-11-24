import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {DiagnosticsCatalogService} from "../application/diagnostics-catalog.service";

@Controller("api/v1/diagnostics")
export class DiagnosticsCatalogController{
 constructor(private readonly catalog:DiagnosticsCatalogService){}
 @Get("catalog/admin")
 admin(@Headers("authorization")token:string){return this.catalog.summary(token);}
 @Get("categories")
 categories(@Headers("authorization")token:string){return this.catalog.categories(token);}
 @Post("categories")
 createCategory(@Headers("authorization")token:string,@Body()body:unknown){
  return this.catalog.createCategory(token,body);
 }
 @Get("tests")
 tests(@Headers("authorization")token:string,@Query()filter:unknown){
  return this.catalog.tests(token,filter);
 }
 @Post("tests/export")
 exportSelected(@Headers("authorization")token:string,@Body()body:unknown){
  return this.catalog.exportSelected(token,body);
 }
 @Post("tests")
 createTest(@Headers("authorization")token:string,@Body()body:unknown){
  return this.catalog.createTest(token,body);
 }
 @Patch("tests/:testRef")
 updateTest(@Headers("authorization")token:string,@Param("testRef")ref:string,
  @Body()body:unknown){return this.catalog.updateTest(token,ref,body);}
 @Get("packages")
 packages(@Headers("authorization")token:string){return this.catalog.packages(token);}
 @Post("packages")
 createPackage(@Headers("authorization")token:string,@Body()body:unknown){
  return this.catalog.createPackage(token,body);
 }
 @Get("centers/eligible")
 centers(@Headers("authorization")token:string){return this.catalog.eligibleCenters(token);}
 @Get("my-centers/eligible")
 myCenters(@Headers("authorization")token:string){return this.catalog.eligibleCenters(token,true);}
 @Get("centers/:centerRef/eligible-items")
 items(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.catalog.eligibleItems(token,center);
 }
 @Get("my-centers/:centerRef/eligible-items")
 ownItems(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.catalog.eligibleItems(token,center,true);
 }
 @Get("centers/:centerRef/tests")
 maps(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.catalog.mappings(token,center);
 }
 @Get("my-centers/:centerRef/tests")
 ownMaps(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.catalog.mappings(token,center,true);
 }
 @Post("centers/:centerRef/tests")
 map(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.catalog.mapItem(token,center,body);}
 @Post("my-centers/:centerRef/tests")
 ownMap(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.catalog.mapItem(token,center,body,true);}
 @Get("centers/:centerRef/test-prices")
 prices(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Query("mappingRef")map?:string,@Query("priceStatus")status?:string,@Query("offset")offset?:string){return this.catalog.prices(token,center,map,false,status,offset);}
 @Get("my-centers/:centerRef/test-prices")
 ownPrices(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Query("mappingRef")map?:string,@Query("priceStatus")status?:string,@Query("offset")offset?:string){return this.catalog.prices(token,center,map,true,status,offset);}
 @Post("centers/:centerRef/test-prices")
 propose(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.catalog.proposePrice(token,center,body);}
 @Post("my-centers/:centerRef/test-prices")
 ownPropose(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){return this.catalog.proposePrice(token,center,body,true);}
 @Post("test-prices/:priceRef/approve")
 approve(@Headers("authorization")token:string,@Param("priceRef")ref:string,
  @Body()body:unknown){return this.catalog.approvePrice(token,ref,body);}
 @Post("test-prices/:priceRef/reject")
 reject(@Headers("authorization")token:string,@Param("priceRef")ref:string,
  @Body()body:unknown){return this.catalog.rejectPrice(token,ref,body);}
}
