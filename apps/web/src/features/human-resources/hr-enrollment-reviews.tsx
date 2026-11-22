"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Case={caseRef:string;reference:string;name:string;status:string;
 revision:number;canReview:boolean};
type Detail={caseRef:string;reference:string;revision:number;name:string;
 status:string;designation:string;employmentType:string;canDecide:boolean;canReadProof:boolean;timeline?:{action:string;step:number;occurredAt:string}[];
 evidence:Array<{classification:string;verified:boolean}>};
const originalStatuses=[{key:"ALL",title:"All"},{key:"SUBMITTED",title:"Submitted"},{key:"IN_REVIEW",title:"In review"},{key:"PENDING_OWNER",title:"Approved — activation pending"},{key:"OWNER_COMPLETED",title:"Activated"},{key:"RETURNED",title:"Returned"},{key:"REJECTED",title:"Rejected"}];
const stageLabel=(status:string)=>originalStatuses.find(x=>x.key===status)?.title??"Status unavailable";
type Action="APPROVE"|"RETURN"|"REJECT";
async function api(path:string,init?:RequestInit){
 const response=await fetch("/api/hr/reviews"+path,{
  ...init,cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json",...init?.headers}});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:
  "The original Foundation employee review is unavailable."),{status:response.status});
 return data;
}
export function HrEnrollmentReviews({canConfigure=false}:{canConfigure?:boolean}){
 const [cases,setCases]=useState<Case[]>([]);
 const [filter,setFilter]=useState("ALL"),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [uncertain,setUncertain]=useState(false);const read=useRef(0),running=useRef(false);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [password,setPassword]=useState("");
 const [notes,setNotes]=useState("");
 const [outcome,setOutcome]=useState<Action>("APPROVE");
 const [key,setKey]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [setupPassword,setSetupPassword]=useState("");
 const [configuring,setConfiguring]=useState(false);
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  const seq=++read.current;setLoading(true);setError("");setCases([]);setMore(false);
  try{
   const value=await api("?offset="+offset+"&status="+encodeURIComponent(filter));
   if(!value||typeof value!=="object"||!("items" in value)||!Array.isArray(value.items))
    throw Error("Original Foundation review inbox is unavailable.");
   if(seq===read.current){setCases(value.items as Case[]);setMore("hasMore" in value&&value.hasMore===true);}
  }catch(e){if(seq===read.current)setError(e instanceof Error?e.message:"The original employee review inbox is unavailable.");}
  finally{if(seq===read.current)setLoading(false);}
 },[offset,filter]);
 useEffect(()=>{void refresh();return()=>{read.current++;};},[refresh]);
 const checkProcess=useCallback(async()=>{
  try{
   const value=await api("/process");
   if(!value||typeof value!=="object"||!("configured" in value)||
     typeof value.configured!=="boolean")
    throw Error("Original approval process status unavailable.");
   setConfigured(value.configured);
  }catch(e){setConfigured(null);setError(e instanceof Error?e.message:
    "The Foundation approval process cannot be verified.");}
 },[]);
 useEffect(()=>{void checkProcess();},[checkProcess]);
 const configure=async()=>{
  if(!canConfigure||!setupPassword||configuring)return;
  setConfiguring(true);setError("");
  try{
   const result=await api("/process",{
    method:"POST",body:JSON.stringify({currentPassword:setupPassword})});
   if(!result||typeof result!=="object"||!("configured" in result)||
     result.configured!==true)
    throw Error("Employee approval process configuration is not confirmed.");
   setSetupPassword("");setConfigured(true);
   setMessage("Protected employee review process is configured.");
  }catch(e){setError(e instanceof Error?e.message:
    "Review configuration is unavailable.");}
  finally{setConfiguring(false);}
 };
 const open=async(ref:string)=>{
  if(running.current||uncertain)return;running.current=true;setBusy(true);setDetail(null);setError("");setMessage("");setPassword("");setNotes("");setKey(null);setOutcome("APPROVE");
  try{
   const value=await api("/"+ref);
   if(!value||typeof value!=="object"||!("caseRef" in value)||
     !("status" in value))throw Error("This original enrollment cannot be verified.");
   setDetail(value as Detail);
  }catch(e){setDetail(null);setError(e instanceof Error?e.message:
    "The original employee review is not available.");
  }finally{running.current=false;setBusy(false);}
 };
 const decide=async()=>{
  if(!detail||running.current||busy||!detail.canDecide||!password)return;running.current=true;
  const original=detail;
  const requestKey=key??crypto.randomUUID();
  setKey(requestKey);setBusy(true);setError("");setMessage("");
  try{
   const res=await api("/"+original.caseRef+"/decide",{method:"POST",
    body:JSON.stringify({requestKey,expectedRevision:original.revision,
     action:outcome,remarks:notes,currentPassword:password})});
   if(!res||typeof res!=="object"||!("status" in res))
    throw Error("The independent decision result cannot be confirmed.");
   setPassword("");setNotes("");setKey(null);setUncertain(false);
   setMessage(outcome==="APPROVE"?"Original review approved. HR must still confirm employment activation.":
    outcome==="RETURN"?"Application returned to HR for correction.":
     "Original employee application rejected.");
   await refresh();setDetail(null);
  }catch(e){
   setError(e instanceof Error?e.message:
    "The decision result is uncertain. Refresh the original review before retrying.");
   setPassword("");if(!uncertain&&e&&typeof e==="object"&&"status" in e&&[400,401,403,404,409,422].includes(Number(e.status))){setKey(null);setUncertain(false);}else setUncertain(true);
  }finally{running.current=false;setBusy(false);}
 };
 return <section aria-label="Protected Foundation HR review"
  style={{background:"#fff",borderRadius:14,border:"1px solid var(--cg-border)",
   padding:"1rem",display:"grid",gap:12,marginBlock:20}}>
  <header style={{display:"flex",justifyContent:"space-between",gap:12}}>
   <div><h2 style={{margin:0,fontSize:"1.12rem"}}>Independent employee enrollment reviews</h2>
    <p style={{fontSize:13,color:"var(--cg-muted)",margin:"5px 0 0"}}>
     The original case and scanner-validated files must be current.
     The proposer cannot approve their own enrollment.
    </p></div>
   <button type="button" disabled={busy||loading} onClick={()=>void refresh()}
    style={{padding:"8px 12px",alignSelf:"start",borderRadius:9,border:"1px solid var(--cg-border)",
     background:"#F8FAFC",cursor:"pointer"}}>Refresh</button>
  </header>
  {error&&<p role="alert" style={{color:"#991B1B",background:"#FEF2F2",padding:10}}>{error}</p>}
  {message&&<p role="status" style={{color:"#166534",background:"#ECFDF5",padding:10}}>{message}</p>}
  {configured===false&&<div style={{padding:12,border:"1px solid var(--cg-border)",
    borderRadius:10,display:"grid",gap:10}}>
    <p role="status" style={{margin:0}}>Employee reviews are not configured.
     A protected Foundation process manager must authorize the original review process.</p>
    {canConfigure&&<>
     <label style={{display:"grid",gap:5}}>Current password to configure approvals
      <input type="password" autoComplete="current-password"
       value={setupPassword} onChange={e=>setSetupPassword(e.target.value)}
       style={{padding:10,border:"1px solid var(--cg-border)",borderRadius:9}}/>
     </label>
     <button type="button" onClick={()=>void configure()}
      disabled={configuring||!setupPassword}
      style={{padding:11,background:"var(--cg-accent)",color:"#fff",border:0,borderRadius:9}}>
      {configuring?"Configuring original process…":"Configure original employee approval process"}</button>
    </>}
   </div>}
  <div role="group" aria-label="Original review status" style={{display:"flex",gap:6,flexWrap:"wrap"}}>{originalStatuses.map(x=><button key={x.key} type="button" disabled={busy||uncertain} aria-pressed={filter===x.key} onClick={()=>{setFilter(x.key);setOffset(0);setDetail(null);}}>{x.title}</button>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:12,alignItems:"start"}}><section aria-label="Review queue">
  {loading?<p role="status">Loading original employee review cases…</p>:
    cases.length===0?<p>No enrollment cases in this Foundation scope.</p>:
   <ul style={{listStyle:"none",padding:0,display:"grid",gap:9}}>
    {cases.map(c=><li key={c.caseRef} style={{padding:12,borderRadius:10,
      border:"1px solid var(--cg-border)"}}>
     <strong>{c.name}</strong>
     <small style={{display:"block",color:"var(--cg-muted)"}}>
      {c.reference} · {stageLabel(c.status)}
     </small>
     <button type="button" onClick={()=>void open(c.caseRef)} disabled={busy||uncertain}
      style={{marginTop:8,padding:"8px 10px",border:0,borderRadius:9,
        background:"var(--cg-accent)",color:"#fff",cursor:"pointer"}}>
      View original review</button>
    </li>)}
   </ul>}
  <div style={{display:"flex",gap:8}}>{offset>0&&<button disabled={busy||loading||uncertain} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous</button>}{more&&<button disabled={busy||loading||uncertain} onClick={()=>setOffset(v=>v+25)}>Next</button>}</div></section><section aria-label="Application summary">{!detail&&<p>Select a review to see the original application and evidence.</p>}
  {detail&&<div style={{padding:14,display:"grid",gap:12,
    border:"1px solid var(--cg-border)",borderRadius:12}}>
   <h3 style={{margin:0}}>{detail.name} — {detail.designation}</h3>
   <p style={{margin:0,color:"var(--cg-muted)"}}>{detail.reference} · {stageLabel(detail.status)}
    {" · "}{detail.employmentType.replaceAll("_"," ")}</p>
   <div><strong>Original approval history</strong>{detail.timeline?.length?<div style={{display:"grid",gap:8,marginTop:8}}>{detail.timeline.map((e,i)=><div key={i} style={{borderLeft:"3px solid var(--cg-accent)",paddingLeft:10}}><strong>{e.action.replaceAll("_"," ").toLowerCase()}</strong><small style={{display:"block"}}>Step {e.step} · {new Date(e.occurredAt).toLocaleString("en-IN")}</small></div>)}</div>:<p>No recorded approval events available.</p>}</div>
   <div><strong>Original verified evidence</strong>
    {detail.evidence.map((f,i)=><p key={i} style={{margin:"4px 0"}}>
      {f.classification.replaceAll("_"," ")} — {f.verified?"Verified":"Unverified"}
      {f.verified&&detail.canReadProof&&<a style={{marginLeft:9,color:"var(--cg-accent)"}}
       href={"/api/hr-review-proof/"+encodeURIComponent(detail.caseRef)+
        "?kind="+encodeURIComponent(f.classification)}>
       Download original private proof</a>}
     </p>)}
   </div>
   {detail.canDecide&&<div style={{display:"grid",gap:11}}>
    <label style={{display:"grid",gap:4}}>Decision
     <select value={outcome} disabled={busy||uncertain} onChange={e=>{setOutcome(e.target.value as Action);setKey(null);}}
      style={{padding:11,border:"1px solid var(--cg-border)",borderRadius:9}}>
      <option value="APPROVE">Approve</option>
      <option value="RETURN">Return for correction</option>
      <option value="REJECT">Reject</option>
     </select></label>
    <label style={{display:"grid",gap:4}}>Review remarks (optional)
     <textarea value={notes} disabled={busy||uncertain} maxLength={500} onChange={e=>{setNotes(e.target.value);setKey(null);}}
      style={{padding:11,border:"1px solid var(--cg-border)",borderRadius:9}}/></label>
    <label style={{display:"grid",gap:4}}>Confirm with your current password
     <input type="password" required autoComplete="current-password"
      value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}
      style={{padding:11,border:"1px solid var(--cg-border)",borderRadius:9}}/></label>
    {uncertain&&<p role="alert">The previous result is unconfirmed. Re-enter your password and retry the same decision.</p>}
    <button type="button" onClick={()=>void decide()} disabled={busy||!password}
     style={{padding:12,borderRadius:10,border:0,background:"var(--cg-accent)",
      color:"#fff",fontWeight:700,cursor:"pointer"}}>
      {busy?"Confirming original decision…":"Confirm independent review"}</button>
   </div>}
   <button type="button" disabled={busy||uncertain} onClick={()=>{setDetail(null);setPassword("");setKey(null);}}
    style={{padding:10,borderRadius:10,border:"1px solid var(--cg-border)",
     background:"#F8FAFC",cursor:"pointer"}}>Close review</button>
  </div>}</section></div>
 </section>;
}
