"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
type Booking={bookingRef:string;bookingId:string;doctorName:string;centerName:string;
 centerAddress:string;startAt:string;endAt:string;timeZone:string;
 bookingStatus:string;collectionStatus:string;paymentMode:string;
 consultationFeeMinor:string;version:number};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function PatientAppointmentDetail({bookingRef}:{bookingRef:string}){
 const [booking,setBooking]=useState<Booking|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(!ID.test(bookingRef))throw Error("This appointment link is invalid.");
  const response=await fetch("/api/consultations/me/"+bookingRef,{
   credentials:"same-origin",cache:"no-store"});
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:"The appointment cannot be checked.");
  setBooking(data as Booking);
 },[bookingRef]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(e=>{if(active)setError(e instanceof Error?e.message:
   "This consultation is unavailable.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 const money=(s:string)=>new Intl.NumberFormat("en-IN",{
  style:"currency",currency:"INR"}).format(Number(s)/100);
 return <section className="cg-public-section">
  <h1>My consultation</h1>
  {loading&&<p role="status">Checking this appointment…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {booking&&<div style={{border:"1px solid #d7dfdb",padding:18,borderRadius:12}}>
   <h2>Booking ID: {booking.bookingId}</h2>
   <p><strong>Status:</strong> {booking.bookingStatus.replaceAll("_"," ")}</p>
   <p><strong>Doctor:</strong> {booking.doctorName}</p>
   <p><strong>Healthcare center:</strong> {booking.centerName}</p>
   <p>{booking.centerAddress}</p>
   <p><strong>Date/time:</strong> {new Date(booking.startAt).toLocaleString("en-IN",{
    timeZone:booking.timeZone,dateStyle:"full",timeStyle:"short"})} ({booking.timeZone})</p>
   <p><strong>Consultation fee:</strong> {money(booking.consultationFeeMinor)}</p>
   <p><strong>Payment status:</strong> {booking.collectionStatus.replaceAll("_"," ")}
    · {booking.paymentMode.replaceAll("_"," ")}</p>
   <p>CareGanga has not verified a payment for this appointment.
    Please confirm payment directly with the healthcare center.</p>
   {["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION"].includes(booking.bookingStatus)&&
    <p><a href={"/api/consultations/me/"+encodeURIComponent(bookingRef)+"/calendar.ics"}>
     Add appointment to my calendar</a></p>}
   <p>Private PDF or QR slip will be available only after original
    CG-19 secure issuance is configured and verified. This booking ID is not
    a public record-access token.</p>
   <Link href="/patients/me">Back to my consultations</Link>
  </div>}
 </section>;
}
