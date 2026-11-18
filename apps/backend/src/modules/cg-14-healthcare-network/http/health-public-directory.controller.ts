import {Controller,Get,Header,Param,Query} from "@nestjs/common";
import {HealthPublicDirectoryService} from "../application/health-public-directory.service";
@Controller("api/v1/public/health-network")
export class HealthPublicDirectoryController{
  constructor(private readonly directory:HealthPublicDirectoryService){}
  @Get("sitemap")
  @Header("Cache-Control","no-store, max-age=0")
  sitemap(){return this.directory.sitemap();}
  @Get("centers")
  @Header("Cache-Control","no-store, max-age=0")
  centers(@Query()filters:Record<string,unknown>){return this.directory.centers(filters);}
  @Get("doctors")
  @Header("Cache-Control","no-store, max-age=0")
  doctors(@Query()filters:Record<string,unknown>){return this.directory.doctors(filters);}
  @Get("doctors/:doctorRef")
  @Header("Cache-Control","no-store, max-age=0")
  doctor(@Param("doctorRef")ref:string){return this.directory.doctor(ref);}
}
