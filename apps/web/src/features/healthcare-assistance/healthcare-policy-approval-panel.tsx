"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
type ReviewCase={caseRef:string;reference:string;title:string;
 status:string;revision:number};
type Detail={caseRef:string;reference:string;title:string;status:string;
 revision:number;source:{policyRevisionRef:string;validFrom:string;
 validUntil:string;capMinor:string;percentBasisPoints:number|null;fixedMinor:string|null;
 service:string;mode:string;state:string}};
type PendingPolicy={revisionRef:string;reviewCaseRef:string|null;
 reviewStatus:string|null;status:string;serviceKind:string;
 capMinor:string;percentBasisPoints:number|null;revision:number};
type Attempt={path:string;body:Record<string,unknown>;success:string};
type Props={canReview:boolean;canManage:boolean;pendingPolicies:PendingPolicy[];
 onChanged:()=>Promise<void>};
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:object){
 const r=await fetch("/api/healthcare-assistance/policies/reviews"+
  (path?"/"+path:""),{method,cache:"no-store",credentials:"same-origin",
   ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(
  r.status===401?"Session expired. Sign in again.":
  r.status===403?"A current protected reviewer or Foundation owner role is required.":
  r.status===404?"Original independent approval is unavailable.":
  r.status===409?"Policy/review changed. Check the latest original case.":
  "Outcome unconfirmed. Check the original approval before retrying."),
  {status:r.status});
 return r.json() as Promise<T>;
}
const cash=(minor:string)=>/^\d{1,11}$/.test(minor)?
 "₹"+(Number(minor)/100).toLocaleString("en-IN",{
  minimumFractionDigits:2,maximumFractionDigits:2}):"Amount unavailable";
export function HealthcarePolicyApprovalPanel({canReview,canManage,
 pendingPolicies,onChanged}:Props){
 const [cases,setCases]=useState<ReviewCase[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [password,setPassword]=useState(""),[remarks,setRemarks]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [message,setMessage]=useState(""),[unknown,setUnknown]=useState(false);
 const last=useRef<Attempt|null>(null);
 const load=useCallback(async()=>{
  if(!canReview)return;
  const v=await api<{cases:ReviewCase[]}>("");
  if(!Array.isArray(v.cases)||v.cases.length>50)
   throw Error("Protected original review list unavailable.");
  setCases(v.cases);
 },[canReview]);
 useEffect(()=>{
  let active=true;if(!canReview)return;
  void load().catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Protected reviewer access unavailable.");});
  return()=>{active=false};
 },[load,canReview]);
 async function inspect(ref:string){
  setBusy(true);setError("");setMessage("");
  try{setSelected(await api<Detail>(ref));}catch(e){
   setError(e instanceof Error?e.message:"Original CG03 case unavailable.");
  }finally{setBusy(false);}
 }
 async function submit(command:Attempt,retry=false){
  if(busy||unknown&&!retry)return;
  setBusy(true);setError("");setMessage("");
  try{
   await api<{status:string;replayed?:boolean}>(command.path,"POST",command.body);
   setUnknown(false);last.current=null;setPassword("");setRemarks("");
   setMessage(command.success);
   try{await Promise.all([load(),onChanged()]);}catch{
    setMessage(command.success+" Latest case list could not refresh.");
   }
   setSelected(null);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
     typeof e.status==="number"?e.status:503;
   setUnknown(code>=500);if(code<500)last.current=null;
   setError(e instanceof Error?e.message:"Original decision not verified.");
  }finally{setBusy(false);}
 }
 function decide(action:"APPROVE"|"REJECT",event:FormEvent){
  event.preventDefault();
  if(!canReview||!selected||busy||!password||unknown)return;
  if(!window.confirm(action==="APPROVE"?
   "Approve this protected healthcare contribution for separate Foundation finalization?":
   "Reject this protected contribution policy? No patient award becomes effective."))return;
  const command={path:selected.caseRef+"/decision",body:{
   requestKey:crypto.randomUUID(),expectedRevision:selected.revision,
   action,remarks:remarks.trim(),currentPassword:password},
   success:action==="APPROVE"?
    "Independent CG03 review approved. Foundation finalization is still required.":
    "Protected contribution rejected; no unapproved benefit becomes effective."};
  last.current=command;void submit(command);
 }
 function activate(ref:string){
  if(!canManage||busy||unknown||!password)return;
  if(!window.confirm("Finalize this exact independently approved healthcare contribution? "+
   "The prior active rule changes only after successful protected finalization."))return;
  const command={path:ref+"/activate",body:{currentPassword:password},
   success:"Protected owner finalized original CG03 decision. "+
    "Only verified eligible future services can use the effective support rule."};
  last.current=command;void submit(command);
 }
 const ready=pendingPolicies.filter(p=>p.status==="PENDING_APPROVAL"&&
  p.reviewStatus==="PENDING_OWNER"&&p.reviewCaseRef!==null);
 if(!canReview&&!canManage)return null;
 return <section className="form-section" aria-label="Independent protected healthcare contribution approval">
  <h2>Protected healthcare contribution approval</h2>
  <p>Full consultation coverage and all pharmacy, nursing and OT benefit
   policies require a genuine independent protected CG03 reviewer decision
   followed by separate Foundation owner finalization.
   A scanner check, ordinary role or a pending request is never approval.</p>
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!message&&<p className="notice" role="status">{message}</p>}
  <label className="field">Current account password for protected action
   <input autoComplete="current-password" type="password" maxLength={1024}
    value={password} disabled={busy||unknown}
    onChange={e=>setPassword(e.target.value)}/>
  </label>
  {unknown&&<div className="cg-diagnostics-card" role="alert">
   <p>Approval action outcome uncertain. Do not create another decision.</p>
   <button type="button" disabled={busy||!last.current} onClick={()=>{
    if(last.current)void submit(last.current,true);
   }}>Retry exact original approval action</button>
   <button type="button" disabled={busy} onClick={()=>void load().catch(e=>
    setError(e instanceof Error?e.message:"Review refresh failed."))}>
    Check current original case history</button>
  </div>}
  {canReview&&<div className="cg-diagnostics-card">
   <h3>Protected reviewer inbox</h3>
   <button type="button" disabled={busy||unknown} onClick={()=>void load().catch(e=>
    setError(e instanceof Error?e.message:"Review inbox unavailable."))}>
    Refresh reviews</button>
   {cases.length===0?<p>No protected contribution reviews currently visible.</p>:
    <div className="table-wrap"><table className="role-table">
     <thead><tr><th>Original reference</th><th>Review state</th><th>Details</th></tr></thead>
     <tbody>{cases.map(c=><tr key={c.caseRef}>
      <td>{c.reference} · {c.title}</td><td>{c.status.replaceAll("_"," ")}</td>
      <td><button type="button" disabled={busy||unknown}
       onClick={()=>void inspect(c.caseRef)}>Inspect original</button></td>
     </tr>)}</tbody>
    </table></div>}
   {selected&&<form onSubmit={event=>decide("APPROVE",event)}>
    <h3>Review {selected.reference}</h3>
    <p>{selected.title}. {selected.source.service} contribution:
     {" "+(selected.source.percentBasisPoints/100).toFixed(2)}%.
     Cap: {cash(selected.source.capMinor)}.
     Period: {new Date(selected.source.validFrom).toLocaleString("en-IN")} –
     {" "+new Date(selected.source.validUntil).toLocaleString("en-IN")}.</p>
    <p>Current case: {selected.status}. A protected reviewer may not
     approve their own submission.</p>
    {["SUBMITTED","IN_REVIEW"].includes(selected.status)&&<>
     <label className="field">Review remarks (optional)
      <textarea maxLength={500} value={remarks} disabled={busy||unknown}
       onChange={e=>setRemarks(e.target.value)}/>
     </label>
     <div className="toolbar">
      <button type="submit" disabled={busy||unknown||password.length<8}>
       Approve for finalization</button>
      <button type="button" disabled={busy||unknown||password.length<8}
       onClick={event=>decide("REJECT",event)}>Reject original policy</button>
     </div>
    </>}
   </form>}
  </div>}
  {canManage&&ready.length>0&&<div className="cg-diagnostics-card">
   <h3>Owner finalization ready</h3>
   {ready.map(p=><div key={p.revisionRef} className="toolbar">
    <span>{p.serviceKind} · {p.percentBasisPoints===null?"—":
     (p.percentBasisPoints/100)+"%"} · cap {cash(p.capMinor)}</span>
    <button type="button" disabled={busy||unknown||password.length<8}
     onClick={()=>{if(p.reviewCaseRef)activate(p.reviewCaseRef)}}>
     Finalize protected approval</button>
   </div>)}
  </div>}
 </section>;
}
