import {Body,Controller,Get,Header,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {CsrPartnersService} from "../application/csr-partners.service";
@Controller("api/v1/csr/partners")
@Header("Cache-Control","private, no-store")
export class CsrPartnersController{
 constructor(private readonly partners:CsrPartnersService){}
 @Get("options") options(@Headers("authorization")token:string){return this.partners.options(token);}
 @Get() list(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.partners.list(token,query);}
 @Get(":ref") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.partners.detail(token,ref);}
 @Post() create(@Headers("authorization")token:string,@Body()body:unknown){return this.partners.create(token,body);}
 @Patch(":ref") edit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.partners.edit(token,ref,body);}
 @Post(":ref/cancel") cancel(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.partners.cancel(token,ref,body);}
}
