import {Controller,Get,Headers,Query,Post,Body,Header} from "@nestjs/common";
import {OperationsSummaryService} from "../application/operations-summary.service";
@Controller("api/v1/operations")
export class OperationsSummaryController{
 constructor(private readonly summary:OperationsSummaryService){}
 @Get("summary") @Header("Cache-Control","private, no-store") read(@Headers("authorization")t:string,@Query("scope")scope?:string){return this.summary.read(t,scope);}
 @Post("export") @Header("Cache-Control","private, no-store") export(@Headers("authorization")t:string,@Body("scope")scope?:string){return this.summary.read(t,scope,true);}
}
