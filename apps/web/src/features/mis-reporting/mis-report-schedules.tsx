"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {safeClientProblem} from "./mis-safe-error";
type Saved={ref:string;name:string;state:string;sourceKey?:string|null};
type Schedule={ref:string;state:string;cadence:string;savedReportName:string;
 timezone:string;localTime:string;nextDueAt:string;revision:number;canActivate:boolean};
type History={state:string;createdAt:string;deliveryState:string;dueAt:string;
 sourceAsOf:string|null;rowCount:number|null;format:string|null};
const call=async<T,>(path:string,body?:object):Promise<T>=>{
 const response=await fetch("/api/mis/reports/"+path,{
  method:body?"POST":"GET",cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new Error(await safeClientProblem(response,
  "The schedule outcome could not be confirmed. Refresh its current status."));
 return response.json() as Promise<T>;
};
const localDate=(when:string,zone:string)=>{
 try{
  const fmt=new Intl.DateTimeFormat("en-GB",{
   timeZone:zone,day:"2-digit",month:"2-digit",year:"numeric"});
  const parts=Object.fromEntries(fmt.formatToParts(new Date(when))
   .map(part=>[part.type,part.value]));
  return parts.year+"-"+parts.month+"-"+parts.day;
 }catch{return "";}
};
/** C49 actual private scheduled finance summary: original CG09 projection,
 * CG19 verified document and IN_APP notification. Other sources/channels
 * are intentionally not advertised as working.
 */
export function MisReportSchedules(){
 const [reports,setReports]=useState<Saved[]>([]);
 const [schedules,setSchedules]=useState<Schedule[]>([]);
 const [report,setReport]=useState("");
 const [cadence,setCadence]=useState("MONTHLY");
 const [timezone,setTimezone]=useState("Asia/Kolkata");
 const [localTime,setLocalTime]=useState("09:00");
 const [date,setDate]=useState("");
 const [editing,setEditing]=useState<Schedule|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [history,setHistory]=useState<History[]>([]);
 const pending=useRef<{payload:string;key:string}|null>(null);
 const rev=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++rev.current;setError("");
  try{
   const [saved,scheduled]=await Promise.all([
    call<{items:Saved[]}>("saved"),
    call<{schedules:Schedule[]}>("schedules")]);
   if(!Array.isArray(saved.items)||!Array.isArray(scheduled.schedules))
    throw Error("Current schedules could not be verified.");
   if(current===rev.current){
    setReports(saved.items.filter(x=>x.state==="ACTIVE"&&
     (x.sourceKey==="FINANCE_POSTED_SUMMARY"||x.sourceKey==="PROJECT_STATUS_REPORT")));
    setSchedules(scheduled.schedules);
   }
  }catch(e){if(current===rev.current){setReports([]);setSchedules([]);
   setError(e instanceof Error?e.message:"Unable to check schedules.");}}
 },[]);
 useEffect(()=>{void refresh();return()=>{rev.current++};},[refresh]);
 useEffect(()=>{
  const listener=()=>{
   rev.current++;setReports([]);setSchedules([]);setHistory([]);
   if(document.visibilityState==="visible"){
    pending.current=null;setEditing(null);void refresh();
   }
  };
  document.addEventListener("visibilitychange",listener);
  return()=>document.removeEventListener("visibilitychange",listener);
 },[refresh]);
 function reset(){
  setEditing(null);setDate("");pending.current=null;
 }
 async function save(){
  if(busy||!date||!editing&&!report)return;
  const fields={cadence,timezone,localTime,firstDate:date};
  const input={savedRef:report,...fields};
  const payload=JSON.stringify(input);
  if(!editing&&pending.current?.payload!==payload)
   pending.current={payload,key:crypto.randomUUID()};
  setBusy(true);setError("");setNotice("");
  try{
   const response=editing?
    await call<{message:string}>(
     "schedules/"+encodeURIComponent(editing.ref)+"/edit",{
      expectedRevision:editing.revision,...fields
     }):
    await call<{message:string}>("schedules",{
     ...input,requestKey:pending.current!.key
    });
   setNotice(response.message||
    "Your schedule is active for verified private in-app reports.");
   reset();await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "The schedule status is unconfirmed. Refresh before retrying.");}
  finally{setBusy(false);}
 }
 async function pause(item:Schedule){
  if(busy||item.state!=="ACTIVE")return;
  setBusy(true);setError("");setNotice("");
  try{
   await call("schedules/"+encodeURIComponent(item.ref)+"/pause",{
    expectedRevision:item.revision});
   setNotice("Schedule paused. No new report occurrence will be created.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "The pause outcome is unconfirmed. Refresh its status.");}
  finally{setBusy(false);}
 }
 async function resume(item:Schedule){
  if(busy||item.state!=="PAUSED")return;
  setBusy(true);setError("");setNotice("");
  try{
   const done=await call<{message:string}>(
    "schedules/"+encodeURIComponent(item.ref)+"/resume",{
     expectedRevision:item.revision
    });
   setNotice(done.message||"Schedule resumed with current permissions.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "The saved report may have changed. Review and edit this schedule.");}
  finally{setBusy(false);}
 }
 async function historyFor(item:Schedule){
  if(busy)return;
  setBusy(true);setError("");setHistory([]);
  try{
   const result=await call<{runs:History[]}>(
    "schedules/"+encodeURIComponent(item.ref)+"/history");
   setHistory(Array.isArray(result.runs)?result.runs:[]);
  }catch(e){setError(e instanceof Error?e.message:
   "Actual schedule history is unavailable.");}
  finally{setBusy(false);}
 }
 function edit(item:Schedule){
  setEditing(item);setCadence(item.cadence);setTimezone(item.timezone);
  setLocalTime(item.localTime.slice(0,5));
  setDate(localDate(item.nextDueAt,item.timezone));
  setHistory([]);setError("");setNotice("");pending.current=null;
 }
 const canEdit=editing!==null||reports.length>0;
 return <section aria-labelledby="mis-schedules" style={{
  marginTop:20,paddingTop:16,borderTop:"1px solid var(--cg-border)"}}>
  <h3 id="mis-schedules">My report delivery schedules</h3>
  <p role="status" style={{fontSize:".83rem"}}>
   Authorized posted-finance summaries and project status reports can run automatically at the chosen
   local date and time. A verified private PDF is stored by CareGanga and
   a neutral in-app notice is recorded only after confirmation. The recipient
   is your current account. Email, SMS and other sources are not enabled.
   Scheduled time does not guarantee a successful file or notification.</p>
  {!!error&&<p role="alert">{error}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   Refresh schedule status</button>
  {canEdit&&<div style={{display:"grid",gap:10,marginTop:12}}>
   {editing?<strong>Editing: {editing.savedReportName}</strong>:
    <label>My saved report <select value={report}
     onChange={e=>setReport(e.target.value)}>
     <option value="">Choose a private finance or project report</option>
     {reports.map(x=><option key={x.ref} value={x.ref}>{x.name}</option>)}
    </select></label>}
   <label>Recurrence <select value={cadence} onChange={e=>setCadence(e.target.value)}>
    {(["DAILY","WEEKLY","MONTHLY","YEARLY"] as const).map(x=>
     <option key={x} value={x}>{x[0]+x.slice(1).toLowerCase()}</option>)}
   </select></label>
   <label>Timezone <input value={timezone} maxLength={64}
    onChange={e=>setTimezone(e.target.value)} placeholder="Asia/Kolkata"/></label>
   <label>First local date <input type="date" value={date}
    onChange={e=>setDate(e.target.value)}/></label>
   <label>Local time <input type="time" value={localTime}
    onChange={e=>setLocalTime(e.target.value)}/></label>
   <button type="button" disabled={busy||!date||!editing&&!report}
    onClick={()=>void save()}>
    {editing?"Save schedule changes and activate":"Create active in-app schedule"}</button>
   {!!editing&&<button type="button" disabled={busy} onClick={reset}>
    Cancel schedule edit</button>}
  </div>}
  {!canEdit&&<p>No eligible saved report is available for new schedules.</p>}
  <div style={{display:"grid",gap:8,marginTop:12}}>
   {schedules.map(item=><div key={item.ref} style={{
    border:"1px solid var(--cg-border)",borderRadius:10,padding:12}}>
    <strong>{item.savedReportName} · {item.cadence.charAt(0)+
     item.cadence.slice(1).toLowerCase()}</strong>
    <p style={{fontSize:".82rem",margin:"4px 0"}}>
     {item.state==="PAUSED"?"Paused · not sending":
      item.state==="ACTIVE"?"Active · in-app only":
      item.state==="DISABLED"?"Disabled":"Status unavailable"}
     {" · "}{item.timezone}
     {" · "}Next planned: {new Date(item.nextDueAt).toLocaleString("en-IN",{
      timeZone:item.timezone})}</p>
    {item.state==="ACTIVE"&&<button type="button" disabled={busy}
     onClick={()=>void pause(item)}>Pause</button>}
    {item.state==="PAUSED"&&<button type="button" disabled={busy}
     onClick={()=>void resume(item)}>Resume with current permissions</button>}
    {item.state!=="DISABLED"&&<button type="button" disabled={busy}
     onClick={()=>edit(item)}>Edit</button>}
    <button type="button" disabled={busy}
     onClick={()=>void historyFor(item)}>View actual run and delivery history</button>
   </div>)}
  </div>
  {history.length===0?<p style={{fontSize:".82rem"}}>
   No selected schedule runs to display.</p>:
   <ul>{history.map((item,i)=><li key={i}>
    {item.state.replaceAll("_"," ")} · In-app notice: {item.deliveryState.replaceAll("_"," ")}
    {" · "}{new Date(item.createdAt).toLocaleString("en-IN")}
    {item.sourceAsOf&&<> · Source snapshot: {new Date(item.sourceAsOf).toLocaleString("en-IN")}</>}
    {item.rowCount!==null&&item.rowCount!==undefined&&<> · Verified rows: {item.rowCount}</>}
    {item.format&&<> · {item.format}</>}</li>)}</ul>}
 </section>;
}
