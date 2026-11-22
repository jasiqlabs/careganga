import {Body,Controller,Get,Headers,Post,Query} from "@nestjs/common";
import {InventoryReportService} from "../application/inventory-report.service";
@Controller("api/v1/inventory/reports")
export class InventoryReportController{
 constructor(private readonly reports:InventoryReportService){}
 @Get() list(@Headers("authorization")t:string,@Query()q:Record<string,unknown>){return this.reports.report(t,q);}
 @Post() export(@Headers("authorization")t:string,@Body()v:unknown){return this.reports.export(t,v);}
}
