import {Controller,Get,Header,Param,Req} from "@nestjs/common";
import {HealthPublicRequestThrottleService} from "../application/health-public-request-throttle.service";
import {HealthPublicCenterService} from "../application/health-public-center.service";
@Controller("api/v1/public/health-network")
export class HealthPublicCenterController{
 constructor(private readonly centers:HealthPublicCenterService,
  private readonly throttle:HealthPublicRequestThrottleService){}
 @Get("centers/:publicSlug")
 @Header("Cache-Control","no-store")
 @Header("X-Content-Type-Options","nosniff")
 async center(@Req()request:object,@Param("publicSlug")slug:string){
  await this.throttle.hit(request,"center");return this.centers.center(slug);
 }
}
