"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
/** Original public Verify Volunteer tab; no volunteer PII or raw IDs. */
export function PublicVolunteerVerification(){
 const [code,setCode]=useState(""),[state,setState]=useState<"IDLE"|"VERIFYING"|"ACTIVE"|"NOT_VALID"|"UNAVAILABLE">("IDLE");
 const active=useRef(0);
 useEffect(()=>{
  const hidden=()=>{if(document.visibilityState!=="visible"){active.current++;setCode("");setState("IDLE");}};
  document.addEventListener("visibilitychange",hidden);
  return()=>{active.current++;document.removeEventListener("visibilitychange",hidden);};
 },[]);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(state==="VERIFYING")return;
  const v=code.trim().toUpperCase(),id=++active.current;
  if(!/^CGV-[A-F0-9]{24}$/.test(v)){setState("NOT_VALID");return;}
  setState("VERIFYING");
  try{
   const r=await fetch("/api/public/volunteers/verify",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:v}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error("Cannot check current status.");
   const v:unknown=await r.json();
   if(id===active.current)setState(v&&typeof v==="object"&&(v as {valid?:boolean;status?:string}).valid===true&&(v as {status:string}).status==="ACTIVE"?"ACTIVE":"NOT_VALID");
  }catch{if(id===active.current)setState("UNAVAILABLE");}
 };
 return <section className="cg04-search-card" aria-label="Verify original volunteer card">
  <h2>Verify Volunteer</h2>
  <p>Enter the verification code printed on an officially issued Foundation volunteer card or certificate. This checks the current recorded eligibility, not the applicant’s private identity.</p>
  <form onSubmit={submit}>
   <label htmlFor="cg04-volunteer-verify-code">Official volunteer verification code</label>
   <div className="cg04-search-row"><input id="cg04-volunteer-verify-code" type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={28}
    placeholder="CGV-…" value={code} onChange={e=>{active.current++;setCode(e.target.value.toUpperCase());setState("IDLE");}} required/>
    <button type="submit" className="cg04-primary" disabled={state==="VERIFYING"}>{state==="VERIFYING"?"Checking…":"Verify current status"}</button>
   </div>
  </form>
  {state==="ACTIVE"&&<p role="status">Current official volunteer verification: <strong>Active</strong>.</p>}
  {state==="NOT_VALID"&&<p role="status">The code does not verify a currently active official volunteer. Check the issued document or contact the Foundation.</p>}
  {state==="UNAVAILABLE"&&<p role="alert">Volunteer verification is temporarily unavailable. Please retry; no verification was recorded.</p>}
 </section>;
}
