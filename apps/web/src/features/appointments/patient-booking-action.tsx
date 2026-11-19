"use client";
import Link from "next/link";
import {useRef,useState} from "react";

type Hold={holdRef:string;expiresAt:string;status:string;
 consultationFeeMinor:string;feeVersion:number;};
type Confirmed={bookingRef:string;bookingId:string;doctorRef:string;centerRef:string;
 bookingStatus:string;paymentMode:string;collectionStatus:string;
 startAt:string;endAt:string;consultationFeeMinor:string;};
type Props={doctorRef:string;centerRef:string;doctorName:string;centerName:string;
 startAt:string;endAt:string;feeMinor:string;feeVersion:number;timeZone:string;};
const currency=(minor:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR"}).format(Number(minor)/100);
async function submit<T>(path:string,data:Record<string,unknown>):Promise<T>{
 const response=await fetch("/api/consultations/"+path,{method:"POST",
  cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const item=raw&&typeof raw==="object"&&"message" in raw?
   (raw as {message?:unknown}).message:null;
  throw Error(typeof item==="string"?item:"The booking result is uncertain. Check your appointments.");
 }
 return raw as T;
}
export function PatientBookingAction(p:Props){
 const [hold,setHold]=useState<Hold|null>(null);
 const [confirmed,setConfirmed]=useState<Confirmed|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const holdKey=useRef<string|null>(null),confirmKey=useRef<string|null>(null);
 const sameSlot=useRef(p.startAt+"|"+p.centerRef+"|"+p.feeVersion);
 async function makeHold(){
  if(busy||uncertain)return;
  setBusy(true);setMessage("");
  try{
   const signature=p.startAt+"|"+p.centerRef+"|"+p.feeVersion;
   if(signature!==sameSlot.current){
    holdKey.current=null;confirmKey.current=null;sameSlot.current=signature;
   }
   if(!holdKey.current)holdKey.current=crypto.randomUUID();
   const value=await submit<Hold>("holds",{
    requestKey:holdKey.current,doctorRef:p.doctorRef,centerRef:p.centerRef,
    startAt:p.startAt,endAt:p.endAt,acceptedFeeMinor:p.feeMinor,
    acceptedFeeVersion:p.feeVersion,paymentMode:"PAY_AT_CENTER"
   });
   if(value.status!=="HELD"||Date.parse(value.expiresAt)<=Date.now())
    throw Error("This reservation expired. Refresh the availability before retrying.");
   setHold(value);setUncertain(false);setMessage("Time reserved temporarily. Confirm before it expires.");
  }catch(e){
   setUncertain(true);
   setMessage(e instanceof Error?e.message:"Reservation cannot be confirmed.");
  }finally{setBusy(false);}
 }
 async function confirm(){
  if(busy||uncertain||!hold)return;
  if(Date.parse(hold.expiresAt)<=Date.now()){
   setMessage("Your temporary reservation expired. Refresh and select a current time.");return;
  }
  setBusy(true);setMessage("");
  if(!confirmKey.current)confirmKey.current=crypto.randomUUID();
  try{
   const value=await submit<Confirmed>("confirm",{
    requestKey:confirmKey.current,holdRef:hold.holdRef,
    acceptedFeeMinor:hold.consultationFeeMinor,acceptedFeeVersion:hold.feeVersion,
    paymentMode:"PAY_AT_CENTER"
   });
   setConfirmed(value);setUncertain(false);
   setMessage("Appointment confirmed. Payment is due at the healthcare center.");
  }catch(e){
   setUncertain(true);setMessage(e instanceof Error?e.message:
    "Confirmation outcome uncertain. Check your appointments before retrying.");
  }finally{setBusy(false);}
 }
 async function checkOriginal(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/consultations/me",{cache:"no-store",credentials:"same-origin"});
   if(!res.ok)throw Error("Cannot verify your current appointments. Please try again.");
   const data=await res.json() as {items?:Confirmed[]};
   const exact=data.items?.find(x=>x.startAt===p.startAt&&
    x.doctorRef===p.doctorRef&&x.centerRef===p.centerRef&&
    ["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION","COMPLETED"].includes(x.bookingStatus)&&
    x.consultationFeeMinor===p.feeMinor);
   if(exact){setConfirmed(exact);setUncertain(false);
    setMessage("A matching appointment was found. Review it in your patient history.");
   }else{
    setUncertain(false);
    setMessage("No matching booking was found among recent appointments. Recheck the temporary hold status before retrying.");
   }
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to confirm the earlier result.");}
  finally{setBusy(false);}
 }
 return <div style={{border:"1px solid #d7dfdb",padding:12,borderRadius:12,marginTop:8}}>
  <p style={{margin:"0 0 8px"}}><strong>{p.doctorName}</strong> · {p.centerName}</p>
  <p style={{margin:"0 0 8px"}}>{new Date(p.startAt).toLocaleString("en-IN",{
   timeZone:p.timeZone,dateStyle:"medium",timeStyle:"short"})} ({p.timeZone})</p>
  <p style={{margin:"0 0 8px"}}>Consultation: {currency(p.feeMinor)} ·
   <strong> Pay at center</strong>. No online charge or Foundation benefit is claimed.</p>
  {!!message&&<p role="status" aria-live="polite">{message}</p>}
  {confirmed?<p><strong>Booking confirmed: {confirmed.bookingId}</strong>.
   <Link href="/patients/me"> View my patient profile</Link></p>:
   uncertain?<div>
    <p role="alert">The previous action may have succeeded. Do not make a second payment or new booking.</p>
    <button disabled={busy} type="button" onClick={()=>void checkOriginal()}>
     Check my recent appointments</button>
    <Link href="/patients/me">My patient profile</Link>
   </div>:hold?<button type="button" disabled={busy}
    onClick={()=>void confirm()}>Confirm appointment — payment due at center</button>:
   <button type="button" disabled={busy} onClick={()=>void makeHold()}>
    {busy?"Checking…":"Reserve this appointment time"}</button>}
 </div>;
}
