"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {FoundationPatientDuplicateReviews} from "./foundation-patient-duplicate-reviews";
type Row={bookingRef:string;bookingId:string;virtualPatientId:string;
 patientName:string;patientProfileStatus:string;patientConsentGranted:boolean|null;
 doctorName:string;centerName:string;bookingStatus:string;bookingVersion:number;
 startAt:string;timeZone:string;createdAt:string;collectionStatus:string;consultationFeeMinor:string};
type Center={centerRef:string;centerName:string;stateRef:string;
 districtRef:string;centerType:string};
type StateChoice={stateRef:string;stateName:string};
type DistrictChoice={districtRef:string;districtName:string;stateRef:string};
type Stats={totalPatients:number;activePatients:number;totalBookings:number;
 todayBookings:number;completed:number;pending:number};
type Result={metrics:Stats;items:Row[];next:string|null;centerChoices:Center[];
 states:StateChoice[];districts:DistrictChoice[];centerTypes:string[];
 geographyComplete:boolean;centerChoicesComplete:boolean};
type Query={status:string;centerRef:string;after:string;day:string;fromDay:string;untilDay:string;
 stateRef:string;districtRef:string;centerType:string;search:string;centerSearch:string};
type EventPart={status:string|null;startAt:string|null;endAt:string|null;
 consultationFeeMinor:string|null;centerName:string|null;reason:string|null}|null;
type HistoricEvent={action:string;revision:number;when:string;by:string;
 before:EventPart;after:EventPart};
