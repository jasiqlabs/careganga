import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {FinanceAccountsService} from "../application/finance-accounts.service";
import {FinanceJournalReversalService} from "../application/finance-journal-reversal.service";

@Controller("api/finance-accounting")
export class FinanceAccountsController{
 constructor(private readonly service:FinanceAccountsService,
  private readonly corrections:FinanceJournalReversalService){}
 @Get("setup")
 setup(@Headers("authorization")bearer:string,
  @Query("search")search?:string,@Query("offset")offset?:string,
  @Query("kind")kind?:string,@Query("groupRef")groupRef?:string,
  @Query("branchRef")branchRef?:string,@Query("status")status?:string,
  @Query("yearRef")yearRef?:string){
  return this.service.setup(bearer,search,offset,{kind,groupRef,branchRef,status,yearRef});
 }
 @Get("account-options")
 accountOptions(@Headers("authorization")bearer:string,@Query("q")q?:string){
  return this.service.postingAccountOptions(bearer,q);
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
 @Get("manual-journals")
 manualJournals(@Headers("authorization")bearer:string){
  return this.service.manualJournalHistory(bearer);
 }
 @Get("manual-journals/reversal-eligibility")
 manualEligibility(@Headers("authorization")bearer:string){
  return this.corrections.eligibility(bearer);
 }
 @Get("manual-journals/reversal-commands/:requestKey")
 manualReversalStatus(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.corrections.status(bearer,key);
 }
 @Post("manual-journals/:journalRef/reverse")
 reverseManual(@Headers("authorization")bearer:string,@Param("journalRef")ref:string,
  @Body()body:unknown){return this.corrections.reverse(bearer,ref,body);}
 @Post("manual-journals")
 manualJournalPost(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.postGeneral(bearer,body);
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
