import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FinanceAccountsService} from "../application/finance-accounts.service";

@Controller("api/finance-accounting")
export class FinanceAccountsController{
 constructor(private readonly service:FinanceAccountsService){}
 @Get("setup")
 setup(@Headers("authorization")bearer:string,
  @Query("search")search?:string,@Query("offset")offset?:string){
  return this.service.setup(bearer,search,offset);
 }
 @Post("years")
 year(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.createYear(bearer,body);
 }
 @Post("groups")
 group(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.createGroup(bearer,body);
 }
 @Post("accounts")
 account(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.createAccount(bearer,body);
 }
 @Post("opening-journals")
 opening(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.postOpening(bearer,body);
 }
 @Patch("years/:yearRef/status")
 yearStatus(@Headers("authorization")bearer:string,@Param("yearRef")yearRef:string,
  @Body()body:unknown){return this.service.changeYearStatus(bearer,yearRef,body);}
 @Patch("accounts/:accountRef/status")
 accountStatus(@Headers("authorization")bearer:string,@Param("accountRef")accountRef:string,
  @Body()body:unknown){return this.service.changeAccountStatus(bearer,accountRef,body);}
 @Get("commands/:kind/:requestKey")
 command(@Headers("authorization")bearer:string,@Param("kind")kind:string,
  @Param("requestKey")key:string){
  return this.service.commandStatus(bearer,kind,key);
 }
}
