import {Controller,Get,Headers} from "@nestjs/common";
import {FinanceVoucherDashboardService} from "../application/finance-voucher-dashboard.service";
@Controller("api/finance-accounting/vouchers")
export class FinanceVoucherDashboardController{
 constructor(private readonly dashboard:FinanceVoucherDashboardService){}
 @Get("dashboard")
 summary(@Headers("authorization")bearer:string){
  return this.dashboard.summary(bearer);
 }
}
