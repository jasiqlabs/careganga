import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {CmsPublicationApprovalService} from "../application/cms-publication-approval.service";
@Controller("api/cms/reviews")
export class CmsPublicationApprovalController{
 constructor(private readonly reviews:CmsPublicationApprovalService){}
 @Get()
 inbox(@Headers("authorization")auth:string,@Query("offset")offset?:string){
  return this.reviews.inbox(auth,offset);
 }
 @Get(":caseRef")
 detail(@Headers("authorization")auth:string,@Param("caseRef")ref:string){
  return this.reviews.detail(auth,ref);
 }
 @Post(":caseRef/decide")
 decide(@Headers("authorization")auth:string,@Param("caseRef")ref:string,
  @Body()value:unknown){
  return this.reviews.decide(auth,ref,value);
 }
}
