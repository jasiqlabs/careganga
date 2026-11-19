"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Channel="foundation"|"center";
type Row={associationRef:string;doctorRef:string;centerRef:string;doctorName:string;
 centerName:string;specialties:string[];status:string;version:number};
type Window={weekday:number;startLocal:string;endLocal:string};
type Except={exceptionRef:string;kind:string;state:string;startAt:string;
 endAt:string;reason:string;version:number};
type Detail={associationRef:string;doctorName:string;centerName:string;timeZone:string;
 status:string;version:number;slotMinutes:number;effectiveFrom:string|null;
 effectiveUntil:string|null;windows:Window[];exceptions:Except[]};
const weekdays=[{day:1,label:"Monday"},{day:2,label:"Tuesday"},
 {day:3,label:"Wednesday"},{day:4,label:"Thursday"},
 {day:5,label:"Friday"},{day:6,label:"Saturday"},
 {day:0,label:"Sunday"}];
const clean=(s:string)=>s.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,x=>x.toUpperCase());
function parseError(data:unknown,fallback:string){
 return data&&typeof data==="object"&&"message" in data&&
 typeof data.message==="string"?data.message:fallback;
}
async function api<T>(path:string,method:"GET"|"PUT"|"POST"="GET",body?:unknown){
 let response:Response;
 try{
  response=await fetch("/api/appointments/schedules/"+path,{
   method,cache:"no-store",credentials:"same-origin",
   ...(body?{headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)}:{})
  });
 }catch{
  throw Object.assign(new Error("The result is uncertain. Refresh the original schedule."),
   {status:503});
 }
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error(parseError(data,
  "This doctor schedule could not be confirmed.")),{status:response.status});
 return data as T;
}
function pathFor(channel:Channel,centerRef?:string){
 return channel==="foundation"?"admin":"my-centers/"+
  encodeURIComponent(centerRef??"");
}
const isoDate=(v:string)=>{
 const date=new Date(v);
 if(!Number.isFinite(date.getTime()))throw Error("Choose a valid exception date and time.");
 return date.toISOString();
};
export function DoctorScheduleWorkspace({channel,centerRef,canManage=true}:{
 channel:Channel;centerRef?:string;canManage?:boolean
}){
 const base=pathFor(channel,centerRef);
 const [roster,setRoster]=useState<Row[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [loading,setLoading]=useState(true),[working,setWorking]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false),[search,setSearch]=useState("");
 const [windows,setWindows]=useState<Window[]>([]);
 const [slot,setSlot]=useState("30"),[from,setFrom]=useState(""),[until,setUntil]=useState("");
 const [kind,setKind]=useState<"LEAVE"|"BLOCK"|"HOLIDAY">("LEAVE");
 const [blockFrom,setBlockFrom]=useState(""),[blockUntil,setBlockUntil]=useState("");
 const [reason,setReason]=useState("");
 const weekKey=useRef(""),exceptionKey=useRef(""),seq=useRef(0);
 const loadRoster=useCallback(async()=>{
  const n=++seq.current;
  try{
   const response=await api<{doctors:Row[]}>(base);
   if(n!==seq.current)return;
   setRoster(response.doctors);setLoading(false);setError("");setUncertain(false);
  }catch(e){if(n===seq.current){
   setLoading(false);setError(e instanceof Error?e.message:
    "The approved doctor list is currently unavailable.");
  }}
 },[base]);
 useEffect(()=>{
  setSelected(null);setRoster([]);setWindows([]);weekKey.current="";
  exceptionKey.current="";setLoading(true);
  void loadRoster();return()=>{seq.current++;};
 },[loadRoster]);
 const select=useCallback(async(ref:string)=>{
  const n=++seq.current;setError("");setNotice("");
  try{
   const detail=await api<Detail>(base+"/"+encodeURIComponent(ref));
   if(n!==seq.current)return;
   setSelected(detail);setWindows(detail.windows);setSlot(String(detail.slotMinutes));
   setFrom(detail.effectiveFrom??"");setUntil(detail.effectiveUntil??"");
   weekKey.current="";exceptionKey.current="";setUncertain(false);
  }catch(e){if(n===seq.current)setError(e instanceof Error?e.message:
   "This doctor's verified schedule is unavailable.");}
 },[base]);
 async function refresh(){
  setError("");await loadRoster();
  if(selected)await select(selected.associationRef);
 }
 function changeDay(day:number,field:"startLocal"|"endLocal",index:number,value:string){
  setWindows(old=>old.map((w,i)=>w.weekday===day&&
   old.filter(k=>k.weekday===day).indexOf(w)===index?{...w,[field]:value}:w));
  weekKey.current="";
 }
 function add(day:number){
  setWindows(old=>[...old,{weekday:day,startLocal:"09:00",endLocal:"10:00"}]);
  weekKey.current="";
 }
 function drop(day:number,index:number){
  let found=-1;
  setWindows(old=>old.filter(w=>{
   if(w.weekday!==day)return true;
   found++;
   return found!==index;
  }));
  weekKey.current="";
 }
 async function saveWeek(){
  if(!selected||!canManage||working||uncertain||windows.length===0||
   !from||!slot)return;
  if(!weekKey.current)weekKey.current=crypto.randomUUID();
  setWorking(true);setError("");setNotice("");
  try{
   const payload={requestKey:weekKey.current,expectedVersion:selected.version,
    slotMinutes:Number(slot),consultationMode:"IN_PERSON",
    effectiveFrom:from,effectiveUntil:until||null,windows};
   const r=await api<{message:string}>(base+"/"+
    encodeURIComponent(selected.associationRef),"PUT",payload);
   weekKey.current="";await refresh();setNotice(r.message);
  }catch(e){
   setError(e instanceof Error?e.message:"Saving result uncertain.");
   if(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500))setUncertain(true);
  }finally{setWorking(false);}
 }
 async function saveException(){
  if(!selected||selected.version<1||working||uncertain||!canManage||
   !blockFrom||!blockUntil||reason.trim().length<3)return;
  if(!exceptionKey.current)exceptionKey.current=crypto.randomUUID();
  setWorking(true);setError("");setNotice("");
  try{
   const r=await api<{message:string}>(base+"/"+
    encodeURIComponent(selected.associationRef)+"/exceptions","POST",{
     requestKey:exceptionKey.current,expectedVersion:selected.version,
     kind,startAt:isoDate(blockFrom),endAt:isoDate(blockUntil),reason
    });
   exceptionKey.current="";await refresh();
   setReason("");setBlockFrom("");setBlockUntil("");setNotice(r.message);
  }catch(e){
   setError(e instanceof Error?e.message:"The exception could not be confirmed.");
   if(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500))setUncertain(true);
  }finally{setWorking(false);}
 }
 const result=roster.filter(x=>
  (x.doctorName+" "+x.centerName+" "+x.specialties.join(" "))
   .toLowerCase().includes(search.trim().toLowerCase()));
 return <section className="role-workspace" aria-label="Doctor schedules and availability">
  <header className="topbar"><div>
   <h1>Doctor Schedule & Availability</h1>
   <p>Choose a currently verified doctor and center, then set real working hours.
    These are scheduling rules, not bookable slots or confirmed appointments.</p>
  </div></header>
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  {uncertain&&<p role="alert">The last change could already have been saved.
   Refresh the original schedule before submitting another change.</p>}
  <div className="toolbar">
   <button type="button" disabled={working} onClick={()=>void refresh()}>
    Refresh verified schedules</button>
  </div>
  <div className="form-section">
   <h2>Doctor and center</h2>
   <label>Search approved doctors, clinics or specialties
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
      maxLength={80} placeholder="Doctor or healthcare center"/>
   </label>
   {loading&&<p role="status">Checking current doctor associations…</p>}
   {!loading&&result.length===0&&
    <p role="status">No matching, currently approved doctor-center associations.</p>}
   <div className="toolbar" role="group" aria-label="Select doctor and healthcare center">
    {result.map(r=><button type="button" key={r.associationRef}
     disabled={working} aria-pressed={selected?.associationRef===r.associationRef}
     onClick={()=>void select(r.associationRef)}>
      {r.doctorName} — {r.centerName} · {clean(r.status)}
     </button>)}
   </div>
  </div>
  {selected&&<div className="form-section" key={selected.associationRef}>
   <h2>{selected.doctorName} — {selected.centerName}</h2>
   <p><strong>{clean(selected.status)}</strong>. Time zone: {selected.timeZone}.
    Schedule revision: {selected.version===0?"Not saved":selected.version}.
    Working hours are private until actual booking availability is implemented.</p>
   <h3>Weekly working hours</h3>
   <p>Add morning and afternoon sessions separately, as on the original
    CareGanga Doctor Schedule screen. Each session must fit inside verified
    center consultation hours and be divisible by the slot duration.</p>
   <div className="form-grid">
    <label>Consultation slot duration
     <select value={slot} disabled={!canManage||working||uncertain}
      onChange={e=>{setSlot(e.target.value);weekKey.current="";}}>
      {[5,10,15,20,30,40,45,60,90,120,180].map(v=>
       <option key={v} value={v}>{v} minutes</option>)}
     </select>
    </label>
    <label>Effective from
     <input type="date" value={from} disabled={!canManage||working||uncertain}
      onChange={e=>{setFrom(e.target.value);weekKey.current="";}}/>
    </label>
    <label>Effective until (optional)
     <input type="date" value={until} disabled={!canManage||working||uncertain}
      onChange={e=>{setUntil(e.target.value);weekKey.current="";}}/>
    </label>
   </div>
   <div className="role-table-wrap">
    <table className="role-table">
     <thead><tr><th>Day</th><th>Current working sessions</th>
      <th>Action</th></tr></thead>
     <tbody>{weekdays.map(day=><tr key={day.day}>
      <th scope="row">{day.label}</th>
      <td><div className="form-grid">{windows.filter(w=>w.weekday===day.day)
       .map((w,i)=><div className="toolbar" key={day.day+":"+i}>
        <label>Opens
         <input type="time" value={w.startLocal}
          disabled={!canManage||working||uncertain}
          onChange={e=>changeDay(day.day,"startLocal",i,e.target.value)}/>
        </label>
        <label>Closes
         <input type="time" value={w.endLocal}
          disabled={!canManage||working||uncertain}
          onChange={e=>changeDay(day.day,"endLocal",i,e.target.value)}/>
        </label>
        {canManage&&<button type="button" disabled={working||uncertain}
         onClick={()=>drop(day.day,i)}>Remove session</button>}
       </div>)}</div></td>
      <td>{canManage&&<button type="button"
        disabled={working||uncertain||windows.length>=42}
        onClick={()=>add(day.day)}>Add session</button>}</td>
     </tr>)}</tbody>
    </table>
   </div>
   {canManage&&<div className="toolbar">
    <button type="button" className="primary" onClick={()=>void saveWeek()}
     disabled={working||uncertain||!from||windows.length===0}>
     {working?"Saving…":"Save verified working hours"}</button>
    <button type="button" disabled={working}
     onClick={()=>void select(selected.associationRef)}>Discard unsaved changes</button>
   </div>}
   <h3>Leave, holidays and blocked time</h3>
   <p>Leave is an independent approval request, not an automatic booking
    cancellation. A center-specific block never modifies another center's
    confirmed patient record.</p>
   <div className="role-table-wrap"><table className="role-table">
    <thead><tr><th>Type</th><th>Starts</th><th>Ends</th><th>State</th></tr></thead>
    <tbody>{selected.exceptions.map(e=><tr key={e.exceptionRef}>
     <td>{clean(e.kind)}</td>
     <td>{new Date(e.startAt).toLocaleString("en-IN")}</td>
     <td>{new Date(e.endAt).toLocaleString("en-IN")}</td>
     <td>{clean(e.state)}</td>
    </tr>)}</tbody>
   </table></div>
   {selected.exceptions.length===0&&
    <p role="status">No current leave or blocked-time requests.</p>}
   {canManage&&selected.version>0&&<>
    <div className="form-grid">
     <label>Request type
      <select value={kind} disabled={working||uncertain}
       onChange={e=>{setKind(e.target.value as typeof kind);exceptionKey.current="";}}>
       <option value="LEAVE">Doctor leave — requires independent review</option>
       <option value="BLOCK">Center-specific blocked time</option>
       <option value="HOLIDAY">Center holiday</option>
      </select>
     </label>
     <label>Starts at
      <input type="datetime-local" value={blockFrom} disabled={working||uncertain}
       onChange={e=>{setBlockFrom(e.target.value);exceptionKey.current="";}}/>
     </label>
     <label>Ends at
      <input type="datetime-local" value={blockUntil} disabled={working||uncertain}
       onChange={e=>{setBlockUntil(e.target.value);exceptionKey.current="";}}/>
     </label>
     <label>Reason (private)
      <textarea rows={2} value={reason} maxLength={240}
       disabled={working||uncertain}
       onChange={e=>{setReason(e.target.value);exceptionKey.current="";}}/>
     </label>
    </div>
    <button type="button" disabled={working||uncertain||!blockFrom||
     !blockUntil||reason.trim().length<3}
     onClick={()=>void saveException()}>
     {working?"Saving…":"Record leave or blocked time"}</button>
   </>}
  </div>}
 </section>;
}
