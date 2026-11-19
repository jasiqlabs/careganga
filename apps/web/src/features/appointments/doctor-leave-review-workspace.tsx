"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Case={caseRef:string;reference:string;status:string;revision:number;title:string};
type Detail=Case&{doctorName?:string;startAt?:string;endAt?:string;
 reason?:string;requiresIndependentReviewer:true};
type Approved={caseRef:string;reference:string;doctorName:string;
 centerName:string;exceptionVersion:number;startAt:string;endAt:string;
 affectedCount:number;affectedBookingIds:string[]};
type Applied={status:string;impactedBookingIds?:string[];
 moreImpactedBookings?:boolean;message?:string};
type Decision="APPROVE"|"RETURN"|"REJECT";
async function fetchJson<T>(route:string,method:"GET"|"POST"="GET",data?:object){
 const res=await fetch(route,{method,credentials:"same-origin",cache:"no-store",
  ...(data?{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}:{})});
 const value:unknown=await res.json().catch(()=>null);
 if(!res.ok)throw Object.assign(new Error(value&&typeof value==="object"&&
  "message" in value&&typeof value.message==="string"?value.message:
  "The original leave review could not be verified."),{status:res.status});
 return value as T;
}
const status=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
const timestamp=(s:string)=>new Date(s).toLocaleString("en-IN");
export function DoctorLeaveReviewWorkspace({canReview,canManage}:{
 canReview:boolean;canManage:boolean
}){
 const [cases,setCases]=useState<Case[]>([]),[ready,setReady]=useState<Approved[]>([]);
 const [detail,setDetail]=useState<Detail|null>(null),[decision,setDecision]=useState<Decision>("APPROVE");
 const [remarks,setRemarks]=useState(""),[reviewPassword,setReviewPassword]=useState("");
 const [publishPassword,setPublishPassword]=useState("");
 const [impactAcknowledged,setImpactAcknowledged]=useState("");
 const [appliedImpact,setAppliedImpact]=useState<Applied|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const decisionKey=useRef(""),applyKey=useRef(""),applyTarget=useRef("");
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const epoch=++generation.current;
  try{
   const [reviews,approved]=await Promise.all([
    canReview?fetchJson<{cases:Case[]}>("/api/health/doctor-leave-reviews/list"):
      Promise.resolve({cases:[] as Case[]}),
    canManage?fetchJson<{requests:Approved[]}>("/api/appointments/schedules/leave/ready"):
      Promise.resolve({requests:[] as Approved[]})
   ]);
   if(epoch!==generation.current)return;
   setCases(reviews.cases);setReady(approved.requests);setError("");setUncertain(false);
  }catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:
   "The original leave approvals could not be confirmed.");}
 },[canReview,canManage]);
 useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
 async function open(ref:string){
  const epoch=++generation.current;setError("");
  try{
   const row=await fetchJson<Detail>("/api/health/doctor-leave-reviews/"+encodeURIComponent(ref));
   if(epoch===generation.current){setDetail(row);setRemarks("");setReviewPassword("");
    decisionKey.current="";}
  }catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:
   "The current original leave source is unavailable.");}
 }
 async function decide(){
  if(!detail||!canReview||busy||uncertain||reviewPassword.length<8||
    !["SUBMITTED","IN_REVIEW"].includes(detail.status))return;
  if(!decisionKey.current)decisionKey.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   await fetchJson("/api/health/doctor-leave-reviews/"+
    encodeURIComponent(detail.caseRef)+"/decide","POST",{
    requestKey:decisionKey.current,expectedRevision:detail.revision,
    action:decision,remarks,currentPassword:reviewPassword
   });
   decisionKey.current="";setReviewPassword("");
   await load();await open(detail.caseRef);
   setNotice("The independent reviewer decision is recorded in the original Foundation approval case.");
  }catch(e){setError(e instanceof Error?e.message:"Decision outcome uncertain.");
   if(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500))setUncertain(true);
  }finally{setBusy(false);}
 }
 async function apply(item:Approved){
  if(!canManage||busy||uncertain||publishPassword.length<8||
   (item.affectedCount>0&&impactAcknowledged!==item.caseRef))return;
  if(!applyKey.current||applyTarget.current!==item.caseRef){
   applyKey.current=crypto.randomUUID();applyTarget.current=item.caseRef;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const saved=await fetchJson<Applied>("/api/appointments/schedules/leave/"+
    encodeURIComponent(item.caseRef)+"/apply","POST",{
    requestKey:applyKey.current,expectedVersion:item.exceptionVersion,
    currentPassword:publishPassword
   });
   applyKey.current="";applyTarget.current="";setPublishPassword("");
   setImpactAcknowledged("");await load();
   setAppliedImpact(saved);
   setNotice(saved.message??"Approved doctor leave was applied to the current source.");
  }catch(e){setError(e instanceof Error?e.message:"Application outcome uncertain.");
   if(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500))setUncertain(true);
  }finally{setBusy(false);}
 }
 return <section className="role-workspace" aria-labelledby="doctor-leave-heading">
  <h1 id="doctor-leave-heading">Doctor Leave & Schedule Approvals</h1>
  <p>CareGanga keeps the review decision and actual doctor-time blocking separate.
   Pending leave never silently cancels an existing booking.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  <div className="toolbar"><button type="button" disabled={busy}
   onClick={()=>void load()}>Refresh original cases</button></div>
  {uncertain&&<p role="alert">The result is uncertain. Refresh original
   leave status before submitting a different request.</p>}
  {canReview&&<div className="form-section">
   <h2>Independent CG-03 reviewer</h2>
   {cases.length===0&&<p>No original doctor leave reviews available.</p>}
   <div className="toolbar">{cases.map(c=><button type="button"
     key={c.caseRef} disabled={busy}
     aria-pressed={detail?.caseRef===c.caseRef}
     onClick={()=>void open(c.caseRef)}>
     {c.title} · {status(c.status)} · {c.reference}</button>)}</div>
   {detail&&<section aria-label="Original doctor leave review">
    <h3>{detail.title}</h3>
    <p>Original case: {detail.reference}. Status: {status(detail.status)}.</p>
    {detail.startAt&&detail.endAt&&<>
     <p>Doctor: {detail.doctorName}. Requested leave:
      {timestamp(detail.startAt)} to {timestamp(detail.endAt)}.</p>
     <p>Reason (protected): {detail.reason}</p>
    </>}
    {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&
     <div className="form-grid">
      <label>Independent decision
       <select value={decision} disabled={busy}
        onChange={e=>{setDecision(e.target.value as Decision);decisionKey.current="";}}>
        <option value="APPROVE">Approve</option>
        <option value="RETURN">Return for correction</option>
        <option value="REJECT">Reject</option>
       </select></label>
      <label>Reviewer remarks (optional)
       <textarea rows={2} value={remarks} maxLength={500} disabled={busy}
        onChange={e=>{setRemarks(e.target.value);decisionKey.current="";}}/>
      </label>
      <label>Current protected Foundation password
       <input type="password" autoComplete="current-password" value={reviewPassword}
        disabled={busy} onChange={e=>setReviewPassword(e.target.value)}/>
      </label>
      <button type="button" disabled={busy||uncertain||reviewPassword.length<8}
       onClick={()=>void decide()}>Record independent CG-03 decision</button>
     </div>}
   </section>}
  </div>}
  {canManage&&<div className="form-section">
   <h2>Apply independently approved doctor leave</h2>
   <p>Foundation schedule management does not provide the independent
    reviewer permission. Only previously approved original cases appear below.</p>
   <label>Current Foundation password for protected leave application
    <input type="password" autoComplete="current-password" value={publishPassword}
     disabled={busy} onChange={e=>setPublishPassword(e.target.value)}/>
   </label>
   {ready.length===0&&<p role="status">No approved doctor leave awaits application.</p>}
   {appliedImpact?.status==="ACTIVE"&&
    <div className="notice" role="status">
     <p>{appliedImpact.message}</p>
     {!!appliedImpact.impactedBookingIds?.length&&
      <p><strong>Confirmed bookings requiring individual follow-up:</strong>
       {" "+appliedImpact.impactedBookingIds.join(", ")}
       {appliedImpact.moreImpactedBookings?" (additional bookings exist; review full current center list)":""}
      </p>}
    </div>}
   <div className="role-table-wrap"><table className="role-table">
    <thead><tr><th>Doctor and center</th><th>Approved dates</th>
     <th>Original case</th><th>Confirmed bookings affected</th><th>Action</th></tr></thead>
    <tbody>{ready.map(item=><tr key={item.caseRef}>
     <td>{item.doctorName} — {item.centerName}</td>
     <td>{timestamp(item.startAt)} to {timestamp(item.endAt)}</td>
     <td>{item.reference}</td>
     <td>{item.affectedCount>0?<details>
       <summary>{item.affectedCount} existing appointment(s)</summary>
       <p>Booking references: {item.affectedBookingIds.join(", ")}
        {item.affectedCount>item.affectedBookingIds.length?
         " (more bookings exist; review the current H15 booking list)":""}</p>
       <p>None of these bookings will be automatically cancelled or notified.</p>
      </details>:"None"}</td>
     <td>{item.affectedCount>0&&
      <label><input type="checkbox" checked={impactAcknowledged===item.caseRef}
       disabled={busy||uncertain} onChange={e=>setImpactAcknowledged(e.target.checked?item.caseRef:"")}/>
       I reviewed the affected bookings and will arrange individual follow-up
      </label>}
      <button type="button" disabled={busy||uncertain||
       publishPassword.length<8||(item.affectedCount>0&&impactAcknowledged!==item.caseRef)}
       onClick={()=>void apply(item)}>
       Apply approved leave</button></td>
    </tr>)}</tbody>
   </table></div>
  </div>}
 </section>;
}
