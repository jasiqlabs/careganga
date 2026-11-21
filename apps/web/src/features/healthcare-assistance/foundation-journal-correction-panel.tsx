"use client";
import {useCallback,useEffect,useState} from "react";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Year={yearRef:string;name:string};
type Options={sourcePosted:boolean;canCorrect:boolean;claimAlreadyCreated:boolean;
 originalReversed:boolean;corrected:boolean;correctionReason:string|null;
 postingDate:string;financialYears:Year[];complete:boolean;
 claimState?:string;requiredVerifiedRecoveryMinor:string;
 bankRecoveries:{bankMatchRef:string;bankItemLabel:string;amountMinor:string}[]};
type Result={status:string;corrected:boolean;replayed?:boolean};
type Props={centerRef:string;liabilityRef:string;onCorrected:()=>Promise<void>};
async function request<T>(url:string,body?:object):Promise<T>{
 const response=await fetch(url,{method:body?"POST":"GET",
  credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{})});
 const value:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error(
  value&&typeof value==="object"&&"message" in value&&
  typeof value.message==="string"?value.message:
  "Finance correction was not confirmed. Check its original source."),
  {status:response.status});
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw Error("Original finance correction source is unavailable.");
 return value as T;
}
/** CG17 US006: no new account/ledger or artificial bank refund.
 * An independently authorized reviewer can offset an original Foundation
 * accrual using CG09. Claims/payouts stay immutable, and actual verified
 * incoming bank money is mandatory when a claimed provider was overpaid.
 */
