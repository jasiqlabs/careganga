import {Controller,Get,Header,Query,Req} from "@nestjs/common";
import {PublicHealthcareAssistanceService}
 from "../application/public-healthcare-assistance.service";

/** Only genuine current supported CG17 policy, never patient charge,
 * patient identity, center merchant credentials or future lab/ERP discounts.
 */
@Controller("api/v1/public/healthcare-assistance")
export class PublicHealthcareAssistanceController{
 constructor(private readonly policies:PublicHealthcareAssistanceService){}
 @Get("consultation-benefits")
 @Header("Cache-Control","no-store, max-age=0")
 current(@Req()request:object,@Query()filters:Record<string,unknown>){
  return this.policies.current(request,filters);
 }
}
