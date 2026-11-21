"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {FoundationJournalPostingPanel} from "./foundation-journal-posting-panel";
type Center={centerRef:string;name:string};
type Appointment={appointmentRef:string;bookingLabel:string;centerName:string;
 doctorName:string;completedAt:string;approvedSupportMinor:string;
 state:"READY_TO_RECOGNIZE"|"APPROVED_LIABILITY"};
type Options={appointments:Appointment[];complete:boolean};
type Status={state:string;liabilityRef?:string;amountMinor?:string;currency?:string;
 postingState?:string;foundationJournalPosted:boolean;providerSettled:boolean;
 providerSettlementState?:string;
 originalServiceCompletedAt?:string;correctedByOriginalReversal?:boolean;
 effectiveFoundationPayableMinor?:string};
type Props={canManage:boolean;canPost:boolean};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const money=(v:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2
}).format(Number(v)/100);
const root="/api/healthcare-assistance/foundation-liabilities/";
async function request<T>(path:string,body?:object):Promise<T>{
 const response=await fetch(root+path,{
  method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{})});
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error(
  raw&&typeof raw==="object"&&"message" in raw&&
  typeof raw.message==="string"?raw.message:
  "The original Foundation obligation could not be verified."),{
   status:response.status});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw Error("The source-owned Foundation response cannot be verified.");
 return raw as T;
}
/** CG17 US005: source-confirmed completed appointments only. The existing
 * CG14/CG15/CG17 sources and protected staff BFF own authorization.
 * Cash collections, CG09 posted journals and provider payments are separate.
 */
