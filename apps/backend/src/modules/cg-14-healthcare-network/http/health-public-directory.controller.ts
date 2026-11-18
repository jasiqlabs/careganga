import {Controller,Get,Header,Param,Query,Req} from "@nestjs/common";
import {HealthPublicRequestThrottleService} from "../application/health-public-request-throttle.service";
import {HealthPublicDirectoryService} from "../application/health-public-directory.service";
@Controller("api/v1/public/health-network")
export class HealthPublicDirectoryController{
  constructor(private readonly directory:HealthPublicDirectoryService,
   private readonly throttle:HealthPublicRequestThrottleService){}
  @Get("facets")
  @Header("Cache-Control","no-store, max-age=0")
  async facets(@Req()request:object){await this.throttle.hit(request,"facets");
    return this.directory.facets();}
  @Get("sitemap")
  @Header("Cache-Control","no-store, max-age=0")
  async sitemap(@Req()request:object){await this.throttle.hit(request,"sitemap");
    return this.directory.sitemap();}
  @Get("centers")
  @Header("Cache-Control","no-store, max-age=0")
  async centers(@Req()request:object,@Query()filters:Record<string,unknown>){
    await this.throttle.hit(request,"centers");return this.directory.centers(filters);
  }
  @Get("doctors")
  @Header("Cache-Control","no-store, max-age=0")
  async doctors(@Req()request:object,@Query()filters:Record<string,unknown>){
    await this.throttle.hit(request,"doctors");return this.directory.doctors(filters);
  }
  @Get("doctors/:doctorRef")
  @Header("Cache-Control","no-store, max-age=0")
  async doctor(@Req()request:object,@Param("doctorRef")ref:string){
    await this.throttle.hit(request,"doctor");return this.directory.doctor(ref);
  }
}
