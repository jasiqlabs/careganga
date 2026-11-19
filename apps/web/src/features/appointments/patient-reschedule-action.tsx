"use client";
import Link from "next/link";
import {useRef,useState} from "react";
type Props={bookingRef:string;expectedVersion:number;
 doctorRef:string;centerRef:string;doctorName:string;centerName:string;
 startAt:string;endAt:string;feeMinor:string;feeVersion:number;timeZone:string};
type Result={bookingId:string;bookingStatus:string;startAt:string;consultationFeeMinor:string};
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
     centerRef:p.centerRef,startAt:p.startAt,endAt:p.endAt,
     acceptedFeeMinor:p.feeMinor,acceptedFeeVersion:p.feeVersion,
     paymentMode:"PAY_AT_CENTER"})});
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok){
    const item=data&&typeof data==="object"&&"message" in data?
     (data as {message?:unknown}).message:null;
    throw Error(typeof item==="string"?item:"Reschedule status cannot be verified.");
   }
   setResult(data as Result);
   setMessage("Appointment moved successfully. Your previous time was released.");
  }catch(e){setUncertain(true);setMessage((e instanceof Error?e.message:
   "The outcome is uncertain.")+" Check the original appointment before retrying.");}
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
   uncertain?<p><Link href="/patients/me">Check the original appointment in My Consultations</Link></p>:
   <button disabled={busy} onClick={()=>void submit()} type="button">
    {busy?"Checking…":"Accept fee and reschedule"}</button>}
 </div>;
}
