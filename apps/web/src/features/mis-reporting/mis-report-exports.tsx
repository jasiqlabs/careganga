"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {safeClientProblem} from "./mis-safe-error";
import type {ReportRequest} from "./mis-reports-workspace";
type Format="PDF"|"XLSX"|"CSV";
type Run={ref:string;state:string;format:Format;sourceKey?:string;
 createdAt?:string;sourceAsOf?:string;rows?:number|null;
 canDownload:boolean;expiresAt?:string};
const api=async<T,>(path:string,body?:object):Promise<T>=>{
 const res=await fetch("/api/mis/reports/runs"+path,{
  method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw new Error(await safeClientProblem(res,"This protected file status cannot be confirmed. Refresh before retrying."));
 return res.json() as Promise<T>;
};
/** CG19-confirmed protected files only; no locally fabricated PDF, XLSX or CSV
 * and no database IDs displayed as business names or fields.
 */
export function MisReportExports({request,allowed}:{request:ReportRequest|null;
 allowed:boolean}){
 const [runs,setRuns]=useState<Run[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const pending=useRef<{digest:string;key:string}|null>(null);
 const seq=useRef(0);
 const refresh=useCallback(async()=>{
  const i=++seq.current;setError("");
  try{
   const result=await api<{runs:Run[]}>("");
   if(!Array.isArray(result.runs))throw Error("Original report history is unavailable.");
   if(i===seq.current)setRuns(result.runs);
  }catch(e){if(i===seq.current){setRuns([]);
   setError(e instanceof Error?e.message:"Could not confirm report history.");}}
 },[]);
 useEffect(()=>{if(allowed)void refresh();return()=>{seq.current++};},[allowed,refresh]);
 useEffect(()=>{
  const vis=()=>{if(document.visibilityState==="visible"){
   setRuns([]);pending.current=null;void refresh();
  }else{seq.current++;setRuns([]);}};
  document.addEventListener("visibilitychange",vis);
  return()=>document.removeEventListener("visibilitychange",vis);
 },[refresh]);
 async function create(format:Format){
  if(!allowed||!request||busy)return;
  const digest=JSON.stringify({request,format});
  if(pending.current?.digest!==digest)pending.current={
   digest,key:crypto.randomUUID()};
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<Run>("",{requestKey:pending.current.key,
    format,request});
   pending.current=null;
   setNotice(result.state==="READY"?
    "Verified private file ready. Your current access is checked again before download.":
    result.state==="EMPTY"?"This source has no matching records.":
    result.state==="UNKNOWN"?"File outcome is unconfirmed. Check its status before trying again.":
    "File generation has not completed. Check the original run status.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "File outcome unconfirmed. Check report history before retrying.");}
  finally{setBusy(false);}
 }
 return <section aria-labelledby="mis-protected-exports"
  style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--cg-border)"}}>
  <h3 id="mis-protected-exports">My protected report exports</h3>
  <p style={{fontSize:".83rem",color:"var(--cg-muted)"}}>
   Exports use real posted or permitted source data. Files remain private and
   are released only after storage and permissions are verified.</p>
  {allowed&&request&&<div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
   {(["PDF","XLSX","CSV"] as Format[]).map(format=>
    <button type="button" key={format} disabled={busy}
     onClick={()=>void create(format)}>
     {busy?"Checking export…":"Export verified "+(format==="XLSX"?"Excel":format)}</button>)}
  </div>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}
   style={{marginTop:10}}>Refresh export history</button>
  {!!error&&<p role="alert">{error}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  {runs.length===0&&<p role="status">No protected report runs found.</p>}
  <div style={{display:"grid",gap:8,marginTop:12}}>
   {runs.map(run=><div key={run.ref}
    style={{border:"1px solid var(--cg-border)",padding:12,borderRadius:10,
     background:"var(--cg-surface)"}}>
    <strong>{run.format} report</strong>
    <p style={{margin:"4px 0",fontSize:".8rem",color:"var(--cg-muted)"}}>
     Status: {run.state==="UNKNOWN"?"Not confirmed":
      run.state==="READY"?"Verified file ready":
      run.state==="EMPTY"?"No records":
      run.state==="REVOKED"?"Access revoked":
      run.state==="FAILED"?"Generation failed":
      run.state==="RUNNING"?"Preparing":
      run.state==="QUEUED"?"Queued":
      run.state==="EXPIRED"?"Expired":"Status unavailable"}
     {run.createdAt?" · "+new Date(run.createdAt).toLocaleString("en-IN"):""}</p>
    {run.canDownload&&run.state==="READY"&&
     <a href={"/api/mis/reports/runs/"+encodeURIComponent(run.ref)+"/download"}>
      Download authorized {run.format} file</a>}
   </div>)}
  </div>
 </section>;
}
