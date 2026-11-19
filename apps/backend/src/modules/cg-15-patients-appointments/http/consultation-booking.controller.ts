import {Body,Controller,Get,Header,Headers,Param,Post,Query,Res} from "@nestjs/common";
import type {Response} from "express";
import {ConsultationBookingService} from "../application/consultation-booking.service";
@Controller("api/v1/appointments/consultations")
export class ConsultationBookingController{
 constructor(private readonly bookings:ConsultationBookingService){}
 @Get("staff/centers/:centerRef/doctors")
 @Header("Cache-Control","private, no-store")
 centerDoctors(@Headers("authorization")bearer:string,@Param("centerRef")center:string){
  return this.bookings.centerDoctors(bearer,center);
 }
 @Get("staff/centers/:centerRef/doctor/:doctorRef/slots")
 @Header("Cache-Control","private, no-store")
 centerSlots(@Headers("authorization")bearer:string,
  @Param("centerRef")center:string,@Param("doctorRef")doctor:string,
  @Query("date")date:string){
  return this.bookings.centerSlots(bearer,center,doctor,date);
 }
 @Post("staff/holds")
 @Header("Cache-Control","private, no-store")
 staffHold(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.bookings.holdForCenter(bearer,input);
 }
 @Post("staff/confirm")
 @Header("Cache-Control","private, no-store")
 staffConfirm(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.bookings.confirmForCenter(bearer,input);
 }
 @Get("staff/holds/by-request/:requestKey")
 @Header("Cache-Control","private, no-store")
 staffHoldRequest(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.bookings.holdByRequest(bearer,key,true);
 }
 @Get("staff/confirmations/by-request/:requestKey")
 @Header("Cache-Control","private, no-store")
 staffConfirmationRequest(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.bookings.confirmationByRequest(bearer,key,true);
 }
 @Post("holds")
 @Header("Cache-Control","private, no-store")
 hold(@Headers("authorization")bearer:string,@Body()input:unknown){
  return this.bookings.hold(bearer,input);
 }
 @Get("holds/by-request/:requestKey")
 @Header("Cache-Control","private, no-store")
 holdByRequest(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.bookings.holdByRequest(bearer,key);
 }
 @Get("confirmations/by-request/:requestKey")
 @Header("Cache-Control","private, no-store")
 confirmationByRequest(@Headers("authorization")bearer:string,@Param("requestKey")key:string){
  return this.bookings.confirmationByRequest(bearer,key);
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
 @Post("me/:bookingRef/cancel")
 @Header("Cache-Control","private, no-store")
 cancel(@Headers("authorization")bearer:string,
  @Param("bookingRef")ref:string,@Body()body:unknown){
  return this.bookings.cancel(bearer,ref,body);
 }
 @Post("me/:bookingRef/reschedule")
 @Header("Cache-Control","private, no-store")
 reschedule(@Headers("authorization")bearer:string,
  @Param("bookingRef")ref:string,@Body()body:unknown){
  return this.bookings.reschedule(bearer,ref,body);
 }
 @Get("me")
 @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")bearer:string,@Query("limit")limit?:string,
  @Query("after")after?:string){
  return this.bookings.mine(bearer,limit===undefined?20:Number(limit),after);
 }
 @Get("me/:bookingRef/calendar.ics")
 @Header("Cache-Control","private, no-store")
 calendar(@Headers("authorization")bearer:string,@Param("bookingRef")id:string,
  @Res({passthrough:true})response:Response){
  response.setHeader("Content-Type","text/calendar; charset=utf-8");
  response.setHeader("Content-Disposition","attachment; filename=careganga-consultation.ics");
  return this.bookings.calendar(bearer,id);
 }
 @Get("me/:bookingRef")
 @Header("Cache-Control","private, no-store")
 one(@Headers("authorization")bearer:string,@Param("bookingRef")id:string){
  return this.bookings.myOne(bearer,id);
 }
}
