"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Case={caseRef:string;reference:string;title:string;kind:string;status:string;revision:number};
type Detail={caseRef:string;reference:string;status:string;revision:number;
 kind:"HEALTH_PROVIDER_VERIFICATION"|"HEALTH_CENTER_VERIFICATION"|"HEALTH_DOCTOR_VERIFICATION";
 source:null|{kind:string;source:Record<string,unknown>;proofStatus:string;sourceVersion:number}};
const statusText=(s:string)=>s.replace(/([a-z])([A-Z])/g,"$1 $2")
 .replaceAll("_"," ").toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
async function data<T>(url:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const r=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const value:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Object.assign(new Error(value&&typeof value==="object"&&
  "message" in value&&typeof value.message==="string"?
  value.message:"Review result could not be confirmed."),{status:r.status});
 return value as T;
}
const dayLabels=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const safeText=(v:unknown):string=>{
 if(typeof v==="string")return v;
 if(typeof v==="number"&&Number.isFinite(v))return String(v);
 if(Array.isArray(v))return v.length?
   v.map(row=>{
     if(typeof row==="string")return statusText(row);
     if(row&&typeof row==="object"){
       const x=row as Record<string,unknown>;
       if(typeof x.weekday==="number"&&typeof x.opens==="string"&&
         typeof x.closes==="string"&&typeof x.service==="string")
         return (dayLabels[x.weekday]??"Day")+" "+x.opens+"–"+x.closes+
           " ("+statusText(x.service)+")";
     }
     return "Declaration unavailable";
   }).join("; "):"None declared";
 return "Not specified";
};
export function HealthReviewInbox({canManageProviders=false,canManageDoctors=false}:{canManageProviders?:boolean;canManageDoctors?:boolean}){
 const [cases,setCases]=useState<Case[]>([]);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [decision,setDecision]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [currentPassword,setCurrentPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const [statusFilter,setStatusFilter]=useState("ALL");
 const [kindFilter,setKindFilter]=useState("ALL");
 const [searchText,setSearchText]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [pageLoading,setPageLoading]=useState(false);
 const currentRequest=useRef(0),detailRequest=useRef(0),selectedCase=useRef("");
 const [detailLoading,setDetailLoading]=useState(false),[refreshVersion,setRefreshVersion]=useState(0);
 const key=useRef("");
 const load=useCallback(async(offset=0)=>{
  const thisRequest=++currentRequest.current;
  const search=new URLSearchParams({
    offset:String(offset),status:statusFilter,kind:kindFilter,q:appliedSearch
  });
  const out=await data<{cases:Case[];nextOffset:number|null}>(
    "/api/health/reviews?"+search.toString());
  if(thisRequest!==currentRequest.current)return;
  if(!Array.isArray(out.cases)||out.cases.some(x=>!x.caseRef||!x.reference))
    throw Error("The current case list is incomplete.");
  if(offset===0)setCases(out.cases);
  else setCases(previous=>{
    const refs=new Set(previous.map(x=>x.caseRef));
    return [...previous,...out.cases.filter(x=>!refs.has(x.caseRef))];
  });
  setNextOffset(Number.isSafeInteger(out.nextOffset)?out.nextOffset:null);
 },[statusFilter,kindFilter,appliedSearch]);
 useEffect(()=>{
  let active=true;detailRequest.current++;selectedCase.current="";setDetailLoading(false);
  setLoading(true);setError("");setDetail(null);setCases([]);setNextOffset(null);
  void load(0).catch(e=>{if(active)setError(e instanceof Error?e.message:"Healthcare reviews unavailable");})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;currentRequest.current++;detailRequest.current++;};
 },[load,refreshVersion]);
 async function loadMore(){
  if(nextOffset===null||pageLoading||loading||busy||uncertain)return;
  setPageLoading(true);
  try{await load(nextOffset);}
  catch(e){setError(e instanceof Error?e.message:"Additional reviews unavailable.");}
  finally{setPageLoading(false);}
 }
 async function open(ref:string){
  const turn=++detailRequest.current;selectedCase.current=ref;setDetailLoading(true);
  setError("");setNotice("");setDetail(null);setCurrentPassword("");setRemarks("");setDecision("APPROVE");
  try{
   const found=await data<Detail>("/api/health/reviews/"+encodeURIComponent(ref));
   if(turn!==detailRequest.current)return;
   if(!found||found.caseRef!==ref)throw Error("The selected review cannot be verified.");
   setDetail(found);setUncertain(false);key.current="";
  }catch(e){if(turn===detailRequest.current)setError(e instanceof Error?e.message:"Review not available.");}
  finally{if(turn===detailRequest.current)setDetailLoading(false);}
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
  const kind=detail.kind==="HEALTH_PROVIDER_VERIFICATION"?"providers":detail.kind==="HEALTH_DOCTOR_VERIFICATION"?"doctors":"centers";
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
  const kind=detail.kind==="HEALTH_PROVIDER_VERIFICATION"?"providers":detail.kind==="HEALTH_DOCTOR_VERIFICATION"?"doctors":"centers";
  setBusy(true);setError("");setNotice("");
  try{
   await data("/api/health-network/"+kind+"/reviews/"+
     encodeURIComponent(ref)+"/return-to-draft","POST",{});
   await open(ref);await load();
   setNotice("Returned application is ready for corrections and new current evidence.");
  }catch(e){setError(e instanceof Error?e.message:"Return could not be confirmed.");if(!(e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status<500))setUncertain(true);}
  finally{setBusy(false);}
 }
 return <div className="role-workspace">
  <header className="topbar"><div><h1>Healthcare verification queue</h1>
   <p>Each registration requires an independent authorized reviewer and verified private evidence.</p>
  </div><button type="button" disabled={loading||busy||uncertain||pageLoading||detailLoading} onClick={()=>setRefreshVersion(v=>v+1)}>Refresh queue</button></header>
  <form className="form-section" onSubmit={e=>{e.preventDefault();if(!busy&&!uncertain&&!detailLoading&&!pageLoading)setAppliedSearch(searchText.trim());}}>
    <h2>Find registrations</h2>
    <div className="form-grid">
      <label className="field">Search case number or organization
        <input type="search" maxLength={80} value={searchText}
          onChange={e=>setSearchText(e.target.value)} placeholder="Search current registrations"/>
      </label>
      <label className="field">Approval status
        <select value={statusFilter} disabled={busy||uncertain||loading||detailLoading||pageLoading} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="IN_REVIEW">In review</option>
          <option value="PENDING_OWNER">Approved — awaiting application</option>
          <option value="OWNER_COMPLETED">Verified and applied</option>
          <option value="RETURNED">Returned for corrections</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      <label className="field">Registration type
        <select value={kindFilter} disabled={busy||uncertain||loading||detailLoading||pageLoading} onChange={e=>setKindFilter(e.target.value)}>
          <option value="ALL">All healthcare registrations</option>
          <option value="HEALTH_PROVIDER_VERIFICATION">Provider</option>
          <option value="HEALTH_CENTER_VERIFICATION">Center</option>
           <option value="HEALTH_DOCTOR_VERIFICATION">Doctor</option>
        </select>
      </label>
    </div>
    <div className="toolbar">
      <button type="submit" className="primary" disabled={busy||uncertain||loading||detailLoading||pageLoading}>Apply search</button>
      <button type="button" disabled={busy||uncertain||loading||detailLoading||pageLoading} onClick={()=>{
        setStatusFilter("ALL");setKindFilter("ALL");setSearchText("");setAppliedSearch("");
      }}>Reset filters</button>
    </div>
    {!loading&&<p className="muted" role="status">
      {cases.length} matching cases loaded{nextOffset!==null?" — more available":""}.
      These are current original review records, not sample counts.</p>}
  </form>
  {loading&&<p role="status">Checking submitted registrations…</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  {uncertain&&<div role="alert" className="notice">
    The last review action may have succeeded. Refresh the original case before doing anything else.
    <button type="button" disabled={busy||detailLoading||!selectedCase.current} onClick={()=>{if(selectedCase.current)void open(selectedCase.current);}}>Check current case</button>
  </div>}
  {!loading&&!error&&cases.length===0&&<p>No healthcare registrations are awaiting review.</p>}
  <div className="table-wrap"><table><thead><tr><th>Case</th>
   <th>Registration</th><th>Kind</th><th>Status</th><th>Action</th></tr></thead><tbody>
   {!loading&&cases.map(c=><tr key={c.caseRef}>
    <td>{c.reference}</td><td>{c.title}</td>
    <td>{c.kind==="HEALTH_PROVIDER_VERIFICATION"?"Provider":c.kind==="HEALTH_DOCTOR_VERIFICATION"?"Doctor":"Center"}</td>
    <td>{statusText(c.status)}</td><td><button type="button"
     disabled={busy||uncertain||detailLoading||pageLoading} aria-pressed={detail?.caseRef===c.caseRef} onClick={()=>void open(c.caseRef)}>Review</button></td>
   </tr>)}
  </tbody></table></div>
  {nextOffset!==null&&<div className="toolbar">
    <button type="button" disabled={pageLoading||loading||busy||uncertain||detailLoading} onClick={()=>void loadMore()}>
      {pageLoading?"Loading more…":"Load more matching reviews"}</button>
  </div>}
  {detailLoading&&<p role="status">Checking selected registration…</p>}
  {detail&&!detailLoading&&<section className="form-section">
   <h2>{detail.reference}</h2><p>{statusText(detail.kind)} · {statusText(detail.status)}</p>
   {detail.source&&<>
    <h3>Original submitted details</h3>
    <dl>
     {Object.entries(detail.source.source).map(([key,value])=><div key={key}>
      <dt>{statusText(key)}</dt><dd>{safeText(value)}</dd>
     </div>)}
    </dl>
    {detail.kind==="HEALTH_CENTER_VERIFICATION"&&
     typeof detail.source.source.diagnosticLicenseValidThrough==="string"&&
     <p className="cg-diagnostics-note">Diagnostic licence expiry is an
      applicant declaration, not an automatic verification. Compare the
      displayed valid-through date with the original protected licence,
      center identity and date before making the independent Foundation
      decision. Return or reject mismatched or expired evidence.</p>}
    <p>Private evidence: {statusText(detail.source.proofStatus)}</p>
    <a href={(detail.kind==="HEALTH_DOCTOR_VERIFICATION"?"/api/documents/doctor-evidence/reviews/":"/api/documents/health-draft/reviews/")+
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
   {detail.status==="PENDING_OWNER"&&(detail.kind==="HEALTH_DOCTOR_VERIFICATION"?canManageDoctors:canManageProviders)&&<button type="button" className="primary"
      disabled={busy||uncertain} onClick={()=>void apply()}>
     Apply approved registration</button>}
   {(detail.kind==="HEALTH_DOCTOR_VERIFICATION"?canManageDoctors:canManageProviders)&&["RETURNED","REJECTED"].includes(detail.status)&&<button type="button"
      disabled={busy||uncertain} onClick={()=>void returnForCorrection()}>
     Reopen for corrections</button>}
   {!(detail.kind==="HEALTH_DOCTOR_VERIFICATION"?canManageDoctors:canManageProviders)&&["RETURNED","REJECTED"].includes(detail.status)&&
     <p>Only an authorized Foundation registration manager can reopen this application for corrections.</p>}
   <p>Doctor verification does not activate a center association or fee. Only separately approved centers can be published. No approval creates an appointment or payment.</p>
  </section>}
 </div>;
}
