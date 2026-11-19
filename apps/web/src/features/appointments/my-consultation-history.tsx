"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
type Booking={bookingRef:string;bookingId:string;doctorRef:string;centerRef:string;
 startAt:string;endAt:string;timeZone:string;consultationFeeMinor:string;
 bookingStatus:string;canPatientChange:boolean;paymentMode:string;collectionStatus:string;version:number};
type Result={items:Booking[];next:string|null};
const money=(minor:string)=>new Intl.NumberFormat("en-IN",{style:"currency",
 currency:"INR"}).format(Number(minor)/100);
export function MyConsultationHistory(){
 const [items,setItems]=useState<Booking[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [nextCursor,setNextCursor]=useState<string|null>(null),[moreBusy,setMoreBusy]=useState(false);
 const [notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const keys=useRef<Map<string,string>>(new Map());
 const refresh=useCallback(async()=>{
  const r=await fetch("/api/consultations/me",{cache:"no-store",credentials:"same-origin"});
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:"Your appointment history cannot be confirmed.");
  if(!data||typeof data!=="object"||!("items" in data)||!Array.isArray(data.items))
   throw Error("Your appointments could not be verified.");
  setItems((data as Result).items);setNextCursor((data as Result).next);
  setUncertain(false);
 },[]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(e=>{if(active)setNotice(e instanceof Error?e.message:
   "Your appointments are temporarily unavailable.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 async function more(){
  if(moreBusy||busy||!nextCursor)return;
  setMoreBusy(true);setNotice("");
  try{
   const r=await fetch("/api/consultations/me?after="+
    encodeURIComponent(nextCursor),{cache:"no-store",credentials:"same-origin"});
   const raw:unknown=await r.json().catch(()=>null);
   if(!r.ok||!raw||typeof raw!=="object"||!("items" in raw)||
    !Array.isArray(raw.items))
    throw Error("Older consultations cannot be confirmed. Try again.");
   const page=raw as Result;
   setItems(current=>{
    const known=new Set(current.map(x=>x.bookingRef));
    return [...current,...page.items.filter(x=>!known.has(x.bookingRef))];
   });
   setNextCursor(page.next);
  }catch(e){setNotice(e instanceof Error?e.message:"Older consultations are unavailable.");}
  finally{setMoreBusy(false);}
 }
 async function cancel(a:Booking){
  if(busy||uncertain)return;
  const reason=window.confirm("Cancel this appointment? Your time will be released. No payment has been recorded by CareGanga.");
  if(!reason)return;
  setBusy(true);setNotice("");
  const key=a.bookingRef+":"+a.version+":cancel";
  if(!keys.current.has(key))keys.current.set(key,crypto.randomUUID());
  try{
   const r=await fetch("/api/consultations/me/"+encodeURIComponent(a.bookingRef)+"/cancel",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:keys.current.get(key),
     expectedVersion:a.version,reason:"PATIENT_REQUEST"})});
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
    typeof data.message==="string"?data.message:"The cancellation result is uncertain.");
   keys.current.delete(key);
   await refresh();setNotice("Your appointment is cancelled. The original fee remained due-only.");
  }catch(e){
   setUncertain(true);setNotice((e instanceof Error?e.message:
    "Cancellation status is uncertain.")+" Refresh your appointments to confirm the original result.");
  }finally{setBusy(false);}
 }
 return <section aria-label="My consultations" style={{marginTop:24}}>
  <h2>My consultations</h2>
  <p>Only consultations linked to this patient account are shown. A booking is not a receipt.</p>
  {loading&&<p>Checking your current appointment history…</p>}
  {!!notice&&<p role="alert" aria-live="polite">{notice}</p>}
  <button disabled={busy} type="button" onClick={()=>{
   setLoading(true);void refresh().catch(e=>setNotice(String(e)))
    .finally(()=>setLoading(false));
  }}>Refresh my appointments</button>
  {!loading&&items.length===0&&<p>No confirmed consultations were found for this account.</p>}
  <div style={{display:"grid",gap:12}}>
   {items.map(a=><article key={a.bookingRef}
    style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12}}>
    <h3>Booking: {a.bookingId}</h3>
    <p>{new Date(a.startAt).toLocaleString("en-IN",{timeZone:a.timeZone,
     dateStyle:"medium",timeStyle:"short"})} · {a.bookingStatus}</p>
    <p>{money(a.consultationFeeMinor)} · {a.collectionStatus.replaceAll("_"," ")}
     · {a.paymentMode.replaceAll("_"," ")}</p>
    <p>Payment is collected at the healthcare center, not by CareGanga.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
     {a.canPatientChange===true&&<>
      <button type="button" disabled={busy||uncertain}
       onClick={()=>void cancel(a)}>Cancel appointment</button>
      <Link href={"/health-network/doctors/"+encodeURIComponent(a.doctorRef)+
       "/schedule?reschedule="+encodeURIComponent(a.bookingRef)+
       "&version="+a.version}>Reschedule — choose new time</Link>
     </>}
     <Link href={"/patients/me/appointments/"+encodeURIComponent(a.bookingRef)}>
      Appointment details</Link>
    </div>
   </article>)}
  </div>
  {nextCursor&&<button type="button" disabled={busy||moreBusy}
   onClick={()=>void more()}>
   {moreBusy?"Loading…":"Load older consultations"}</button>}
 </section>;
}
