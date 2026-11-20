"use client";
import {useState} from "react";
export function AppointmentStatusVerifier(){
 const [token,setToken]=useState(""),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 async function verify(){
  if(busy||!/^CGV-[A-F0-9]{24}$/.test(token.trim().toUpperCase()))return;
  setBusy(true);setStatus("");
  try{
   const response=await fetch("/api/appointments/slips/verify",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token:token.trim().toUpperCase()})});
   if(!response.ok)throw Error("This code could not be checked. Try again later.");
   const result=await response.json() as {valid:boolean};
   setStatus(result.valid?"This CareGanga consultation slip is currently valid.":
    "This slip is invalid, revoked, out of date or outside its verification window.");
  }catch(e){setStatus(e instanceof Error?e.message:"Verification unavailable.");}
  finally{setBusy(false);}
 }
 return <div style={{display:"grid",gap:12,maxWidth:520}}>
  <label>QR status code
   <input value={token} autoCapitalize="characters" maxLength={28}
    onChange={e=>setToken(e.target.value.toUpperCase())}
    placeholder="CGV-XXXXXXXXXXXXXXXXXXXXXXXX"/></label>
  <button type="button" disabled={busy||!/^CGV-[A-F0-9]{24}$/.test(token.trim())}
   onClick={()=>void verify()}>{busy?"Checking…":"Check slip validity"}</button>
  {status&&<p role="status" aria-live="polite">{status}</p>}
  <p>Do not use this checker as proof of patient identity or as a payment receipt.</p>
 </div>;
}