export function CompletedConsultationLiabilityWorkspace({canManage,canPost}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState("");
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [selected,setSelected]=useState<Appointment|null>(null);
 const [status,setStatus]=useState<Status|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [complete,setComplete]=useState(true),[uncertain,setUncertain]=useState(false);
 const originalKey=useRef<string|null>(null),serial=useRef(0);
 const load=useCallback(async(current:string)=>{
  if(!ID.test(current))return {appointments:[],complete:true} as Options;
  const reply=await request<Options>("centers/"+current+"/completed-options");
  if(!Array.isArray(reply.appointments)||reply.appointments.length>50)
   throw Error("Original completed consultation options are unavailable.");
  return reply;
 },[]);
 const refreshStatus=useCallback(async(c:string,booking:string)=>{
  if(!ID.test(c)||!ID.test(booking))throw Error("Choose a valid original consultation.");
  const value=await request<Status>("centers/"+c+"/appointments/"+booking);
  if(typeof value.state!=="string"||
    typeof value.foundationJournalPosted!=="boolean"||
    typeof value.providerSettled!=="boolean")
   throw Error("Original Foundation obligation state is incomplete.");
  return value;
 },[]);
 useEffect(()=>{
  let active=true;
  void request<{centers:Center[];complete:boolean}>("centers/eligible")
   .then(x=>{
    if(!active)return;
    if(!Array.isArray(x.centers)||x.centers.length>50)
     throw Error("Verified Foundation center list could not be confirmed.");
    setCenters(x.centers.filter(c=>ID.test(c.centerRef)&&c.name.length>0));
    if(x.centers.length===1)setCenter(x.centers[0].centerRef);
   }).catch(e=>{
    if(active)setError(e instanceof Error?e.message:"Current eligible centers unavailable.");
   }).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  const rev=++serial.current;
  setAppointments([]);setSelected(null);setStatus(null);setUncertain(false);
  originalKey.current=null;setError("");setNotice("");
  if(!center)return;
  setLoading(true);
  void load(center).then(v=>{
   if(rev!==serial.current)return;
   setAppointments(v.appointments);
   setComplete(v.complete);
  }).catch(e=>{
   if(rev===serial.current)setError(e instanceof Error?e.message:
    "No verified completed appointments available.");
  }).finally(()=>{if(rev===serial.current)setLoading(false)});
 },[center,load]);
 const choose=async(a:Appointment)=>{
  if(busy||loading)return;
  setSelected(a);setStatus(null);setError("");setNotice("");setUncertain(false);
  originalKey.current=null;setBusy(true);
  try{setStatus(await refreshStatus(center,a.appointmentRef));}
  catch(e){setError(e instanceof Error?e.message:"Original liability status unavailable.");}
  finally{setBusy(false)}
 };
 async function check(){
  if(!selected||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const next=await refreshStatus(center,selected.appointmentRef);
   setStatus(next);
   setUncertain(false);
   if(next.state==="APPROVED_LIABILITY")originalKey.current=null;
   const opts=await load(center);
   setAppointments(opts.appointments);setComplete(opts.complete);
  }catch(e){setError(e instanceof Error?e.message:
   "The original completed-service state is unavailable.");}
  finally{setBusy(false);}
 }
 async function recognize(){
  if(!canManage||busy||uncertain||!selected||
   selected.state!=="READY_TO_RECOGNIZE"||
   status?.state!=="NOT_RECOGNIZED")return;
  if(!window.confirm("Recognize the approved Foundation share for this "+
   "genuinely completed consultation? This does not pay the provider "+
   "or collect any money from the patient."))return;
  originalKey.current??=selected.appointmentRef;
  setBusy(true);setError("");setNotice("");
  try{
   const value=await request<Status>("centers/"+center+"/appointments/"+
    selected.appointmentRef+"/recognize",{requestKey:originalKey.current});
   if(value.state!=="APPROVED_LIABILITY"||
    value.foundationJournalPosted!==false)
    throw Error("The new Foundation obligation source cannot be confirmed.");
   setStatus(value);setUncertain(false);originalKey.current=null;
   setNotice("Approved Foundation obligation recorded from the completed "+
    "service. CG09 journal posting and provider settlement are still pending.");
   const opts=await load(center);
   setAppointments(opts.appointments);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(code>=500);
   if(code<500)originalKey.current=null;
   setError(e instanceof Error?e.message:
    "Liability outcome uncertain. Recheck the original service.");
  }finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="Foundation healthcare obligations">
  <h1>Foundation Healthcare Obligations</h1>
  <p>Recognize an approved Foundation contribution only after the clinician has
   genuinely completed the consultation and the original accepted amount is verified.
   Patient payments belong to the healthcare center, not Foundation income.</p>
  {loading&&<p role="status">Checking original completed-service sources…</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  <label className="field">Verified healthcare center
   <select value={center} disabled={busy} onChange={e=>setCenter(e.target.value)}>
    <option value="">Select a verified center</option>
    {centers.map(c=><option key={c.centerRef} value={c.centerRef}>{c.name}</option>)}
   </select>
  </label>
  {center&&!loading&&appointments.length===0&&
   <p>No completed consultation has an accepted approved Foundation contribution
    available at this center. Bookings alone do not create obligations.</p>}
  {center&&!complete&&<p role="status">
   Showing the first 50 completed source records. Review older records through
   authorized historical reporting; no additional obligations were guessed.</p>}
  {appointments.length>0&&<section className="cg-diagnostics-card">
   <h2>Actual completed consultations</h2>
   <div className="table-wrap"><table className="role-table">
    <thead><tr><th>Booking</th><th>Doctor</th><th>Completed</th>
     <th>Approved Foundation share</th><th>Source state</th><th>Action</th></tr></thead>
    <tbody>{appointments.map(a=><tr key={a.appointmentRef}>
     <td>{a.bookingLabel}</td><td>{a.doctorName}</td>
     <td>{new Date(a.completedAt).toLocaleDateString("en-IN")}</td>
     <td>{money(a.approvedSupportMinor)}</td>
     <td>{a.state==="APPROVED_LIABILITY"?
      "Already recognized":"Awaiting approved obligation"}</td>
     <td><button type="button" disabled={busy}
      onClick={()=>void choose(a)}>Review original</button></td>
    </tr>)}</tbody>
   </table></div>
  </section>}
  {selected&&<section className="cg-diagnostics-card">
   <h2>Review original contribution — {selected.bookingLabel}</h2>
   <p>Original completed consultation, not booking confirmation.
    Approved contribution: <strong>{money(selected.approvedSupportMinor)}</strong>.</p>
   {status&&<p role="status">Foundation liability: {
    status.state.replaceAll("_"," ").toLowerCase()}.
    CG09 journal: {status.correctedByOriginalReversal?"Offset by independently verified correction":
     status.foundationJournalPosted?"Posted":"Not confirmed posted"}.
    Provider settlement: {status.providerSettled?"Verified settled":
     status.providerSettlementState==="PARTIALLY_SETTLED"?"Partially settled":
     status.providerSettlementState==="APPROVED"?"Approved, not yet paid":
     status.providerSettlementState==="PROPOSED"?"Proposed, not approved":
     "Not yet claimed"}.
    {status.correctedByOriginalReversal&&
     <strong> Effective Foundation payable: {money(status.effectiveFoundationPayableMinor??"0")}.</strong>}</p>}
   {canManage&&status?.state==="NOT_RECOGNIZED"&&
    selected.state==="READY_TO_RECOGNIZE"&&!uncertain&&
    <button type="button" className="primary" disabled={busy}
     onClick={()=>void recognize()}>Recognize approved completed-service obligation</button>}
   {canPost&&status?.state==="APPROVED_LIABILITY"&&
    status.liabilityRef&&
    ID.test(status.liabilityRef)&&
    <FoundationJournalPostingPanel key={status.liabilityRef}
     centerRef={center} liabilityRef={status.liabilityRef}
     onPosted={async()=>{await check();}}/>}
   {uncertain&&<p role="alert">The previous write may have succeeded.
    Check its original status before another attempt; no new liability will be created.</p>}
   <button type="button" disabled={busy} onClick={()=>void check()}>
    {busy?"Checking…":"Check original obligation status"}</button>
  </section>}
 </section>;
}
