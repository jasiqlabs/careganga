"use client";
import {useCallback,useEffect,useState} from "react";
type Assignment={doctorRef:string;doctorName:string;centerRef:string;
 centerName:string;timeZone:string};
type Summary={centerRef:string;doctorRef:string;day:string;
 confirmed:number;waiting:number;inConsultation:number;
 completed:number;cancelled:number;noShow:number;
 containsPatientDetails:false;paymentNotIncluded:true};
const safeToday=(zone:string)=>{
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
   year:"numeric",month:"2-digit",day:"2-digit",timeZone:zone
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return parts.year+"-"+parts.month+"-"+parts.day;
 }catch{return new Date().toISOString().slice(0,10);}
};
async function get<T>(part:string):Promise<T>{
 const response=await fetch("/api/appointments/queue/"+part,{
  cache:"no-store",credentials:"same-origin"});
 if(!response.ok)throw Error(response.status===403?
  "Your current clinical role or center assignment cannot be verified.":
  "The original assigned consultations are currently unavailable.");
 return response.json() as Promise<T>;
}
/** Doctor-only CG14 professional link + CG15 appointment/visit counts,
 * independent of center front-desk queue and of Foundation settlement.
 */
export function MyClinicianActivity(){
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [selected,setSelected]=useState("");
 const [day,setDay]=useState("");
 const [data,setData]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  void get<{assignments:Assignment[]}>("my-clinician/assignments").then(x=>{
   if(!active)return;
   if(!Array.isArray(x.assignments)||x.assignments.length>50)
    throw Error("Doctor assignments cannot be verified.");
   setAssignments(x.assignments);
   const first=x.assignments[0];
   if(first){setSelected(first.doctorRef+"|"+first.centerRef);
    setDay(safeToday(first.timeZone));}
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Your own doctor assignments are unavailable.");})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const current=assignments.find(x=>x.doctorRef+"|"+x.centerRef===selected);
 const refresh=useCallback(async()=>{
  if(!current||!/^(20[2-9]\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day))
   throw Error("Choose a valid consultation date.");
  const x=await get<Summary>("my-clinician/centers/"+current.centerRef+
   "/doctors/"+current.doctorRef+"/summary?date="+encodeURIComponent(day));
  if(x.centerRef!==current.centerRef||x.doctorRef!==current.doctorRef||
   x.day!==day||x.containsPatientDetails!==false||
   x.paymentNotIncluded!==true)
   throw Error("Current doctor's source activity cannot be verified.");
  setData(x);
 },[current?.centerRef,current?.doctorRef,day]);
 useEffect(()=>{
  let active=true;setData(null);setError("");
  if(!current||!day)return;
  setBusy(true);
  void refresh().catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Current professional activity is unavailable.");})
   .finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[refresh]);
 return <section className="cg-health-workspace">
  <header className="topbar"><div>
   <h1>My consultations</h1>
   <p>Appointments and visits assigned to your verified doctor identity.
    Other doctors' patients and Foundation financial records are not shown.</p>
  </div></header>
  {loading&&<p role="status">Checking your current professional assignments…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {!loading&&!assignments.length&&
   <p>No active approved healthcare center is linked to your current
    doctor account. Ask the Foundation to verify your affiliation.</p>}
  {!!assignments.length&&<div className="toolbar">
   <label htmlFor="my-clinician-center">Doctor and healthcare center</label>
   <select id="my-clinician-center" value={selected}
    onChange={e=>{const x=assignments.find(item=>
     item.doctorRef+"|"+item.centerRef===e.target.value);
     if(!x)return;setSelected(e.target.value);setDay(safeToday(x.timeZone));}}>
    {assignments.map(x=><option key={x.doctorRef+"|"+x.centerRef}
     value={x.doctorRef+"|"+x.centerRef}>
     {x.doctorName} — {x.centerName}</option>)}
   </select>
   <label htmlFor="my-clinician-day">Consultation day</label>
   <input id="my-clinician-day" type="date" value={day}
    onChange={e=>setDay(e.target.value)}/>
   <button type="button" disabled={busy}
    onClick={()=>{setBusy(true);setError("");void refresh().catch(e=>
     setError(e instanceof Error?e.message:"Unable to refresh."))
      .finally(()=>setBusy(false))}}>Refresh</button>
  </div>}
  {busy&&<p role="status">Checking today's original appointment records…</p>}
  {data&&<dl className="cg-health-summary">
   <dt>Confirmed consultations</dt><dd>{data.confirmed}</dd>
   <dt>Waiting</dt><dd>{data.waiting}</dd>
   <dt>With doctor</dt><dd>{data.inConsultation}</dd>
   <dt>Completed visits</dt><dd>{data.completed}</dd>
   <dt>Cancelled</dt><dd>{data.cancelled}</dd>
   <dt>No-shows</dt><dd>{data.noShow}</dd>
  </dl>}
 </section>;
}
