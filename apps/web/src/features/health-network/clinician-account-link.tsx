"use client";
import {useCallback,useEffect,useState} from "react";

type Candidate={accountRef:string;displayName:string};
type Link={linkRef:string;status:string;accountName:string};
const base="/api/health-network/clinician-accounts/";
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const r=await fetch(base+path,{
  method,credentials:"same-origin",cache:"no-store",
  headers:method==="POST"?{"Content-Type":"application/json"}:undefined,
  body:method==="POST"?JSON.stringify(body??{}):undefined
 });
 if(!r.ok)throw Object.assign(new Error(r.status===401?
  "Your session expired. Sign in again.":r.status===403?
  "Your current role or professional identity cannot perform this action.":
  r.status===409?"The original professional account assignment changed. Refresh first.":
  "The professional account assignment could not be confirmed."),{status:r.status});
 return await r.json() as T;
}
/** Only an original CG14 reviewer may propose or revoke a doctor login.
 * No manual technical-ID entry or phone-based clinical identity matching.
 */
export function ClinicianAccountLinkReviewer({doctorRef}:{
 doctorRef:string
}){
 const [current,setCurrent]=useState<Link|null>(null);
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [search,setSearch]=useState(""),[chosen,setChosen]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[revokeConfirm,setRevokeConfirm]=useState(false);
 const refresh=useCallback(async()=>{
  const x=await api<{link:Link|null}>("doctors/"+encodeURIComponent(doctorRef));
  setCurrent(x.link);
 },[doctorRef]);
 useEffect(()=>{
  let alive=true;setCurrent(null);setCandidates([]);setChosen("");
  void api<{link:Link|null}>("doctors/"+encodeURIComponent(doctorRef))
   .then(x=>{if(alive)setCurrent(x.link);})
   .catch(()=>{if(alive)setError("Doctor account assignment could not be checked.");});
  return()=>{alive=false;};
 },[doctorRef]);
 async function lookup(){
  if(busy||search.trim().length<2)return;
  setBusy(true);setError("");setCandidates([]);setChosen("");
  try{
   const result=await api<{options:Candidate[]}>(
    "account-options?search="+encodeURIComponent(search.trim()));
   setCandidates(result.options);
  }catch(e){setError(e instanceof Error?e.message:"Staff account search unavailable.");}
  finally{setBusy(false);}
 }
 async function propose(){
  if(busy||current||!candidates.some(x=>x.accountRef===chosen))return;
  setBusy(true);setError("");setNotice("");
  try{
   await api("doctors/"+encodeURIComponent(doctorRef)+"/propose","POST",
    {accountRef:chosen});
   await refresh();setChosen("");setCandidates([]);
   setNotice("Proposal recorded. The doctor must sign in and personally accept before clinical access is possible.");
  }catch(e){setError(e instanceof Error?e.message:"Result uncertain. Refresh current link.");}
  finally{setBusy(false);}
 }
 async function revoke(){
  if(!current||busy||!revokeConfirm)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api(encodeURIComponent(current.linkRef)+"/revoke","POST",{});
   await refresh();setRevokeConfirm(false);
   setNotice("The current doctor account assignment was revoked.");
  }catch(e){setError(e instanceof Error?e.message:"Revocation result uncertain. Refresh source.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="Verified clinician account association">
  <h3>Doctor login authorization</h3>
  <p>Professional verification alone does not grant a staff login permission to
   complete another person's consultation. A separate reviewer proposes the
   doctor-account match, and that clinician must personally accept.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {current?<div>
   <p>Assigned account: <strong>{current.accountName}</strong></p>
   <p>Verification: <strong>{current.status==="ACTIVE"?
     "Personally accepted":"Pending clinician acceptance"}</strong></p>
   {!revokeConfirm?<button type="button" disabled={busy}
    onClick={()=>setRevokeConfirm(true)}>Revoke doctor login assignment</button>:
    <div className="toolbar">
     <span>Revoke this professional-to-account assignment?</span>
     <button type="button" disabled={busy} onClick={()=>void revoke()}>Confirm revoke</button>
     <button type="button" disabled={busy} onClick={()=>setRevokeConfirm(false)}>Keep</button>
    </div>}
  </div>:<>
   <form onSubmit={e=>{e.preventDefault();void lookup();}}>
    <label>Find the doctor's registered staff account by name
     <input type="search" value={search} maxLength={80}
      disabled={busy} onChange={e=>setSearch(e.target.value)}
      placeholder="Search staff name" autoComplete="off"/></label>
    <button type="submit" disabled={busy||search.trim().length<2}>
     Find eligible accounts</button>
   </form>
   {!!candidates.length&&<label>Staff account for this verified doctor
    <select value={chosen} disabled={busy} onChange={e=>setChosen(e.target.value)}>
     <option value="">Choose an account</option>
     {candidates.map(x=><option key={x.accountRef} value={x.accountRef}>
      {x.displayName}</option>)}
    </select>
   </label>}
   {chosen&&<button type="button" disabled={busy} onClick={()=>void propose()}>
    Request doctor account acceptance</button>}
   {search.trim().length>=2&&!candidates.length&&
    <p role="status">Search again if no eligible active account is listed.</p>}
  </>}
  <div className="toolbar">
   <button type="button" disabled={busy} onClick={()=>void refresh().catch(()=>
    setError("Doctor account assignment could not be refreshed."))}>
    Refresh original assignment</button>
  </div>
 </section>;
}
/** Shown only on the account's own signed-in dashboard, not on public Web.
 * A pending link is never active until this actual recipient accepts it.
 */
export function ClinicianAccountAcceptance(){
 const [proposal,setProposal]=useState<{linkRef:string;doctorName:string}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{
  let alive=true;
  void api<{proposal:{linkRef:string;doctorName:string}|null}>("me/pending")
   .then(r=>{if(alive)setProposal(r.proposal);})
   .catch(()=>{/* No authenticated staff proposal is displayed on uncertainty. */});
  return()=>{alive=false;};
 },[]);
 if(!proposal)return null;
 return <section className="form-section" aria-label="Accept your clinician account assignment">
  <h3>Doctor account confirmation</h3>
  <p>A Foundation reviewer proposed linking your current login to
   <strong> {proposal.doctorName}</strong>. Accept only if this is your own
   independently verified professional registration.</p>
  {!!message&&<p role="alert">{message}</p>}
  <button type="button" disabled={busy} onClick={async()=>{
   if(busy)return;
   setBusy(true);setMessage("");
   try{
    const result=await api<{status:string}>(
     "me/"+encodeURIComponent(proposal.linkRef)+"/accept","POST",{});
    if(result.status!=="ACTIVE")throw Error("Acceptance is not confirmed.");
    setProposal(null);
   }catch(e){
    setMessage(e instanceof Error?e.message:
     "Professional login acceptance not confirmed. Sign in again to confirm.");
   }finally{setBusy(false);}
  }}>{busy?"Confirming…":"Accept my verified doctor account"}</button>
  <p>A recent password sign-in is required. This step does not itself grant
   clinical visit permissions; Foundation role and center authorization are separate.</p>
 </section>;
}
