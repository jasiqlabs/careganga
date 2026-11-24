"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
type Booking={bookingRef:string;bookingId:string;doctorRef:string;centerRef:string;doctorName:string;centerName:string;
 startAt:string;endAt:string;timeZone:string;consultationFeeMinor:string;
 bookingStatus:string;canPatientChange:boolean;paymentMode:string;collectionStatus:string;version:number};
type Result={items:Booking[];next:string|null};
const money=(minor:string)=>new Intl.NumberFormat("en-IN",{style:"currency",
 currency:"INR"}).format(Number(minor)/100);
export function MyConsultationHistory(){
 const [items,setItems]=useState<Booking[]>([]);
 const [statusFilter,setStatusFilter]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [nextCursor,setNextCursor]=useState<string|null>(null),[moreBusy,setMoreBusy]=useState(false);
 const [notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const keys=useRef<Map<string,string>>(new Map());
 const listSeq=useRef(0);
 const refresh=useCallback(async()=>{
  const turn=++listSeq.current;setLoading(true);setItems([]);setNextCursor(null);setMoreBusy(false);
  try{
  const query=new URLSearchParams();
  if(statusFilter)query.set("status",statusFilter);
  const r=await fetch("/api/consultations/me"+(query.size?"?"+query.toString():""),{
   cache:"no-store",credentials:"same-origin"});
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:"Your appointment history cannot be confirmed.");
  if(!data||typeof data!=="object"||!("items" in data)||!Array.isArray(data.items))
   throw Error("Your appointments could not be verified.");
  if(turn!==listSeq.current)return;
  const result=data as Result;
  if(!(result.next===null||typeof result.next==="string"))throw Error("Your appointments could not be verified.");
  setItems(result.items);setNextCursor(result.next);setUncertain(false);
  }catch(e){if(turn===listSeq.current)throw e;}finally{if(turn===listSeq.current)setLoading(false);}
 },[statusFilter]);
 useEffect(()=>{
  let active=true;setNotice("");
  void refresh().catch(e=>{if(active)setNotice(e instanceof Error?e.message:"Your appointments are temporarily unavailable.");});
  return()=>{active=false;listSeq.current++;};
 },[refresh]);
 async function more(){
  if(moreBusy||busy||loading||uncertain||!nextCursor)return;
  const turn=listSeq.current;
  setMoreBusy(true);setNotice("");
  try{
   const query=new URLSearchParams({after:nextCursor});
   if(statusFilter)query.set("status",statusFilter);
   const r=await fetch("/api/consultations/me?"+query.toString(),{
    cache:"no-store",credentials:"same-origin"});
   const raw:unknown=await r.json().catch(()=>null);
   if(!r.ok||!raw||typeof raw!=="object"||!("items" in raw)||
    !Array.isArray(raw.items))
    throw Error("Older consultations cannot be confirmed. Try again.");
   const page=raw as Result;
   if(turn!==listSeq.current)return;
   if(!(page.next===null||typeof page.next==="string"))throw Error("Older consultations cannot be verified.");
   setItems(current=>{
    const known=new Set(current.map(x=>x.bookingRef));
    return [...current,...page.items.filter(x=>!known.has(x.bookingRef))];
   });
   setNextCursor(page.next);
  }catch(e){if(turn===listSeq.current)setNotice(e instanceof Error?e.message:"Older consultations are unavailable.");}
  finally{if(turn===listSeq.current)setMoreBusy(false);}
 }
 async function cancel(a:Booking){
  if(busy||uncertain)return;
  const reason=window.confirm("Cancel this appointment? Your time will be released. Check any collection or refund separately with the healthcare center.");
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
   await refresh();setNotice("Your appointment is cancelled. Check the updated center payment status.");
  }catch(e){
   setUncertain(true);setNotice((e instanceof Error?e.message:
    "Cancellation status is uncertain.")+" Refresh your appointments to confirm the original result.");
  }finally{setBusy(false);}
 }
 return <section aria-label="My consultations" style={{marginTop:24}}>
  <h2>My consultations</h2>
  <p>Only consultations linked to this patient account are shown. A booking is not a receipt.</p>
  <label>Filter my appointment status
   <select value={statusFilter} disabled={busy||uncertain||loading||moreBusy}
    onChange={e=>{listSeq.current++;setLoading(true);setStatusFilter(e.target.value);}}>
    <option value="">All appointments</option>
    <option value="CONFIRMED">Confirmed</option>
    <option value="ARRIVED">Checked in</option>
    <option value="WAITING">Waiting</option>
    <option value="IN_CONSULTATION">In consultation</option>
    <option value="COMPLETED">Completed</option>
    <option value="NO_SHOW">Not attended</option>
    <option value="CANCELLED">Cancelled</option>
   </select>
  </label>
  {loading&&<p>Checking your current appointment history…</p>}
  {!!notice&&<p role="alert" aria-live="polite">{notice}</p>}
  <button disabled={busy||loading||moreBusy} type="button" onClick={()=>{
   setNotice("");void refresh().catch(e=>setNotice(e instanceof Error?e.message:"Current appointments unavailable."));
  }}>Refresh my appointments</button>
  {!loading&&!notice&&items.length===0&&<p>No appointments match the selected status.</p>}
  <div style={{display:"grid",gap:12}}>
   {!loading&&items.map(a=><article key={a.bookingRef}
    style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12}}>
    <h3>{a.doctorName} · {a.centerName}</h3>
    <p>Booking: {a.bookingId}</p>
    <p>{new Date(a.startAt).toLocaleString("en-IN",{timeZone:a.timeZone,
     dateStyle:"medium",timeStyle:"short"})} · {a.bookingStatus.replaceAll("_"," ")}</p>
    <p>{money(a.consultationFeeMinor)} · {a.collectionStatus.replaceAll("_"," ")}
     · {a.paymentMode.replaceAll("_"," ")}</p>
    <p>Payment is collected at the healthcare center, not by CareGanga.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
     {a.canPatientChange===true&&<>
      <button type="button" disabled={busy||uncertain}
       onClick={()=>void cancel(a)}>Cancel appointment</button>
      <Link href={"/health-network/doctors/"+encodeURIComponent(a.doctorRef)+
       "/schedule?reschedule="+encodeURIComponent(a.bookingRef)+
       "&version="+a.version}>Reschedule — keep doctor</Link>
      <Link href={"/health-network?tab=doctors&reschedule="+
       encodeURIComponent(a.bookingRef)+"&version="+a.version}>
       Change doctor or time</Link>
     </>}
     <Link href={"/patients/me/appointments/"+encodeURIComponent(a.bookingRef)}>
      Appointment details</Link>
    </div>
   </article>)}
  </div>
  {nextCursor&&<button type="button" disabled={busy||moreBusy||loading||uncertain}
   onClick={()=>void more()}>
   {moreBusy?"Loading…":"Load older consultations"}</button>}
 </section>;
}
