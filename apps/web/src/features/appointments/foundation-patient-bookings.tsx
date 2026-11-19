"use client";
import {useCallback,useEffect,useState} from "react";
type Row={bookingRef:string;bookingId:string;virtualPatientId:string;
 patientName:string;doctorName:string;centerName:string;bookingStatus:string;
 startAt:string;timeZone:string;createdAt:string;collectionStatus:string;consultationFeeMinor:string};
type Center={centerRef:string;centerName:string};
type Stats={totalPatients:number;activePatients:number;totalBookings:number;
 todayBookings:number;completed:number;pending:number};
type Result={metrics:Stats;items:Row[];next:string|null;centerChoices:Center[]};
type Query={status:string;centerRef:string;after:string;day:string};
type EventPart={status:string|null;startAt:string|null;endAt:string|null;
 consultationFeeMinor:string|null;centerName:string|null;reason:string|null}|null;
type HistoricEvent={action:string;revision:number;when:string;by:string;
 before:EventPart;after:EventPart};
type OriginalHistory={bookingId:string|null;items:HistoricEvent[];next:number|null};
const money=(s:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR"}).format(Number(s)/100);
const centerTime=(iso:string,zone:string)=>{
 try{
  const when=new Date(iso);
  if(!Number.isFinite(when.getTime()))return "Appointment time unavailable";
  return new Intl.DateTimeFormat("en-IN",{
   timeZone:zone,dateStyle:"medium",timeStyle:"short"
  }).format(when)+" ("+zone+")";
 }catch{return "Original center local time unavailable";}
};
export function FoundationPatientBookings(){
 const [query,setQuery]=useState<Query>({status:"",centerRef:"",after:"",day:""});
 const [result,setResult]=useState<Result|null>(null);
 const [selected,setSelected]=useState("");
 const [history,setHistory]=useState<OriginalHistory|null>(null);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [historyError,setHistoryError]=useState("");
 const [message,setMessage]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async(q:Query)=>{
  const params=new URLSearchParams();
  if(q.status)params.set("status",q.status);
  if(q.centerRef)params.set("centerRef",q.centerRef);
  if(q.day)params.set("day",q.day);
  if(q.after)params.set("after",q.after);
  params.set("limit","20");
  const r=await fetch("/api/appointments/admin/patients?"+params.toString(),{
   cache:"no-store",credentials:"same-origin"});
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:"Protected patient list unavailable.");
  if(!data||typeof data!=="object"||!("items" in data)||
   !Array.isArray(data.items))throw Error("Protected patient list cannot be verified.");
  return data as Result;
 },[]);
 useEffect(()=>{
  let active=true;
  setLoading(true);setMessage("");
  void load(query).then(data=>{
   if(!active)return;
   setResult(data);setSelected(current=>
    data.items.some(i=>i.bookingRef===current)?current:(data.items[0]?.bookingRef??""));
  }).catch(e=>{if(active){setResult(null);setMessage(e instanceof Error?
   e.message:"Protected patient list unavailable.");}})
  .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[query,load]);
 useEffect(()=>{
  if(!selected){setHistory(null);return;}
  let active=true;
  setHistoryBusy(true);setHistory(null);setHistoryError("");
  void fetch("/api/appointments/admin/patients/"+encodeURIComponent(selected)+
   "/history",{cache:"no-store",credentials:"same-origin"})
   .then(async r=>{
    const raw:unknown=await r.json().catch(()=>null);
    if(!r.ok)throw Error(raw&&typeof raw==="object"&&"message" in raw&&
     typeof raw.message==="string"?raw.message:"Booking history unavailable.");
    return raw as OriginalHistory;
   }).then(data=>{if(active)setHistory(data);})
   .catch(e=>{if(active)setHistoryError(e instanceof Error?e.message:
    "Booking history unavailable.");})
   .finally(()=>{if(active)setHistoryBusy(false);});
  return()=>{active=false;};
 },[selected]);
 async function moreHistory(){
  if(!selected||historyBusy||!history?.next)return;
  setHistoryBusy(true);setHistoryError("");
  try{
   const r=await fetch("/api/appointments/admin/patients/"+
    encodeURIComponent(selected)+"/history?before="+history.next,{
     cache:"no-store",credentials:"same-origin"});
   const raw:unknown=await r.json().catch(()=>null);
   if(!r.ok)throw Error(raw&&typeof raw==="object"&&"message" in raw&&
    typeof raw.message==="string"?raw.message:"Further history unavailable.");
   const next=raw as OriginalHistory;
   setHistory(old=>old?.bookingId===next.bookingId?
    {...old,items:[...old.items,...next.items],next:next.next}:old);
  }catch(e){setHistoryError(e instanceof Error?e.message:"Further history is unavailable.");}
  finally{setHistoryBusy(false);}
 }
 const selectedBooking=result?.items.find(x=>x.bookingRef===selected);
 const update=(change:Partial<Query>)=>setQuery(q=>({...q,...change,after:""}));
 const metrics=result?.metrics;
 return <section className="role-workspace" aria-label="Patient and booking management">
  <header className="topbar"><div>
   <h1>Patient &amp; Booking Management</h1>
   <p>Original H15 · protected Foundation source records; consultation only</p>
  </div></header>
  <p>This protected view contains actual registered patients and accepted
   consultations only. No example patient data, fake paid amounts or unsupported
   pharmacy/diagnostic appointments appear here.</p>
  {!!message&&<p role="alert" className="notice error">{message}</p>}
  <p>Foundation-wide totals across all dates and centers. Filters below apply to consultation records only.</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
   {([
    ["Total Patients",metrics?.totalPatients],
    ["Active Patients",metrics?.activePatients],
    ["Total Bookings",metrics?.totalBookings],
    ["Today's Bookings",metrics?.todayBookings],
    ["Completed",metrics?.completed],
    ["Pending",metrics?.pending]
   ] as const).map(([label,n])=><article className="card"
    style={{padding:14,border:"1px solid #d7dfdb",borderRadius:12}} key={label}>
    <p>{label}</p><strong>{n===undefined?"—":n.toLocaleString("en-IN")}</strong>
   </article>)}
  </div>
  <section className="form-section" aria-label="Source-backed booking filters">
   <div className="toolbar">
    <label>Healthcare center
     <select value={query.centerRef} onChange={e=>update({centerRef:e.target.value})}>
      <option value="">All centers</option>
      {result?.centerChoices.map(c=><option key={c.centerRef} value={c.centerRef}>
       {c.centerName}</option>)}
     </select>
    </label>
    <label>Consultation status
     <select value={query.status} onChange={e=>update({status:e.target.value})}>
      <option value="">All statuses</option>
      {["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION","COMPLETED",
        "NO_SHOW","CANCELLED"].map(status=><option key={status} value={status}>
       {status.replaceAll("_"," ")}</option>)}
     </select>
    </label>
    <label>Consultation date (center local date)
     <input type="date" value={query.day}
      onChange={e=>update({day:e.target.value})}/>
    </label>
    <button type="button" onClick={()=>setQuery({status:"",centerRef:"",after:"",day:""})}>
     Reset filters</button>
   </div>
  </section>
  {loading&&<p role="status">Checking current protected source records…</p>}
  {!loading&&result&&<div style={{display:"grid",
   gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:18}}>
   <section aria-label="Protected consultations">
    <h2>Consultation records</h2>
    {result.items.length===0&&<p>No consultations match these filters.</p>}
    {result.items.map(item=><button key={item.bookingRef} type="button"
     aria-pressed={selected===item.bookingRef} onClick={()=>setSelected(item.bookingRef)}
     style={{display:"block",width:"100%",textAlign:"left",padding:14,
      border:"1px solid #d7dfdb",borderRadius:12,marginBottom:8}}>
     <strong>{item.bookingId}</strong><span> — {item.bookingStatus.replaceAll("_"," ")}</span>
     <p>{item.patientName} · {item.centerName}</p>
     <p>{centerTime(item.startAt,item.timeZone)}</p>
    </button>)}
    {result.next&&<button type="button" onClick={()=>
     setQuery(q=>({...q,after:result.next!}))}>Next results</button>}
   </section>
   <section aria-label="Selected patient and appointment details"
    style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12,alignSelf:"start"}}>
    <h2>Patient Details</h2>
    {!selectedBooking?<p>Select an actual consultation to view its limited details.</p>:
     <>
      <p><strong>Patient:</strong> {selectedBooking.patientName}</p>
      <p><strong>Virtual Patient ID:</strong> {selectedBooking.virtualPatientId}</p>
      <p><strong>Booking ID:</strong> {selectedBooking.bookingId}</p>
      <p><strong>Doctor:</strong> {selectedBooking.doctorName}</p>
      <p><strong>Center:</strong> {selectedBooking.centerName}</p>
      <p><strong>Appointment:</strong> {centerTime(selectedBooking.startAt,selectedBooking.timeZone)}</p>
      <p><strong>Status:</strong> {selectedBooking.bookingStatus.replaceAll("_"," ")}</p>
      <p><strong>Consultation:</strong> {money(selectedBooking.consultationFeeMinor)}
       · {selectedBooking.collectionStatus.replaceAll("_"," ")}</p>
      <h3>Booking History</h3>
      {historyBusy&&!history&&<p role="status">Checking original booking events…</p>}
      {!!historyError&&<p role="alert">{historyError}</p>}
      {history?.items.length===0&&<p>No recorded changes are available for this booking.</p>}
      {history?.items.map(e=><article key={e.revision}
       style={{padding:10,borderBottom:"1px solid #d7dfdb"}}>
       <p><strong>{e.action.replaceAll("_"," ")}</strong> —
        {new Date(e.when).toLocaleString("en-IN")}</p>
       <p>Recorded by {e.by}</p>
       {e.before?.status&&<p>Previously: {e.before.status.replaceAll("_"," ")}
        {e.before.startAt?" · "+new Date(e.before.startAt).toLocaleString("en-IN"):""}</p>}
       {e.after?.status&&<p>Updated: {e.after.status.replaceAll("_"," ")}
        {e.after.startAt?" · "+new Date(e.after.startAt).toLocaleString("en-IN"):""}</p>}
       {e.before?.centerName&&<p>Previous center: {e.before.centerName}</p>}
       {e.after?.centerName&&<p>Current center: {e.after.centerName}</p>}
       {e.after?.reason&&<p>Reason: {e.after.reason.replaceAll("_"," ").toLowerCase()}</p>}
       {e.after?.consultationFeeMinor&&
        <p>Accepted consultation: {money(e.after.consultationFeeMinor)}</p>}
      </article>)}
      {history?.next&&<button type="button" disabled={historyBusy}
       onClick={()=>void moreHistory()}>Older booking events</button>}
      <p>This event history contains only this protected booking's operational changes.
       Medical reports and other patient records are not disclosed.</p>
      <p>Medical Profile, Documents, Prescriptions and Care Plan remain hidden until
       their actual consented owner sources are authorized.</p>
     </>}
   </section>
  </div>}
 </section>;
}
