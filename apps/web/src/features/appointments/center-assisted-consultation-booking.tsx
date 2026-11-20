"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ConsultationContribution} from "../healthcare-assistance/consultation-contribution";

type Doctor={doctorRef:string;doctorName:string};
type Day={status:string;bookingEnabled:boolean;doctorName:string;centerName:string;
 timeZone:string;consultationFeeMinor:string|null;consultationFeeVersion:number|null;
 slots:{startAt:string;endAt:string;startLocal:string;endLocal:string;bookable:boolean}[]};
type Hold={holdRef:string;status:string;expiresAt:string;consultationFeeMinor:string;feeVersion:number};
type Booking={bookingRef:string;bookingId:string;bookingStatus:string;collectionStatus:string;consultationFeeMinor:string};
type Attempt={signature:string;key:string;body:Record<string,unknown>};
const VIRTUAL=/^CGP-[A-F0-9]{16}$/;
const CODE=/^CGB-[A-F0-9]{24}$/;
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const money=(minor:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR"}).format(Number(minor)/100);
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):
 Promise<T>{
 const res=await fetch("/api/appointments/staff-consultations/"+path,{
  method,cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 const raw:unknown=await res.json().catch(()=>null);
 if(!res.ok){
  const message=raw&&typeof raw==="object"&&"message" in raw&&
   typeof raw.message==="string"?raw.message:
   "The original center booking request cannot be confirmed.";
  throw Object.assign(new Error(message),{status:res.status});
 }
 return raw as T;
}
/** One receptionist route, actual CG14 center and doctor choices, original
 * public slots, source-authenticated patient code, same global CG15 booking.
 * Does not create a new patient, shadow appointment, payment or private report.
 */
export function CenterAssistedConsultationBooking({centerRef}:{centerRef:string}){
 const [permission,setPermission]=useState(false),[loading,setLoading]=useState(true);
 const [chargeAccess,setChargeAccess]=useState({view:false,accept:false});
 const [doctors,setDoctors]=useState<Doctor[]>([]),[doctor,setDoctor]=useState("");
 const [date,setDate]=useState("");
 const [availability,setAvailability]=useState<Day|null>(null);
 const [slotsLoading,setSlotsLoading]=useState(false);
 const [patientId,setPatientId]=useState(""),[code,setCode]=useState("");
 const [hold,setHold]=useState<Hold|null>(null),[booking,setBooking]=useState<Booking|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const [attemptKind,setAttemptKind]=useState<"HOLD"|"CONFIRM"|null>(null);
 const [selected,setSelected]=useState<{startAt:string;endAt:string}|null>(null);
 const holdAttempt=useRef<Attempt|null>(null),confirmAttempt=useRef<Attempt|null>(null);
 const slipKey=useRef<string|null>(null);
 const requestEpoch=useRef(0);
 const root="centers/"+encodeURIComponent(centerRef);
 useEffect(()=>{
  let active=true;
  setLoading(true);setDoctors([]);setPermission(false);
  setChargeAccess({view:false,accept:false});
  // A new center must never inherit the previous patient's code or identity.
  setPatientId("");setCode("");setHold(null);setBooking(null);
  setAvailability(null);setUncertain(false);setAttemptKind(null);
  holdAttempt.current=null;confirmAttempt.current=null;slipKey.current=null;
  void fetch("/api/access/effective",{cache:"no-store",credentials:"same-origin"})
   .then(async r=>r.ok?r.json():null)
   .then(async (data:unknown)=>{
    if(!active)return;
    const actions=data&&typeof data==="object"&&"actions" in data&&
     Array.isArray(data.actions)?data.actions:[];
    const can=actions.some((x:unknown)=>x&&typeof x==="object"&&
     "key" in x&&x.key==="health.patients.intake");
    setChargeAccess({
     view:actions.some((x:unknown)=>x&&typeof x==="object"&&
      "key" in x&&x.key==="healthcare.assistance.charges.view"),
     accept:actions.some((x:unknown)=>x&&typeof x==="object"&&
      "key" in x&&x.key==="healthcare.assistance.charges.accept")});
    if(!can){setPermission(false);return;}
    const original=await request<{doctors:Doctor[];complete:boolean}>(root+"/doctors");
    if(!active)return;
    setDoctors(original.doctors);setPermission(true);
    if(!original.complete)setMessage("This center has more than 100 doctors; ask an administrator to narrow the roster.");
   }).catch(e=>{if(active)setMessage(e instanceof Error?e.message:
    "The authorized center's doctors could not be loaded.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;requestEpoch.current++;};
 },[root]);
 const refreshSlots=useCallback(async(d:string,day:string)=>{
  if(!d||!day)return;
  const epoch=++requestEpoch.current;
  setSlotsLoading(true);setAvailability(null);setMessage("");
  try{
   const source=await request<Day>(root+"/doctor/"+encodeURIComponent(d)+
    "/slots?date="+encodeURIComponent(day));
   if(epoch!==requestEpoch.current)return;
   setAvailability(source);
  }catch(e){if(epoch===requestEpoch.current)
   setMessage(e instanceof Error?e.message:"Availability could not be confirmed.");}
  finally{if(epoch===requestEpoch.current)setSlotsLoading(false);}
 },[root]);
 function makeAttempt(slot:{startAt:string;endAt:string}){
  const fee=availability?.consultationFeeMinor,ver=availability?.consultationFeeVersion;
  if(!fee||!ver)return null;
  const body={doctorRef:doctor,centerRef,startAt:slot.startAt,endAt:slot.endAt,
   acceptedFeeMinor:fee,acceptedFeeVersion:ver,paymentMode:"PAY_AT_CENTER",
   virtualPatientId:patientId,authorizationCode:code};
  const signature=JSON.stringify(body);
  if(holdAttempt.current?.signature!==signature)
   holdAttempt.current={signature,key:crypto.randomUUID(),body};
  return holdAttempt.current;
 }
 async function reserve(slot:{startAt:string;endAt:string},retry=false){
  if(busy||(!retry&&uncertain)||hold||booking)return;
  if(!VIRTUAL.test(patientId)||!CODE.test(code)){
   setMessage("Ask the patient for their verified Virtual Patient ID and one-time booking code.");return;
  }
  const attempt=makeAttempt(slot);if(!attempt)return;
  setSelected(slot);setBusy(true);setMessage("");
  setAttemptKind("HOLD");
  try{
   const result=await request<Hold>("holds","POST",{
    ...attempt.body,requestKey:attempt.key});
   setHold(result);setUncertain(false);
   setMessage("The doctor's time is held for this patient. Confirm before the displayed expiry.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   if(typeof status==="number"&&status>=400&&status<500){
    setUncertain(false);setMessage(e instanceof Error?e.message:
     "This patient authorization or time is not available. Refresh and choose again.");
   }else{
    setUncertain(true);setMessage((e instanceof Error?e.message:
     "The hold may have succeeded.")+" Check the original request before another booking.");
   }
  }finally{setBusy(false);}
 }
 // Center-owned CG19 publication is attempted only after CG15 commits.
 // The real center permission and consent are checked again by CG19.
 // A document error does not undo or fake the original appointment.
 async function issueCurrentSlip(bookingRef:string):Promise<boolean>{
  if(!ID.test(bookingRef))return false;
  const path="/api/appointments/staff-slips/"+encodeURIComponent(bookingRef);
  try{
   const response=await fetch(path+"/status",{
    cache:"no-store",credentials:"same-origin",
    signal:AbortSignal.timeout(12000)});
   if(!response.ok)return false;
   const status:unknown=await response.json();
   if(status&&typeof status==="object"&&
    "status" in status&&status.status==="ISSUED"&&
    "canDownload" in status&&status.canDownload===true)return true;
   if(!status||typeof status!=="object"||
    !("status" in status)||status.status!=="NOT_ISSUED")return false;
   if(!slipKey.current)slipKey.current=crypto.randomUUID();
   const issued=await fetch(path+"/issue",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    signal:AbortSignal.timeout(12000),
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:slipKey.current})});
   if(!issued.ok)return false;
   const value:unknown=await issued.json();
   return !!value&&typeof value==="object"&&
    "status" in value&&value.status==="ISSUED"&&
    "confirmed" in value&&value.confirmed===true;
  }catch{return false;}
 }
 async function confirm(retry=false){
  if(busy||(!retry&&uncertain)||!hold||booking)return;
  if(Date.parse(hold.expiresAt)<=Date.now()){
   setMessage("This hold expired. Ask the patient for a new booking code and select a current time.");return;
  }
  if(!confirmAttempt.current){
   const body={holdRef:hold.holdRef,acceptedFeeMinor:hold.consultationFeeMinor,
    acceptedFeeVersion:hold.feeVersion,paymentMode:"PAY_AT_CENTER"};
   confirmAttempt.current={signature:JSON.stringify(body),key:crypto.randomUUID(),body};
  }
  const attempt=confirmAttempt.current;
  setBusy(true);setMessage("");setAttemptKind("CONFIRM");
  try{
   const result=await request<Booking>("confirm","POST",{
    ...attempt.body,requestKey:attempt.key});
   setBooking(result);setUncertain(false);
   const slip=await issueCurrentSlip(result.bookingRef);
   setMessage(slip?
    "Consultation confirmed. The original private slip is issued. Payment remains DUE at the center.":
    "Consultation confirmed. Payment remains DUE at the center. Check the center's private slip status or ask the patient to open their own slip.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   if(typeof status==="number"&&status>=400&&status<500){
    setUncertain(false);setMessage(e instanceof Error?e.message:
     "The held time or fee is no longer available. Refresh the current schedule.");
   }else{
    setUncertain(true);
    setMessage((e instanceof Error?e.message:"The confirmation may have succeeded.")+
     " Check the original request; do not create another booking.");
   }
  }finally{setBusy(false);}
 }
 async function checkOriginal(){
  if(busy||!attemptKind)return;
  setBusy(true);setMessage("");
  try{
   if(attemptKind==="CONFIRM"&&confirmAttempt.current){
    const value=await request<Booking>("confirmations/by-request/"+
     confirmAttempt.current.key);
    setBooking(value);setUncertain(false);
    const slip=await issueCurrentSlip(value.bookingRef);
    setMessage("Original appointment confirmed: "+value.bookingId+
     (slip?". The private consultation slip is issued.":
      ". Check original private slip status before relying on a document."));
   }else if(attemptKind==="HOLD"&&holdAttempt.current){
    const value=await request<Hold>("holds/by-request/"+
     holdAttempt.current.key);
    setHold(value);setUncertain(false);
    setMessage("Original hold found. Confirm only if it is still valid.");
   }
  }catch(e){
   setMessage("The original result is not yet verified. Retry the SAME request or check again.");
  }finally{setBusy(false);}
 }
 const clear=()=>{
  setHold(null);setBooking(null);setUncertain(false);setMessage("");setAttemptKind(null);
  setPatientId("");setCode("");setSelected(null);holdAttempt.current=null;confirmAttempt.current=null;
  slipKey.current=null;
 };
 if(loading)return <p role="status">Checking current receptionist permission…</p>;
 if(!permission)return null;
 return <section className="form-section" aria-label="Reception-assisted consultation booking">
  <h2>Book a consultation for a verified patient</h2>
  <p>Only your assigned center and current verified doctor schedules are available.
   The patient must separately authorize one reservation from their own account.
   The full consultation fee is payable at the center; no payment is collected here.</p>
  {!!message&&<p role="status" aria-live="polite">{message}</p>}
  {booking?<div className="notice" role="status">
   <strong>Confirmed booking: {booking.bookingId}</strong>
   <p>Status: {booking.bookingStatus}. Payment: {booking.collectionStatus}.
    Consultation: {money(booking.consultationFeeMinor)}.</p>
   {chargeAccess.view&&<ConsultationContribution
    key={booking.bookingRef} bookingRef={booking.bookingRef}
    centerRef={centerRef} canAccept={chargeAccess.accept}/>}
   <button type="button" onClick={clear}>Start another authorized booking</button>
  </div>:<>
   <div style={{display:"grid",gap:10,maxWidth:520}}>
    <label>Doctor at this center
     <select value={doctor} disabled={busy||uncertain||!!hold} onChange={e=>{
      requestEpoch.current++;setDoctor(e.target.value);setAvailability(null);
      setSelected(null);setPatientId("");setCode("");
      holdAttempt.current=null;confirmAttempt.current=null;}}>
      <option value="">Choose a verified doctor</option>
      {doctors.map(d=><option key={d.doctorRef} value={d.doctorRef}>
       {d.doctorName}</option>)}
     </select></label>
    <label>Consultation date (next 30 days)
     <input type="date" value={date} disabled={busy||uncertain||!!hold}
      onChange={e=>{requestEpoch.current++;setDate(e.target.value);
       setAvailability(null);setSelected(null);setPatientId("");setCode("");
       holdAttempt.current=null;confirmAttempt.current=null;}}/></label>
    <button type="button" disabled={busy||uncertain||!doctor||!date||!!hold}
     onClick={()=>void refreshSlots(doctor,date)}>
     {slotsLoading?"Checking…":"Check original available times"}</button>
    <label>Patient's Virtual Patient ID
     <input value={patientId} disabled={busy||uncertain||!!hold} maxLength={20}
      onChange={e=>{setPatientId(e.target.value.trim().toUpperCase());holdAttempt.current=null;}}
      placeholder="CGP-XXXXXXXXXXXXXXXX"/></label>
    <label>Patient's one-time code for this center
     <input value={code} disabled={busy||uncertain||!!hold} maxLength={28}
      onChange={e=>{setCode(e.target.value.trim().toUpperCase());holdAttempt.current=null;}}
      placeholder="CGB-XXXXXXXXXXXXXXXXXXXXXXXX"/></label>
   </div>
   {availability&&<div className="form-section">
    <h3>{availability.doctorName} — {availability.centerName}</h3>
    <p>Local time: {availability.timeZone}. Current fee:
     {availability.consultationFeeMinor!==null?
      " "+money(availability.consultationFeeMinor):" unavailable"}.</p>
    <div className="toolbar">
     {availability.slots.filter(s=>s.bookable).map(s=>
      <button type="button" key={s.startAt} disabled={busy||uncertain||!!hold||
       !VIRTUAL.test(patientId)||!CODE.test(code)}
       onClick={()=>void reserve(s)}>
       {s.startLocal}–{s.endLocal} · Reserve</button>)}
    </div>
    {!availability.slots.some(s=>s.bookable)&&
     <p>No currently bookable consultation time is available on this date.</p>}
   </div>}
   {hold&&<div className="notice">
    <h3>Time reserved</h3>
    <p>{selected?.startAt?new Date(selected.startAt).toLocaleString("en-IN"):"Selected consultation"}.
     Temporary hold expires {new Date(hold.expiresAt).toLocaleTimeString("en-IN")}.</p>
    <p>Approved consultation fee: {money(hold.consultationFeeMinor)}.
     The patient due is calculated from the original contribution policy.
     No amount has been collected here.</p>
    {chargeAccess.view&&<ConsultationContribution
     key={hold.holdRef} holdRef={hold.holdRef} centerRef={centerRef}
     canAccept={false}/>} 
    <button type="button" disabled={busy||uncertain||Date.parse(hold.expiresAt)<=Date.now()}
     onClick={()=>void confirm()}>Confirm this authorized appointment</button>
    {!uncertain&&Date.parse(hold.expiresAt)<=Date.now()&&
     <button type="button" disabled={busy} onClick={clear}>
      Start a new verified booking after the hold expired</button>}
   </div>}
   {uncertain&&<div role="alert" className="notice">
    <p>The last action may already have succeeded. Do not create a different
     booking until you check this exact request.</p>
    <button type="button" disabled={busy} onClick={()=>void checkOriginal()}>
     Check original request</button>
    {attemptKind==="HOLD"&&selected&&<button type="button" disabled={busy}
     onClick={()=>void reserve(selected,true)}>Retry same hold request</button>}
    {attemptKind==="CONFIRM"&&hold&&<button type="button" disabled={busy}
     onClick={()=>void confirm(true)}>Retry same confirmation request</button>}
   </div>}
  </>}
 </section>;
}
