"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Review={caseRef:string;reference:string;title:string;status:string;revision:number};
type Detail=Review&{capability?:string;centerName?:string;
 validFrom?:string;validUntil?:string|null;independentReviewerRequired:true};
type Grant={centerRef:string;centerName:string;providerName:string;
 capability:string;status:string;version:number;global:string;effective:false;
 approvedCaseRef:string|null;readyToApply:boolean};
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(path,{...init,cache:"no-store",credentials:"same-origin"});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:
  "The original capability review could not be confirmed.");
 return data as T;
}
const nice=(s:string)=>s.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,x=>x.toUpperCase());
export function CenterErpGrantReviews({canReview,canPublish}:{
 canReview:boolean;canPublish:boolean
}){
 const [items,setItems]=useState<Review[]>([]),[current,setCurrent]=useState<Detail|null>(null);
 const [grants,setGrants]=useState<Grant[]>([]);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState(""),[reviewPassword,setReviewPassword]=useState("");
 const [publishPassword,setPublishPassword]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const key=useRef(""),epoch=useRef(0);
 const load=useCallback(async()=>{
  const n=++epoch.current;
  try{
   const [inbox,registered]=await Promise.all([
    canReview?api<{cases:Review[]}>("/api/health/erp-grant-reviews/list"):
     Promise.resolve({cases:[] as Review[]}),
    canPublish?api<{grants:Grant[]}>("/api/health-network/erp-grants/foundation"):
     Promise.resolve({grants:[] as Grant[]})
   ]);
   if(n===epoch.current){setItems(inbox.cases);setGrants(registered.grants);setError("");
     setUncertain(false);}
  }catch(e){if(n===epoch.current)setError(e instanceof Error?
    e.message:"The Foundation capability queue is unavailable.");}
 },[canReview,canPublish]);
 useEffect(()=>{void load();return()=>{epoch.current++;};},[load]);
 async function select(ref:string){
  const n=++epoch.current;setError("");setNotice("");
  try{
   const data=await api<Detail>("/api/health/erp-grant-reviews/"+encodeURIComponent(ref));
   if(n===epoch.current){setCurrent(data);setReviewPassword("");setPublishPassword("");
    setRemarks("");key.current="";}
  }catch(e){if(n===epoch.current)setError(e instanceof Error?
    e.message:"The original case is unavailable.");}
 }
 async function decide(){
  if(!canReview||!current||busy||uncertain||reviewPassword.length<8||
    !["SUBMITTED","IN_REVIEW"].includes(current.status))return;
  if(!key.current)key.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   await api("/api/health/erp-grant-reviews/"+encodeURIComponent(current.caseRef)+"/decide",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:key.current,expectedRevision:current.revision,
      action,remarks,currentPassword:reviewPassword})
   });
   key.current="";setReviewPassword("");await load();await select(current.caseRef);
   setNotice("Independent decision saved in the original Foundation approval case.");
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "Decision uncertain. Check the original case before retrying.");}
  finally{setBusy(false);}
 }
 async function publish(){
  if(!canPublish||!current||busy||uncertain||current.status!=="PENDING_OWNER"||
    publishPassword.length<8)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api("/api/health-network/erp-grants/reviews/"+
    encodeURIComponent(current.caseRef)+"/apply",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:publishPassword})
   });
   setPublishPassword("");await load();await select(current.caseRef);
   setNotice("Center capability approved. Optional ERP operations remain unavailable until the owning module is installed.");
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "The approved grant was not confirmed. Recheck original status.");}
  finally{setBusy(false);}
 }
 async function publishReady(g:Grant){
  if(!canPublish||busy||uncertain||!g.readyToApply||!g.approvedCaseRef||
     publishPassword.length<8)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api("/api/health-network/erp-grants/reviews/"+
    encodeURIComponent(g.approvedCaseRef)+"/apply",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:publishPassword,
      expectedVersion:g.version})
   });
   setPublishPassword("");await load();
   setNotice("Approved center capability recorded. Actual ERP operations remain disabled.");
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "Approved grant outcome uncertain. Check the original state.");}
  finally{setBusy(false);}
 }
 async function changeGrant(g:Grant,operation:"suspend"|"withdraw"){
  if(!canPublish||busy||uncertain||publishPassword.length<8)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api("/api/health-network/erp-grants/foundation/"+
    encodeURIComponent(g.centerRef)+"/"+encodeURIComponent(g.capability)+"/"+operation,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:publishPassword,expectedVersion:g.version})
   });
   setPublishPassword("");await load();
   setNotice("Optional center capability was "+(operation==="suspend"?"suspended":"withdrawn")+
    ". No separate ERP module has been enabled.");
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "This capability change is uncertain. Recheck original state.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-labelledby="erp-grants-heading">
  <h1 id="erp-grants-heading">Optional healthcare capability approvals</h1>
  <p>Partner operations are separately installed and disabled by default.
   This page authorizes a center only; it does not create pharmacy stock,
   laboratory orders, nursing tasks or operation theatre appointments.</p>
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void load()}>Refresh original queue</button>
  {uncertain&&<p role="alert">A recent change may already be recorded. Refresh
   the original case before retrying.</p>}
  {canReview&&<>
   <h2>Independent CG-03 approval cases</h2>
   {items.length===0&&<p>No capability reviews are currently available.</p>}
   <div className="toolbar">{items.map(c=><button type="button" key={c.caseRef}
    onClick={()=>void select(c.caseRef)} disabled={busy}
    aria-pressed={current?.caseRef===c.caseRef}>
     {c.title} · {nice(c.status)} · {c.reference}
    </button>)}</div>
   {current&&<section className="permission-group" aria-label="Original review details">
    <h3>{current.title}</h3>
    <p>State: {nice(current.status)}. {current.centerName??""}.
     {current.capability?nice(current.capability):""}.
    </p>
    {current.validFrom&&<p>Proposed effective from:
      {new Date(current.validFrom).toLocaleDateString("en-IN")}.
      {current.validUntil?" Until "+new Date(current.validUntil).toLocaleDateString("en-IN"):""}
    </p>}
    {["SUBMITTED","IN_REVIEW"].includes(current.status)&&<div className="form-grid">
     <label>Independent decision
      <select value={action} disabled={busy} onChange={e=>{
       setAction(e.target.value as typeof action);key.current="";}}>
       <option value="APPROVE">Approve source request</option>
       <option value="RETURN">Return for correction</option>
       <option value="REJECT">Reject request</option>
      </select></label>
     <label>Remarks <textarea rows={3} maxLength={500} value={remarks}
      disabled={busy} onChange={e=>{setRemarks(e.target.value);key.current="";}}/></label>
     <label>Current Foundation password (review decision)
      <input type="password" autoComplete="current-password"
       value={reviewPassword} disabled={busy}
       onChange={e=>setReviewPassword(e.target.value)}/></label>
     <button type="button" onClick={()=>void decide()}
      disabled={busy||uncertain||reviewPassword.length<8}>
      Record independent decision</button>
    </div>}
    {current.status==="PENDING_OWNER"&&canPublish&&
     <button type="button" disabled={busy||uncertain||publishPassword.length<8}
      onClick={()=>void publish()}>Apply approved center grant</button>}
   </section>}
  </>}
  {canPublish&&<div className="form-grid">
   <label>Current Foundation password for protected publication/suspension
    <input type="password" value={publishPassword} disabled={busy}
     autoComplete="current-password" onChange={e=>setPublishPassword(e.target.value)}/>
   </label>
  </div>}
  <h2>Actual center permission ledger</h2>
  {grants.length===0&&<p>No center has requested optional ERP access.</p>}
  <div className="role-table-wrap"><table className="role-table">
   <thead><tr><th>Center</th><th>Capability</th><th>Permission</th>
    <th>Deployment</th><th>Action</th></tr></thead>
   <tbody>{grants.map(g=><tr key={g.centerRef+g.capability}>
    <td>{g.centerName} · {g.providerName}</td><td>{nice(g.capability)}</td>
    <td>{nice(g.status)}</td>
    <td>{nice(g.global)} · No module enabled</td>
    <td>{canPublish&&<div className="toolbar">
     {g.readyToApply&&g.approvedCaseRef&&
      <button type="button" disabled={busy||uncertain||publishPassword.length<8}
       onClick={()=>void publishReady(g)}>Apply independently approved grant</button>}
     {g.status==="APPROVED"&&<button type="button" disabled={busy||uncertain||
      publishPassword.length<8} onClick={()=>void changeGrant(g,"suspend")}>
       Suspend</button>}
     {g.status!=="WITHDRAWN"&&<button type="button" disabled={busy||uncertain||
      publishPassword.length<8} onClick={()=>void changeGrant(g,"withdraw")}>
       Withdraw</button>}
    </div>}</td>
   </tr>)}</tbody>
  </table></div>
 </section>;
}
