"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {CG04VolunteerReviewCase,CG04VolunteerReviewPage,CG04VolunteerReviewPolicy,CG04VolunteerRosterPage,CG04VolunteerRosterExport} from "@careganga/api-contracts";
import {VolunteerCardManager} from "./volunteer-card-manager";
import {VolunteerReimbursementPanel} from "./volunteer-reimbursement-panel";
import {VolunteerStaffIntake} from "./volunteer-staff-intake";
type Decision="APPROVE"|"RETURN"|"REJECT";
type Pending={ref:string;body:{requestKey:string;expectedRevision:number;action:Decision;remarks:string};digest:string};
const read=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
const reviewBase="/api/volunteers/reviews",rosterBase="/api/volunteers/roster";
const statusOptions=["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"] as const;
const availOptions=["ALL","FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const;
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const res=await fetch(path,{method:body?"POST":"GET",cache:"no-store",signal:AbortSignal.timeout(16000),
  headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
 const value:unknown=await res.json().catch(()=>null);
 if(!res.ok||value===null)throw Object.assign(new Error(value&&typeof value==="object"&&typeof (value as {message?:unknown}).message==="string"?(value as {message:string}).message:"Could not verify the current volunteer record."),{status:res.status});
 return value as T;
}
export function VolunteerStaffWorkspace({canReview,canRoster,canExport,canConfigure,canIssueCards,canReimburse,canImport}:{
 canReview:boolean;canRoster:boolean;canExport:boolean;canConfigure:boolean;canIssueCards:boolean;canReimburse:boolean;canImport:boolean
}){
 const [tab,setTab]=useState<"REVIEW"|"ROSTER">(canReview?"REVIEW":"ROSTER");
 const [policy,setPolicy]=useState<CG04VolunteerReviewPolicy|null>(null),[reviews,setReviews]=useState<CG04VolunteerReviewPage|null>(null);
 const [detail,setDetail]=useState<CG04VolunteerReviewCase|null>(null),[selected,setSelected]=useState<string|null>(null);
 const [roster,setRoster]=useState<CG04VolunteerRosterPage|null>(null);
 const [reimbursementRef,setReimbursementRef]=useState<string|null>(null);
 const [status,setStatus]=useState("ALL"),[availability,setAvailability]=useState("ALL"),[q,setQ]=useState(""),[applied,setApplied]=useState(""),[offset,setOffset]=useState(0);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [action,setAction]=useState<Decision>("APPROVE"),[remarks,setRemarks]=useState(""),[password,setPassword]=useState(""),[configPassword,setConfigPassword]=useState("");
 const pending=useRef<Pending|null>(null),seq=useRef(0),detailSeq=useRef(0);
 const refresh=useCallback(async()=>{
  const id=++seq.current;setLoading(true);
  const params=new URLSearchParams({status,q:applied,offset:String(offset),availability});
  try{
   if(tab==="REVIEW"&&canReview){
    const [p,items]=await Promise.all([api<CG04VolunteerReviewPolicy>(reviewBase+"/policy"),api<CG04VolunteerReviewPage>(reviewBase+"?"+params)]);
    if(id!==seq.current||document.visibilityState!=="visible")return;
    setPolicy(p);setReviews(items);setDetail(null);setSelected(null);
   }else if(canRoster){
    const items=await api<CG04VolunteerRosterPage>(rosterBase+"?"+params);
    if(id!==seq.current||document.visibilityState!=="visible")return;
    setRoster(items);
   }
   if(id===seq.current)setError("");
  }catch(e){if(id===seq.current){setError(e instanceof Error?e.message:"Volunteer data is unavailable.");setReviews(null);setRoster(null);}}
  finally{if(id===seq.current)setLoading(false);}
 },[tab,canReview,canRoster,offset,applied,status,availability]);
 useEffect(()=>{void refresh();return()=>{seq.current++;};},[refresh]);
 useEffect(()=>{
  const visibility=()=>{
   if(document.visibilityState!=="visible"){seq.current++;detailSeq.current++;setDetail(null);setReviews(null);setRoster(null);setPassword("");setConfigPassword("");setRemarks("");setLoading(true);}
   else void refresh();
  };
  document.addEventListener("visibilitychange",visibility);
  return()=>document.removeEventListener("visibilitychange",visibility);
 },[refresh]);
 const choose=async(ref:string)=>{
  if(busy)return;const n=++detailSeq.current;setSelected(ref);setDetail(null);setError("");
  try{const v=await api<CG04VolunteerReviewCase>(reviewBase+"/"+ref);if(document.visibilityState==="visible"&&n===detailSeq.current)setDetail(v);}
  catch(e){setError(e instanceof Error?e.message:"Volunteer review evidence unavailable.");}
 };
 const run=async(work:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{await work();}catch(e){setError(e instanceof Error?e.message:"The outcome is not confirmed. Refresh current status before retrying.");}
  finally{setBusy(false);}
 };
 const configure=()=>void run(async()=>{
  if(!canConfigure||!configPassword)throw Error("Enter the current password for protected Foundation configuration.");
  const policy=await api<CG04VolunteerReviewPolicy>(reviewBase+"/policy",{currentPassword:configPassword});
  setPolicy(policy);setConfigPassword("");setNotice("Original volunteer review process configured.");
 });
 const decide=()=>void run(async()=>{
  if(!detail||!detail.canDecide||detail.status!=="SUBMITTED")throw Error("Only a submitted original case may be independently reviewed.");
  if(action!=="APPROVE"&&remarks.trim().length<3)throw Error("Provide an original review remark for return or rejection.");
  const digest=JSON.stringify([detail.caseRef,detail.revision,action,remarks.trim()]);
  if(!pending.current||pending.current.digest!==digest)pending.current={ref:detail.caseRef,digest,body:{
   requestKey:crypto.randomUUID(),expectedRevision:detail.revision,action,remarks:remarks.trim()
  }};
  const key=pending.current;
  await api(reviewBase+"/"+key.ref+"/decide",{...key.body,currentPassword:password});
  pending.current=null;setPassword("");setRemarks("");setSelected(null);setDetail(null);setNotice("Original independent Foundation volunteer decision recorded.");
  await refresh();
 });
 const exportRoster=()=>void run(async()=>{
  if(!canExport)throw Error("Volunteer export is not permitted.");
  const params=new URLSearchParams({status,q:applied,availability});
  const result=await api<CG04VolunteerRosterExport>(rosterBase+"/export?"+params);
  if(typeof result.csv!=="string"||!Number.isSafeInteger(result.rows))throw Error("Original volunteer export is unavailable.");
  const blob=new Blob([result.csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  try{anchor.href=url;anchor.download="CareGanga-approved-volunteers.csv";anchor.click();}
  finally{window.setTimeout(()=>URL.revokeObjectURL(url),1500);}
  setNotice(result.rows+" permitted approved volunteer records exported.");
 });
 const switchTab=(value:"REVIEW"|"ROSTER")=>{detailSeq.current++;setTab(value);setOffset(0);setApplied("");setQ("");setStatus("ALL");setAvailability("ALL");setDetail(null);setSelected(null);setPassword("");pending.current=null;};
 return <section className="cg04-panel cg04-volunteer-staff" aria-label="Authorized volunteer administration">
  <header><h1>Volunteers</h1><p>Original Foundation volunteer applications, independent reviews and current approved volunteer directory.</p></header>
  <div className="cg04-buttons" role="tablist" aria-label="Volunteer administration">
   {canReview&&<button type="button" role="tab" aria-selected={tab==="REVIEW"} onClick={()=>switchTab("REVIEW")}>Application review</button>}
   {canRoster&&<button type="button" role="tab" aria-selected={tab==="ROSTER"} onClick={()=>switchTab("ROSTER")}>Approved volunteer directory</button>}
  </div>
  {error&&<p role="alert" className="cg04-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {tab==="REVIEW"&&canReview&&policy&&!policy.configured&&<div className="cg04-panel">
   <p>Original independent volunteer review is not yet configured. Draft applications are saved, but cannot be submitted for approval.</p>
   {canConfigure&&<><label>Confirm current Foundation password<input type="password" value={configPassword} onChange={e=>setConfigPassword(e.target.value)}/></label>
    <button type="button" className="cg04-primary" disabled={busy||!configPassword} onClick={configure}>Configure original protected review</button></>}
  </div>}
  <form className="cg04-buttons" onSubmit={e=>{e.preventDefault();setOffset(0);setApplied(q.trim());}}>
   <label>Search visible reference or name<input value={q} maxLength={80} onChange={e=>setQ(e.target.value)}/></label>
   <label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);}}>
    {(tab==="REVIEW"?statusOptions:["ALL","ACTIVE","INACTIVE","SUSPENDED"] as const).map(v=><option key={v} value={v}>{read(v)}</option>)}
   </select></label>
   <label>Availability<select value={availability} onChange={e=>{setAvailability(e.target.value);setOffset(0);}}>
    {availOptions.map(v=><option key={v} value={v}>{read(v)}</option>)}</select></label>
   <button type="submit" disabled={busy}>Apply filters</button>
   <button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh</button>
  </form>
  {loading&&<p role="status">Checking original Foundation volunteer records…</p>}
  {tab==="REVIEW"&&canReview&&!loading&&reviews&&<>
   <div className="cg04-buttons"><strong>Total applications: {reviews.overview.total}</strong><span>Active volunteers: {reviews.overview.active}</span><span>Awaiting review: {reviews.overview.pending}</span><span>Rejected: {reviews.overview.rejected}</span><span>Today: {reviews.overview.today}</span></div>
   {!reviews.items.length&&<p>No original volunteer cases match these filters.</p>}
   <div className="cg04-review-details">{reviews.items.map(v=><article className="cg04-panel" key={v.caseRef}>
    <strong>{v.name}</strong><p>{v.applicationNumber} · {v.reference}</p><p>{read(v.status)} · {v.department} · {read(v.availability)}</p>
    <button type="button" aria-pressed={selected===v.caseRef} onClick={()=>void choose(v.caseRef)}>Review original application</button>
   </article>)}</div>
   <div className="cg04-buttons">{offset>0&&<button type="button" onClick={()=>setOffset(Math.max(0,offset-25))}>Previous cases</button>}
    {reviews.hasMore&&<button type="button" onClick={()=>setOffset(x=>x+25)}>More cases</button>}</div>
   {detail&&<section className="cg04-panel" aria-label="Protected original volunteer review details">
    <h2>{detail.applicationNumber} · {detail.reference}</h2><p>{read(detail.status)} · {detail.department}{detail.branch?" · "+detail.branch:""}</p>
    <h3>Original submitted applicant details</h3>
    <div className="cg04-review-details">
     {(["first_name","last_name","date_of_birth","contact_mobile","contact_email","address_text","city","pin_code","availability","skills","experience","referral_input"] as const).map(key=>
      <p key={key}><strong>{read(key)}</strong>: {typeof detail.source[key]==="string"?String(detail.source[key]):Array.isArray(detail.source[key])?(detail.source[key] as string[]).join(", "):"Not supplied"}</p>)}
    </div>
    <h3>Current original verified identity evidence</h3>
    {detail.files.length?detail.files.map(file=><div key={file.fileRef} className="cg04-buttons">
     <span>{read(file.classification)} · {file.verified?"Verified":"Not currently verified"}</span>
     {file.verified&&["SUBMITTED","PENDING_OWNER"].includes(detail.status)&&<a href={reviewBase+"/"+detail.caseRef+"/files/"+file.fileRef+"/download">Download original private proof</a>}
    </div>):<p>No original protected document was found.</p>}
    <h3>Approval activity</h3>{detail.timeline.map((event,i)=><p key={i}>{read(event.action)} · {event.reviewer} · {new Date(event.occurredAt).toLocaleString("en-IN")}</p>)}
    {detail.canDecide&&detail.status==="SUBMITTED"&&<div className="cg04-panel">
     <h3>Independent protected decision</h3>
     <label>Decision<select value={action} onChange={e=>{setAction(e.target.value as Decision);pending.current=null;}}>
      <option value="APPROVE">Approve original volunteer</option><option value="RETURN">Return for correction</option><option value="REJECT">Reject application</option>
     </select></label>
     <label>Reviewer remarks<textarea value={remarks} maxLength={500} onChange={e=>{setRemarks(e.target.value);pending.current=null;}}/></label>
     <label>Current Foundation password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <p>Approval records the independent original decision. The verified applicant must still confirm volunteer activation.</p>
     <button type="button" className="cg04-primary" disabled={busy||password.length<8} onClick={decide}>Record independent decision</button>
    </div>}
   </section>}
  </>}
  {tab==="ROSTER"&&canRoster&&canImport&&<VolunteerStaffIntake/>}
  {tab==="ROSTER"&&canRoster&&!loading&&roster&&<>
   <div className="cg04-buttons"><strong>Approved volunteers: {roster.overview.total}</strong><span>Active: {roster.overview.active}</span><span>Inactive: {roster.overview.inactive}</span><span>Suspended: {roster.overview.suspended}</span>
    {canExport&&<button type="button" disabled={busy} onClick={exportRoster}>Export permitted CSV</button>}</div>
   {!roster.items.length&&<p>No approved volunteers match your current permitted scope.</p>}
   <div className="cg04-review-details">{roster.items.map(row=><article className="cg04-panel" key={row.ref}>
    <strong>{row.volunteerNumber} · {row.name}</strong><p>{row.department}{row.branch?" · "+row.branch:""} · {read(row.status)}</p>
    <p>{read(row.availability)} · {row.city}, {row.district}</p>
    <p>Joined: {row.joinedOn}</p><p>Contact: {row.mobile}{row.email?" · "+row.email:""}</p><p>Skills: {row.skills.join(", ")||"None recorded"}</p>
    {canIssueCards&&<VolunteerCardManager volunteerRef={row.ref}/>}
    {canReimburse&&<button type="button" disabled={busy} onClick={()=>setReimbursementRef(v=>v===row.ref?null:row.ref)}>
     {reimbursementRef===row.ref?"Close reimbursement":"New reimbursement (U42)"}</button>}
    {canReimburse&&reimbursementRef===row.ref&&<VolunteerReimbursementPanel volunteerRef={row.ref} onClose={()=>setReimbursementRef(null)}/>}

   </article>)}</div>
   <div className="cg04-buttons">{offset>0&&<button type="button" onClick={()=>setOffset(Math.max(0,offset-25))}>Previous volunteers</button>}
    {roster.hasMore&&<button type="button" onClick={()=>setOffset(x=>x+25)}>More volunteers</button>}</div>
  </>}
 </section>;
}
