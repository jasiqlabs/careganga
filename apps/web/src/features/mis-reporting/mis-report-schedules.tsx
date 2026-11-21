"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {safeClientProblem} from "./mis-safe-error";
type Saved={ref:string;name:string;state:string};
type Schedule={ref:string;state:string;cadence:string;savedReportName:string;timezone:string;localTime:string;
 nextDueAt:string;revision:number;canActivate:boolean};
const get=async<T,>(path:string,body?:object)=>{
 const response=await fetch("/api/mis/reports/"+path,{
  method:body?"POST":"GET",cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new Error(await safeClientProblem(response,"This schedule change could not be confirmed. Refresh its status first."));
 return response.json() as Promise<T>;
};
/** C49 schedule management: source-safe metadata only. The backend refuses
 * ACTIVE until true delegated background auth and CG19 delivery are verified.
 */
export function MisReportSchedules(){
 const [reports,setReports]=useState<Saved[]>([]);
 const [schedules,setSchedules]=useState<Schedule[]>([]);
 const [report,setReport]=useState("");
 const [cadence,setCadence]=useState("MONTHLY");
 const [timezone,setTimezone]=useState("Asia/Kolkata");
 const [localTime,setLocalTime]=useState("09:00");
 const [date,setDate]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [history,setHistory]=useState<{state:string;createdAt:string}[]>([]);
 const pending=useRef<{payload:string;key:string}|null>(null);
 const rev=useRef(0);
 const refresh=useCallback(async()=>{
  const i=++rev.current;setError("");
  try{
   const [saved,scheduled]=await Promise.all([
    get<{items:Saved[]}>("saved"),get<{schedules:Schedule[]}>("schedules")]);
   if(!Array.isArray(saved.items)||!Array.isArray(scheduled.schedules))
    throw Error("Current report schedules could not be verified.");
   if(i===rev.current){setReports(saved.items.filter(x=>x.state==="ACTIVE"));
    setSchedules(scheduled.schedules);}
  }catch(e){if(i===rev.current){setReports([]);setSchedules([]);
   setError(e instanceof Error?e.message:"Schedules cannot be checked.");}}
 },[]);
 useEffect(()=>{void refresh();return()=>{rev.current++};},[refresh]);
 useEffect(()=>{
  const listener=()=>{if(document.visibilityState==="visible"){
   setReports([]);setSchedules([]);setHistory([]);pending.current=null;
   void refresh();
  }else{rev.current++;setReports([]);setSchedules([]);setHistory([]);}};
  document.addEventListener("visibilitychange",listener);
  return()=>document.removeEventListener("visibilitychange",listener);
 },[refresh]);
 async function create(){
  if(busy||!report)return;
  const input={savedRef:report,cadence,timezone,localTime,firstDate:date};
  const payload=JSON.stringify(input);
  if(pending.current?.payload!==payload)
   pending.current={payload,key:crypto.randomUUID()};
  setBusy(true);setError("");setNotice("");
  try{
   const response=await get<{message:string}>("schedules",{
    ...input,requestKey:pending.current.key});
   pending.current=null;
   setNotice(response.message||
    "Schedule saved as paused. Automatic delivery is not yet active.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "Schedule status unconfirmed. Refresh before retrying.");}
  finally{setBusy(false);}
 }
 async function pause(item:Schedule){
  if(busy||item.state!=="ACTIVE")return;
  setBusy(true);setError("");setNotice("");
  try{
   await get("schedules/"+encodeURIComponent(item.ref)+"/pause",{
    expectedRevision:item.revision
   });
   setNotice("This schedule has been paused. Automatic delivery remains disabled.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "Schedule pause outcome unconfirmed. Refresh its status.");}
  finally{setBusy(false);}
 }
 async function viewHistory(id:string){
  setBusy(true);setError("");setHistory([]);
  try{
   const result=await get<{runs:{state:string;createdAt:string}[]}>(
    "schedules/"+encodeURIComponent(id)+"/history");
   setHistory(result.runs);
  }catch(e){setError(e instanceof Error?e.message:"Schedule history unavailable.");}
  finally{setBusy(false);}
 }
 return <section aria-labelledby="mis-schedules" style={{
  marginTop:20,paddingTop:16,borderTop:"1px solid var(--cg-border)"}}>
  <h3 id="mis-schedules">My report delivery schedules</h3>
  <p role="status" style={{fontSize:".83rem"}}>
   Automatic delivery is not enabled yet. Schedule preferences can be saved
   privately in a paused state, but no report will be sent until current
   recipient permissions and the CG-19 delivery integration are verified.</p>
  {!!error&&<p role="alert">{error}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   Refresh schedule status</button>
  {!!reports.length&&<div style={{display:"grid",gap:10,marginTop:12}}>
   <label>Saved report <select value={report} onChange={e=>setReport(e.target.value)}>
    <option value="">Choose my private saved report</option>
    {reports.map(x=><option key={x.ref} value={x.ref}>{x.name}</option>)}
   </select></label>
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
   <button type="button" disabled={busy||!report||!date} onClick={()=>void create()}>
    Save schedule as paused</button>
  </div>}
  {!reports.length&&<p>No eligible private saved report is currently available.</p>}
  <div style={{display:"grid",gap:8,marginTop:12}}>
   {schedules.map(item=><div key={item.ref} style={{
    border:"1px solid var(--cg-border)",borderRadius:10,padding:12}}>
    <strong>{item.savedReportName} · {item.cadence.charAt(0)+item.cadence.slice(1).toLowerCase()}</strong>
    <p style={{fontSize:".82rem",margin:"4px 0"}}>
     {item.state==="PAUSED"?"Paused · Not sending":
      item.state==="ACTIVE"?"Needs review · delivery is not enabled":
      item.state==="DISABLED"?"Disabled":"Status unavailable"}
     {" · "}{item.timezone}
     {" · "}Next planned: {new Date(item.nextDueAt).toLocaleString("en-IN")}</p>
    {item.state==="ACTIVE"&&<button type="button" disabled={busy}
     onClick={()=>void pause(item)}>Pause this schedule</button>}
    <button type="button" disabled={busy}
     onClick={()=>void viewHistory(item.ref)}>View actual run history</button>
   </div>)}
  </div>
  {history.length===0?<p style={{fontSize:".82rem"}}>No selected schedule runs to display.</p>:
   <ul>{history.map((item,i)=><li key={i}>
    {item.state.replaceAll("_"," ")} · {new Date(item.createdAt).toLocaleString("en-IN")}</li>)}</ul>}
 </section>;
}
