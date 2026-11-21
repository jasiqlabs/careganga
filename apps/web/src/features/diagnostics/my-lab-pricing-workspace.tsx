"use client";
import {useEffect,useState} from "react";
import {CenterLabPricingPanel} from "./center-lab-pricing-panel";
import {diagnosticsCall,type DiagnosticCenter} from "./diagnostic-api";
export function MyLabPricingWorkspace({canManage}:{canManage:boolean}){
 const [centers,setCenters]=useState<DiagnosticCenter[]>([]);
 const [selected,setSelected]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  void diagnosticsCall<{centers:DiagnosticCenter[]}>("my-centers/eligible")
   .then(r=>{if(active)setCenters(r.centers??[]);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:
    "Your current assigned lab centers cannot be confirmed.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 return <section className="cg-health-workspace cg-diagnostics">
  <header className="topbar"><div><h1>My Lab Pricing</h1>
   <p>View or propose test prices only at verified lab locations currently assigned to you.</p>
  </div></header>
  {loading&&<p className="cg-module-loading" role="status">Checking your assigned labs…</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!loading&&!centers.length&&<p className="cg-module-empty">
   No verified diagnostic lab is currently assigned to your account.</p>}
  {!!centers.length&&<label className="field">My assigned laboratory
   <select value={selected} onChange={e=>setSelected(e.target.value)}>
    <option value="">Choose a current lab</option>
    {centers.map(c=><option key={c.centerRef} value={c.centerRef}>
     {c.name} — {c.providerName}</option>)}
   </select>
  </label>}
  {selected&&(()=>{
   const current=centers.find(c=>c.centerRef===selected);
   return current?.publicationState==="PUBLISHED"&&current.publicSlug?
    <p><a href={"/health-network/lab-tests?center="+encodeURIComponent(current.publicSlug)}
     target="_blank" rel="noopener noreferrer">Preview currently published prices
     for this assigned lab</a></p>:
    <p className="cg-diagnostics-note">
     This lab is not currently published. Private proposals are not public offers.</p>;
  })()}
  {selected&&<CenterLabPricingPanel key={selected} centerRef={selected}
   canManage={canManage}/>}
 </section>;
}
