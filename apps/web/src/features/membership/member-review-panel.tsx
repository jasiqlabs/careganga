"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import type {CG04ReviewPolicy,CG04ReviewPage,CG04ReviewCase,CG04ReviewDecisionResult} from "@careganga/api-contracts";
type Pending={url:string;body:{requestKey:string;expectedRevision:number;action:"APPROVE"|"RETURN"|"REJECT";remarks:string;currentPassword:string}};
const base="/api/membership/reviews";
async function req<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+path,{method:body?"POST":"GET",body:body?JSON.stringify(body):undefined,
  headers:body?{"Content-Type":"application/json"}:undefined,cache:"no-store",signal:AbortSignal.timeout(14000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data===null)throw Object.assign(new Error(typeof data?.message==="string"?data.message:"Membership review could not be confirmed."),{status:r.status});
 return data as T;
}
const statuses=["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"] as const;
export function MemberReviewPanel({canConfigure=false}:{canConfigure?:boolean}){
 const [policy,setPolicy]=useState<CG04ReviewPolicy|null>(null),[page,setPage]=useState<CG04ReviewPage|null>(null),[detail,setDetail]=useState<CG04ReviewCase|null>(null);
 const [status,setStatus]=useState<string>("ALL"),[offset,setOffset]=useState(0),[selected,setSelected]=useState<string|null>(null),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE"),[remarks,setRemarks]=useState(""),[password,setPassword]=useState(""),[configPassword,setConfigPassword]=useState("");
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
  finally{setBusy(false);}
 }
 const send=async(cmd:Pending)=>{
  if(busy)return;setBusy(true);setError("");setNote("");pending.current=cmd;
  try{const result=await req<CG04ReviewDecisionResult>(cmd.url,cmd.body);
   pending.current=null;setPassword("");setRemarks("");setAction("APPROVE");
   setNote(result.status==="PENDING_OWNER"?"Decision approved. Membership remains pending until the original fee and owner activation are verified.":"Decision recorded as "+result.status+".");
   refresh();
  }catch(e){setError(e instanceof Error?e.message:"Decision result uncertain. Refresh the case before retrying.");}
  finally{setBusy(false);setPassword("");}
 };
 const submit=(e:FormEvent)=>{e.preventDefault();if(!detail||!detail.canDecide||busy||pending.current)return;
  if((action!=="APPROVE"&&remarks.trim().length<3)||password.length<8){setError("Provide a reason for return/reject and your current password.");return;}
  const cmd:Pending={url:"/"+detail.caseRef+"/decide",body:{requestKey:crypto.randomUUID(),expectedRevision:detail.revision,action,remarks:remarks.trim(),currentPassword:password}};
  void send(cmd);
 };
 return <section className="cg04-admin cg04-review"><header className="cg04-header"><div><small>REGISTRATION &amp; APPROVAL</small><h1>Membership Applications</h1><p className="cg04-muted">Review only the original verified applicant and protected case evidence. Approval alone does not activate a member.</p></div></header>
 {!!error&&<p role="alert" className="cg04-error">{error}</p>}{!!note&&<p role="status" className="cg04-panel">{note}</p>}
 {policy&&!policy.configured&&<section className="cg04-panel"><h2>Membership review not configured</h2><p>Applications remain saved but cannot enter review until the protected Foundation approval workflow is configured.</p>
 {canConfigure&&<form onSubmit={e=>void configure(e)}><label>Confirm your current Foundation password<input type="password" required minLength={8} value={configPassword} onChange={e=>setConfigPassword(e.target.value)}/></label><button className="cg04-primary" disabled={busy}>Configure original CG-03 approval</button></form>}
 {!canConfigure&&<p>Ask an authorized Foundation administrator to configure the review process.</p>}</section>}
 <section className="cg04-panel"><div className="cg04-buttons"><label>Application status<select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);setSelected(null);}}>{statuses.map(s=><option key={s} value={s}>{s==="ALL"?"All application statuses":s.replaceAll("_"," ")}</option>)}</select></label><button type="button" disabled={busy||loading} onClick={refresh}>Refresh</button></div>
 {loading?<p role="status">Checking current protected registration cases…</p>:page?<><div className="cg04-roster-scroll" role="region" aria-label="Membership review applications" tabIndex={0}><table><thead><tr><th>Application</th><th>Applicant</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>
 {page.items.map(c=><tr key={c.caseRef}><td>{c.reference}</td><td>{c.name}</td><td>{c.status.replaceAll("_"," ")}</td><td>{new Date(c.submittedAt).toLocaleDateString("en-IN")}</td><td><button type="button" onClick={()=>setSelected(c.caseRef)} aria-pressed={selected===c.caseRef}>View application</button></td></tr>)}
 {!page.items.length&&<tr><td colSpan={5}>No membership cases match this permitted status.</td></tr>}</tbody></table></div>
 <div className="cg04-buttons"><button type="button" disabled={busy||offset===0} onClick={()=>{setOffset(Math.max(0,offset-25));setSelected(null);}}>Previous</button><button type="button" disabled={busy||!page.hasMore} onClick={()=>{setOffset(x=>x+25);setSelected(null);}}>Next</button></div></>:<p>No review data available.</p>}
 </section>
 {selected&&detail&&<section className="cg04-panel"><h2>Review {detail.reference}</h2><p>Status: <strong>{detail.status.replaceAll("_"," ")}</strong> · {detail.source.applicationNumber}</p>
 <div className="cg04-review-details"><div><strong>Applicant</strong><p>{detail.source.name}</p><p>{detail.source.mobile}</p><p>{detail.source.email??"No email provided"}</p></div>
 <div><strong>Address</strong><p>{detail.source.address}, {detail.source.city} – {detail.source.pinCode}</p></div><div><strong>Accepted fee</strong><p>{detail.source.currency} {Number(detail.source.feeMinor)/100}</p></div></div>
 <h3>Verified private evidence</h3><div className="cg04-buttons">{detail.files.map(file=><div key={file.fileRef} className="cg04-panel"><p>{file.classification.replaceAll("_"," ")} · {file.verified?"Verified":"Not current"}</p>{file.verified&&<a href={base+"/"+detail.caseRef+"/files/"+file.fileRef+"/download"}>Download protected proof</a>}</div>)}</div>
 <h3>Original review history</h3><ol>{detail.timeline.map((event,i)=><li key={i}>{event.action.replaceAll("_"," ")} · {event.reviewer} · {new Date(event.occurredAt).toLocaleString("en-IN")}</li>)}</ol>
 {detail.canDecide&&<form className="cg04-review-decision" onSubmit={submit}><h3>Independent protected decision</h3><label>Decision<select value={action} onChange={e=>setAction(e.target.value as typeof action)}><option value="APPROVE">Approve (pending owner completion)</option><option value="RETURN">Return for correction</option><option value="REJECT">Reject</option></select></label>
 <label>Reason / reviewer remarks<textarea value={remarks} onChange={e=>setRemarks(e.target.value)} maxLength={500} required={action!=="APPROVE"}/></label>
 <label>Current Foundation password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label>
 <button type="submit" className="cg04-primary" disabled={busy||!!pending.current}>Confirm protected decision</button></form>}
 </section>}
 {pending.current&&<section className="cg04-panel" role="status"><p>The decision outcome is uncertain. Check the current case before retrying the exact original request.</p><button disabled={busy} onClick={refresh}>Refresh case</button><button disabled={busy} onClick={()=>void send(pending.current!)}>Retry original decision</button></section>}
 </section>;
}
