"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Case={caseRef:string;reference:string;title:string;kind:string;status:string;revision:number};
type Detail={caseRef:string;reference:string;status:string;revision:number;
 kind:"HEALTH_PROVIDER_VERIFICATION"|"HEALTH_CENTER_VERIFICATION";
 source:null|{kind:string;source:Record<string,unknown>;proofStatus:string;sourceVersion:number}};
const statusText=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
async function data<T>(url:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const r=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const value:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Object.assign(new Error(value&&typeof value==="object"&&
  "message" in value&&typeof value.message==="string"?
  value.message:"Review result could not be confirmed."),{status:r.status});
 return value as T;
}
const safeText=(v:unknown)=>typeof v==="string"?v:"Not specified";
export function HealthReviewInbox(){
 const [cases,setCases]=useState<Case[]>([]);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [decision,setDecision]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [currentPassword,setCurrentPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const key=useRef("");
 const load=useCallback(async()=>{
  const out=await data<{cases:Case[]}>("/api/health/reviews");
  setCases(Array.isArray(out.cases)?out.cases:[]);
 },[]);
 useEffect(()=>{
  void load().catch(e=>setError(e instanceof Error?e.message:"Healthcare reviews unavailable"))
    .finally(()=>setLoading(false));
 },[load]);
 async function open(ref:string){
  setError("");setNotice("");setDetail(null);setCurrentPassword("");
  setRemarks("");setUncertain(false);key.current="";
  try{
   const found=await data<Detail>("/api/health/reviews/"+encodeURIComponent(ref));
   setDetail(found);
  }catch(e){setError(e instanceof Error?e.message:"Review not available.");}
 }
 async function sendDecision(){
  if(!detail||busy||uncertain||currentPassword.length<8)return;
  setBusy(true);setError("");setNotice("");
  if(!key.current)key.current=crypto.randomUUID();
  try{
   await data("/api/health/reviews/"+encodeURIComponent(detail.caseRef)+"/decide","POST",{
    requestKey:key.current,expectedRevision:detail.revision,
    action:decision,remarks,currentPassword
   });
   setCurrentPassword("");key.current="";
   await open(detail.caseRef);await load();
   setNotice("Original independent review decision recorded. Approval still requires the owner to apply it.");
  }catch(e){
   setCurrentPassword("");
   setError(e instanceof Error?e.message:"Review result uncertain.");
   if(!(e&&typeof e==="object"&&"status" in e&&
      typeof e.status==="number"&&e.status<500))
    setUncertain(true);
  }finally{setBusy(false);}
 }
 async function apply(){
  if(!detail||busy||uncertain)return;
  const ref=detail.caseRef;
  const kind=detail.kind==="HEALTH_PROVIDER_VERIFICATION"?"providers":"centers";
  setBusy(true);setError("");setNotice("");
  try{
   await data("/api/health-network/"+kind+"/reviews/"+encodeURIComponent(ref)+"/apply",
     "POST",{});
   await open(ref);await load();
   setNotice("Approved evidence was applied. Center access and publication remain separate.");
  }catch(e){
   setError(e instanceof Error?e.message:"Applying approval could not be confirmed.");
   if(!(e&&typeof e==="object"&&"status" in e&&
      typeof e.status==="number"&&e.status<500))
     setUncertain(true);
  }finally{setBusy(false);}
 }
 async function returnForCorrection(){
  if(!detail||busy||uncertain)return;
  const ref=detail.caseRef;
  const kind=detail.kind==="HEALTH_PROVIDER_VERIFICATION"?"providers":"centers";
  setBusy(true);setError("");setNotice("");
  try{
   await data("/api/health-network/"+kind+"/reviews/"+
     encodeURIComponent(ref)+"/return-to-draft","POST",{});
   await open(ref);await load();
   setNotice("Returned application is ready for corrections and new current evidence.");
  }catch(e){setError(e instanceof Error?e.message:"Return could not be confirmed.");}
  finally{setBusy(false);}
 }
 return <div className="role-workspace">
  <header className="topbar"><div><h1>Healthcare verification queue</h1>
   <p>Each registration requires an independent authorized reviewer and verified private evidence.</p>
  </div><button type="button" onClick={()=>{void load();}}>Refresh queue</button></header>
  {loading&&<p role="status">Checking submitted registrations…</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  {uncertain&&<div role="alert" className="notice">
    The last review action may have succeeded. Refresh the original case before doing anything else.
    <button type="button" onClick={()=>{setUncertain(false);
      if(detail)void open(detail.caseRef);}}>Check current case</button>
  </div>}
  {!loading&&cases.length===0&&<p>No healthcare registrations are awaiting review.</p>}
  <div className="table-wrap"><table><thead><tr><th>Case</th>
   <th>Registration</th><th>Kind</th><th>Status</th><th>Action</th></tr></thead><tbody>
   {cases.map(c=><tr key={c.caseRef}>
    <td>{c.reference}</td><td>{c.title}</td>
    <td>{c.kind==="HEALTH_PROVIDER_VERIFICATION"?"Provider":"Center"}</td>
    <td>{statusText(c.status)}</td><td><button type="button"
     onClick={()=>void open(c.caseRef)}>Review</button></td>
   </tr>)}
  </tbody></table></div>
  {detail&&<section className="form-section">
   <h2>{detail.reference}</h2><p>{statusText(detail.kind)} · {statusText(detail.status)}</p>
   {detail.source&&<>
    <h3>Original submitted details</h3>
    <dl>
     {Object.entries(detail.source.source).map(([key,value])=><div key={key}>
      <dt>{statusText(key)}</dt><dd>{safeText(value)}</dd>
     </div>)}
    </dl>
    <p>Private evidence: {statusText(detail.source.proofStatus)}</p>
    <a href={"/api/documents/health-draft/reviews/"+
      encodeURIComponent(detail.caseRef)+"/download"}>
      Download original scanned evidence for review</a>
   </>}
   {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&
    <div className="form">
     <label className="field">Review action
      <select value={decision} disabled={busy||uncertain}
       onChange={e=>{setDecision(e.target.value as typeof decision);key.current="";}}>
       <option value="APPROVE">Approve verified registration</option>
       <option value="RETURN">Return for corrections</option>
       <option value="REJECT">Reject application</option>
      </select>
     </label>
     <label className="field">Reviewer note
      <textarea maxLength={500} value={remarks} disabled={busy||uncertain}
       onChange={e=>{setRemarks(e.target.value);key.current="";}}/>
     </label>
     <label className="field">Confirm with current password
      <input type="password" autoComplete="current-password"
       value={currentPassword} disabled={busy||uncertain} minLength={8}
       onChange={e=>{setCurrentPassword(e.target.value);key.current="";}}/>
     </label>
     <div className="toolbar"><button type="button" className="primary"
       disabled={busy||uncertain||currentPassword.length<8}
       onClick={()=>void sendDecision()}>
       {busy?"Recording…":"Record independent review decision"}</button>
     </div>
    </div>}
   {detail.status==="PENDING_OWNER"&&<button type="button" className="primary"
      disabled={busy||uncertain} onClick={()=>void apply()}>
     Apply approved registration</button>}
   {detail.status==="RETURNED"&&<button type="button"
      disabled={busy||uncertain} onClick={()=>void returnForCorrection()}>
     Reopen for corrections</button>}
   <p>Only a verified and separately activated center can later be published. No approval creates a booking or payment.</p>
  </section>}
 </div>;
}
