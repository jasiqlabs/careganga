"use client";
import {useEffect,useState} from "react";
type Result={eligible:boolean;programmeName:string|null;notice:string};
/** Anonymous preflight checks programme eligibility only. A successful preflight
 * is NOT accepted attribution, approval, membership or a points award.
 */
export function ReferralCodeCheck({code}:{code:string}){
 const [busy,setBusy]=useState(false),[checked,setChecked]=useState<Result|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{setChecked(null);setError("");},[code]);
 const verify=async()=>{
  if(busy)return;
  setBusy(true);setChecked(null);setError("");
  try{
   if(!/^[A-Za-z0-9_-]{32}$/.test(code))
    throw Error("Enter a complete referral code, or leave the field blank.");
   const r=await fetch("/api/referrals/resolve",{method:"POST",cache:"no-store",
    credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok||!data||typeof data!=="object")
    throw Error(r.status===429?"Too many checks. Try again later.":
     "The current referral status could not be confirmed.");
   const value=data as Result;
   if(typeof value.eligible!=="boolean"||
    (value.programmeName!==null&&typeof value.programmeName!=="string"))
    throw Error("Referral status could not be confirmed.");
   setChecked(value);
  }catch(e){setError(e instanceof Error?e.message:"Referral validation is unavailable.");}
  finally{setBusy(false);}
 };
 return <div className="cg04-buttons" aria-label="Optional referral code validation">
  {!!code&&<button type="button" disabled={busy} onClick={()=>void verify()}>
   {busy?"Verifying referral…":"Check referral code"}
  </button>}
  {error&&<p role="alert" className="cg04-error">{error}</p>}
  {checked&&<p role="status">{checked.eligible?
   "Eligible programme: "+checked.programmeName+". Points require independently approved activation.":
   "This referral code is not currently eligible. You may continue without a code."}</p>}
 </div>;
}
