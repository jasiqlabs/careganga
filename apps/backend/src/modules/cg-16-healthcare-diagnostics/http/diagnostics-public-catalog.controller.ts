import {Controller,Get,Header,Query,Req} from "@nestjs/common";
import {HealthPublicRequestThrottleService}
 from "../../cg-14-healthcare-network/application/health-public-request-throttle.service";
import {DiagnosticsPublicCatalogService} from "../application/diagnostics-public-catalog.service";
@Controller("api/v1/public/diagnostics")
export class DiagnosticsPublicCatalogController{
 constructor(private readonly directory:DiagnosticsPublicCatalogService,
  private readonly throttle:HealthPublicRequestThrottleService){}
 @Get("facets")
 @Header("Cache-Control","no-store, max-age=0")
 @Header("X-Content-Type-Options","nosniff")
 async facets(@Req()request:object){
  await this.throttle.hit(request,"facets");
  return this.directory.facets();
 }
 @Get("offers")
 @Header("Cache-Control","no-store, max-age=0")
 @Header("X-Content-Type-Options","nosniff")
 async offers(@Req()request:object,@Query()query:Record<string,unknown>){
  await this.throttle.hit(request,"centers");
  return this.directory.offers(query);
 }
}