type OriginalHistory={bookingId:string|null;items:HistoricEvent[];next:number|null};
const statusName=(s:string)=>({
 CONFIRMED:"Confirmed",ARRIVED:"Checked in",WAITING:"Waiting",
 IN_CONSULTATION:"In consultation",COMPLETED:"Completed",
 NO_SHOW:"Not attended",CANCELLED:"Cancelled",
 DUE_AT_CENTER:"Payment due at center",NOT_COLLECTIBLE:"No payment due"
} as Record<string,string>)[s]??"Status unavailable";
const money=(s:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR"}).format(Number(s)/100);
const centerKind=(v:string)=>v.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
const centerTime=(iso:string,zone:string)=>{
 try{
  const when=new Date(iso);
  if(!Number.isFinite(when.getTime()))return "Appointment time unavailable";
  return new Intl.DateTimeFormat("en-IN",{
   timeZone:zone,dateStyle:"medium",timeStyle:"short"
  }).format(when)+" ("+zone+")";
 }catch{return "Original center local time unavailable";}
};
export function FoundationPatientBookings({canOverride=false}:{canOverride?:boolean}){
 const [query,setQuery]=useState<Query>({status:"",centerRef:"",after:"",day:"",fromDay:"",untilDay:"",
 stateRef:"",districtRef:"",centerType:"",search:"",centerSearch:""});
 const [searchDraft,setSearchDraft]=useState("");
 const [centerDraft,setCenterDraft]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [selected,setSelected]=useState("");
 const [history,setHistory]=useState<OriginalHistory|null>(null);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [historyError,setHistoryError]=useState("");
 const [printBusy,setPrintBusy]=useState(false);
 const [printMessage,setPrintMessage]=useState("");
 const selectedForPrint=useRef("");
 const [overridePassword,setOverridePassword]=useState("");
 const [overrideAcknowledged,setOverrideAcknowledged]=useState(false);
 const [overrideBusy,setOverrideBusy]=useState(false);
 const [overrideUncertain,setOverrideUncertain]=useState(false);
 const [overrideMessage,setOverrideMessage]=useState("");
 const overrideKey=useRef("");
 const [message,setMessage]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async(q:Query)=>{
  const params=new URLSearchParams();
  if(q.status)params.set("status",q.status);
  if(q.centerRef)params.set("centerRef",q.centerRef);
  if(q.day)params.set("day",q.day);
  if(q.fromDay)params.set("fromDay",q.fromDay);
  if(q.untilDay)params.set("untilDay",q.untilDay);
  if(q.stateRef)params.set("stateRef",q.stateRef);
  if(q.districtRef)params.set("districtRef",q.districtRef);
  if(q.centerType)params.set("centerType",q.centerType);
  if(q.search)params.set("search",q.search);
  if(q.centerSearch)params.set("centerSearch",q.centerSearch);
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
  overrideKey.current="";
  setOverridePassword("");setOverrideAcknowledged(false);
  setOverrideMessage("");setOverrideUncertain(false);
 },[selected]);
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
 selectedForPrint.current=selected;
 const selectedBooking=result?.items.find(x=>x.bookingRef===selected);
 // Never show an old patient's async audit history in another patient's card.
 const currentHistory=selectedBooking&&history?.bookingId===selectedBooking.bookingId?
  history:null;
 const blocked=overrideBusy||overrideUncertain||printBusy;
 const update=(change:Partial<Query>)=>{if(!blocked)setQuery(q=>({...q,...change,after:""}));};
 const metrics=result?.metrics;
 const districts=result?.districts.filter(d=>!query.stateRef||d.stateRef===query.stateRef)??[];
 const centerChoices=result?.centerChoices.filter(c=>
  (!query.stateRef||c.stateRef===query.stateRef)&&
  (!query.districtRef||c.districtRef===query.districtRef)&&
  (!query.centerType||c.centerType===query.centerType))??[];
 async function printSelectedBooking(){
  const booking=result?.items.find(x=>x.bookingRef===selected);
  const events=history;
  if(printBusy||historyBusy||!booking||!events||
   events.bookingId!==booking.bookingId||events.next||overrideBusy||overrideUncertain){
   setPrintMessage("Load the complete original selected booking history before printing.");
   return;
  }
  const ref=booking.bookingRef;
  setPrintBusy(true);setPrintMessage("");
  try{
   const response=await fetch("/api/appointments/admin/patients/"+
    encodeURIComponent(ref)+"/print-authorization",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({expectedVersion:booking.bookingVersion,
      purpose:"BOOKING_HISTORY"})});
   const data:unknown=await response.json().catch(()=>null);
   if(!response.ok||!data||typeof data!=="object"||
    !("authorized" in data)||data.authorized!==true||
    !("bookingId" in data)||data.bookingId!==booking.bookingId||
    !("bookingVersion" in data)||data.bookingVersion!==booking.bookingVersion)
    throw Error(data&&typeof data==="object"&&"message" in data&&
     typeof data.message==="string"?data.message:
     "This report could not be authorized. Refresh the selected booking.");
   if(selectedForPrint.current!==ref)
    throw Error("The selected booking changed. Review its history before printing.");
   const root=document.body;
   root.classList.add("cg15-h15-report-print");
   const restore=()=>root.classList.remove("cg15-h15-report-print");
   window.addEventListener("afterprint",restore,{once:true});
   try{window.print();}
   finally{restore();window.removeEventListener("afterprint",restore);}
   setPrintMessage("Print was requested only for the selected audited appointment and its complete original history. A physical or saved copy cannot be revoked.");
  }catch(e){setPrintMessage(e instanceof Error?e.message:
   "Report printing is unavailable. Review the original booking.");}
  finally{setPrintBusy(false);}
 }
 async function refreshOverrideSource(){
  setLoading(true);setOverrideMessage("");
  try{
   const latest=await load(query);
   setResult(latest);
   setSelected(old=>latest.items.some(x=>x.bookingRef===old)?
    old:latest.items[0]?.bookingRef??"");
   setOverrideUncertain(false);
   setOverridePassword("");setOverrideAcknowledged(false);
   setMessage("Current original appointment list checked. Review the selected booking again.");
  }catch(e){
   setOverrideMessage(e instanceof Error?e.message:
    "Current original appointment could not be checked.");
   setOverrideUncertain(true);
  }finally{setLoading(false);}
 }
 async function applyFoundationOverride(){
  const item=selectedBooking;
  if(!canOverride||!item||item.bookingStatus!=="CONFIRMED"||
   new Date(item.startAt).getTime()<=Date.now()||
   !Number.isSafeInteger(item.bookingVersion)||item.bookingVersion<1||
   overrideBusy||overrideUncertain||!overrideAcknowledged||
   overridePassword.length<8)return;
  const requestKey=overrideKey.current||crypto.randomUUID();
  overrideKey.current=requestKey;
  setOverrideBusy(true);setOverrideMessage("");
  try{
   const response=await fetch(
    "/api/appointments/admin/bookings/"+encodeURIComponent(item.bookingRef)+
     "/cancel-override",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({requestKey,expectedVersion:item.bookingVersion,
      reason:"FOUNDATION_OVERRIDE",currentPassword:overridePassword})
    });
   const data:unknown=await response.json().catch(()=>null);
   if(!response.ok){
    const msg=data&&typeof data==="object"&&"message" in data&&
     typeof data.message==="string"?data.message:
      "The original cancellation state could not be verified.";
    if([400,401,403,404,409,429].includes(response.status)){
     overrideKey.current="";
     setOverrideUncertain(false);
    }else setOverrideUncertain(true);
    setOverrideMessage(msg);
    return;
   }
   if(!data||typeof data!=="object"||!("bookingStatus" in data)||
    data.bookingStatus!=="CANCELLED"){
    setOverrideUncertain(true);
    setOverrideMessage("The original cancellation result is uncertain. Refresh before retrying.");
    return;
   }
   overrideKey.current="";
   setOverrideUncertain(false);
   setOverrideMessage("Protected Foundation cancellation committed. The original appointment audit was updated; notification delivery is separate.");
   const updated=await load(query);
   setResult(updated);
   setSelected(current=>updated.items.some(x=>x.bookingRef===current)?
    current:updated.items[0]?.bookingRef??"");
  }catch{
   setOverrideUncertain(true);
   setOverrideMessage("The original cancellation may have committed. Refresh the appointment before another action.");
  }finally{
   setOverridePassword("");setOverrideAcknowledged(false);setOverrideBusy(false);
  }
 }
 return <section className="role-workspace cg-health-workspace" aria-label="Patient and booking management">
  <style>{`@media print{
   body *{visibility:hidden!important;}
   body.cg15-h15-report-print .cg15-print-scope,
   body.cg15-h15-report-print .cg15-print-scope *{visibility:visible!important;}
   body.cg15-h15-report-print .cg15-print-scope{position:absolute!important;inset:0 auto auto 0!important;
    box-sizing:border-box;width:100%!important;max-width:100%!important;
    min-height:0!important;padding:18px!important;border:none!important;
    background:#fff!important;color:#111!important;}
   body.cg15-h15-report-print .cg15-print-scope button{display:none!important;}
   body.cg15-h15-report-print .cg15-print-scope [aria-label="Protected Foundation appointment cancellation override"]{
    display:none!important;visibility:hidden!important;
   }
   .cg15-print-scope p{break-inside:avoid;}
   .cg15-print-scope article{break-inside:avoid;}
  }`}</style>
  <header className="topbar"><div>
   <p className="cg-health-eyebrow">Healthcare / Patient records</p>
   <h1>Patient &amp; Booking Management</h1>
   <p>Manage actual patient consultations across healthcare centers</p>
  </div></header>
  <p>View current bookings and their recorded changes. Medical reports are kept private.</p>
  {!!message&&<p role="alert" className="notice error">{message}</p>}
  <p>Foundation-wide totals across all dates and centers. Filters below apply to consultation records only.</p>
  <div className="cg-health-kpi-grid" aria-label="Six Foundation patient and booking indicators">
   {([
    ["Total Patients",metrics?.totalPatients],
    ["Active Patients",metrics?.activePatients],
    ["Total Bookings",metrics?.totalBookings],
    ["Today's Bookings",metrics?.todayBookings],
    ["Completed",metrics?.completed],
    ["Pending",metrics?.pending]
   ] as const).map(([label,n])=><article className="cg-health-kpi-card" key={label}>
    <p>{label}</p><strong>{n===undefined?"—":n.toLocaleString("en-IN")}</strong>
   </article>)}
  </div>
  <fieldset className="form-section" aria-label="Source-backed booking filters" disabled={blocked} style={{minWidth:0}}>
   {!result?.geographyComplete&&result&&
    <p role="status">The original location categories exceed the safe single-response limit.
     Narrow by a specific center name to find an existing booking.</p>}
   {!result?.centerChoicesComplete&&result&&
    <p role="status">More than 100 healthcare centers match.
     Select a state, district or facility type, or search by center name.</p>}
   <form onSubmit={e=>{e.preventDefault();
    const value=searchDraft.trim();
    if(value&&value.length<2){setMessage("Enter at least two characters to search.");return;}
    setMessage("");update({search:value});
   }} style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"end"}}>
    <label>Find a patient or booking
     <input type="search" value={searchDraft} maxLength={80}
      onChange={e=>setSearchDraft(e.target.value)}
      placeholder="Patient name, Virtual Patient ID, or booking ID"
      aria-label="Search own Foundation patient bookings"/>
    </label>
    <button type="submit">Search bookings</button>
   </form>
   <div className="toolbar">
    <label>State
     <select value={query.stateRef} onChange={e=>update({
      stateRef:e.target.value,districtRef:"",centerRef:""})}>
      <option value="">All states</option>
      {result?.states.map(x=><option key={x.stateRef} value={x.stateRef}>
       {x.stateName}</option>)}
     </select>
    </label>
    <label>District
     <select value={query.districtRef} onChange={e=>update({
      districtRef:e.target.value,centerRef:""})}>
      <option value="">All districts</option>
      {districts.map(x=><option key={x.districtRef} value={x.districtRef}>
       {x.districtName}</option>)}
     </select>
    </label>
    <form onSubmit={e=>{e.preventDefault();
      update({centerSearch:centerDraft.trim(),centerRef:""});}}
     style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
     <label>Find healthcare center
      <input type="search" value={centerDraft} maxLength={60}
       onChange={e=>setCenterDraft(e.target.value)}
       placeholder="Center name"/></label>
     <button type="submit">Filter centers</button>
     <button type="button" onClick={()=>{setCenterDraft("");
      update({centerSearch:"",centerRef:""});}}>Clear center search</button>
    </form>
    <label>Healthcare center
     <select value={query.centerRef} onChange={e=>update({centerRef:e.target.value})}>
      <option value="">All centers</option>
      {centerChoices.map(c=><option key={c.centerRef} value={c.centerRef}>
       {c.centerName}</option>)}
     </select>
    </label>
    <label>Facility type
     <select value={query.centerType}
      onChange={e=>update({centerType:e.target.value,centerRef:""})}>
      <option value="">All facility types</option>
      {result?.centerTypes.map(type=><option key={type} value={type}>
       {centerKind(type)}</option>)}
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
    <label>Appointment from (center local date)
     <input type="date" value={query.fromDay} max={query.untilDay||undefined}
      onChange={e=>{setMessage("");update({fromDay:e.target.value,day:""});}}/>
    </label>
    <label>Appointment through (center local date)
     <input type="date" value={query.untilDay} min={query.fromDay||undefined}
      onChange={e=>{setMessage("");update({untilDay:e.target.value,day:""});}}/>
    </label>
    <button type="button" onClick={()=>{setSearchDraft("");setCenterDraft("");setMessage("");setQuery({status:"",centerRef:"",after:"",day:"",fromDay:"",untilDay:"",
      stateRef:"",districtRef:"",centerType:"",search:"",centerSearch:""});}}>
     Reset filters</button>
   </div>
  </fieldset>
  {loading&&<p role="status" className="cg-module-loading">Checking current protected source records…</p>}
  {!loading&&result&&<div className="cg-health-record-layout">
   <section className="cg-health-records" aria-label="Protected consultations">
    <h2>Consultation records</h2>
    {result.items.length===0&&<p>No consultations match these filters.</p>}
    {result.items.map(item=><button key={item.bookingRef} type="button" className="cg-health-record"
     aria-pressed={selected===item.bookingRef} disabled={blocked}
     onClick={()=>setSelected(item.bookingRef)}>
     <strong>{item.bookingId}</strong><span> — {statusName(item.bookingStatus)}</span>
     <p>{item.patientName} · {item.centerName}</p>
     <p>{centerTime(item.startAt,item.timeZone)}</p>
    </button>)}
    {result.next&&<button type="button" disabled={blocked} onClick={()=>
     setQuery(q=>({...q,after:result.next!}))}>Next results</button>}
   </section>
   <section className="cg15-print-scope cg-health-patient-detail" aria-label="Selected patient and appointment details">
    <h2>Patient Details</h2>
    {!selectedBooking?<p>Select an actual consultation to view its limited details.</p>:
     <>
      <p><strong>Patient:</strong> {selectedBooking.patientName}</p>
      <p><strong>Virtual Patient ID:</strong> {selectedBooking.virtualPatientId}</p>
      <p><strong>Patient profile:</strong> {selectedBooking.patientProfileStatus==="VERIFIED"?
       "Identity verified":selectedBooking.patientProfileStatus==="PROVISIONAL"?
       "Provisional — identity verification pending":"Current status unavailable"}</p>
      <p><strong>Patient-care consent:</strong> {selectedBooking.patientConsentGranted===true?
       "Currently granted":selectedBooking.patientConsentGranted===false?
       "Withdrawn":"Not recorded"}</p>
      <p>This is a CareGanga patient record, not a government-issued Health ID.</p>
      <p><strong>Booking ID:</strong> {selectedBooking.bookingId}</p>
      <p><strong>Doctor:</strong> {selectedBooking.doctorName}</p>
      <p><strong>Center:</strong> {selectedBooking.centerName}</p>
      <p><strong>Appointment:</strong> {centerTime(selectedBooking.startAt,selectedBooking.timeZone)}</p>
      <p><strong>Status:</strong> {statusName(selectedBooking.bookingStatus)}</p>
      <p><strong>Consultation:</strong> {money(selectedBooking.consultationFeeMinor)}
       · {statusName(selectedBooking.collectionStatus)}</p>
      {canOverride&&selectedBooking.bookingStatus==="CONFIRMED"&&
       new Date(selectedBooking.startAt).getTime()>Date.now()&&
       <section className="form-section"
        aria-label="Protected Foundation appointment cancellation override">
        <h3>Exceptional cancellation review</h3>
        <p>Only a protected Foundation administrator may cancel a confirmed
         appointment after the normal cancellation cutoff or while its center
         is suspended, provided the consultation has not started. Every change
         uses the real appointment version and an immutable actor/reason audit.
         The doctor reservation is released; previous clinical outcomes cannot
         be rewritten. Sending a patient notification is a separate operation.</p>
        <label>Confirm your current Foundation password
         <input type="password" autoComplete="current-password"
          value={overridePassword} onChange={e=>setOverridePassword(e.target.value)}
          maxLength={1024} disabled={overrideBusy||overrideUncertain}/>
        </label>
        <label><input type="checkbox" checked={overrideAcknowledged}
         onChange={e=>setOverrideAcknowledged(e.target.checked)}
         disabled={overrideBusy||overrideUncertain}/>
         I reviewed this exact appointment, its patient, doctor, date and
         current status, and authorize an exceptional cancellation.
        </label>
        <button type="button" disabled={overrideBusy||overrideUncertain||
         !overrideAcknowledged||overridePassword.length<8||loading}
         onClick={()=>void applyFoundationOverride()}>
         {overrideBusy?"Checking original cancellation…":"Confirm exceptional cancellation"}
        </button>
       </section>}
      {!!overrideMessage&&<p role="status" className="notice">{overrideMessage}</p>}
      {overrideUncertain&&<button type="button" disabled={loading||overrideBusy}
       onClick={()=>void refreshOverrideSource()}>
       Refresh original booking before another cancellation
      </button>}
      <p>Original CareGanga appointment record — not a receipt, prescription,
       government Health ID or evidence of financial assistance.</p>
      <button type="button" disabled={blocked||historyBusy||
       !currentHistory||!!currentHistory.next}
       onClick={()=>void printSelectedBooking()}>
       {printBusy?"Checking protected report…":"Print selected booking report"}</button>
      {!!printMessage&&<p role="status">{printMessage}</p>}
      <h3>Booking History</h3>
      {historyBusy&&!currentHistory&&<p role="status">Checking original booking events…</p>}
      {!!historyError&&<p role="alert">{historyError}</p>}
      {currentHistory?.items.length===0&&<p>No recorded changes are available for this booking.</p>}
      {currentHistory?.items.map(e=><article key={e.revision}
       style={{padding:10,borderBottom:"1px solid #d7dfdb"}}>
       <p><strong>{e.action.replaceAll("_"," ")}</strong> —
        {new Date(e.when).toLocaleString("en-IN")}</p>
       <p>Recorded by {e.by}</p>
       {e.before?.status&&<p>Previously: {statusName(e.before.status)}
        {e.before.startAt?" · "+new Date(e.before.startAt).toLocaleString("en-IN"):""}</p>}
       {e.after?.status&&<p>Updated: {statusName(e.after.status)}
        {e.after.startAt?" · "+new Date(e.after.startAt).toLocaleString("en-IN"):""}</p>}
       {e.before?.centerName&&<p>Previous center: {e.before.centerName}</p>}
       {e.after?.centerName&&<p>Current center: {e.after.centerName}</p>}
       {e.after?.reason&&<p>Reason: {e.after.reason.replaceAll("_"," ").toLowerCase()}</p>}
       {e.after?.consultationFeeMinor&&
        <p>Accepted consultation: {money(e.after.consultationFeeMinor)}</p>}
      </article>)}
      {currentHistory?.next&&<p>Older booking events remain. Load all original
       history pages before printing the complete protected report.</p>}
      {currentHistory?.next&&<button type="button" disabled={historyBusy}
       onClick={()=>void moreHistory()}>Older booking events</button>}
      <p>This event history contains only this protected booking's operational changes.
       Medical reports and other patient records are not disclosed.</p>
      <p>Medical Profile, Documents, Prescriptions and Care Plan remain hidden until
       their actual consented owner sources are authorized.</p>
     </>}
   </section>
  </div>}
  <details className="form-section" aria-label="Restricted patient duplicate reviews">
   <summary>Review possible duplicate patient identities</summary>
   <FoundationPatientDuplicateReviews/>
  </details>
 </section>;
}
