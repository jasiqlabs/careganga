import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {CenterPatientCollectionService}
 from "../application/center-patient-collection.service";
@Controller("api/v1/healthcare-assistance/center-collections")
export class CenterPatientCollectionController{
 constructor(private readonly money:CenterPatientCollectionService){}
 @Get("me/appointments/:bookingRef")
 @Header("Cache-Control","private, no-store")
 patient(@Headers("authorization")token:string,@Param("bookingRef")booking:string){
  return this.money.patientStatement(token,booking);
 }
 @Get("staff/centers/:centerRef/charges/:chargeRef")
 @Header("Cache-Control","private, no-store")
 detail(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("chargeRef")charge:string){
  return this.money.centerStatement(token,center,charge);
 }
 @Post("staff/centers/:centerRef/charges/:chargeRef/record")
 @Header("Cache-Control","private, no-store")
 record(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("chargeRef")charge:string,@Body()request:unknown){
  return this.money.record(token,center,charge,request);
 }
 @Post("staff/centers/:centerRef/collections/:collectionRef/refund")
 @Header("Cache-Control","private, no-store")
 refund(@Headers("authorization")token:string,@Param("centerRef")center:string,
  @Param("collectionRef")collection:string,@Body()request:unknown){
  return this.money.refund(token,center,collection,request);
 }
}
