"use client";
import {useEffect,useState} from "react";
import type {CG19OwnVolunteerCards} from "@careganga/api-contracts";
const base="/api/community/volunteers/documents";
const read=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
export function VolunteerOwnCard({current}:{current:string}){
 const [data,setData]=useState<CG19OwnVolunteerCards|null>(null),[state,setState]=useState<"LOADING"|"READY"|"UNAVAILABLE">("LOADING");
 const [nonce,setNonce]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setState("LOADING");setData(null);
  void fetch(base+"/me",{cache:"no-store",signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error();
   const x:unknown=await response.json();
   if(!x||typeof x!=="object"||!Array.isArray((x as CG19OwnVolunteerCards).items))throw Error();
   if(!controller.signal.aborted&&document.visibilityState==="visible"){setData(x as CG19OwnVolunteerCards);setState("READY");}
  }).catch(()=>{if(!controller.signal.aborted&&document.visibilityState==="visible")setState("UNAVAILABLE");});
  return()=>controller.abort();
 },[current,nonce]);
 useEffect(()=>{
  const hide=()=>{if(document.visibilityState!=="visible"){setData(null);setState("LOADING");}else setNonce(x=>x+1);};
  document.addEventListener("visibilitychange",hide);
  return()=>document.removeEventListener("visibilitychange",hide);
 },[]);
 return <section className="cg04-panel" aria-label="Your privately issued official volunteer card">
  <h3>My official volunteer card</h3>
  <p className="cg04-muted">Cards are issued by the Foundation after independent approval. Your card is not an employee ID or permission to access private work.</p>
  {state==="LOADING"?<p role="status">Checking current official card issuance…</p>:
   state==="UNAVAILABLE"?<p role="alert">Original card status could not be verified. Refresh before relying on it.</p>:
   data?.items.length?data.items.map(v=><div key={v.cardRef} className="cg04-buttons">
    <strong>{read(v.status)} · Issue {v.revision}</strong>
    {v.canDownload&&<a href={base+"/cards/"+v.cardRef+"/download">Download my issued official PDF privately</a>}
    {!v.canDownload&&<span>{v.status==="ISSUED"?"This previously issued card no longer confirms current eligibility. Please contact the Foundation.":"Document is not currently issued; no public verification is available."}</span>}
   </div>):<p>No official volunteer card has been issued.</p>}
  <button type="button" onClick={()=>setNonce(x=>x+1)}>Refresh original card status</button>
 </section>;
}
