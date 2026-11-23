import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {CsrFundingProposalsService} from "../application/csr-funding-proposals.service";
/** CG08 owns intended funding, not CG09 posted cash and not CG03 approval. */
@Controller("api/v1/csr/funding-proposals")
export class CsrFundingProposalsController{
 constructor(private readonly source:CsrFundingProposalsService){}
 @Get() list(@Headers("authorization")auth:string,@Query()query:Record<string,unknown>){
  return this.source.list(auth,query);
 }
 @Get(":ref") detail(@Headers("authorization")auth:string,@Param("ref")ref:string){
  return this.source.detail(auth,ref);
 }
 @Post() create(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.source.create(auth,body);
 }
 @Patch(":ref") edit(@Headers("authorization")auth:string,@Param("ref")ref:string,
  @Body()body:unknown){return this.source.edit(auth,ref,body);}
}
