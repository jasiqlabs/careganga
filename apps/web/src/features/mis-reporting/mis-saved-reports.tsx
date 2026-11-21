"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {safeClientProblem} from "./mis-safe-error";
import type {ReportRequest} from "./mis-reports-workspace";
type Row={ref:string;name:string;version:number;revision:number;
 state:"ACTIVE"|"RETIRED";visibility:"PRIVATE";updatedAt:string};
type Detail=Row&{request:ReportRequest};
type Props={canManage:boolean;currentRequest:ReportRequest|null;
 onRestore:(value:ReportRequest)=>void};
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object){
 const r=await fetch("/api/mis/reports/saved"+path,{
  method,cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw new Error(await safeClientProblem(r,"This saved-report operation is unconfirmed. Refresh its current status."));
 return r.json() as Promise<T>;
}
export function MisSavedReports({canManage,currentRequest,onRestore}:Props){
 const [items,setItems]=useState<Row[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [name,setName]=useState("");
 const [problem,setProblem]=useState(""),[notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [hasMore,setHasMore]=useState(false);
 const seq=useRef(0);
 const pending=useRef<{digest:string;key:string}|null>(null);
 const load=useCallback(async()=>{
  const rev=++seq.current;
  setLoading(true);setProblem("");
  try{
   const list=await api<{items:Row[];hasMore:boolean}>("");
   if(!Array.isArray(list.items))throw Error("Saved report list unavailable.");
   if(rev===seq.current){setItems(list.items);setHasMore(list.hasMore===true);}
  }catch(e){if(rev===seq.current){setItems([]);
   setProblem(e instanceof Error?e.message:"Saved reports cannot be checked.");}}
  finally{if(rev===seq.current)setLoading(false);}
 },[]);
 useEffect(()=>{void load();return()=>{seq.current++};},[load]);
 useEffect(()=>{
  const reset=()=>{seq.current++;setSelected(null);setItems([]);setHasMore(false);
   pending.current=null;void load();};
  const vis=()=>{if(document.visibilityState==="visible")reset();
   else{seq.current++;setSelected(null);setItems([]);}};
  document.addEventListener("visibilitychange",vis);
  return()=>document.removeEventListener("visibilitychange",vis);
 },[load]);
 const attemptKey=(action:string,payload:unknown)=>{
  const digest=JSON.stringify({action,payload});
  if(pending.current?.digest!==digest)pending.current={
   digest,key:crypto.randomUUID()};
  return pending.current.key;
 };
 async function open(ref:string){
  if(busy)return;setBusy(true);setProblem("");setSelected(null);
  try{setSelected(await api<Detail>("/"+encodeURIComponent(ref)));}
  catch(e){setProblem(e instanceof Error?e.message:"Could not open this saved report.");}
  finally{setBusy(false);}
 }
 async function change(action:"CREATE"|"REVISE"|"COPY"|"RETIRE"){
  if(!canManage||busy)return;
  const request=currentRequest;
  const old=selected;
  if(action!=="RETIRE"&&!name.trim()){
   setProblem("Enter a short report name first.");return;
  }
  if((action==="CREATE"||action==="REVISE")&&!request){
   setProblem("Choose a real report and its supported format first.");return;
  }
  if(action!=="CREATE"&&(!old||old.state!=="ACTIVE")){
   setProblem("Choose an active saved report first.");return;
  }
  if(action==="RETIRE"&&
   !window.confirm("Retire this saved report? Scheduled runs will be paused."))return;
  const base=action==="RETIRE"?{expectedVersion:old!.version}:
   action==="COPY"?{name}:action==="REVISE"?
   {name,request,expectedVersion:old!.version}:{name,request};
  const key=attemptKey(action,{savedRef:old?.ref,...base});
  setBusy(true);setNotice("");setProblem("");
  try{
   const path=action==="CREATE"?"":"/"+encodeURIComponent(old!.ref)+
    (action==="COPY"?"/copy":action==="RETIRE"?"/retire":"");
   const res=await api<Row>(path,action==="REVISE"?"PATCH":"POST",
    {...base,requestKey:key});
   pending.current=null;
   setNotice(action==="RETIRE"?"Report retired. Any future schedule is paused.":
    action==="REVISE"?"Saved changes to the existing private report.":
    action==="COPY"?"Created a new private copy.":"Saved your private report.");
   setName("");setSelected(null);await load();
   if(res.state==="RETIRED")return;
  }catch(e){setProblem(e instanceof Error?e.message:
   "This request could not be confirmed. Refresh before retrying.");}
  finally{setBusy(false);}
 }
 return <section aria-labelledby="mis-saved-heading"
  style={{marginTop:20,borderTop:"1px solid var(--cg-border)",paddingTop:18}}>
  <h3 id="mis-saved-heading" style={{fontSize:"1rem"}}>My private saved reports</h3>
  <p style={{fontSize:".83rem",color:"var(--cg-muted)"}}>
   Saved configurations never store patient files, finance entries or report contents.
   A saved report always checks your current access before reopening.</p>
  <button type="button" disabled={busy||loading} onClick={()=>void load()}>
   {loading?"Checking saved reports…":"Refresh saved reports"}</button>
  {!!notice&&<p role="status">{notice}</p>}
  {!!problem&&<p role="alert">{problem}</p>}
  {items.length===0&&!loading&&<p role="status">No private saved reports were found.</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(13rem,1fr))",gap:9,
   marginTop:10}}>
   {items.map(row=><button type="button" key={row.ref}
    disabled={busy||row.state!=="ACTIVE"} onClick={()=>void open(row.ref)}
    style={{textAlign:"left",padding:12,border:"1px solid var(--cg-border)",
     borderRadius:8,background:"var(--cg-surface)"}}>
    <strong>{row.name}</strong>
    <small style={{display:"block",color:"var(--cg-muted)"}}>
     {row.state==="RETIRED"?"Retired":"Private · Active"}</small>
   </button>)}
  </div>
  {hasMore&&<p role="status">Showing the latest 50 reports.
   Retire older reports or narrow the saved list in a future release.</p>}
  {selected&&<div style={{marginTop:12,display:"grid",gap:9}}>
   <strong>{selected.name}</strong>
   <p style={{margin:0,fontSize:".8rem"}}>This is your current permitted saved definition.</p>
   <button type="button" onClick={()=>{onRestore(selected.request);
    setNotice("Saved filters loaded into the report form. Run again to refresh the data.");}}>
    Load saved filters into report</button>
  </div>}
  {canManage&&<div style={{marginTop:14,display:"grid",gap:10}}>
   <label>Report name <input value={name} maxLength={100}
    onChange={e=>{setName(e.target.value);pending.current=null;}}
    placeholder="Monthly Foundation finance" /></label>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button type="button" disabled={busy||!currentRequest}
     onClick={()=>void change("CREATE")}>Save new private report</button>
    {selected&&<>
     <button type="button" disabled={busy||!currentRequest}
      onClick={()=>void change("REVISE")}>Save changes to selected report</button>
     <button type="button" disabled={busy}
      onClick={()=>void change("COPY")}>Make private copy</button>
     <button type="button" disabled={busy}
      onClick={()=>void change("RETIRE")}>Retire selected report</button>
    </>}
   </div>
  </div>}
 </section>;
}
