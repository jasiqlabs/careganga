import {PayrollPaymentService} from "../application/payroll-payment.service";
import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {PayrollRunService} from "../application/payroll-run.service";
@Controller("api/v1/payroll/runs")
export class PayrollRunController{
 constructor(private readonly runs:PayrollRunService,private readonly payments:PayrollPaymentService){}
 @Get("options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string){return this.runs.options(token);}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string){return this.runs.list(token);}
 @Post("draft") @Header("Cache-Control","private, no-store") create(@Headers("authorization")token:string,@Body()body:unknown){return this.runs.createDraft(token,body);}
 @Post(":ref/import-current-attendance") @Header("Cache-Control","private, no-store") import(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.runs.command(token,ref,"import-current-attendance",raw);}
 @Post(":ref/calculate") @Header("Cache-Control","private, no-store") calculate(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.runs.command(token,ref,"calculate",raw);}
 @Post(":ref/adjust") @Header("Cache-Control","private, no-store") adjust(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.runs.command(token,ref,"adjust",raw);}
 @Get(":ref/late-options") @Header("Cache-Control","private, no-store") lateOptions(@Headers("authorization")token:string,@Param("ref")ref:string){return this.runs.lateOptions(token,ref);}
 @Post(":ref/late-adjustment") @Header("Cache-Control","private, no-store") lateAdjustment(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.runs.command(token,ref,"late-adjustment",raw);}
 @Get(":ref/validation") @Header("Cache-Control","private, no-store") validation(@Headers("authorization")token:string,@Param("ref")ref:string){return this.runs.detail(token,ref);}
 @Get(":ref/history") @Header("Cache-Control","private, no-store") history(@Headers("authorization")token:string,@Param("ref")ref:string){return this.runs.history(token,ref);}
 @Get(":ref/accrual-options") @Header("Cache-Control","private, no-store") accrualOptions(@Headers("authorization")token:string,@Param("ref")ref:string){return this.payments.options(token,ref);}
 @Post(":ref/request-release") @Header("Cache-Control","private, no-store") accrue(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()raw:unknown){return this.payments.accrue(token,ref,raw);}
 @Get(":ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.runs.detail(token,ref);}
}
