"use client";
import {useCallback,useEffect,useState} from "react";
type Self={status:string;employeeReference?:string;name?:string;
 designation?:string;branch?:string;employmentType?:string;
 effectiveFrom?:string;message?:string};
export function HrMyProfile(){
 const [self,setSelf]=useState<Self|null>(null);
 const [busy,setBusy]=useState(true);
 const [problem,setProblem]=useState("");
 const [pending,setPending]=useState<{pending:boolean;applicationRef?:string;
  name?:string;designation?:string}|null>(null);
 const [linkBusy,setLinkBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [bio,setBio]=useState<{linked:boolean;consented:boolean;revision:number}|null>(null);
 const [bioBusy,setBioBusy]=useState(false);
 const refresh=useCallback(async()=>{
  setBusy(true);setProblem("");
  try{
   const res=await fetch("/api/hr/me",{credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error(res.status===401?"Please sign in again.":
    "Current employment details cannot be verified. Try again.");
   const result:unknown=await res.json();
   if(!result||typeof result!=="object"||!("status" in result)||
     typeof result.status!=="string")
     throw Error("Employment information is unavailable.");
   setSelf(result as Self);
  }catch(e){
   setSelf(null);setProblem(e instanceof Error?e.message:
    "Current employment information cannot be verified.");
  }finally{setBusy(false);}
 },[]);
 const checkPending=useCallback(async()=>{
  setProblem("");
  try{
   const res=await fetch("/api/hr/my-pending-link",{
    credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error("Current employee account acceptance is unavailable.");
   const result:unknown=await res.json();
   if(!result||typeof result!=="object"||!("pending" in result)||
     typeof result.pending!=="boolean")
    throw Error("Current account status cannot be verified.");
   setPending(result as typeof pending);
  }catch(e){setPending(null);
   setProblem(e instanceof Error?e.message:"Account acceptance status unavailable.");}
 },[]);
 const accept=async()=>{
  if(!pending?.pending||!pending.applicationRef||linkBusy)return;
  setLinkBusy(true);setProblem("");setNotice("");
  try{
   const res=await fetch("/api/hr/my-link/accept",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({applicationRef:pending.applicationRef})});
   if(!res.ok)throw Error(res.status===409?
    "Employment changed. Check its current approval status.":
    "Your employment acceptance could not be confirmed.");
   const result:unknown=await res.json();
   if(!result||typeof result!=="object"||!("status" in result)||
     result.status!=="ACTIVE")
    throw Error("Employment account acceptance is not confirmed.");
   setPending(null);await refresh();
   setNotice("Your existing staff login is linked to your approved employment. "+
     "No new permissions were granted.");
  }catch(e){setProblem(e instanceof Error?e.message:
    "Check your account status before retrying.");}
  finally{setLinkBusy(false);}
 };
 const refreshBio=useCallback(async()=>{
  try{
   const response=await fetch("/api/hr/my-bio-consent",{
    credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("Current public-use consent is unavailable.");
   const value:unknown=await response.json();
   if(!value||typeof value!=="object"||!("linked" in value)||
    typeof value.linked!=="boolean"||!("consented" in value)||
    typeof value.consented!=="boolean"||!("revision" in value)||
    typeof value.revision!=="number")
    throw Error("Current professional permission could not be verified.");
   setBio(value as {linked:boolean;consented:boolean;revision:number});
  }catch(e){setBio(null);setProblem(e instanceof Error?e.message:
   "Professional consent cannot be verified.");}
 },[]);
 const changeBio=async(consent:boolean)=>{
  if(!bio?.linked||bioBusy)return;
  setBioBusy(true);setNotice("");setProblem("");
  try{
   const response=await fetch("/api/hr/my-bio-consent",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({consent,expectedRevision:bio.revision})});
   if(!response.ok)throw Error(response.status===409?
    "Your professional consent changed. Refresh before retrying.":
    "Professional permission could not be confirmed.");
   const value:unknown=await response.json();
   if(!value||typeof value!=="object"||!("revision" in value)||
    typeof value.revision!=="number")
    throw Error("Professional permission result is uncertain.");
   await refreshBio();
   setNotice(consent?
    "Minimal professional-use consent recorded; separate editorial approval is still required.":
    "Professional-use consent withdrawn. Public eligibility is revoked.");
  }catch(e){setProblem(e instanceof Error?e.message:
   "Permission status is uncertain. Check before retrying.");}
  finally{setBioBusy(false);}
 };
 useEffect(()=>{void refresh();void checkPending();void refreshBio();},
  [refresh,checkPending,refreshBio]);
 return <section aria-labelledby="cg-hr-my-profile" style={{padding:"1rem 1.2rem",
  border:"1px solid #E2E8F0",borderRadius:14,background:"#fff",marginBottom:18}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
   <h2 id="cg-hr-my-profile" style={{fontSize:"1.15rem",margin:0}}>My employment</h2>
   <button type="button" onClick={()=>void refresh()} disabled={busy}
    style={{padding:".55rem .8rem",border:"1px solid #CBD5E1",
      background:"#F8FAFC",borderRadius:9,cursor:"pointer"}}>Refresh</button>
  </header>
  {busy?<p role="status">Verifying current employment…</p>:
   problem?<p role="alert" style={{color:"#991B1B"}}>{problem}</p>:
   self?.status==="NOT_LINKED"?<p style={{color:"#64748B"}}>
    No approved employee profile is linked to your account.</p>:
   self?<dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:13}}>
    <div><dt>Employee</dt><dd style={{margin:0,fontWeight:700}}>{self.name??"Unavailable"}</dd></div>
    <div><dt>Designation</dt><dd style={{margin:0}}>{self.designation??"Unavailable"}</dd></div>
    <div><dt>Branch</dt><dd style={{margin:0}}>{self.branch??"Unavailable"}</dd></div>
    <div><dt>Status</dt><dd style={{margin:0}}>{self.status.replaceAll("_"," ")}</dd></div>
    <div><dt>Employment reference</dt><dd style={{margin:0}}>{self.employeeReference??"Unavailable"}</dd></div>
   </dl>:<p>Employment information is not available.</p>}
  {bio?.linked&&<div style={{border:"1px solid #CBD5E1",
   borderRadius:10,padding:13,marginTop:14,display:"grid",gap:8}}>
   <strong>Optional professional profile consent</strong>
   <p style={{margin:0,color:"#64748B",fontSize:13}}>
    Only your professional name and current designation may be considered
    for a future Foundation Team profile. A private ID scan or photograph is never
    automatically a public image. Publishing still requires separate editorial approval.
   </p>
   <p role="status" style={{margin:0}}>
    Current choice: {bio.consented?"Permission granted":"No public-use permission"}
   </p>
   <button type="button" disabled={bioBusy}
    onClick={()=>void changeBio(!bio.consented)}
    style={{padding:11,background:bio.consented?"#FEE2E2":"#087F8C",
     color:bio.consented?"#991B1B":"#fff",border:0,
     borderRadius:9,fontWeight:700,justifySelf:"start"}}>
     {bioBusy?"Confirming choice…":bio.consented?
      "Withdraw my professional profile permission":"Allow limited professional profile"}
   </button>
  </div>}
  {pending?.pending&&<div style={{marginTop:15,padding:12,
    border:"1px solid #BAE6FD",borderRadius:10}}>
    <strong>Approved employment awaits your account confirmation</strong>
    <p style={{margin:"6px 0"}}>{pending.name} · {pending.designation}.
     Confirm only if this employment belongs to you. This does not create any role or login.</p>
    <button type="button" disabled={linkBusy} onClick={()=>void accept()}
     style={{background:"#087F8C",color:"#fff",border:0,borderRadius:9,
      padding:"10px 13px",fontWeight:700,cursor:"pointer"}}>
      {linkBusy?"Confirming…":"Accept my approved employment link"}</button>
   </div>}
   {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
   <button type="button" onClick={()=>void checkPending()} style={{marginTop:10,
    padding:"8px 11px",border:"1px solid #CBD5E1",borderRadius:9,background:"#F8FAFC"}}>
    Check pending employment acceptance</button>
 </section>;
}
