import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {ReferralCatalogService} from "../application/referral-catalog.service";

/** CG13 US001: original Foundation policy, rank and reward product actions.
 * Public catalog is authenticated own CG04 eligibility; no anonymous wallet.
 */
@Controller("api/v1/referrals")
export class ReferralCatalogController{
 constructor(private readonly catalog:ReferralCatalogService){}
 @Get("programmes")
 programmes(@Headers("authorization")auth:string,@Query("page")page?:string){
  return this.catalog.listProgrammes(auth,page);
 }
 @Get("catalogue-programmes")
 catalogueProgrammes(@Headers("authorization")auth:string,@Query("page")page?:string){
  return this.catalog.catalogueProgrammes(auth,page);
 }
 @Post("programmes")
 createProgramme(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.catalog.createProgramme(auth,body);
 }
 @Get("programmes/:programmeRef/summary")
 summary(@Headers("authorization")auth:string,@Param("programmeRef")ref:string){
  return this.catalog.adminSummary(auth,ref);
 }
 @Get("programmes/:programmeRef/redemptions")
 redemptions(@Headers("authorization")auth:string,@Param("programmeRef")ref:string,
  @Query("page")page?:string,@Query("status")status?:string,
  @Query("q")search?:string,@Query("from")from?:string,@Query("to")to?:string){
  return this.catalog.adminRedemptions(auth,ref,page,status,search,from,to);
 }
 @Get("programmes/:programmeRef")
 programme(@Headers("authorization")auth:string,@Param("programmeRef")ref:string){
  return this.catalog.programmeDetail(auth,ref);
 }
 @Patch("programmes/:programmeRef")
 updateProgramme(@Headers("authorization")auth:string,
  @Param("programmeRef")ref:string,@Body()body:unknown){
  return this.catalog.reviseProgramme(auth,ref,body);
 }
 @Post("programmes/:programmeRef/status")
 changeStatus(@Headers("authorization")auth:string,
  @Param("programmeRef")ref:string,@Body()body:unknown){
  return this.catalog.changeProgrammeStatus(auth,ref,body);
 }
 @Get("programmes/:programmeRef/categories")
 categories(@Headers("authorization")auth:string,@Param("programmeRef")ref:string){
  return this.catalog.productCategories(auth,ref);
 }
 @Get("programmes/:programmeRef/products")
 products(@Headers("authorization")auth:string,@Param("programmeRef")ref:string,
  @Query("page")page?:string,@Query("q")search?:string,@Query("category")category?:string){
  return this.catalog.listProducts(auth,ref,page,search,category);
 }
 @Post("products")
 createProduct(@Headers("authorization")auth:string,@Body()body:unknown){
  return this.catalog.createProduct(auth,body);
 }
 @Patch("products/:productRef")
 updateProduct(@Headers("authorization")auth:string,
  @Param("productRef")ref:string,@Body()body:unknown){
  return this.catalog.reviseProduct(auth,ref,body);
 }
 @Get("stock-options")
 stockOptions(@Headers("authorization")auth:string){
  return this.catalog.stockOptions(auth);
 }
 @Get("stock-preview/:itemRef/:storeRef")
 stockPreview(@Headers("authorization")auth:string,
  @Param("itemRef")itemRef:string,@Param("storeRef")storeRef:string){
  return this.catalog.stockPreview(auth,itemRef,storeRef);
 }
 @Get("my-catalog")
 ownCatalog(@Headers("authorization")auth:string,@Query("page")page?:string,
  @Query("q")search?:string,@Query("category")category?:string){
  return this.catalog.publicEligibleCatalog(auth,page,search,category);
 }
}
