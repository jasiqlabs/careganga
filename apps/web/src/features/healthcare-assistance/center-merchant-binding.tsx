"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
type Merchant={bindingRef?:string;revision?:number;provider?:string;
 merchantRef?:string;verificationState:string;onlineAvailable:boolean;
 credentialProvisioned?:boolean;canAcceptOnline?:boolean;verifiedAt?:string|null};
type Props={centerRef:string;canPropose:boolean;canVerify:boolean};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function api<T>(path:string,body?:object):Promise<T>{
 const res=await fetch("/api/healthcare-assistance/merchant/"+path,{
  credentials:"same-origin",cache:"no-store",method:body?"POST":"GET",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(
  res.status===401?"Sign in to review your center payment settings.":
  res.status===403?"Your current role or center assignment does not permit this change.":
  res.status===409?"Current merchant/provisioning state changed. Refresh first.":
  res.status===404?"Your verified center is unavailable.":
  "Merchant source could not be verified. Check the original setting."),
  {status:res.status});
 return res.json() as Promise<T>;
}
export function CenterMerchantBinding({centerRef,canPropose,canVerify}:Props){
 const [source,setSource]=useState<Merchant|null>(null);
 const [merchantRef,setMerchantRef]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const last=useRef<{path:string;body:object}|null>(null);
 const prefix="staff/centers/"+centerRef+"/binding";
 const refresh=useCallback(async()=>{
  const value=await api<Merchant>(prefix);
  if(!value||!["NOT_CONFIGURED","PENDING_VERIFICATION","VERIFIED","REVOKED"]
    .includes(value.verificationState))
   throw Error("Current center merchant source is unavailable.");
  setSource(value);return value;
 },[prefix]);
 useEffect(()=>{
  let active=true;setLoading(true);setSource(null);
  void refresh().catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Merchant source unavailable.")}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[refresh]);
 async function command(path:string,body:object,replay=false){
  if(busy||uncertain&&!replay)return;
  setBusy(true);setError("");setMessage("");
  try{
   const done=await api<Merchant>(path,body);
   if(!done||!done.verificationState)
    throw Error("Merchant outcome uncertain.");
   setSource(done);last.current=null;setUncertain(false);
   setMessage(done.onlineAvailable?
    "The independent reviewer verified this center's genuine merchant. "+
    "Patient online checkout is now permitted for this center.":
    done.verificationState==="REVOKED"?
     "The original binding is revoked. Online checkout is unavailable.":
     "Request recorded; online payment remains unavailable until "+
     "the independent current-center reviewer verifies it.");
   try{await refresh()}catch{
    setMessage("Merchant action recorded, but latest status could not be refreshed.");
   }
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)last.current=null;
   setError(e instanceof Error?e.message:"Merchant source unverified.");
  }finally{setBusy(false)}
 }
 function propose(e:FormEvent){
  e.preventDefault();
  if(!canPropose||busy||uncertain)return;
  if(!/^[A-Za-z0-9_-]{6,80}$/.test(merchantRef)){
   setError("Enter the actual provider merchant reference supplied by your center.");
   return;
  }
  const attempt={path:prefix+"/propose",body:{merchantRef:merchantRef.trim()}};
  last.current=attempt;void command(attempt.path,attempt.body);
 }
 function change(kind:"verify"|"revoke"){
  if(!source||!Number.isSafeInteger(source.revision)||!canVerify||
    busy||uncertain)return;
  if(!window.confirm(kind==="verify"?
   "Independently verify the center-owned merchant and current provider credentials?":
   "Revoke this merchant? New online checkouts will be unavailable."))return;
  const attempt={path:prefix+"/"+kind,
   body:{expectedRevision:source.revision}};
  last.current=attempt;void command(attempt.path,attempt.body);
 }
 if(!ID.test(centerRef)||(!canPropose&&!canVerify))return null;
 return <section className="form-section" aria-label="Verified center online merchant">
  <h2>Center online payment settings</h2>
  <p>Only this healthcare center's merchant account can receive patient
   online payments. The Foundation's donation account is not a fallback.
   Secret credentials must be provisioned securely by the deployment team
   and never typed into this page.</p>
  {loading&&<p role="status">Checking original merchant binding…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!message&&<p role="status" className="notice">{message}</p>}
  {source&&<div className="cg-diagnostics-card">
   <p><strong>Binding status:</strong> {
    source.verificationState.replaceAll("_"," ")}</p>
   <p><strong>Center merchant:</strong> {source.merchantRef??"Not enrolled"}</p>
   <p><strong>Server credentials provisioned:</strong> {
    source.credentialProvisioned?"Yes, ownership evidence configured":
    "No — online checkout is disabled"}</p>
   <p><strong>Patient online checkout:</strong> {
    source.canAcceptOnline?"Verified and enabled":"Unavailable; pay-at-center continues"}</p>
   {source.verifiedAt&&<p>Last independently verified: {
    new Date(source.verifiedAt).toLocaleString("en-IN")}</p>}
  </div>}
  {canPropose&&source?.verificationState==="NOT_CONFIGURED"&&
   <form className="cg-diagnostics-card" onSubmit={propose}>
    <h3>Request verification of this center's merchant</h3>
    <label className="field">Center-owned provider merchant reference
     <input required maxLength={80} value={merchantRef}
      disabled={busy||uncertain} onChange={e=>setMerchantRef(e.target.value)}
      placeholder="Merchant account reference"/>
    </label>
    <p>Requesting a binding does not enable checkout. A different authorized
     reviewer must confirm current center ownership and authenticate the
     provider's configured credentials.</p>
    <button className="primary" type="submit" disabled={busy||uncertain}>
     Request independent merchant verification</button>
   </form>}
  {canVerify&&source?.verificationState==="PENDING_VERIFICATION"&&
   <button type="button" disabled={busy||uncertain} onClick={()=>change("verify")}>
    Independently verify actual merchant</button>}
  {canVerify&&source?.bindingRef&&
   ["PENDING_VERIFICATION","VERIFIED"].includes(source.verificationState)&&
   <button type="button" disabled={busy||uncertain}
    onClick={()=>change("revoke")}>Revoke merchant binding</button>}
  {uncertain&&<div className="cg-diagnostics-card" role="alert">
   <p>The previous merchant change may already have succeeded. Do not issue
    a different request before rechecking the current record.</p>
   <button type="button" disabled={busy||!last.current} onClick={()=>{
    if(last.current)void command(last.current.path,last.current.body,true);
   }}>Retry same request</button>
   <button type="button" disabled={busy} onClick={()=>
    void refresh().catch(e=>setError(e instanceof Error?e.message:
     "Original merchant status unavailable."))}>Recheck binding source</button>
  </div>}
 </section>;
}
