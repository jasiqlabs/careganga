import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {PartnerPublicOffersService} from "../application/partner-public-offers.service";
/** CG14 public information, not optional inventory or procedure ERP. */
@Controller("api/v1/public/health-network/partner-offers")
export class PublicPartnerOffersController{
 constructor(private readonly offers:PartnerPublicOffersService){}
 @Get(":centerSlug")
 @Header("Cache-Control","no-store")
 center(@Param("centerSlug")slug:string){return this.offers.publicList(slug);}
}
@Controller("api/v1/health-network/partner-offers")
export class PartnerOffersController{
 constructor(private readonly offers:PartnerPublicOffersService){}
 @Get("my-centers/eligible")
 @Header("Cache-Control","private, no-store")
 assigned(@Headers("authorization")token:string){return this.offers.assigned(token);}
 @Get("my-centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 myCenter(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.offers.centerList(token,center,false);
 }
 @Post("my-centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 propose(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Body()body:unknown){
  return this.offers.submit(token,center,body);
 }
 @Get("foundation/centers/:centerRef")
 @Header("Cache-Control","private, no-store")
 foundation(@Headers("authorization")token:string,@Param("centerRef")center:string){
  return this.offers.centerList(token,center,true);
 }
 @Post("foundation/centers/:centerRef/offers/:offerCode/decision")
 @Header("Cache-Control","private, no-store")
 review(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("offerCode")code:string,@Body()body:unknown){
  return this.offers.decision(token,center,code,body);
 }
}
