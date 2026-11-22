"use client";
import {useEffect,useRef,useState} from "react";
import type {CG19VolunteerCardStatus} from "@careganga/api-contracts";
type Pending={ref:string;requestKey:string};
const base="/api/volunteers/documents";
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(18000)});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw new Error(v&&typeof v==="object"&&typeof (v as {message?:unknown}).message==="string"?(v as {message:string}).message:"Current original volunteer card issuance is uncertain. Refresh its status.");
 return v as T;
}
/** This component only exists behind the verified Foundation issue capability. */
export function VolunteerCardManager({volunteerRef}:{volunteerRef:string}){
 const [card,setCard]=useState<CG19VolunteerCardStatus|null>(null),[password,setPassword]=useState(""),
  [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[note,setNote]=useState("");
 const seq=useRef(0),pending=useRef<Pending|null>(null);
 useEffect(()=>{
  const id=++seq.current;setLoading(true);setCard(null);setPassword("");pending.current=null;setError("");setNote("");
  void api<{card:CG19VolunteerCardStatus|null}>("/volunteers/"+volunteerRef)
   .then(v=>{if(id===seq.current&&document.visibilityState==="visible")setCard(v.card);})
   .catch(e=>{if(id===seq.current)setError(e instanceof Error?e.message:"Official volunteer card unavailable.");})
   .finally(()=>{if(id===seq.current)setLoading(false);});
  return()=>{seq.current++;};
 },[volunteerRef,reload]);
 useEffect(()=>{
  const hide=()=>{if(document.visibilityState!=="visible"){seq.current++;setCard(null);setPassword("");setLoading(true);pending.current=null;}else setReload(v=>v+1);};
  document.addEventListener("visibilitychange",hide);
  return()=>document.removeEventListener("visibilitychange",hide);
 },[]);
 const refresh=async()=>{
  const v=await api<{card:CG19VolunteerCardStatus|null}>("/volunteers/"+volunteerRef);
  setCard(v.card);setLoading(false);
 };
 const act=async(work:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError("");setNote("");
  try{await work();}catch(e){setError(e instanceof Error?e.message:"The original card outcome is uncertain. Refresh the current record.");}
  finally{setBusy(false);setPassword("");}
 };
 const issue=()=>void act(async()=>{
  if(password.length<8)throw Error("Enter your current protected Foundation password.");
  if(!pending.current||pending.current.ref!==volunteerRef)pending.current={ref:volunteerRef,requestKey:crypto.randomUUID()};
  const status=await api<CG19VolunteerCardStatus>("/volunteers/"+volunteerRef+"/issue",{requestKey:pending.current.requestKey,currentPassword:password});
  pending.current=null;setCard(status);setNote(status.status==="ISSUED"?"Original volunteer card issued.":"Issuance is pending verification. Check current status before retrying.");
 });
 const reconcile=()=>void act(async()=>{
  if(!card||!card.canRetry)throw Error("This original card is not currently retryable.");
  const status=await api<CG19VolunteerCardStatus>("/cards/"+card.cardRef+"/reconcile",{});
  setCard(status);setNote(status.status==="ISSUED"?"Original volunteer card now issued.":"The original card status is still pending.");
 });
 const revoke=()=>void act(async()=>{
  if(!card||password.length<8)throw Error("Enter your current Foundation password to revoke the card.");
  const result=await api<CG19VolunteerCardStatus>("/cards/"+card.cardRef+"/revoke",{currentPassword:password});
  setCard(result);setNote("Previous volunteer card revoked; its public verification will not remain valid.");
 });
 const download=()=>void act(async()=>{
  if(!card||!card.canDownload)throw Error("The original volunteer PDF has not been issued.");
  const r=await fetch(base+"/cards/"+card.cardRef+"/download",{cache:"no-store",signal:AbortSignal.timeout(17000)});
  if(!r.ok||(r.headers.get("content-type")??"").split(";")[0]!=="application/pdf")throw Error("Official private volunteer card is not available.");
  const blob=await r.blob();
  if(!blob.size||blob.size>10485760)throw Error("The issued PDF could not be verified.");
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  try{link.href=url;link.download="CareGanga-issued-volunteer-card.pdf";link.click();}
  finally{setTimeout(()=>URL.revokeObjectURL(url),1500);}
 });
 return <section className="cg04-panel" aria-label="Authorized original volunteer card issuer">
  <h3>Official volunteer card (CG-19)</h3>
  <p className="cg04-muted">Issue only after independent approval, current volunteer eligibility and approved original Foundation branding. No sample signature, guessed card or public personal data.</p>
  {loading?<p role="status">Checking current official card state…</p>:card?
   <p role="status"><strong>{label(card.status)}</strong> · Revision {card.revision}{card.issuedAt?" · Issued "+new Date(card.issuedAt).toLocaleString("en-IN"):""}</p>:
   <p>No official volunteer card has been issued.</p>}
  {error&&<p role="alert" className="cg04-error">{error}</p>}{note&&<p role="status">{note}</p>}
  <div className="cg04-buttons">
   {(!card||card.status==="REVOKED")&&<label>Current Foundation password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
   {(!card||card.status==="REVOKED")&&<button type="button" disabled={busy||loading||password.length<8} onClick={issue}>Issue original card</button>}
   {card?.canRetry&&<button type="button" disabled={busy} onClick={reconcile}>Reconcile genuine issue</button>}
   {card?.canDownload&&<><button type="button" disabled={busy} onClick={download}>Download issued PDF</button>
    <label>Current password to revoke<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button type="button" disabled={busy||password.length<8} onClick={revoke}>Revoke card</button></>}
   <button type="button" disabled={busy} onClick={()=>void act(refresh)}>Refresh official state</button>
  </div>
 </section>;
}
