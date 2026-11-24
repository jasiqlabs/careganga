import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {PayrollRunService} from "../application/payroll-run.service";
@Controller("api/v1/payroll/runs")
export class PayrollRunController{
 constructor(private readonly runs:PayrollRunService){}
 @Get("options") @Header("Cache-Control","private, no-store") options(@Headers("authorization")token:string){return this.runs.options(token);}
 @Get() @Header("Cache-Control","private, no-store") list(@Headers("authorization")token:string){return this.runs.list(token);}
 @Post("draft") @Header("Cache-Control","private, no-store") create(@Headers("authorization")token:string,@Body()body:unknown){return this.runs.createDraft(token,body);}
 @Get(":ref") @Header("Cache-Control","private, no-store") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.runs.detail(token,ref);}
}
