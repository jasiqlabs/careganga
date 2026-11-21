"use client";
import {useCallback,useEffect,useState} from "react";
type Self={status:string;employeeReference?:string;name?:string;
 designation?:string;branch?:string;employmentType?:string;
 effectiveFrom?:string;message?:string};
export function HrMyProfile(){
 const [self,setSelf]=useState<Self|null>(null);
 const [busy,setBusy]=useState(true);
 const [problem,setProblem]=useState("");
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
 useEffect(()=>{void refresh();},[refresh]);
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
 </section>;
}
