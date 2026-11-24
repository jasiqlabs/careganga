"use client";
import Link from "next/link";
import {ConsultationContribution} from "../healthcare-assistance/consultation-contribution";
import {useRef,useState} from "react";

type Hold={holdRef:string;expiresAt:string;status:string;
 consultationFeeMinor:string;feeVersion:number;};
type Confirmed={bookingRef:string;bookingId:string;doctorRef:string;centerRef:string;
 bookingStatus:string;paymentMode:string;collectionStatus:string;
 startAt:string;endAt:string;consultationFeeMinor:string;};
type Props={doctorRef:string;centerRef:string;doctorName:string;centerName:string;
 startAt:string;endAt:string;feeMinor:string;feeVersion:number;timeZone:string;};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
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
  throw Object.assign(new Error(typeof item==="string"?item:
   "The booking request could not be completed. Check its original status."),
   {status:response.status});
 }
 return raw as T;
}
export function PatientBookingAction(p:Props){
 const [hold,setHold]=useState<Hold|null>(null);
 const [review,setReview]=useState(false);
 const [confirmed,setConfirmed]=useState<Confirmed|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [uncertain,setUncertain]=useState(false);
  const [reasonForVisit,setReasonForVisit]=useState("");
  const confirmedReason=useRef<string|null>(null);
 const [staffBusy,setStaffBusy]=useState(false),[staffError,setStaffError]=useState("");
 const [staffCode,setStaffCode]=useState<{centerRef:string;authorizationCode:string;expiresAt:string}|null>(null);
 const holdKey=useRef<string|null>(null),confirmKey=useRef<string|null>(null);
 const slipKey=useRef<string|null>(null);
 const sameSlot=useRef(JSON.stringify([p.doctorRef,p.centerRef,p.startAt,p.endAt,
  p.feeMinor,p.feeVersion]));
 /** CG19 is an optional second durable operation after original CG15
  * confirmation: status first, same issue key if retried, never an
  * unverified local PDF and never a payment receipt.
  */
 async function issuePatientSlip(ref:string):Promise<"ISSUED"|"CHECK_STATUS">{
  if(!ID.test(ref))return "CHECK_STATUS";
  try{
   const path="/api/appointments/slips/me/"+encodeURIComponent(ref);
   const status=await fetch(path+"/status",{
    cache:"no-store",credentials:"same-origin"});
   if(!status.ok)return "CHECK_STATUS";
   const current:unknown=await status.json();
   if(current&&typeof current==="object"&&
    "status" in current&&current.status==="ISSUED"&&
    "canDownload" in current&&current.canDownload===true)return "ISSUED";
   if(!current||typeof current!=="object"||
    !("status" in current)||current.status!=="NOT_ISSUED")
    return "CHECK_STATUS";
   if(!slipKey.current)slipKey.current=crypto.randomUUID();
   const answer=await fetch(path+"/issue",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:slipKey.current})});
   if(!answer.ok)return "CHECK_STATUS";
   const issued:unknown=await answer.json();
   return issued&&typeof issued==="object"&&
    "status" in issued&&issued.status==="ISSUED"&&
    "confirmed" in issued&&issued.confirmed===true?"ISSUED":"CHECK_STATUS";
  }catch{return "CHECK_STATUS";}
 }
 async function makeHold(){
  if(busy||uncertain)return;
  setBusy(true);setMessage("");
  try{
   const signature=JSON.stringify([p.doctorRef,p.centerRef,p.startAt,p.endAt,
    p.feeMinor,p.feeVersion]);
   if(signature!==sameSlot.current){
    holdKey.current=null;confirmKey.current=null;confirmedReason.current=null;sameSlot.current=signature;
   }
   if(!holdKey.current)holdKey.current=crypto.randomUUID();
   const value=await submit<Hold>("holds",{
    requestKey:holdKey.current,doctorRef:p.doctorRef,centerRef:p.centerRef,
    startAt:p.startAt,endAt:p.endAt,acceptedFeeMinor:p.feeMinor,
    acceptedFeeVersion:p.feeVersion,paymentMode:"PAY_AT_CENTER"
   });
   if(value.status!=="HELD"||Date.parse(value.expiresAt)<=Date.now())
    throw Error("This reservation expired. Refresh the availability before retrying.");
   setHold(value);setReview(false);setUncertain(false);setMessage("Time reserved temporarily. Review the doctor, center, time and fee before confirming.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   // An explicit HTTP 4xx is a rejected write, not a lost response.
   // Preserve the original key so retry/recovery never creates a duplicate.
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage(e instanceof Error?e.message:"Reservation cannot be confirmed.");
  }finally{setBusy(false);}
 }
 async function confirm(){
  if(busy||uncertain||!hold||!review)return;
  if(Date.parse(hold.expiresAt)<=Date.now()){
   setReview(false);setMessage("Your temporary reservation expired. Refresh and select a current time.");return;
  }
  setBusy(true);setMessage("");
   if(!confirmKey.current){
    confirmKey.current=crypto.randomUUID();
    confirmedReason.current=reasonForVisit.trim();
   }
  try{
   const value=await submit<Confirmed>("confirm",{
    requestKey:confirmKey.current,holdRef:hold.holdRef,
    acceptedFeeMinor:hold.consultationFeeMinor,acceptedFeeVersion:hold.feeVersion,
    paymentMode:"PAY_AT_CENTER",
     ...(confirmedReason.current?{reasonForVisit:confirmedReason.current}:{})
   });
   setConfirmed(value);setReview(false);setUncertain(false);
   const document=await issuePatientSlip(value.bookingRef);
   setMessage(document==="ISSUED"?
    "Appointment confirmed. Your private consultation slip is issued. Payment is due at the center.":
    "Appointment confirmed. Payment is due at the center. Check your private patient profile to issue or verify the consultation slip.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage(e instanceof Error?e.message:
    "Confirmation outcome uncertain. Check your original request before retrying.");
  }finally{setBusy(false);}
 }
 async function authorizeCenterStaff(){
  if(staffBusy)return;
  setStaffBusy(true);setStaffError("");setStaffCode(null);
  try{
   const r=await fetch("/api/patients/me/assisted-booking-code",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({centerRef:p.centerRef})});
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok||!data||typeof data!=="object"||
    !("authorizationCode" in data)||typeof data.authorizationCode!=="string"||
    !("expiresAt" in data)||typeof data.expiresAt!=="string")
    throw Error("Staff authorization is unavailable. Sign in to your verified patient profile and check your consent.");
   setStaffCode({centerRef:p.centerRef,
    authorizationCode:data.authorizationCode,expiresAt:data.expiresAt});
  }catch(e){setStaffError(e instanceof Error?e.message:
   "Cannot verify your center authorization.");}
  finally{setStaffBusy(false);}
 }
 async function recover<T>(path:string):Promise<T|null>{
  const response=await fetch("/api/consultations/"+path,{
   cache:"no-store",credentials:"same-origin"});
  if(response.status===404)return null;
  if(!response.ok)throw Error("The original booking request status is unavailable. Try checking again.");
  return response.json() as Promise<T>;
 }
 async function checkOriginal(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   // The exact confirmation key is authoritative even when older than
   // the first 20 history items or when a similar time was booked before.
   if(confirmKey.current){
    const booking=await recover<Confirmed>(
     "confirmations/by-request/"+confirmKey.current);
    if(booking){
     setConfirmed(booking);setUncertain(false);setHold(null);
     const document=await issuePatientSlip(booking.bookingRef);
     setMessage("Your original appointment is confirmed: "+booking.bookingId+
      (document==="ISSUED"?". The private slip is issued.":
       ". Check the private patient profile for slip status."));
     return;
    }
   }
   if(holdKey.current){
    const original=await recover<Hold>("holds/by-request/"+holdKey.current);
    if(original&&original.status==="HELD"&&Date.parse(original.expiresAt)>Date.now()){
     setHold(original);setReview(false);setUncertain(false);
     setMessage(confirmKey.current?
      "The original hold still exists. You can safely retry confirmation using the same request.":
      "The original time is reserved. Confirm before it expires.");
     return;
    }
    if(original?.status==="CONSUMED"){
     setMessage("This hold was used but its booking was not confirmed by the request lookup. Recheck the same request or contact the center.");
     return;
    }
    if(original?.status==="EXPIRED"||original?.status==="CANCELLED"){
     holdKey.current=null;confirmKey.current=null;setHold(null);setReview(false);setUncertain(false);
     setMessage("The old hold expired. Select and reserve a currently available time.");
     return;
    }
    // No committed original was found. Reuse the SAME request key on the
    // next attempt so an in-flight hold cannot create a duplicate booking.
    setHold(null);setReview(false);setUncertain(false);
    setMessage("No committed hold was found yet. You can retry this reservation using its original request key.");
    return;
   }
   setMessage("No original request key is available. Refresh your selected time.");
  }catch(e){
   setMessage(e instanceof Error?e.message:"The original booking request is still uncertain.");
  }finally{setBusy(false);}
 }
 return <div className="cg-health-booking-summary">
  <h3 style={{margin:"0 0 8px"}}>{p.doctorName}</h3>
  <p style={{margin:"0 0 8px"}}>{p.centerName}</p>
  <p style={{margin:"0 0 8px"}}>{new Date(p.startAt).toLocaleString("en-IN",{
   timeZone:p.timeZone,dateStyle:"medium",timeStyle:"short"})} ({p.timeZone})</p>
  <div className="cg-health-amount">Consultation fee <strong>{currency(p.feeMinor)}</strong></div><p>Pay at center. Online payment is checked after the original booking and contribution are accepted.</p>
  {!!message&&<p role="status" aria-live="polite">{message}</p>}
   {!confirmed&&!uncertain&&!review&&<label style={{display:"grid",gap:4,marginBlock:8}}>
    Reason for consultation (optional, private)
    <textarea value={reasonForVisit} rows={2} maxLength={300}
     disabled={busy||!!confirmKey.current}
     onChange={e=>setReasonForVisit(e.target.value)}
     placeholder="Briefly describe your reason, only if you wish"/>
    <small>Your current patient-care consent is recorded with this encrypted
     reason. It is not printed on the appointment slip or sent in notifications.</small>
   </label>}
  {confirmed?<div>
   <p><strong>Booking confirmed: {confirmed.bookingId}</strong>.
    <Link href="/patients/me"> View my patient profile</Link></p>
   <ConsultationContribution bookingRef={confirmed.bookingRef}/>
  </div>:
   uncertain?<div>
    <p role="alert">The previous action may have succeeded. Do not make a second payment or new booking.</p>
    <button disabled={busy} type="button" onClick={()=>void checkOriginal()}>
     Check original booking request</button>
    <Link href="/patients/me">My patient profile</Link>
   </div>:hold?(review?
    <div className="form-section" aria-label="Review actual consultation before confirming">
     <h3>Booking summary &amp; payment</h3>
     <p>Doctor: <strong>{p.doctorName}</strong></p>
     <p>Healthcare center: <strong>{p.centerName}</strong></p>
     <p>Consultation time: {new Date(p.startAt).toLocaleString("en-IN",{
      timeZone:p.timeZone,dateStyle:"medium",timeStyle:"short"})}</p>
     <p>Consultation fee: <strong>{currency(hold.consultationFeeMinor)}</strong></p>
     <p role="status">Reserved until {new Date(hold.expiresAt).toLocaleString("en-IN")} — not yet booked.</p>
     <h4>Foundation assistance &amp; patient amount</h4>
     <ConsultationContribution holdRef={hold.holdRef}/>
     <p>Optional private consultation reason: {reasonForVisit.trim()?
      "Included in the private booking":"Not provided"}.</p>
     <button type="button" className="primary" disabled={busy}
      onClick={()=>void confirm()}>
      Confirm appointment — pay at center</button>
     <button type="button" disabled={busy}
      onClick={()=>setReview(false)}>Back to edit private reason</button>

    </div>:
    <button type="button" className="primary" disabled={busy}
     onClick={()=>setReview(true)}>Review appointment &amp; fee</button>):
   <button type="button" className="primary" disabled={busy} onClick={()=>void makeHold()}>
    {busy?"Checking…":"Reserve this appointment time"}</button>}
  {!confirmed&&!uncertain&&!hold&&<details>
   <summary>Need help booking at reception?</summary>
   <section aria-label="Authorize reception staff to book">
   <p>If you are booking in person at this center, you can authorize the assigned
    receptionist to make one reservation. Your account must already be identity-verified.</p>
   <button type="button" disabled={staffBusy}
    onClick={()=>void authorizeCenterStaff()}>
    {staffBusy?"Checking…":"Get one-time receptionist booking code"}</button>
   {!!staffError&&<p role="alert">{staffError}</p>}
   {staffCode&&staffCode.centerRef===p.centerRef&&
    <p role="status">Give only this center's authorized receptionist your
    Virtual Patient ID and code <strong style={{fontFamily:"monospace"}}>
     {staffCode.authorizationCode}</strong>.
    Expires {new Date(staffCode.expiresAt).toLocaleTimeString("en-IN")}.
    One appointment hold only.</p>}
  </section>
  </details>}
 </div>;
}
