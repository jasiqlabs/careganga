import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {ClinicalLabOrderService} from "../application/clinical-lab-order.service";

/** Internal authenticated CG16 clinical operations, NEVER public checkout.
 * Backend CG01 + current center grant + real CG15 care consent are mandatory.
 */
@Controller("api/v1/diagnostics/clinical")
export class ClinicalLabOrderController{
 constructor(private readonly orders:ClinicalLabOrderService){}
 @Get("centers/:centerRef/orders")
 centerOrders(@Headers("authorization")token:string,
  @Param("centerRef")center:string){
  return this.orders.centerOrders(token,center);
 }
 @Post("centers/:centerRef/orders")
 create(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Body()data:unknown){
  return this.orders.create(token,center,data);
 }
 @Get("centers/:centerRef/orders/:orderRef")
 detail(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.orders.detail(token,center,order);
 }
}
