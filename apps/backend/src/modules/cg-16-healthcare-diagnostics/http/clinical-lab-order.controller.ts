import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {ClinicalLabOrderService} from "../application/clinical-lab-order.service";
import {ClinicalLabOptionsService} from "../application/clinical-lab-options.service";
import {ClinicalLabCustodyService} from "../application/clinical-lab-custody.service";

/** Internal authenticated CG16 clinical operations, NEVER public checkout.
 * Backend CG01 + current center grant + real CG15 care consent are mandatory.
 */
@Controller("api/v1/diagnostics/clinical")
export class ClinicalLabOrderController{
 constructor(private readonly orders:ClinicalLabOrderService,
  private readonly options:ClinicalLabOptionsService,
  private readonly custody:ClinicalLabCustodyService){}
 @Get("centers/eligible")
 eligible(@Headers("authorization")token:string){
  return this.options.centers(token);
 }
 @Get("centers/:centerRef/patients/eligible")
 patients(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.options.patients(token,center);
 }
 @Get("centers/:centerRef/catalog/eligible")
 catalog(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.options.catalog(token,center);
 }
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
 @Post("centers/:centerRef/orders/:orderRef/samples/:sampleRef/:action")
 custodyChange(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string,
  @Param("sampleRef")sample:string,@Param("action")action:string,
  @Body()body:unknown){
  return this.custody.change(token,center,order,sample,action,body);
 }
 @Get("centers/:centerRef/orders/:orderRef")
 detail(@Headers("authorization")token:string,
  @Param("centerRef")center:string,@Param("orderRef")order:string){
  return this.orders.detail(token,center,order);
 }
}
