"use client";
import Link from "next/link";
import {useRef,useState} from "react";
type Props={bookingRef:string;expectedVersion:number;
 doctorRef:string;centerRef:string;doctorName:string;centerName:string;
 startAt:string;endAt:string;feeMinor:string;feeVersion:number;timeZone:string};
type Result={bookingId:string;bookingStatus:string;doctorRef:string;startAt:string;centerRef:string;version:number;consultationFeeMinor:string};
type Applied={applied:boolean;bookingId:string;doctorRef:string|null;centerRef:string|null;
 startAt:string|null;currentBooking:Result};
export function PatientRescheduleAction(p:Props){
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [result,setResult]=useState<Result|null>(null),[message,setMessage]=useState("");
 const key=useRef<string|null>(null);
 const cost=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})
  .format(Number(p.feeMinor)/100);
 async function submit(){
  if(busy||uncertain||result)return;
  setBusy(true);setMessage("");
  if(!key.current)key.current=crypto.randomUUID();
  try{
   const r=await fetch("/api/consultations/me/"+encodeURIComponent(p.bookingRef)+"/reschedule",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:key.current,expectedVersion:p.expectedVersion,
     doctorRef:p.doctorRef,centerRef:p.centerRef,startAt:p.startAt,endAt:p.endAt,
     acceptedFeeMinor:p.feeMinor,acceptedFeeVersion:p.feeVersion,
     paymentMode:"PAY_AT_CENTER"})});
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok){
    const item=data&&typeof data==="object"&&"message" in data?
     (data as {message?:unknown}).message:null;
    throw Object.assign(new Error(typeof item==="string"?item:
     "Reschedule status cannot be verified."),{status:r.status});
   }
   setResult(data as Result);
   setMessage("Appointment moved successfully. Your previous time was released.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage((e instanceof Error?e.message:
    "The outcome is uncertain.")+
    (typeof status==="number"&&status>=400&&status<500?
     " Choose a current approved time.":" Check the original appointment before retrying."));
  }
  finally{setBusy(false);}
 }
 async function checkOriginal(){
  if(busy||!uncertain)return;
  setBusy(true);setMessage("");
  try{
   if(!key.current)throw Error("No original reschedule request key exists.");
   const r=await fetch("/api/consultations/me/"+encodeURIComponent(p.bookingRef)+
    "/reschedule/by-request/"+key.current,{
    cache:"no-store",credentials:"same-origin"});
   if(r.ok){
    const applied=await r.json() as Applied;
    if(applied.applied){
     setResult(applied.currentBooking);setUncertain(false);
     setMessage("Your original reschedule request was accepted. The latest booking details are shown.");
     return;
    }
    throw Error("The recorded reschedule response is unavailable.");
   }
   if(r.status!==404)throw Error("The original request status could not be confirmed. Check again.");
   const existing=await fetch("/api/consultations/me/"+encodeURIComponent(p.bookingRef),{
    cache:"no-store",credentials:"same-origin"});
   if(!existing.ok)throw Error("The current booking could not be checked. Retry this status check.");
   const current=await existing.json() as Result;
   if(current.bookingStatus==="CONFIRMED"&&current.version===p.expectedVersion){
    setUncertain(false);
    setMessage("No matching original request is recorded. The booking is unchanged; retry uses the same request key.");
   }else{
    setMessage("The booking changed without a matching original request. Refresh it before taking any action.");
   }
  }catch(e){setMessage(e instanceof Error?e.message:"Original booking status remains uncertain.");}
  finally{setBusy(false);}
 }
 return <div style={{border:"1px solid #d7dfdb",borderRadius:12,padding:12,marginTop:12}}>
  <p><strong>{p.doctorName}</strong> · {p.centerName}</p>
  <p>{new Date(p.startAt).toLocaleString("en-IN",{timeZone:p.timeZone,
   dateStyle:"medium",timeStyle:"short"})} · Consultation: {cost}</p>
  <p><strong>Pay at the center</strong>. The updated price applies only if you accept it.
   Your old slot remains booked until the new slot is confirmed.</p>
  {!!message&&<p role="status">{message}</p>}
  {result?<p><strong>Booking {result.bookingId} updated.</strong>
   <Link href="/patients/me"> View my consultations</Link></p>:
   uncertain?<div>
    <p>Do not create a different booking until the original request is checked.</p>
    <button type="button" disabled={busy} onClick={()=>void checkOriginal()}>
     Check original reschedule outcome</button>
    <Link href="/patients/me"> My Consultations</Link>
   </div>:
   <button disabled={busy} onClick={()=>void submit()} type="button">
    {busy?"Checking…":"Accept fee and reschedule"}</button>}
 </div>;
}
