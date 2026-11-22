import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HrAppraisalService} from "../application/hr-appraisal.service";
@Controller("api/hr")
export class HrAppraisalController{
 constructor(private readonly appraisals:HrAppraisalService){}
 @Get("appraisals/options")
 options(@Headers("authorization")token:string,@Query("search")search?:string){return this.appraisals.options(token,search);}
 @Get("appraisals")
 list(@Headers("authorization")token:string,@Query("offset")offset?:string){return this.appraisals.list(token,offset);}
 @Post("appraisals")
 create(@Headers("authorization")token:string,@Body()body:unknown){return this.appraisals.create(token,body);}
 @Get("appraisals/:ref")
 detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.appraisals.detail(token,ref);}
 @Post("appraisals/:ref/edit")
 edit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.appraisals.edit(token,ref,body);}
 @Post("appraisals/:ref/submit")
 submit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.appraisals.transition(token,ref,body,"SUBMIT");}
 @Post("appraisals/:ref/release")
 release(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.appraisals.transition(token,ref,body,"RELEASE");}
 @Get("me/appraisals")
 mine(@Headers("authorization")token:string){return this.appraisals.mine(token);}
}
