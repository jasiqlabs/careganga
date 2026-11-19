"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CenterConsultationSlip} from "./center-consultation-slip";
type Center={centerRef:string;centerName:string;timeZone:string};
type Item={appointmentRef:string;bookingId:string;doctorRef:string;doctorName:string;
 patientName:string;consentGranted:boolean;startAt:string;endAt:string;timeZone:string;
 bookingStatus:string;bookingVersion:number;
 visitRef:string|null;queueToken:string|null;visitStatus:string|null;visitVersion:number|null};
type Queue={day:string;items:Item[];next:string|null};
type VerifiedSlip={valid:boolean;bookingRef?:string;bookingId?:string;
 patientName?:string;doctorName?:string;bookingStatus?:string;
 startAt?:string;timeZone?:string;canCheckIn?:boolean};
async function get<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/appointments/queue/"+path,{
  method,credentials:"same-origin",cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 const raw:unknown=await r.json().catch(()=>null);
 if(!r.ok){
  const text=raw&&typeof raw==="object"&&"message" in raw&&
   typeof raw.message==="string"?raw.message:"The queue result is uncertain. Refresh first.";
  throw Error(text);
 }
 return raw as T;
}
const centerToday=(zone:string)=>{
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
   timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return parts.year+"-"+parts.month+"-"+parts.day;
 }catch{return null;}
};
const isoToday=()=>new Date().toISOString().slice(0,10);
export function CenterVisitQueue(){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(""),[day,setDay]=useState(isoToday());
 const [items,setItems]=useState<Item[]>([]);
 const [cursor,setCursor]=useState(""),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [previousCursors,setPreviousCursors]=useState<string[]>([]);
 const [doctorFilter,setDoctorFilter]=useState(""),[statusFilter,setStatusFilter]=useState("");
 const [queueLoading,setQueueLoading]=useState(false);
 const [qrToken,setQrToken]=useState("");
 const [verifiedSlip,setVerifiedSlip]=useState<VerifiedSlip|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const [canCancel,setCanCancel]=useState(false);
 const [cancelPending,setCancelPending]=useState<string|null>(null);
 const keys=useRef<Map<string,string>>(new Map());
 const cancellationKeys=useRef<Map<string,string>>(new Map());
 const requestSerial=useRef(0),selectedCenterRef=useRef("");
 const load=useCallback(async(c:string,d:string,after="")=>{
  const serial=++requestSerial.current;
  if(!c){setItems([]);setQueueLoading(false);return;}
  setQueueLoading(true);
  try{
   const rows=await get<Queue>("my-centers/"+encodeURIComponent(c)+"?date="+encodeURIComponent(d)+
    (after?"&after="+encodeURIComponent(after):""));
   if(serial!==requestSerial.current||c!==selectedCenterRef.current)return;
   setItems(rows.items);setCursor(after);setNextCursor(rows.next);setUncertain(false);
  }finally{
   if(serial===requestSerial.current)setQueueLoading(false);
  }
 },[]);
 useEffect(()=>{
  let alive=true;
  // Show the sensitive cancellation action only after the real CG01 grant
  // is confirmed; backend also enforces current center affiliation per write.
  void fetch("/api/access/effective",{cache:"no-store",credentials:"same-origin"})
   .then(async r=>r.ok?r.json():null).then((data:unknown)=>{
    if(!alive)return;
    const actions=data&&typeof data==="object"&&"actions" in data&&
     Array.isArray(data.actions)?data.actions:[];
    setCanCancel(actions.some((action:unknown)=>action&&typeof action==="object"&&
     "key" in action&&action.key==="health.appointments.cancel"));
   }).catch(()=>{if(alive)setCanCancel(false);});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  let alive=true;
  void get<{centers:Center[]}>("my-centers").then(data=>{
   if(!alive)return;
   const valid=data.centers.filter(x=>x&&typeof x.centerRef==="string"&&
    typeof x.centerName==="string"&&typeof x.timeZone==="string");
    setCenters(valid);if(valid.length===1){
    const today=centerToday(valid[0].timeZone);
    if(!today){setMessage("The center's current local date is unavailable.");return;}
    selectedCenterRef.current=valid[0].centerRef;setDay(today);setCenter(valid[0].centerRef);
   }
  }).catch(e=>{if(alive)setMessage(e instanceof Error?e.message:"Access cannot be confirmed.");})
  .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(!center){requestSerial.current++;setItems([]);setCursor("");setNextCursor(null);setPreviousCursors([]);setQueueLoading(false);return;}
  let active=true;
  setPreviousCursors([]);setCursor("");setNextCursor(null);
  void load(center,day).catch(e=>{
   if(active&&center===selectedCenterRef.current){setItems([]);setMessage(e instanceof Error?e.message:"Queue unavailable.");}
  });
  return()=>{active=false;requestSerial.current++;};
 },[center,day,load]);
 async function verifySlip(){
  if(busy||uncertain||!center||!/^CGV-[A-F0-9]{24}$/.test(qrToken))return;
  setBusy(true);setMessage("");setVerifiedSlip(null);
  try{
   const result=await get<VerifiedSlip>("my-centers/"+
    encodeURIComponent(center)+"/verify-slip","POST",{token:qrToken});
   if(center!==selectedCenterRef.current)return;
   if(!result.valid){setMessage("The slip does not belong to an active appointment at this center.");return;}
   setVerifiedSlip(result);
   if(result.startAt&&result.timeZone){
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
     timeZone:result.timeZone,year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date(result.startAt)).map(x=>[x.type,x.value]));
    setDay(parts.year+"-"+parts.month+"-"+parts.day);
   }
   setMessage("This slip matches a current appointment at your authorized center. Confirm the booking in today's queue before checking in.");
  }catch(e){if(center===selectedCenterRef.current)setMessage(e instanceof Error?e.message:"The QR lookup could not be confirmed.");}
  finally{setBusy(false);}
 }
 async function command(item:Item,next:"CHECK_IN"|"WAITING"|"IN_CONSULTATION"|"COMPLETED"|"NO_SHOW"){
  if(busy||uncertain||!center)return;
  const reference=item.appointmentRef+":"+next+":"+
   (item.visitRef??"")+":"+(item.visitVersion??item.bookingVersion);
  let key=keys.current.get(reference);
  if(!key){key=crypto.randomUUID();keys.current.set(reference,key);}
  setBusy(true);setMessage("");
  try{
   if(next==="CHECK_IN"||next==="NO_SHOW"){
    const path=next==="CHECK_IN"?"check-in":"no-show";
    const response=await get<Record<string,unknown>>(
     "my-centers/"+encodeURIComponent(center)+"/"+path,"POST",{
     appointmentRef:item.appointmentRef,requestKey:key,expectedVersion:item.bookingVersion
    });
    if(next==="NO_SHOW"&&response.bookingStatus!=="NO_SHOW")
     throw Error("The original missed-booking status could not be confirmed.");
   }else{
    if(!item.visitRef||!item.visitVersion)throw Error("Visit status unavailable. Refresh.");
    await get("my-centers/"+encodeURIComponent(center)+"/visits/"+
     encodeURIComponent(item.visitRef)+"/transition","POST",{
      requestKey:key,expectedVersion:item.visitVersion,nextState:next
     });
   }
   keys.current.delete(reference);await load(center,day,cursor);
   setMessage("The visit status was saved for this healthcare center.");
  }catch(e){
   setUncertain(true);
   setMessage((e instanceof Error?e.message:"The result is uncertain.")+
    " Refresh the current queue before doing another action.");
  }finally{setBusy(false);}
 }
 async function cancelAppointment(item:Item){
  if(!canCancel||busy||uncertain||!center||cancelPending!==item.appointmentRef||
   item.bookingStatus!=="CONFIRMED"||item.visitRef)return;
  const activeCenter=center;
  const signature=activeCenter+":"+item.appointmentRef+":"+item.bookingVersion;
  let key=cancellationKeys.current.get(signature);
  if(!key){key=crypto.randomUUID();cancellationKeys.current.set(signature,key);}
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/appointments/staff-consultations/centers/"+
    encodeURIComponent(activeCenter)+"/bookings/"+
    encodeURIComponent(item.appointmentRef)+"/cancel",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({requestKey:key,expectedVersion:item.bookingVersion,
      reason:"CENTER_REQUEST"})
    });
   const raw:unknown=await response.json().catch(()=>null);
   if(!response.ok){
    const details=raw&&typeof raw==="object"&&"message" in raw&&
     typeof raw.message==="string"?raw.message:"Center cancellation could not be confirmed.";
    throw Object.assign(new Error(details),{status:response.status});
   }
   if(!raw||typeof raw!=="object"||!("bookingStatus" in raw)||
    raw.bookingStatus!=="CANCELLED")
    throw Error("Cancellation response is uncertain. Check the original booking.");
   cancellationKeys.current.delete(signature);
   setCancelPending(null);
   await load(activeCenter,day,cursor);
   setMessage("This center booking has been cancelled. Its previous audit history remains preserved.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage(e instanceof Error?e.message:"Cancellation may have succeeded. Refresh original queue.");
  }finally{setBusy(false);}
 }
 const doctorChoices=Array.from(new Map(items.map(x=>
  [x.doctorRef,{ref:x.doctorRef,name:x.doctorName}])).values())
  .sort((a,b)=>a.name.localeCompare(b.name));
 const visible=items.filter(x=>(!doctorFilter||x.doctorRef===doctorFilter)&&
  (!statusFilter||x.bookingStatus===statusFilter));
 return <section className="form-section" aria-label="My healthcare center consultation queue">
  <h2>Consultation check-in & queue</h2>
  <p>Only bookings at the selected assigned center appear here. Queue tokens are
   center-specific; no other center's patient history is shown.</p>
  {!!message&&<p role="alert" aria-live="polite">{message}</p>}
  {loading?<p>Checking current center permissions…</p>:<>
   <div className="toolbar">
    <label>Assigned healthcare center
     <select value={center} disabled={busy} onChange={e=>{const next=centers.find(x=>x.centerRef===e.target.value);
      const today=next?centerToday(next.timeZone):null;
      if(next&&!today){setMessage("The selected center's local time zone is unavailable.");return;}
      if(today)setDay(today);
      selectedCenterRef.current=e.target.value;requestSerial.current++;
      setItems([]);setCursor("");setNextCursor(null);setPreviousCursors([]);setVerifiedSlip(null);setQrToken("");setDoctorFilter("");setStatusFilter("");setCancelPending(null);
       setCenter(e.target.value);setUncertain(false);}}>
      <option value="">Select center</option>
      {centers.map(x=><option key={x.centerRef} value={x.centerRef}>
       {x.centerName}</option>)}
     </select></label>
    <label>Consultation date
     <input type="date" value={day} onChange={e=>{requestSerial.current++;setItems([]);setCursor("");setNextCursor(null);setPreviousCursors([]);setVerifiedSlip(null);setQrToken("");setDoctorFilter("");setStatusFilter("");
       setDay(e.target.value);setUncertain(false);setCancelPending(null);}}/>
    </label>
    <button type="button" disabled={busy||!center}
     onClick={()=>void load(center,day,cursor).catch(e=>setMessage(e instanceof Error?e.message:"The queue cannot be refreshed."))}>
     Refresh current queue</button>
   </div>
   {center&&<section aria-label="Verify an appointment QR at my center"
    style={{border:"1px solid #d7dfdb",borderRadius:12,padding:12}}>
    <h3>Verify a consultation QR code</h3>
    <p>Enter the opaque status code from the actual patient's slip. A code for another
     center will not reveal that center's patient or booking.</p>
    <label>Slip QR code
     <input type="text" maxLength={28} value={qrToken} autoCapitalize="characters"
      onChange={e=>{setQrToken(e.target.value.toUpperCase());setVerifiedSlip(null);}}
      placeholder="CGV-XXXXXXXXXXXXXXXXXXXXXXXX"/>
    </label>
    <button type="button" disabled={busy||!/^CGV-[A-F0-9]{24}$/.test(qrToken)}
     onClick={()=>void verifySlip()}>Verify for my center</button>
    {verifiedSlip?.valid&&<p role="status">
     Original booking: {verifiedSlip.bookingId}, {verifiedSlip.patientName},
     status {verifiedSlip.bookingStatus}. Use the current source row below to check in.
    </p>}
   </section>}
   {!centers.length&&<p>No current assigned, enabled healthcare center is available.</p>}
   {center&&items.length>0&&<div className="toolbar" aria-label="Consultation queue filters">
    <label>Doctor
     <select value={doctorFilter} onChange={e=>setDoctorFilter(e.target.value)}>
      <option value="">All doctors</option>
      {doctorChoices.map(d=><option key={d.ref} value={d.ref}>{d.name}</option>)}
     </select></label>
    <label>Visit status
     <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
      <option value="">All statuses</option>
      {["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION","COMPLETED","NO_SHOW",
        "CANCELLED"].map(state=><option key={state} value={state}>
       {state.replaceAll("_"," ")}</option>)}
     </select></label>
   </div>}
   {queueLoading&&<p role="status">Checking current center appointments…</p>}
   {center&&!queueLoading&&items.length===0&&
    <p>No booked consultations for this center and date.</p>}
   {center&&!queueLoading&&items.length>0&&visible.length===0&&
    <p>No consultations match these filters.</p>}
   {visible.map(item=><article className="card" key={item.appointmentRef}
    style={{border:"1px solid #d7dfdb",padding:14,marginBlock:8,borderRadius:12}}>
    <h3>{item.patientName}</h3>
    <p>Doctor: {item.doctorName}</p>
    <p>Booking: {item.bookingId} · {new Date(item.startAt).toLocaleString("en-IN",{
     timeZone:item.timeZone,dateStyle:"medium",timeStyle:"short"})}</p>
    <p>Status: {item.bookingStatus} · Queue: {item.queueToken??"Not checked in"}</p>
    {item.consentGranted?
     <CenterConsultationSlip bookingRef={item.appointmentRef} bookingStatus={item.bookingStatus}/>:
     <p role="status">Patient care consent was withdrawn. Private documents and new check-in are unavailable.</p>}
    {canCancel&&item.bookingStatus==="CONFIRMED"&&!item.visitRef&&
     (cancelPending===item.appointmentRef?
      <div className="notice">
       <p>Cancel this confirmed center appointment? The existing booking will remain in its audit history.</p>
       <button type="button" disabled={busy||uncertain}
        onClick={()=>void cancelAppointment(item)}>Confirm center cancellation</button>
       <button type="button" disabled={busy} onClick={()=>setCancelPending(null)}>Keep appointment</button>
      </div>:
      <button type="button" disabled={busy||uncertain}
       onClick={()=>setCancelPending(item.appointmentRef)}>Cancel center booking</button>)}
    <div className="toolbar">
     {item.consentGranted&&item.bookingStatus==="CONFIRMED"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"CHECK_IN")}>Check in</button>}
     {item.visitStatus==="ARRIVED"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"WAITING")}>Move to waiting</button>}
     {item.visitStatus==="WAITING"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"IN_CONSULTATION")}>In consultation</button>}
     {item.visitStatus==="IN_CONSULTATION"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"COMPLETED")}>Complete visit</button>}
     {item.bookingStatus==="CONFIRMED"&&!item.visitRef&&
      Number.isFinite(Date.parse(item.endAt))&&Date.parse(item.endAt)<=Date.now()&&
      <button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"NO_SHOW")}>Mark missed appointment</button>}
    </div>
   </article>)}
   {center&&items.length>0&&<nav aria-label="Queue pages" className="toolbar">
    <button type="button" disabled={busy||queueLoading||!previousCursors.length}
     onClick={()=>{const older=previousCursors.at(-1)??"";
      void load(center,day,older).then(()=>setPreviousCursors(p=>p.slice(0,-1)))
       .catch(e=>setMessage(e instanceof Error?e.message:"Queue page unavailable."));}}>
     Previous 100</button>
    <span>Page {previousCursors.length+1} · {items.length} appointments on this page</span>
    <button type="button" disabled={busy||queueLoading||!nextCursor}
     onClick={()=>{if(!nextCursor)return;const prior=cursor;
      void load(center,day,nextCursor).then(()=>setPreviousCursors(p=>[...p,prior]))
       .catch(e=>setMessage(e instanceof Error?e.message:"Queue page unavailable."));}}>
     Next 100</button>
    <small>Filters apply to the current page.</small>
   </nav>}
  </>}
 </section>;
}
