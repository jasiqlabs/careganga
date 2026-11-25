"use client";
import {useState} from "react";
export function AppointmentStatusVerifier(){
 const [token,setToken]=useState(""),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 const [resultType,setResultType]=useState<"valid"|"invalid"|"unavailable"|null>(null);
 async function verify(){
  if(busy||!/^CGV-[A-F0-9]{24}$/.test(token.trim().toUpperCase()))return;
  setBusy(true);setStatus("");setResultType(null);
  try{
   const response=await fetch("/api/appointments/slips/verify",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token:token.trim().toUpperCase()}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("This code could not be checked. Try again later.");
   const result:unknown=await response.json();
   if(!result||typeof result!=="object"||!("valid" in result)||typeof result.valid!=="boolean")throw Error("Verification response could not be confirmed. Try again later.");
   setResultType(result.valid?"valid":"invalid");
   setStatus(result.valid?"This CareGanga consultation slip is currently valid.":
    "This slip is invalid, revoked, out of date or outside its verification window.");
  }catch{setResultType("unavailable");setStatus("This code could not be checked. Try again later.");}
  finally{setBusy(false);}
 }
 return <div className="cg-slip-verifier">
  <label>QR status code
   <input value={token} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busy} maxLength={28}
    onChange={e=>{setToken(e.target.value.toUpperCase());setStatus("");setResultType(null);}}
    placeholder="CGV-XXXXXXXXXXXXXXXXXXXXXXXX"/></label>
  <button className="primary" type="button" disabled={busy||!/^CGV-[A-F0-9]{24}$/.test(token.trim())}
   onClick={()=>void verify()}>{busy?"Checking…":"Check slip validity"}</button>
  {status&&<p className="cg-slip-result" data-result={resultType} role="status" aria-live="polite">{status}</p>}
  <p>Do not use this checker as proof of patient identity or as a payment receipt.</p>
 </div>;
}
