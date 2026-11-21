"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";

type Metric={key:string;label:string;unit:string;value:string};
type Source={sourceKey:string;sourceLabel:string;state:string;readAt?:string;
 metrics:Metric[];drilldown?:string;explanation?:string};
type Dashboard={state:string;readAt:string;periodLabel?:string;scopeLabel?:string;
 sources:Source[];message?:string};
type Choice={ref:string;name:string};
type Options={state:string;years:Choice[];branches:Choice[];allBranches:boolean};
const money=(minor:string)=>{
 try{const n=BigInt(minor),abs=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+
   "."+(abs%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}
};
export function MisDashboardPanel(){
 const [data,setData]=useState<Dashboard|null>(null);
 const [busy,setBusy]=useState(true);
 const [problem,setProblem]=useState("");
 const seq=useRef(0);
 const [ready,setReady]=useState(false);
 const [years,setYears]=useState<Choice[]>([]),[branches,setBranches]=useState<Choice[]>([]);
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 const [allBranches,setAllBranches]=useState(false);
 useEffect(()=>{let live=true;void(async()=>{
  try{
   const response=await fetch("/api/mis/options",{cache:"no-store"});
   if(!response.ok)throw Error("Current report filters could not be verified.");
   const options=await response.json() as Options;
   if(!Array.isArray(options.years)||!Array.isArray(options.branches))
    throw Error("Current report filters unavailable.");
   if(live){setYears(options.years);setBranches(options.branches);
    setAllBranches(options.allBranches===true);
    setBranch(options.allBranches===true?"":options.branches[0]?.ref??"");setReady(true);}
  }catch{if(live){setProblem("Report filters are temporarily unavailable.");setReady(false);}}
 })();return()=>{live=false;};},[]);
 const load=useCallback(async()=>{
  const requestId=++seq.current;
  setBusy(true);setProblem("");setData(null);
  try{
   const query=new URLSearchParams();
   if(year)query.set("yearRef",year);
   if(branch)query.set("branchRef",branch);
   const response=await fetch("/api/mis/dashboard?"+query.toString(),
    {cache:"no-store",credentials:"same-origin"});
   if(!response.ok)throw new Error(response.status===403?
    "Your role cannot read this report.":response.status===401?
    "Session expired. Sign in again.":"Dashboard sources could not be verified.");
   const v=await response.json() as Dashboard;
   if(!v||!Array.isArray(v.sources)||typeof v.state!=="string")
    throw new Error("Reporting data could not be verified.");
   if(requestId===seq.current)setData(v);
  }catch(e){if(requestId===seq.current)setProblem(e instanceof Error?e.message:"Dashboard unavailable.");}
  finally{if(requestId===seq.current)setBusy(false);}
 },[year,branch]);
 useEffect(()=>{if(ready)void load();},[ready,load]);
 useEffect(()=>()=>{seq.current+=1;},[]);
 // A returned or refocused dashboard must not retain protected stale figures.
 useEffect(()=>{if(!ready)return;
  const recheck=()=>{if(document.visibilityState==="visible")void load();};
  document.addEventListener("visibilitychange",recheck);
  window.addEventListener("focus",recheck);
  return()=>{document.removeEventListener("visibilitychange",recheck);
   window.removeEventListener("focus",recheck);};
 },[ready,load]);
 return <section aria-labelledby="mis-dashboard-heading" style={{marginBottom:"2rem"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
   <div><h2 id="mis-dashboard-heading" style={{fontSize:"1.1rem",color:"var(--cg-text)"}}>Foundation MIS — Verified Sources</h2>
    <p style={{color:"var(--cg-muted)",fontSize:".85rem"}}>Read-only figures from current permitted business records.</p></div>
   <button type="button" onClick={()=>void load()} disabled={busy}
    aria-label="Refresh reporting data">{busy?"Checking…":"Refresh"}</button>
  </div>
  {ready&&<div style={{display:"flex",flexWrap:"wrap",gap:12,margin:"1rem 0"}}>
   <label>Financial year <select value={year} onChange={e=>setYear(e.target.value)}>
    <option value="">All permitted years</option>
    {years.map(y=><option key={y.ref} value={y.ref}>{y.name}</option>)}
   </select></label>
   {!!branches.length&&<label>Branch <select value={branch} onChange={e=>setBranch(e.target.value)}>
    {allBranches&&<option value="">All permitted branches</option>}
    {branches.map(b=><option key={b.ref} value={b.ref}>{b.name}</option>)}
   </select></label>}
  </div>}
  {busy&&ready&&<p role="status">Loading permitted business reports…</p>}
  {!!problem&&<p role="alert">{problem}</p>}
  {data&&<>
   <p style={{fontSize:".8rem",color:"var(--cg-muted)"}}>
    {data.periodLabel} · {data.scopeLabel} · Retrieved {new Date(data.readAt).toLocaleString("en-IN")}
   </p>
   {!!data.message&&<p role="status">{data.message}</p>}
   {data.sources.map(source=><div key={source.sourceKey} style={{marginTop:"1rem"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
     <h3 style={{fontSize:"1rem",color:"var(--cg-text)"}}>{source.sourceLabel}</h3>
     {source.state==="AVAILABLE"&&source.drilldown==="/admin/finance/reports"&&
      <Link href={source.drilldown}>Open detailed finance reports</Link>}
    </div>
    {source.state==="AVAILABLE"?<>
      <div className="kpi-grid">{source.metrics.map(m=><div className="kpi" key={m.key}>
       <span style={{color:"var(--cg-muted)",fontSize:".82rem"}}>{m.label}</span>
       <strong>{m.unit==="INR_MINOR"?money(m.value):m.value}</strong>
       <small style={{color:"var(--cg-muted)",fontSize:".75rem"}}>Source-read at {source.readAt?new Date(source.readAt).toLocaleString("en-IN"):"current request"}</small>
      </div>)}</div>
      <p style={{fontSize:".78rem",color:"var(--cg-muted)"}}>{source.explanation}</p>
     </>:<p role="status">{source.state==="EMPTY"?
      "No posted financial entries for the selected permitted scope.":
      "Source currently unavailable. No estimates or sample totals are displayed."}</p>}
   </div>)}
   {data.sources.length===0&&<p role="status">No reporting source is permitted for your current role.</p>}
  </>}
 </section>;
}
