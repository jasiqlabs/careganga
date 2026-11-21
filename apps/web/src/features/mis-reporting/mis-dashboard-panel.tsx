"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";

type Metric={key:string;label:string;unit:string;value:string};
type Source={sourceKey:string;sourceLabel:string;state:string;readAt?:string;
 metrics:Metric[];drilldown?:string;explanation?:string};
type Dashboard={state:string;readAt:string;periodLabel?:string;scopeLabel?:string;
 sources:Source[];message?:string};
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
 const load=useCallback(async()=>{
  setBusy(true);setProblem("");setData(null);
  try{
   const response=await fetch("/api/mis/dashboard",{cache:"no-store",credentials:"same-origin"});
   if(!response.ok)throw new Error(response.status===403?
    "Your role cannot read this report.":response.status===401?
    "Session expired. Sign in again.":"Dashboard sources could not be verified.");
   const v=await response.json() as Dashboard;
   if(!v||!Array.isArray(v.sources)||typeof v.state!=="string")
    throw new Error("Reporting data could not be verified.");
   setData(v);
  }catch(e){setProblem(e instanceof Error?e.message:"Dashboard unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 return <section aria-labelledby="mis-dashboard-heading" style={{marginBottom:"2rem"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
   <div><h2 id="mis-dashboard-heading" style={{fontSize:"1.1rem",color:"var(--cg-text)"}}>Foundation MIS — Verified Sources</h2>
    <p style={{color:"var(--cg-muted)",fontSize:".85rem"}}>Read-only figures from current permitted business records.</p></div>
   <button type="button" onClick={()=>void load()} disabled={busy}
    aria-label="Refresh reporting data">{busy?"Checking…":"Refresh"}</button>
  </div>
  {busy&&<p role="status">Loading permitted business reports…</p>}
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
       <small style={{color:"var(--cg-muted)",fontSize:".75rem"}}>Current posted source · {data.periodLabel}</small>
      </div>)}</div>
      <p style={{fontSize:".78rem",color:"var(--cg-muted)"}}>{source.explanation}</p>
     </>:<p role="status">Source currently unavailable. No estimates or sample totals are displayed.</p>}
   </div>)}
   {data.sources.length===0&&<p role="status">No reporting source is permitted for your current role.</p>}
  </>}
 </section>;
}
