"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Channel="foundation"|"center";
type ScheduleTab="WEEKLY"|"CALENDAR"|"SLOTS"|"LEAVE"|"HOLIDAY"|"RULES";
type Row={associationRef:string;doctorRef:string;centerRef:string;doctorName:string;
 centerName:string;specialties:string[];status:string;version:number};
type Place={centerRef:string;centerName:string;stateRef:string;stateName:string;
 districtRef:string;districtName:string;blockRef:string|null;blockName:string|null};
type Metrics={totalAppointments:string;workingSessionsToday:string;
 doctorsOnActiveLeave:string};
type Window={weekday:number;startLocal:string;endLocal:string};
type BulkCopyTarget={associationRef:string;centerName:string;doctorRef:string;
 centerRef:string;timeZone:string;version:number;eligible:boolean;reason:string;
 sourceRef:string;sourceVersion:number};
type BulkCopyOutcome={associationRef:string;centerName:string;
 status:"SAVED"|"REJECTED"|"UNCERTAIN";detail:string};
type Except={exceptionRef:string;kind:string;state:string;startAt:string;
 endAt:string;reason:string;version:number};
type Detail={associationRef:string;doctorRef:string;centerRef:string;
 doctorName:string;centerName:string;timeZone:string;
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
/** Strictly interpret H07 datetime-local in the actual center's IANA zone,
 * not in the Foundation reviewer's device zone. Reject missing and ambiguous
 * DST hours rather than moving a doctor leave interval silently. */
function centerTime(v:string,zone:string){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v))
  throw Object.assign(new Error("Choose a valid date and time for this center."),{status:400});
 const nominal=Date.parse(v+":00Z");
 if(!Number.isFinite(nominal))
  throw Object.assign(new Error("Choose a valid date and time for this center."),{status:400});
 let formatter:Intl.DateTimeFormat;
 try{formatter=new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 });}catch{throw Object.assign(new Error("This healthcare center has an unsupported time zone."),{status:400});}
 const local=(millis:number)=>{
  const p=Object.fromEntries(formatter.formatToParts(new Date(millis))
   .map(t=>[t.type,t.value]));
  return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute;
 };
 const offsets=new Set<number>();
 for(const sample of [-129600000,-86400000,-43200000,0,43200000,86400000,129600000]){
  const moment=nominal+sample;
  const civil=local(moment);
  offsets.add(Date.parse(civil+":00Z")-moment);
 }
 const matches=[...offsets].map(offset=>nominal-offset)
  .filter(ms=>Number.isFinite(ms)&&local(ms)===v);
 if(matches.length!==1)
  throw Object.assign(new Error("That center-local time is missing or ambiguous due to a daylight-saving change. Choose another time."),{status:400});
 return new Date(matches[0]).toISOString();
}
function currentCenterDay(zone:string):string{
 const fields=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return fields.year+"-"+fields.month+"-"+fields.day;
}
export function DoctorScheduleWorkspace({channel,centerRef,canManage=true}:{
 channel:Channel;centerRef?:string;canManage?:boolean
}){
 const base=pathFor(channel,centerRef);
 const [roster,setRoster]=useState<Row[]>([]);
 const [placeChoices,setPlaceChoices]=useState<Place[]>([]);
 const [placesComplete,setPlacesComplete]=useState(true);
 const [stateRef,setStateRef]=useState("");
 const [districtRef,setDistrictRef]=useState("");
 const [blockRef,setBlockRef]=useState("");
 const [chosenCenter,setChosenCenter]=useState("");
 const [metrics,setMetrics]=useState<Metrics|null>(null);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [tab,setTab]=useState<ScheduleTab>("WEEKLY");
 const [loading,setLoading]=useState(true),[working,setWorking]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false),[search,setSearch]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [windows,setWindows]=useState<Window[]>([]);
 const [slot,setSlot]=useState(""),[from,setFrom]=useState(""),[until,setUntil]=useState("");
 const [kind,setKind]=useState<"LEAVE"|"BLOCK"|"HOLIDAY">("LEAVE");
 const [blockFrom,setBlockFrom]=useState(""),[blockUntil,setBlockUntil]=useState("");
 const [reason,setReason]=useState("");
 const [copyTarget,setCopyTarget]=useState("");
 const [copyReview,setCopyReview]=useState<Row|null>(null);
 const [bulkRefs,setBulkRefs]=useState<string[]>([]);
 const [bulkPreview,setBulkPreview]=useState<BulkCopyTarget[]>([]);
 const [bulkAcknowledged,setBulkAcknowledged]=useState(false);
 const [bulkOutcomes,setBulkOutcomes]=useState<BulkCopyOutcome[]>([]);
 const bulkKeys=useRef<Record<string,string>>({});
 const weekKey=useRef(""),exceptionKey=useRef(""),seq=useRef(0);
 const cancelKeys=useRef<Record<string,string>>({});
 const loadRoster=useCallback(async()=>{
  const n=++seq.current;
  try{
   const params=new URLSearchParams();
   if(channel==="foundation"){
    if(stateRef)params.set("stateRef",stateRef);
    if(districtRef)params.set("districtRef",districtRef);
    if(blockRef)params.set("blockRef",blockRef);
    if(chosenCenter)params.set("centerRef",chosenCenter);
    if(appliedSearch)params.set("search",appliedSearch);
   }
   const url=base+(params.size?"?"+params.toString():"");
   const response=await api<{doctors:Row[];metrics:Metrics;
    geographyComplete?:boolean;centerChoices?:Place[]}>(url);
   if(n!==seq.current)return;
   setRoster(response.doctors);setMetrics(response.metrics??null);
   setPlaceChoices(response.centerChoices??[]);
   setPlacesComplete(response.geographyComplete!==false);
   setLoading(false);setError("");setUncertain(false);
  }catch(e){if(n===seq.current){
   setMetrics(null);setLoading(false);setError(e instanceof Error?e.message:
    "The approved doctor list is currently unavailable.");
  }}
 },[base,channel,stateRef,districtRef,blockRef,chosenCenter,appliedSearch]);
 useEffect(()=>{
  setSelected(null);setTab("WEEKLY");setRoster([]);setMetrics(null);setWindows([]);
  setCopyTarget("");
  setCopyReview(null);setBulkRefs([]);setBulkPreview([]);
  setBulkAcknowledged(false);setBulkOutcomes([]);bulkKeys.current={};
  weekKey.current="";
  exceptionKey.current="";setLoading(true);
  void loadRoster();return()=>{seq.current++;};
 },[loadRoster]);
 const select=useCallback(async(ref:string)=>{
  const n=++seq.current;setError("");setNotice("");
  try{
   const detail=await api<Detail>(base+"/"+encodeURIComponent(ref));
   if(n!==seq.current)return;
   setSelected(detail);setTab("WEEKLY");setWindows(detail.windows);
   setSlot(detail.slotMinutes>0?String(detail.slotMinutes):"");
   setCopyTarget("");setCopyReview(null);setBulkRefs([]);setBulkPreview([]);
   setBulkAcknowledged(false);setBulkOutcomes([]);bulkKeys.current={};
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
  setWindows(old=>[...old,{weekday:day,startLocal:"",endLocal:""}]);
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
 function reviewCopy(){
  if(channel!=="foundation"||!canManage||!selected||working||uncertain||
   selected.version<1||selected.windows.length===0)return;
  const target=roster.find(r=>r.associationRef===copyTarget&&
   r.associationRef!==selected.associationRef&&r.doctorRef===selected.doctorRef);
  if(!target){setError("Choose another approved center for this same doctor.");return;}
  setError("");setCopyReview(target);
 }
 async function prepareCopy(){
  if(!copyReview||!selected||channel!=="foundation"||!canManage||
   working||uncertain||copyReview.doctorRef!==selected.doctorRef)return;
  const source=selected,sourceWindows=source.windows.map(w=>({...w}));
  const targetRef=copyReview.associationRef;
  const n=++seq.current;setWorking(true);setError("");setNotice("");
  try{
   const destination=await api<Detail>(base+"/"+encodeURIComponent(targetRef));
   if(n!==seq.current)return;
   if(destination.doctorRef!==source.doctorRef||
      destination.associationRef===source.associationRef||
      destination.centerRef===source.centerRef)
    throw Error("The selected doctor-center association is no longer eligible.");
   if(destination.timeZone!==source.timeZone)
    throw Error("Centers have different time zones. Configure the target schedule directly to avoid shifting consultation times.");
   setSelected(destination);setTab("WEEKLY");setWindows(sourceWindows);
   setSlot(String(source.slotMinutes));
   const today=currentCenterDay(source.timeZone);
   if(source.effectiveUntil&&source.effectiveUntil<=today)
    throw Object.assign(new Error(
     "The original doctor schedule has ended. Update the source schedule before copying it."),
     {status:409});
   setFrom(source.effectiveFrom&&source.effectiveFrom>=today?
    source.effectiveFrom:today);
   setUntil(source.effectiveUntil??"");
   weekKey.current="";setCopyReview(null);setCopyTarget("");
   setNotice("The original working hours are copied into an UNSAVED draft for "+
    destination.centerName+". Review center-specific hours and doctor overlap, "+
    "adjust sessions if needed, then choose Save verified working hours. "+
    "Other centers and old confirmed bookings have not changed.");
  }catch(e){
   if(n===seq.current)setError(e instanceof Error?e.message:
    "The destination's currently verified schedule could not be checked.");
  }finally{if(n===seq.current)setWorking(false);}
 }
 function toggleBulk(ref:string,checked:boolean){
  setBulkPreview([]);setBulkAcknowledged(false);setBulkOutcomes([]);
  bulkKeys.current={};
  setBulkRefs(old=>checked?[...old.filter(x=>x!==ref),ref].slice(0,8):
   old.filter(x=>x!==ref));
 }
 async function previewBulk(){
  if(channel!=="foundation"||!canManage||!selected||
    selected.version<1||!selected.windows.length||!bulkRefs.length||
    working||uncertain)return;
  const n=++seq.current,source=selected;
  setWorking(true);setError("");setNotice("");
  setBulkPreview([]);setBulkOutcomes([]);setBulkAcknowledged(false);
  bulkKeys.current={};
  const results:BulkCopyTarget[]=[];
  try{
   for(const ref of bulkRefs.slice(0,8)){
    const row=roster.find(x=>x.associationRef===ref);
    if(!row||row.doctorRef!==source.doctorRef||
     ref===source.associationRef||row.centerRef===source.centerRef)continue;
    try{
     const dest=await api<Detail>(base+"/"+encodeURIComponent(ref));
     if(n!==seq.current)return;
     const eligible=dest.doctorRef===source.doctorRef&&
      dest.associationRef!==source.associationRef&&
      dest.centerRef!==source.centerRef&&dest.timeZone===source.timeZone;
     results.push({associationRef:ref,centerName:dest.centerName,
      doctorRef:dest.doctorRef,centerRef:dest.centerRef,timeZone:dest.timeZone,
      version:dest.version,eligible,
      reason:eligible?"Source identity and timezone match. Final operating hours, global doctor overlap and revisions are checked only by target Save.":
       "Different doctor, same original center or incompatible time zone.",
      sourceRef:source.associationRef,sourceVersion:source.version});
    }catch(e){
     results.push({associationRef:ref,centerName:row.centerName,
      doctorRef:row.doctorRef,centerRef:row.centerRef,timeZone:"",
      version:-1,eligible:false,
      reason:e instanceof Error?e.message:"Current target eligibility is unavailable.",
      sourceRef:source.associationRef,sourceVersion:source.version});
    }
   }
   if(n!==seq.current)return;
   setBulkPreview(results);
   if(!results.some(x=>x.eligible))
    setError("No matching target can be prepared. Review the current doctor and center source.");
  }finally{if(n===seq.current)setWorking(false);}
 }
 async function applyBulk(){
  if(channel!=="foundation"||!canManage||!selected||working||uncertain||
    !bulkAcknowledged||bulkOutcomes.length||
    !bulkPreview.some(x=>x.eligible)||
    bulkPreview.some(x=>x.sourceRef!==selected.associationRef||
     x.sourceVersion!==selected.version))return;
  const source=selected;
  const eligible=bulkPreview.filter(x=>x.eligible).slice(0,8);
  const outcomes:BulkCopyOutcome[]=[];
  setWorking(true);setError("");setNotice("");
  try{
   const today=currentCenterDay(source.timeZone);
   const effectiveFrom=source.effectiveFrom&&source.effectiveFrom>=today?
    source.effectiveFrom:today;
   if(source.effectiveUntil&&source.effectiveUntil<=effectiveFrom){
    setError("The original source schedule has ended. Update and save the original doctor schedule before copying it to other centers.");
    return;
   }
   const effectiveUntil=source.effectiveUntil??null;
   // Every target is read again, then guarded by its own original PUT/CAS.
   // This is an explicit sequence of independent saves, not one transaction.
   for(const target of eligible){
    const requestKey=bulkKeys.current[target.associationRef]??
     crypto.randomUUID();
    bulkKeys.current[target.associationRef]=requestKey;
    try{
     const dest=await api<Detail>(base+"/"+encodeURIComponent(target.associationRef));
     if(dest.associationRef!==target.associationRef||
      dest.doctorRef!==source.doctorRef||
      dest.centerRef===source.centerRef||
      dest.timeZone!==source.timeZone||dest.version!==target.version)
      throw Object.assign(new Error(
       "Doctor, center, timezone or target revision changed. Review again."),{status:409});
     const saved=await api<{message:string}>(
      base+"/"+encodeURIComponent(dest.associationRef),"PUT",{
       requestKey,expectedVersion:dest.version,slotMinutes:source.slotMinutes,
       consultationMode:"IN_PERSON",effectiveFrom,effectiveUntil,
       windows:source.windows.map(w=>({...w}))
      });
     delete bulkKeys.current[target.associationRef];
     outcomes.push({associationRef:target.associationRef,
      centerName:target.centerName,status:"SAVED",
      detail:saved.message??"The original target Save confirmed this center."});
    }catch(e){
     const status=e&&typeof e==="object"&&"status" in e?e.status:null;
     const isRejected=typeof status==="number"&&status>=400&&status<500;
     outcomes.push({associationRef:target.associationRef,
      centerName:target.centerName,status:isRejected?"REJECTED":"UNCERTAIN",
      detail:e instanceof Error?e.message:"The target result is uncertain."});
     if(!isRejected){
      setUncertain(true);
      setError("The last center result may have been saved. Stop and verify each original target before retrying.");
      break;
     }
     delete bulkKeys.current[target.associationRef];
    }
    setBulkOutcomes([...outcomes]);
   }
   setBulkOutcomes([...outcomes]);
   if(outcomes.every(x=>x.status==="SAVED"))
    setNotice("Each selected target was independently saved with the original source validation. Check center schedules before booking.");
   else if(!outcomes.some(x=>x.status==="UNCERTAIN"))
    setNotice("Some centers were rejected without being changed. Review the individual results below.");
  }catch(e){
   setUncertain(true);
   setError(e instanceof Error?e.message:
    "Bulk copy stopped; confirm original schedules before any retry.");
  }finally{setWorking(false);}
 }
 async function saveWeek(){
  if(!selected||!canManage||working||uncertain||windows.length===0||
   windows.some(w=>!w.startLocal||!w.endLocal)||!from||!slot)return;
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
     kind,startAt:centerTime(blockFrom,selected.timeZone),
     endAt:centerTime(blockUntil,selected.timeZone),reason
    });
   exceptionKey.current="";await refresh();
   setReason("");setBlockFrom("");setBlockUntil("");setNotice(r.message);
  }catch(e){
   setError(e instanceof Error?e.message:"The exception could not be confirmed.");
   if(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500))setUncertain(true);
  }finally{setWorking(false);}
 }
 async function cancel(e:Except){
  if(!selected||busyOrUncertain()||!canManage||
    e.kind==="LEAVE"||e.state!=="ACTIVE")return;
  if(!cancelKeys.current[e.exceptionRef])
    cancelKeys.current[e.exceptionRef]=crypto.randomUUID();
  setWorking(true);setError("");setNotice("");
  try{
   const r=await api<{message:string}>(base+"/"+
    encodeURIComponent(selected.associationRef)+"/exceptions/"+
    encodeURIComponent(e.exceptionRef)+"/cancel","POST",{
     requestKey:cancelKeys.current[e.exceptionRef],expectedVersion:e.version
    });
   delete cancelKeys.current[e.exceptionRef];await refresh();setNotice(r.message);
  }catch(err){
   setError(err instanceof Error?err.message:"The blocked time could not be cancelled.");
   if(!(err&&typeof err==="object"&&"status" in err&&
    typeof err.status==="number"&&err.status<500))setUncertain(true);
  }finally{setWorking(false);}
 }
 function busyOrUncertain(){return working||uncertain;}
 const summary=[
  {label:"Doctors in current list",value:String(new Set(roster.map(x=>x.doctorRef)).size)},
  {label:"Active schedules in list",value:String(roster.filter(x=>x.status==="ACTIVE").length)},
  {label:"Today's working sessions",value:metrics?.workingSessionsToday??"Loading…"},
  {label:"Total consultation bookings",value:metrics?.totalAppointments??"Loading…"},
  {label:"Centers in current list",value:String(new Set(roster.map(x=>x.centerRef)).size)},
  {label:"Doctors on active leave",value:metrics?.doctorsOnActiveLeave??"Loading…"}
 ];
 const matchingPlaces=placeChoices.filter(p=>
  (!stateRef||p.stateRef===stateRef)&&
  (!districtRef||p.districtRef===districtRef)&&
  (!blockRef||p.blockRef===blockRef));
 const stateOptions=Array.from(new Map(placeChoices.map(p=>[
  p.stateRef,{ref:p.stateRef,name:p.stateName}
 ])).values());
 const districtOptions=Array.from(new Map(placeChoices.filter(p=>
  !stateRef||p.stateRef===stateRef).map(p=>[
   p.districtRef,{ref:p.districtRef,name:p.districtName}
 ])).values());
 const blockOptions=Array.from(new Map(placeChoices.filter(p=>
  (!stateRef||p.stateRef===stateRef)&&
  (!districtRef||p.districtRef===districtRef)&&p.blockRef).map(p=>[
   p.blockRef!,{ref:p.blockRef!,name:p.blockName??"Unnamed block"}
 ])).values());
 // The API searches all real approved associations BEFORE applying its
 // bounded 100-row limit. Never silently search only the first Web page.
 const result=roster;
 const tabs:ReadonlyArray<{id:ScheduleTab;label:string}>=[
  {id:"WEEKLY",label:"Weekly Schedule"},
  {id:"CALENDAR",label:"Availability Calendar"},
  {id:"SLOTS",label:"Time Slot Settings"},
  {id:"LEAVE",label:"Leave or Block Time"},
  {id:"HOLIDAY",label:"Holiday"},
  {id:"RULES",label:"Appointment Rule"}
 ];
 function changeTab(next:ScheduleTab){
  setTab(next);setError("");setNotice("");
  if(next==="HOLIDAY"){setKind("HOLIDAY");exceptionKey.current="";}
  else if(next==="LEAVE"&&kind==="HOLIDAY"){
   setKind("LEAVE");exceptionKey.current="";
  }
 }
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
   <h2>Schedule overview</h2>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
    {summary.map(item=><div className="form-section" key={item.label}>
     <p style={{fontSize:13,marginBottom:4}}>{item.label}</p>
     <strong style={{fontSize:22}}>{item.value}</strong>
    </div>)}
   </div>
   <p>The doctor-center list is limited to 100 current associations. Appointment,
    working-session and approved-leave totals are calculated separately from
    the live source, not from this limited list. Use location filters to narrow
    a large list.</p>
   <h2>Doctor and center</h2>
   {channel==="foundation"&&<div className="form-grid"
    aria-label="Filter approved schedules by current healthcare location">
    <label>State
     <select value={stateRef} onChange={e=>{setStateRef(e.target.value);
      setDistrictRef("");setBlockRef("");setChosenCenter("");}}
      disabled={working}>
      <option value="">All states</option>
      {stateOptions.map(p=><option key={p.ref} value={p.ref}>{p.name}</option>)}
     </select>
    </label>
    <label>District
     <select value={districtRef} onChange={e=>{
      setDistrictRef(e.target.value);setBlockRef("");setChosenCenter("");
     }} disabled={working||!stateRef}>
      <option value="">All districts</option>
      {districtOptions.map(p=><option key={p.ref} value={p.ref}>{p.name}</option>)}
     </select>
    </label>
    <label>Block
     <select value={blockRef} onChange={e=>{
      setBlockRef(e.target.value);setChosenCenter("");
     }} disabled={working||!districtRef}>
      <option value="">All blocks</option>
      {blockOptions.map(p=><option key={p.ref} value={p.ref}>{p.name}</option>)}
     </select>
    </label>
    <label>Healthcare center
     <select value={chosenCenter} onChange={e=>setChosenCenter(e.target.value)}
      disabled={working||!stateRef}>
      <option value="">All eligible centers</option>
      {matchingPlaces.map(p=><option key={p.centerRef} value={p.centerRef}>
       {p.centerName}</option>)}
     </select>
    </label>
    {!placesComplete&&<p role="status">More verified centers exist than can
     be shown in this filter. Narrow your location to choose a center.</p>}
   </div>}
   <form onSubmit={e=>{e.preventDefault();setAppliedSearch(search.trim());}}
    aria-label="Search all approved doctors">
    <label>Search approved doctors, clinics or specialties
     <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
      maxLength={80} placeholder="Doctor or healthcare center"/>
    </label>
    <div className="toolbar">
     <button type="submit" disabled={working||loading}>Search verified doctors</button>
     <button type="button" disabled={working||loading||
      (!search&&!appliedSearch)}
      onClick={()=>{setSearch("");setAppliedSearch("");}}>Clear search</button>
    </div>
   </form>
   {appliedSearch&&<p role="status">Showing current server results for
    “{appliedSearch}”. Searches use the original verified doctor and center records.</p>}
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
    Staff edits do not reserve an appointment. Public slot availability is
    calculated separately from the current verified doctor/center, accepted
    fees, approved leave and existing confirmed reservations.</p>
   <h3>Weekly working hours</h3>
   <p>Add morning and afternoon sessions separately, as on the original
    CareGanga Doctor Schedule screen. Each session must fit inside verified
    center consultation hours and be divisible by the slot duration.</p>
   <div className="form-grid">
    <label>Consultation slot duration
     <select value={slot} disabled={!canManage||working||uncertain}
      onChange={e=>{setSlot(e.target.value);weekKey.current="";}}>
      <option value="">Choose verified slot duration</option>
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
   {canManage&&channel==="foundation"&&selected.version>0&&
    selected.windows.length>0&&<div className="form-section"
     aria-label="Copy current doctor schedule to another center">
     <h3>Copy this doctor's working hours to another verified center</h3>
     <p>The copy is only a draft. Each target must be reviewed and saved separately.
      The server rejects overlapping in-person doctor times, incompatible
      center hours or changed revision. Existing appointments stay untouched.</p>
     <label>Another approved center for {selected.doctorName}
      <select value={copyTarget} disabled={working||uncertain}
       onChange={e=>{setCopyTarget(e.target.value);setCopyReview(null);}}>
       <option value="">Choose target center</option>
       {roster.filter(r=>r.doctorRef===selected.doctorRef&&
        r.associationRef!==selected.associationRef).map(row=>
        <option key={row.associationRef} value={row.associationRef}>
         {row.centerName}</option>)}
      </select>
     </label>
     <button type="button" disabled={!copyTarget||working||uncertain}
      onClick={reviewCopy}>Review target center</button>
     {copyReview&&<div className="notice">
      <p>Copy {selected.windows.length} saved weekly session(s) from
       <strong> {selected.centerName}</strong> to
       <strong> {copyReview.centerName}</strong> as an editable draft?</p>
      <button type="button" disabled={working||uncertain}
       onClick={()=>void prepareCopy()}>Prepare copy at selected center</button>
      <button type="button" disabled={working}
       onClick={()=>setCopyReview(null)}>Keep original schedule</button>
     </div>}
    </div>}
   {canManage&&channel==="foundation"&&selected.version>0&&
    selected.windows.length>0&&<section className="form-section"
     aria-label="Bulk apply doctor working hours to verified centers">
     <h3>Apply this doctor's saved schedule to other centers</h3>
     <p>Choose up to 8 verified centers from the current filtered doctor list.
      This is a series of <strong>independent</strong> center saves—not a
      single transaction. Every target is rechecked for the same doctor,
      current center approval, timezone, operating hours, other bookings,
      doctor-global overlap and expected version. A rejected center is not changed.</p>
     <div role="group" aria-label="Select same-doctor target centers">
      {roster.filter(row=>row.doctorRef===selected.doctorRef&&
       row.associationRef!==selected.associationRef&&
       row.centerRef!==selected.centerRef).map(row=>
       <label key={row.associationRef} style={{display:"block",padding:"5px 0"}}>
        <input type="checkbox" checked={bulkRefs.includes(row.associationRef)}
         disabled={working||uncertain||
          (bulkRefs.length>=8&&!bulkRefs.includes(row.associationRef))}
         onChange={e=>toggleBulk(row.associationRef,e.target.checked)}/>
        {" "}{row.centerName}
       </label>)}
     </div>
     {roster.filter(row=>row.doctorRef===selected.doctorRef&&
      row.associationRef!==selected.associationRef&&
      row.centerRef!==selected.centerRef).length===0&&
      <p>No other eligible association is in this filtered list.
       Adjust the location/search filters to find that doctor's other centers.</p>}
     <button type="button" disabled={!bulkRefs.length||working||uncertain}
      onClick={()=>void previewBulk()}>Review selected centers</button>
     {!!bulkPreview.length&&<div className="notice">
      <h4>Current target review</h4>
      <ul>{bulkPreview.map(item=><li key={item.associationRef}>
       <strong>{item.centerName}:</strong> {item.eligible?
        "Eligible for independent target Save; final conflicts are checked again.":
        item.reason}
      </li>)}</ul>
      <label><input type="checkbox" checked={bulkAcknowledged}
       disabled={working||uncertain||!bulkPreview.some(item=>item.eligible)||
        !!bulkOutcomes.length}
       onChange={e=>setBulkAcknowledged(e.target.checked)}/>
       I understand each center may save or be rejected separately.
       I will verify each saved result and any uncertain response.
      </label>
      <button type="button" disabled={working||uncertain||
       !bulkAcknowledged||!bulkPreview.some(item=>item.eligible)||
       !!bulkOutcomes.length}
       onClick={()=>void applyBulk()}>
       Apply to {bulkPreview.filter(item=>item.eligible).length} reviewed center(s)
      </button>
     </div>}
     {!!bulkOutcomes.length&&<div className="notice" role="status">
      <h4>Individual center results</h4>
      <ul>{bulkOutcomes.map(item=><li key={item.associationRef}>
       <strong>{item.centerName}:</strong> {item.status==="SAVED"?
        "Saved":"Not confirmed"} — {item.detail}
      </li>)}</ul>
      <p>Any unlisted target was not attempted. Refresh and inspect each
       target's current schedule before another change.</p>
     </div>}
    </section>}
   {canManage&&<div className="toolbar">
    <button type="button" className="primary" onClick={()=>void saveWeek()}
     disabled={working||uncertain||!from||!slot||windows.length===0||
      windows.some(w=>!w.startLocal||!w.endLocal)}>
     {working?"Saving…":"Save verified working hours"}</button>
    <button type="button" disabled={working}
     onClick={()=>void select(selected.associationRef)}>Discard unsaved changes</button>
   </div>}
   <h3>Leave, holidays and blocked time</h3>
   <p>Leave is an independent approval request, not an automatic booking
    cancellation. A center-specific block never modifies another center's
    confirmed patient record.</p>
   <div className="role-table-wrap"><table className="role-table">
    <thead><tr><th>Type</th><th>Starts</th><th>Ends</th><th>State</th>
     <th>Action</th></tr></thead>
    <tbody>{selected.exceptions.map(e=><tr key={e.exceptionRef}>
     <td>{clean(e.kind)}</td>
     <td>{new Date(e.startAt).toLocaleString("en-IN")}</td>
     <td>{new Date(e.endAt).toLocaleString("en-IN")}</td>
     <td>{clean(e.state)}</td>
     <td>{canManage&&e.kind!=="LEAVE"&&e.state==="ACTIVE"&&
      <button type="button" disabled={working||uncertain}
       onClick={()=>void cancel(e)}>Cancel block</button>}</td>
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
     <label>Starts at ({selected.timeZone} center time)
      <input type="datetime-local" value={blockFrom} disabled={working||uncertain}
       onChange={e=>{setBlockFrom(e.target.value);exceptionKey.current="";}}/>
     </label>
     <label>Ends at ({selected.timeZone} center time)
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
