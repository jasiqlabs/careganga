import {Controller,Get,Header,Param} from "@nestjs/common";
import {HealthPublicCenterService} from "../application/health-public-center.service";
@Controller("api/v1/public/health-network")
export class HealthPublicCenterController{
 constructor(private readonly centers:HealthPublicCenterService){}
 @Get("centers/:publicSlug")
 @Header("Cache-Control","no-store")
 @Header("X-Content-Type-Options","nosniff")
 center(@Param("publicSlug")slug:string){
  return this.centers.center(slug);
 }
}