export function FoundationJournalCorrectionPanel({centerRef,liabilityRef,onCorrected}:Props){
 const base="/api/healthcare-assistance/foundation-journals/centers/"+
  centerRef+"/liabilities/"+liabilityRef+"/";
 const [options,setOptions]=useState<Options|null>(null);
 const [eligible,setEligible]=useState(true);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [year,setYear]=useState(""),[postingDate,setPostingDate]=useState("");
 const [reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [bankMatch,setBankMatch]=useState(""),[payerMatched,setPayerMatched]=useState(false);
 const [requestKey,setRequestKey]=useState("");
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const load=useCallback(async()=>{
  const data=await request<Options>(base+"correction-options");
  if(typeof data.canCorrect!=="boolean"||
    typeof data.corrected!=="boolean"||
    !Array.isArray(data.financialYears)||
    typeof data.requiredVerifiedRecoveryMinor!=="string"||
    !/^(0|[1-9][0-9]*)$/.test(data.requiredVerifiedRecoveryMinor)||
    !Array.isArray(data.bankRecoveries))
   throw Error("Approved correction source is incomplete.");
  return data;
 },[base]);
 useEffect(()=>{
  let active=true;setLoading(true);setOptions(null);setEligible(true);
  setYear("");setReason("");setPassword("");setUncertain(false);
  setBankMatch("");setPayerMatched(false);
  setError("");setMessage("");
  if(typeof window!=="undefined")setRequestKey(window.crypto.randomUUID());
  void load().then(x=>{if(active){setOptions(x);setPostingDate(x.postingDate)}})
   .catch(e=>{if(active){
    if(e&&typeof e==="object"&&"status" in e&&e.status===403)
     setEligible(false);
    else setError(e instanceof Error?e.message:"Correction options unavailable.");
   }}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[load]);
 async function check(){
  if(busy)return;setBusy(true);setMessage("");setError("");
  try{
   const next=await load();setOptions(next);
   if(next.corrected){setUncertain(false);setPassword("");
    setMessage("The original liability has a verified offsetting CG09 journal.");
    await onCorrected();}
   else setMessage("No CG09 correction is confirmed. Do not create a second request key.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to check correction.")}
  finally{setBusy(false)}
 }
 const needsRecovery=!!options&&BigInt(options.requiredVerifiedRecoveryMinor)>0n;
 async function submit(){
  if(busy||!options?.canCorrect||uncertain||!ID.test(requestKey)||
    !ID.test(year)||reason.trim().length<12||reason.trim().length>300||
    password.length<8||!/^\d{4}-\d{2}-\d{2}$/.test(postingDate)||
    (needsRecovery&&(!ID.test(bankMatch)||!payerMatched)))return;
  if(!window.confirm("Post an opposite CG09 journal for this original "+
   "Foundation liability? A claimed or paid provider balance is adjusted "+
   "only using existing independently verified bank recovery, when needed. "+
   "No bank transfer or patient refund is initiated."))return;
  setBusy(true);setError("");setMessage("");
  try{
   const payload={requestKey,financialYearRef:year,postingDate,
    reason:reason.trim(),currentPassword:password};
   const v=await request<Result>(base+"reverse",options.claimAlreadyCreated?
    {...payload,bankMatchRef:needsRecovery?bankMatch:null,
     payerMatched:needsRecovery?payerMatched:false}:payload);
   if(v.status!=="REVERSED"||v.corrected!==true)
    throw Error("Independent CG09 reversal was not verified.");
   setPassword("");setUncertain(false);setOptions(await load());
   setMessage("Original CG09 offset posted. Original claim and payout history "+
    "are preserved. No transfer or refund was initiated.");
   await onCorrected();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   setError(e instanceof Error?e.message:"Correction outcome is uncertain.");
  }finally{setBusy(false)}
 }
 if(!ID.test(centerRef)||!ID.test(liabilityRef)||!eligible)return null;
 return <section className="cg-diagnostics-card" aria-label="Original Foundation correction">
  <h4>Correct an original Foundation accounting entry</h4>
  <p>An independently authorized Foundation reviewer may correct an original
   liability without deleting its journal or claim history. For overpaid
   provider claims, an existing independently verified incoming CG09 bank
   recovery is required before any correction can be posted.</p>
  {loading&&<p role="status">Checking independent correction permission…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!message&&<p role="status">{message}</p>}
  {options?.corrected&&<p role="status">The original entry was corrected
   by an offsetting journal. No additional reversal is permitted.</p>}
  {options?.claimAlreadyCreated&&!options.corrected&&!options.canCorrect&&
   <p role="alert">This liability cannot be corrected with the current
    reviewer authority or original bank evidence. Check the source record.</p>}
  {options?.canCorrect&&<>
   <p>The original amount will be offset using its exact actual accounts.
    Choose an open financial year covering the correction date.</p>
   {!options.complete&&<p role="alert">Financial year choices incomplete.
    Ask Foundation Accounts to check the configured years.</p>}
   {options.claimAlreadyCreated&&<p>Original provider claim: {
    options.claimState?.replaceAll("_"," ")??"Recorded"}.
    It remains in the audit history. Only the verified economic balance changes.</p>}
   {needsRecovery&&<>
    <p role="alert">Previously paid amount exceeds the corrected claim.
     Verify that an actual incoming Foundation bank receipt of {
     (Number(options.requiredVerifiedRecoveryMinor)/100).toFixed(2)} INR
     has already been independently reconciled in CG09.</p>
    <label className="field">Actual verified incoming provider bank recovery
     <select value={bankMatch} onChange={e=>{
      setBankMatch(e.target.value);setPayerMatched(false);
     }} disabled={busy||uncertain}>
      <option value="">Select original verified bank match</option>
      {options.bankRecoveries.map(x=><option key={x.bankMatchRef}
       value={x.bankMatchRef}>{x.bankItemLabel} — {
        (Number(x.amountMinor)/100).toFixed(2)} INR</option>)}
     </select>
    </label>
    <label className="field">
     <input type="checkbox" checked={payerMatched}
      onChange={e=>setPayerMatched(e.target.checked)}
      disabled={busy||uncertain||!ID.test(bankMatch)}/>
     I verified the recovered funds came from this provider using
     the original bank reference and independent supporting evidence.
    </label>
    {options.bankRecoveries.length===0&&
     <p role="alert">No matching verified incoming bank recovery.
      Record and independently verify the actual bank receipt in CG09 first.
      No correction or automatic bank refund will be claimed.</p>}
   </>}
   <label className="field">Open financial year
    <select value={year} onChange={e=>setYear(e.target.value)}
     disabled={busy||uncertain}>
     <option value="">Select a current open year</option>
     {options.financialYears.map(y=><option key={y.yearRef} value={y.yearRef}>
      {y.name}</option>)}
    </select>
   </label>
   <label className="field">Correction posting date
    <input type="date" value={postingDate}
     onChange={e=>setPostingDate(e.target.value)}
     disabled={busy||uncertain}/></label>
   <label className="field">Reason for original correction
    <textarea rows={3} maxLength={300} value={reason}
     onChange={e=>setReason(e.target.value)}
     disabled={busy||uncertain}
     placeholder="Describe the verified source error or cancellation"/></label>
   <label className="field">Confirm current Foundation password
    <input type="password" autoComplete="current-password"
     value={password} onChange={e=>setPassword(e.target.value)}
     disabled={busy||uncertain}/></label>
   <button type="button" className="primary"
    disabled={busy||uncertain||!options.complete||!ID.test(year)||
     !ID.test(requestKey)||reason.trim().length<12||password.length<8||
      (needsRecovery&&(!ID.test(bankMatch)||!payerMatched))}
    onClick={()=>void submit()}>Post protected CG09 correction</button>
   {uncertain&&<p role="alert">The request may have committed.
    Check its original status before retrying the same request key.</p>}
  </>}
  <button type="button" onClick={()=>void check()}
   disabled={busy||loading}>Check correction status</button>
 </section>;
}
