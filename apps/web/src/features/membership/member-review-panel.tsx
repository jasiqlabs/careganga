"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import type {CG04ReviewPolicy,CG04ReviewPage,CG04ReviewCase,CG04ReviewDecisionResult} from "@careganga/api-contracts";
type Pending={url:string;body:{requestKey:string;expectedRevision:number;action:"APPROVE"|"RETURN"|"REJECT";remarks:string}};
const base="/api/membership/reviews";
async function req<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+path,{method:body?"POST":"GET",body:body?JSON.stringify(body):undefined,
  headers:body?{"Content-Type":"application/json"}:undefined,cache:"no-store",signal:AbortSignal.timeout(14000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data===null)throw Object.assign(new Error(typeof data?.message==="string"?data.message:"Membership review could not be confirmed."),{status:r.status});
 return data as T;
}
const statuses=["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"] as const;
const detailTabs=[
 {key:"OVERVIEW",label:"Overview"},
 {key:"PERSONAL",label:"Personal Info"},
 {key:"MEMBERSHIP",label:"Membership Details"},
 {key:"DOCUMENTS",label:"Documents"},
 {key:"PAYMENT",label:"Payment & Donation"},
 {key:"GENERATED",label:"Generated Documents",pending:true},
 {key:"WORKFLOW",label:"Approval Workflow"},
 {key:"COMMUNICATION",label:"Communication",pending:true},
 {key:"ACTIVITY",label:"Activity Log"}
] as const;
type DetailTab=typeof detailTabs[number]["key"];
const money=(minor:string)=>{if(!/^\d{1,15}$/.test(minor))return "Unavailable";const v=BigInt(minor);return (v/100n).toString()+"."+String(v%100n).padStart(2,"0");};
const readable=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
export function MemberReviewPanel({canConfigure=false}:{canConfigure?:boolean}){
 const [policy,setPolicy]=useState<CG04ReviewPolicy|null>(null),[page,setPage]=useState<CG04ReviewPage|null>(null),[detail,setDetail]=useState<CG04ReviewCase|null>(null);
 const [detailTab,setDetailTab]=useState<DetailTab>("OVERVIEW");
 const [status,setStatus]=useState<string>("ALL"),[offset,setOffset]=useState(0),[selected,setSelected]=useState<string|null>(null),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE"),[remarks,setRemarks]=useState(""),[password,setPassword]=useState(""),[retryPassword,setRetryPassword]=useState(""),[configPassword,setConfigPassword]=useState("");
 const pending=useRef<Pending|null>(null),seq=useRef(0);
 useEffect(()=>{
  const n=++seq.current;setLoading(true);setError("");
  void Promise.all([req<CG04ReviewPolicy>("/policy"),req<CG04ReviewPage>("?"+new URLSearchParams({status,offset:String(offset)}))])
   .then(([p,list])=>{if(n===seq.current){setPolicy(p);setPage(list);if(!list.items.some(x=>x.caseRef===selected))setSelected(null);}})
   .catch(e=>{if(n===seq.current){setPage(null);setError(e.message);if(e.status===401)window.location.assign("/admin/login");}})
   .finally(()=>{if(n===seq.current)setLoading(false);});
  return()=>{seq.current++;};
 },[status,offset,epoch]);
 useEffect(()=>{
  if(!selected){setDetail(null);return;}let active=true;setDetail(null);
  void req<CG04ReviewCase>("/"+selected).then(v=>{if(active)setDetail(v);})
   .catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
 },[selected,epoch]);
 const refresh=()=>setEpoch(x=>x+1);
 async function configure(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError("");setNote("");
  try{const result=await req<CG04ReviewPolicy>("/policy",{currentPassword:configPassword});
   setPolicy(result);setConfigPassword("");setNote("Original protected membership approval workflow configured.");refresh();
  }catch(e){setError(e instanceof Error?e.message:"Workflow configuration cannot be confirmed.");}
  finally{setBusy(false);setConfigPassword("");}
 }
 const send=async(cmd:Pending,enteredPassword:string)=>{
  if(busy)return;setBusy(true);setError("");setNote("");pending.current=cmd;
  try{const result=await req<CG04ReviewDecisionResult>(cmd.url,{...cmd.body,currentPassword:enteredPassword});
   pending.current=null;setPassword("");setRemarks("");setAction("APPROVE");
   setNote(result.status==="PENDING_OWNER"?"Decision approved. Membership remains pending until the original fee and owner activation are verified.":"Decision recorded as "+result.status+".");
   refresh();
  }catch(e){setError(e instanceof Error?e.message:"Decision result uncertain. Refresh the case before retrying.");}
  finally{setBusy(false);setPassword("");setRetryPassword("");}
 };
 const submit=(e:FormEvent)=>{e.preventDefault();if(!detail||!detail.canDecide||busy||pending.current)return;
  if((action!=="APPROVE"&&remarks.trim().length<3)||password.length<8){setError("Provide a reason for return/reject and your current password.");return;}
  const cmd:Pending={url:"/"+detail.caseRef+"/decide",body:{requestKey:crypto.randomUUID(),expectedRevision:detail.revision,action,remarks:remarks.trim()}};
  void send(cmd,password);
 };
 return <section className="cg04-admin cg04-review"><header className="cg04-header"><div><small>REGISTRATION &amp; APPROVAL</small><h1>Membership Applications</h1><p className="cg04-muted">Review only the original verified applicant and protected case evidence. Approval alone does not activate a member.</p></div></header>
 {!!error&&<p role="alert" className="cg04-error">{error}</p>}{!!note&&<p role="status" className="cg04-panel">{note}</p>}
 {policy&&!policy.configured&&<section className="cg04-panel"><h2>Membership review not configured</h2><p>Applications remain saved but cannot enter review until the protected Foundation approval workflow is configured.</p>
 {canConfigure&&<form onSubmit={e=>void configure(e)}><label>Confirm your current Foundation password<input type="password" required minLength={8} value={configPassword} onChange={e=>setConfigPassword(e.target.value)}/></label><button className="cg04-primary" disabled={busy}>Configure original CG-03 approval</button></form>}
 {!canConfigure&&<p>Ask an authorized Foundation administrator to configure the review process.</p>}</section>}
 <section className="cg04-panel"><div className="cg04-buttons"><label>Application status<select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);setSelected(null);setDetail(null);setPassword("");}}>{statuses.map(s=><option key={s} value={s}>{s==="ALL"?"All application statuses":s.replaceAll("_"," ")}</option>)}</select></label><button type="button" disabled={busy||loading} onClick={refresh}>Refresh</button></div>
 {loading?<p role="status">Checking current protected registration cases…</p>:page?<><div className="cg04-roster-scroll" role="region" aria-label="Membership review applications" tabIndex={0}><table><thead><tr><th>Application</th><th>Applicant</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>
 {page.items.map(c=><tr key={c.caseRef}><td>{c.reference}</td><td>{c.name}</td><td>{c.status.replaceAll("_"," ")}</td><td>{new Date(c.submittedAt).toLocaleDateString("en-IN")}</td><td><button type="button" onClick={()=>{setDetail(null);setSelected(c.caseRef);setDetailTab("OVERVIEW");setPassword("");setRemarks("");setAction("APPROVE");}} aria-pressed={selected===c.caseRef}>View application</button></td></tr>)}
 {!page.items.length&&<tr><td colSpan={5}>No membership cases match this permitted status.</td></tr>}</tbody></table></div>
 <div className="cg04-buttons"><button type="button" disabled={busy||offset===0} onClick={()=>{setOffset(Math.max(0,offset-25));setSelected(null);}}>Previous</button><button type="button" disabled={busy||!page.hasMore} onClick={()=>{setOffset(x=>x+25);setSelected(null);}}>Next</button></div></>:<p>No review data available.</p>}
 </section>
 {selected&&detail&&detail.caseRef===selected&&<section className="cg04-panel cg04-review-detail" aria-label="Protected membership application details">
 <header><h2>Review {detail.reference}</h2><p>Status: <strong>{readable(detail.status)}</strong> · {detail.source.applicationNumber}</p></header>
 <nav className="cg04-review-tabs" role="tablist" aria-label="Applicant details">
  {detailTabs.map(t=><button key={t.key} type="button" role="tab"
   aria-selected={detailTab===t.key} disabled={"pending" in t&&t.pending}
   title={"pending" in t&&t.pending?"Awaiting original approved source integration":undefined}
   onClick={()=>{setDetailTab(t.key);setPassword("");}}>{t.label}{"pending" in t&&t.pending?" (pending)":""}</button>)}
 </nav>
 <div role="tabpanel" className="cg04-review-tab-panel">
 {detailTab==="OVERVIEW"&&<div className="cg04-review-details">
  <div><strong>Applicant</strong><p>{detail.source.name}</p><p>{detail.source.applicationNumber}</p></div>
  <div><strong>Membership</strong><p>{detail.source.plan}</p><p>{readable(detail.source.category)} · {detail.source.branch??"Foundation"}</p></div>
  <div><strong>Original approval</strong><p>{readable(detail.status)}</p><p>Documents verified: {detail.files.filter(f=>f.verified).length} of {detail.files.length}</p></div>
  <div><strong>Verified payment state</strong><p>{readable(detail.fee.paymentStatus)}</p><p>Accepted joining fee: {detail.source.currency} {money(detail.source.feeMinor)}</p></div>
 </div>}
 {detailTab==="PERSONAL"&&<div className="cg04-review-details">
  <div><strong>Contact</strong><p>{detail.source.name}</p><p>{detail.source.mobile}</p><p>{detail.source.email??"No email provided"}</p></div>
  <div><strong>Registered address</strong><p>{detail.source.address}</p><p>{detail.source.city} · {detail.source.pinCode}</p><p>{detail.source.district??"District not available"}, {detail.source.state??"State not available"}</p></div>
  <div><strong>Consent</strong><p>Policy: {detail.source.consentVersion}</p><p>Recorded: {new Date(detail.source.consentedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p></div>
  <div><strong>Referral</strong><p>{detail.source.referral||"No referral entered"}</p></div>
 </div>}
 {detailTab==="MEMBERSHIP"&&<div className="cg04-review-details">
  <div><strong>Selected tier</strong><p>{detail.source.plan}</p><p>{readable(detail.source.category)}</p></div>
  <div><strong>Duration</strong><p>{detail.source.durationUnit==="LIFETIME"?"Lifetime":detail.source.durationCount+" "+readable(detail.source.durationUnit)+(detail.source.durationCount===1?"":"s")}</p></div>
  <div><strong>Branch</strong><p>{detail.source.branch??"Foundation"}</p></div>
  <div><strong>Accepted fee</strong><p>{detail.source.currency} {money(detail.source.feeMinor)}</p><p>The original accepted amount never changes with new tier prices.</p></div>
 </div>}
 {detailTab==="DOCUMENTS"&&<><h3>Protected original evidence</h3>
  {detail.files.length===0?<p>No verified evidence is attached to this review.</p>:
   <div className="cg04-buttons">{detail.files.map(file=><div key={file.fileRef} className="cg04-panel"><p>{readable(file.classification)} · {file.verified?"Verified":"No longer current"}</p>
    {file.verified&&<a href={base+"/"+detail.caseRef+"/files/"+file.fileRef+"/download"}>Download protected proof</a>}
   </div>)}</div>}
 </>}
 {detailTab==="PAYMENT"&&<><h3>Membership fee verification</h3>
  <div className="cg04-review-details">
   <div><strong>Accepted fee</strong><p>{detail.source.currency} {money(detail.fee.feeMinor)}</p></div>
   <div><strong>Payment status</strong><p>{readable(detail.fee.paymentStatus)}</p></div>
   <div><strong>Bank verified amount</strong><p>{detail.fee.currency} {money(detail.fee.verifiedMinor)}</p></div>
   <div><strong>Refund status</strong><p>{detail.fee.refundRequired?"Verified original fee requires a refund":detail.fee.paymentStatus==="REFUNDED"?"Verified refund completed":"No outstanding verified refund indicated"}</p></div>
  </div><p className="cg04-muted">Only the existing CG-09 verified finance source can confirm payment or refund. Donation records belong to Finance and are not inferred from membership fees.</p>
 </>}
 {detailTab==="WORKFLOW"&&<><h3>Current protected review</h3><p>Status: {readable(detail.status)}. Approval alone does not issue membership or confirm payment.</p>
 {detail.canDecide&&<form className="cg04-review-decision" onSubmit={submit}><h3>Independent protected decision</h3><label>Decision<select value={action} onChange={e=>setAction(e.target.value as typeof action)}><option value="APPROVE">Approve (pending owner completion)</option><option value="RETURN">Return for correction</option><option value="REJECT">Reject</option></select></label>
 <label>Reason / reviewer remarks<textarea value={remarks} onChange={e=>setRemarks(e.target.value)} maxLength={500} required={action!=="APPROVE"}/></label>
 <label>Current Foundation password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label>
 <button type="submit" className="cg04-primary" disabled={busy||!!pending.current}>Confirm protected decision</button></form>}
 {!detail.canDecide&&<p className="cg04-muted">No decision action is available to your role or in the current case status.</p>}
 </>}
 {detailTab==="ACTIVITY"&&<><h3>Original review history</h3><ol>
  {detail.timeline.map((event,i)=><li key={i}>{readable(event.action)} · {event.reviewer} · {new Date(event.occurredAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</li>)}
 </ol>{detail.timeline.length===0&&<p>No committed review events are available.</p>}</>}
 </div>
 </section>}
 {pending.current&&<section className="cg04-panel" role="status"><p>The decision outcome is uncertain. Check the current case before retrying the exact original request.</p><button disabled={busy} onClick={refresh}>Refresh case</button><label>Re-enter current password to verify the original decision<input type="password" value={retryPassword} onChange={e=>setRetryPassword(e.target.value)} minLength={8}/></label><button disabled={busy||retryPassword.length<8} onClick={()=>void send(pending.current!,retryPassword)}>Retry original decision</button></section>}
 </section>;
}
