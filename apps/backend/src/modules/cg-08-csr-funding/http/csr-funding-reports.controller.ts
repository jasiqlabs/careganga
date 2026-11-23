import {Controller,Get,Header,Headers,Query} from "@nestjs/common";
import {CsrFundingReportsService} from "../application/csr-funding-reports.service";

/** US003 is a private Foundation finance report, never a public CSR view. */
@Controller("api/v1/csr/funding-reports")
export class CsrFundingReportsController{
 constructor(private readonly reports:CsrFundingReportsService){}
 @Get()
 list(@Headers("authorization")auth:string,@Query()query:Record<string,unknown>){
  return this.reports.list(auth,query);
 }
 @Get("export/csv")
 @Header("Cache-Control","private, no-store")
 @Header("Content-Type","text/csv; charset=utf-8")
 exportCsv(@Headers("authorization")auth:string,@Query()query:Record<string,unknown>){
  return this.reports.exportCsv(auth,query);
 }
}
