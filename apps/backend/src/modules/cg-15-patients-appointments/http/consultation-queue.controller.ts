import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {ConsultationQueueService} from "../application/consultation-queue.service";
@Controller("api/v1/appointments/queue")
export class ConsultationQueueController{
 constructor(private readonly queue:ConsultationQueueService){}
 @Get("my-centers")
 @Header("Cache-Control","private, no-store")
 options(@Headers("authorization")bearer:string){return this.queue.options(bearer);}
 @Get("my-centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 list(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Query("date")day:string,@Query("after")after?:string){return this.queue.list(bearer,center,day,after);}
 @Post("my-centers/:centerRef/verify-slip")
 @Header("Cache-Control","private, no-store")
 verifySlip(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Body()value:unknown){return this.queue.verifySlipAtMyCenter(bearer,center,value);}
 @Post("my-centers/:centerRef/check-in")
 @Header("Cache-Control","private, no-store")
 checkIn(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Body()value:unknown){return this.queue.checkIn(bearer,center,value);}
 @Post("my-centers/:centerRef/visits/:visitRef/transition")
 @Header("Cache-Control","private, no-store")
 transition(@Headers("authorization")bearer:string,@Param("centerRef")center:string,
  @Param("visitRef")visit:string,@Body()value:unknown){
  return this.queue.transition(bearer,center,visit,value);
 }
}
