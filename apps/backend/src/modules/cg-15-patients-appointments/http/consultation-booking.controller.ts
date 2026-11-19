import {Body,Controller,Get,Header,Headers,Param,Post,Query} from "@nestjs/common";
import {ConsultationBookingService} from "../application/consultation-booking.service";
@Controller("api/v1/appointments/consultations")
export class ConsultationBookingController{
 constructor(private readonly bookings:ConsultationBookingService){}
 @Post("holds")
 @Header("Cache-Control","private, no-store")
 hold(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.bookings.hold(bearer,input);
 }
 @Get("holds/:holdRef")
 @Header("Cache-Control","private, no-store")
 holdStatus(@Headers("authorization")bearer:string,@Param("holdRef")ref:string){
  return this.bookings.holdStatus(bearer,ref);
 }
 @Post("confirm")
 @Header("Cache-Control","private, no-store")
 confirm(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.bookings.confirm(bearer,input);
 }
 @Get("me")
 @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")bearer:string,@Query("limit")limit?:string){
  return this.bookings.mine(bearer,limit===undefined?20:Number(limit));
 }
 @Get("me/:bookingRef")
 @Header("Cache-Control","private, no-store")
 one(@Headers("authorization")bearer:string,@Param("bookingRef")id:string){
  return this.bookings.myOne(bearer,id);
 }
}
