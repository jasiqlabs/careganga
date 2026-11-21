"use client";
import {useCallback,useEffect,useState} from "react";
type Case={caseRef:string;reference:string;name:string;status:string;
 revision:number;canReview:boolean};
type Detail={caseRef:string;reference:string;revision:number;name:string;
 status:string;designation:string;employmentType:string;canDecide:boolean;
 evidence:Array<{classification:string;verified:boolean}>};
type Action="APPROVE"|"RETURN"|"REJECT";
async function api(path:string,init?:RequestInit){
 const response=await fetch("/api/hr/reviews"+path,{
  ...init,cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json",...init?.headers}});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:
  "The original Foundation employee review is unavailable.");
 return data;
}
export function HrEnrollmentReviews({canConfigure=false}:{canConfigure?:boolean}){
 const [cases,setCases]=useState<Case[]>([]);
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
  setLoading(true);setError("");
  try{
   const value=await api("?offset=0");
   if(!value||typeof value!=="object"||!("items" in value)||!Array.isArray(value.items))
    throw Error("Original Foundation review inbox is unavailable.");
   setCases(value.items as Case[]);
  }catch(e){setCases([]);setError(e instanceof Error?e.message:
    "The original employee review inbox is unavailable.");
  }finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
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
  setBusy(true);setError("");setMessage("");setPassword("");setNotes("");setKey(null);
  try{
   const value=await api("/"+ref);
   if(!value||typeof value!=="object"||!("caseRef" in value)||
     !("status" in value))throw Error("This original enrollment cannot be verified.");
   setDetail(value as Detail);
  }catch(e){setDetail(null);setError(e instanceof Error?e.message:
    "The original employee review is not available.");
  }finally{setBusy(false);}
 };
 const decide=async()=>{
  if(!detail||busy||!detail.canDecide||!password)return;
  const original=detail;
  const requestKey=key??crypto.randomUUID();
  setKey(requestKey);setBusy(true);setError("");setMessage("");
  try{
   const res=await api("/"+original.caseRef+"/decide",{method:"POST",
    body:JSON.stringify({requestKey,expectedRevision:original.revision,
     action:outcome,remarks:notes,currentPassword:password})});
   if(!res||typeof res!=="object"||!("status" in res))
    throw Error("The independent decision result cannot be confirmed.");
   setPassword("");setNotes("");setKey(null);
   setMessage(outcome==="APPROVE"?"Original review approved. HR must still confirm employment activation.":
    outcome==="RETURN"?"Application returned to HR for correction.":
     "Original employee application rejected.");
   await refresh();setDetail(null);
  }catch(e){
   setError(e instanceof Error?e.message:
    "The decision result is uncertain. Refresh the original review before retrying.");
   setPassword("");
  }finally{setBusy(false);}
 };
 return <section aria-label="Protected Foundation HR review"
  style={{background:"#fff",borderRadius:14,border:"1px solid #E2E8F0",
   padding:"1rem",display:"grid",gap:12,marginBlock:20}}>
  <header style={{display:"flex",justifyContent:"space-between",gap:12}}>
   <div><h2 style={{margin:0,fontSize:"1.12rem"}}>Independent employee enrollment reviews</h2>
    <p style={{fontSize:13,color:"#64748B",margin:"5px 0 0"}}>
     The original case and scanner-validated files must be current.
     The proposer cannot approve their own enrollment.
    </p></div>
   <button type="button" disabled={busy||loading} onClick={()=>void refresh()}
    style={{padding:"8px 12px",alignSelf:"start",borderRadius:9,border:"1px solid #CBD5E1",
     background:"#F8FAFC",cursor:"pointer"}}>Refresh</button>
  </header>
  {error&&<p role="alert" style={{color:"#991B1B",background:"#FEF2F2",padding:10}}>{error}</p>}
  {message&&<p role="status" style={{color:"#166534",background:"#ECFDF5",padding:10}}>{message}</p>}
  {configured===false&&<div style={{padding:12,border:"1px solid #CBD5E1",
    borderRadius:10,display:"grid",gap:10}}>
    <p role="status" style={{margin:0}}>Employee reviews are not configured.
     A protected Foundation process manager must authorize the original review process.</p>
    {canConfigure&&<>
     <label style={{display:"grid",gap:5}}>Current password to configure approvals
      <input type="password" autoComplete="current-password"
       value={setupPassword} onChange={e=>setSetupPassword(e.target.value)}
       style={{padding:10,border:"1px solid #CBD5E1",borderRadius:9}}/>
     </label>
     <button type="button" onClick={()=>void configure()}
      disabled={configuring||!setupPassword}
      style={{padding:11,background:"#0369A1",color:"#fff",border:0,borderRadius:9}}>
      {configuring?"Configuring original process…":"Configure original employee approval process"}</button>
    </>}
   </div>}
  {loading?<p role="status">Loading original employee review cases…</p>:
    cases.length===0?<p>No enrollment cases in this Foundation scope.</p>:
   <ul style={{listStyle:"none",padding:0,display:"grid",gap:9}}>
    {cases.map(c=><li key={c.caseRef} style={{padding:12,borderRadius:10,
      border:"1px solid #E2E8F0"}}>
     <strong>{c.name}</strong>
     <small style={{display:"block",color:"#64748B"}}>
      {c.reference} · {c.status.replaceAll("_"," ")}
     </small>
     <button type="button" onClick={()=>void open(c.caseRef)} disabled={busy}
      style={{marginTop:8,padding:"8px 10px",border:0,borderRadius:9,
        background:"#0369A1",color:"#fff",cursor:"pointer"}}>
      View original review</button>
    </li>)}
   </ul>}
  {detail&&<div style={{padding:14,display:"grid",gap:12,
    border:"1px solid #CBD5E1",borderRadius:12}}>
   <h3 style={{margin:0}}>{detail.name} — {detail.designation}</h3>
   <p style={{margin:0,color:"#475569"}}>{detail.reference} · {detail.status.replaceAll("_"," ")}
    {" · "}{detail.employmentType.replaceAll("_"," ")}</p>
   <div><strong>Original verified evidence</strong>
    {detail.evidence.map((f,i)=><p key={i} style={{margin:"4px 0"}}>
      {f.classification.replaceAll("_"," ")} — {f.verified?"Verified":"Unverified"}
      {f.verified&&<a style={{marginLeft:9,color:"#0369A1"}}
       href={"/api/hr-review-proof/"+encodeURIComponent(detail.caseRef)+
        "?kind="+encodeURIComponent(f.classification)}>
       Download original private proof</a>}
     </p>)}
   </div>
   {detail.canDecide&&<div style={{display:"grid",gap:11}}>
    <label style={{display:"grid",gap:4}}>Decision
     <select value={outcome} onChange={e=>{setOutcome(e.target.value as Action);setKey(null);}}
      style={{padding:11,border:"1px solid #CBD5E1",borderRadius:9}}>
      <option value="APPROVE">Approve</option>
      <option value="RETURN">Return for correction</option>
      <option value="REJECT">Reject</option>
     </select></label>
    <label style={{display:"grid",gap:4}}>Review remarks (optional)
     <textarea value={notes} maxLength={500} onChange={e=>{setNotes(e.target.value);setKey(null);}}
      style={{padding:11,border:"1px solid #CBD5E1",borderRadius:9}}/></label>
    <label style={{display:"grid",gap:4}}>Confirm with your current password
     <input type="password" required autoComplete="current-password"
      value={password} onChange={e=>{setPassword(e.target.value);setKey(null);}}
      style={{padding:11,border:"1px solid #CBD5E1",borderRadius:9}}/></label>
    <button type="button" onClick={()=>void decide()} disabled={busy||!password}
     style={{padding:12,borderRadius:10,border:0,background:"#087F8C",
      color:"#fff",fontWeight:700,cursor:"pointer"}}>
      {busy?"Confirming original decision…":"Confirm independent review"}</button>
   </div>}
   <button type="button" onClick={()=>{setDetail(null);setPassword("");setKey(null);}}
    style={{padding:10,borderRadius:10,border:"1px solid #CBD5E1",
     background:"#F8FAFC",cursor:"pointer"}}>Close review</button>
  </div>}
 </section>;
}
