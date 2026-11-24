import {Body,Controller,Delete,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {BeneficiariesService} from "../application/beneficiaries.service";

@Controller("api/v1/beneficiaries")
export class BeneficiariesController{
 constructor(private readonly beneficiaries:BeneficiariesService){}
 @Get() list(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){
  return this.beneficiaries.list(token,query);
 }
 @Get("options") options(@Headers("authorization")token:string,@Query("stateRef")state?:string,@Query("districtRef")district?:string){
  return this.beneficiaries.options(token,state,district);
 }
 @Get("duplicate-suggestions") duplicates(@Headers("authorization")token:string,
  @Query("branchRef")branchRef?:string,@Query("name")name?:string,
  @Query("contactMobile")contactMobile?:string,@Query("excludeRef")excludeRef?:string){
  return this.beneficiaries.duplicateSuggestions(token,{branchRef,name,contactMobile,excludeRef});
 }
 @Get("project-filter-options") filterProjects(@Headers("authorization")token:string,@Query("branchRef")branch?:string,@Query("q")q?:string){
  return this.beneficiaries.projectFilterOptions(token,branch,q);
 }
 @Get("eligible-projects") projects(@Headers("authorization")token:string,
  @Query("branchRef")branch?:string,@Query("q")q?:string){
  return this.beneficiaries.projectOptions(token,branch,q);
 }
 @Post() create(@Headers("authorization")token:string,@Body()body:unknown){
  return this.beneficiaries.create(token,body);
 }
 @Get(":ref/history") history(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.beneficiaries.history(token,ref);
 }
 @Get(":ref/verification-history") verificationHistory(
  @Headers("authorization")token:string,@Param("ref")ref:string){
  return this.beneficiaries.verificationHistory(token,ref);
 }
 @Get(":ref") detail(@Headers("authorization")token:string,@Param("ref")ref:string){
  return this.beneficiaries.detail(token,ref);
 }
 @Patch(":ref") edit(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.beneficiaries.edit(token,ref,body);
 }
 @Patch(":ref/lifecycle") lifecycle(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.beneficiaries.changeLifecycle(token,ref,body);
 }
 @Post(":ref/revoke-consent") revoke(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.beneficiaries.revokeConsent(token,ref,body);
 }
 @Post(":ref/project-links") link(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.beneficiaries.link(token,ref,body);
 }
 @Delete(":ref/project-links") unlink(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){
  return this.beneficiaries.unlink(token,ref,body);
 }
}
