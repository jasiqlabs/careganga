import {Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {PayrollPayslipService} from "../application/payroll-payslip.service";
@Controller("api/v1/payroll")
export class PayrollPayslipController{
 constructor(private readonly slips:PayrollPayslipService){}
 @Get("me/payslips") @Header("Cache-Control","private, no-store") own(@Headers("authorization")token:string){return this.slips.own(token);}
 @Post("payslips/:line/issue") @Header("Cache-Control","private, no-store") issue(@Headers("authorization")token:string,@Param("line")line:string){return this.slips.issue(token,line);}
 @Post("payslips/:line/email") @Header("Cache-Control","private, no-store") email(@Headers("authorization")token:string,@Param("line")line:string){return this.slips.email(token,line);}
 @Get("payslips/:line/:ref/download") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("line")line:string,@Param("ref")ref:string){return new StreamableFile(await this.slips.download(token,line,ref),{type:"application/pdf",disposition:'attachment; filename="CareGanga-Salary-Statement.pdf"'});}
}
