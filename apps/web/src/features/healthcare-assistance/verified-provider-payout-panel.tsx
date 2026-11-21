"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Bank={bankMatchRef:string;bankItemLabel:string;statementDate:string;
 amountMinor:string};
type Prior={bankMatchRef:string;bankItemLabel:string;verifiedAt:string;
 amountMinor:string};
type Options={settlementRef:string;state:string;outstandingMinor:string;
 actualPaidMinor:string;protectedDestinationLabel:string;
 bankDisbursements:Bank[];payoutHistory:Prior[];complete:boolean};
type Props={centerRef:string;month:string;onApplied:()=>Promise<void>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const money=(minor:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2
}).format(Number(minor)/100);
const root="/api/healthcare-assistance/provider-settlements/";
async function api<T>(path:string,body?:object){
 const reply=await fetch(root+path,{credentials:"same-origin",
  cache:"no-store",method:body?"POST":"GET",
  ...(body?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{})});
 const raw:unknown=await reply.json().catch(()=>null);
 if(!reply.ok)throw Object.assign(new Error(raw&&typeof raw==="object"&&
  "message" in raw&&typeof raw.message==="string"?raw.message:
  "Original CG09 bank reconciliation cannot be verified."),{
   status:reply.status});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw Error("The original provider payout source is unavailable.");
 return raw as T;
}
/** A POST here allocates a PREEXISTING independently verified CG09
 * bank reconciliation. It never sends money, generates a fake transaction,
 * or treats a center patient's own payment as Foundation bank income.
 */
export function VerifiedProviderPayoutPanel({centerRef,month,onApplied}:Props){
 const [data,setData]=useState<Options|null>(null);
 const [bankRef,setBankRef]=useState("");
 const [attested,setAttested]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const attempt=useRef<{bankRef:string;key:string}|null>(null);
 const tail="centers/"+centerRef+"/months/"+month+"/";
 const load=useCallback(async()=>{
  const value=await api<Options>(tail+"payout-options");
  if(!Array.isArray(value.bankDisbursements)||
    !Array.isArray(value.payoutHistory)||
    typeof value.protectedDestinationLabel!=="string"||
    typeof value.outstandingMinor!=="string")
   throw Error("Verified Foundation bank evidence is incomplete.");
  return value;
 },[tail]);
 useEffect(()=>{
  let live=true;
  void load().then(v=>{if(live)setData(v)})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:
    "Original verified payout records unavailable.");})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;};
 },[load]);
 async function refresh(){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const latest=await load();setData(latest);
   if(attempt.current&&latest.payoutHistory.some(x=>
    x.bankMatchRef===attempt.current!.bankRef)){
    attempt.current=null;setUncertain(false);
    setNotice("Original bank payment is already recorded. No second allocation was made.");
    await onApplied();
   }else{
    setUncertain(false);
    if(!attempt.current)setAttested(false);
   }
  }catch(e){setError(e instanceof Error?e.message:
   "Original payout source remains uncertain.");}
  finally{setBusy(false);}
 }
 async function confirm(){
  if(busy||uncertain||!data||!ID.test(bankRef)||!attested)return;
  const selection=data.bankDisbursements.find(x=>x.bankMatchRef===bankRef);
  if(!selection)return;
  if(!window.confirm("Confirm this is an already independently VERIFIED "+
   "CG09 Foundation bank transfer, and you personally checked its beneficiary "+
   "matches the protected CG14 provider bank instruction? No transfer is initiated."))
   return;
  if(!attempt.current||attempt.current.bankRef!==bankRef)
   attempt.current={bankRef,key:crypto.randomUUID()};
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<{state:string;actualPaidMinor:string}>(
    tail+"confirm-payout",{
     requestKey:attempt.current.key,bankMatchRef:bankRef, payeeMatched:true
    });
   if(!["PARTIALLY_SETTLED","SETTLED"].includes(result.state))
    throw Error("Verified original payout state cannot be confirmed.");
   attempt.current=null;setUncertain(false);setAttested(false);
   setBankRef("");
   setNotice("Existing independently verified CG09 payout linked to the approved "+
    "Foundation claim. No new bank transfer was initiated.");
   setData(await load());await onApplied();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)attempt.current=null;
   setError(e instanceof Error?e.message:
    "Payout allocation may have succeeded. Refresh the original bank match.");
  }finally{setBusy(false);}
 }
 return <section className="cg-diagnostics-card" aria-label="Verified CG09 provider bank payout">
  <h3>Actual verified provider bank payments</h3>
  <p>These entries come from independently verified CG09 bank reconciliations.
   This form allocates an existing payment; it never initiates a transfer.</p>
  {loading&&<p role="status">Checking protected original bank evidence…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {data&&<>
   <p>Protected provider bank reference: <strong>{
    data.protectedDestinationLabel}</strong>. Check the actual statement
    beneficiary against the original CG14 bank document before confirming.</p>
   <p>Approved claim still unpaid: <strong>{
    money(data.outstandingMinor)}</strong>.</p>
   {data.payoutHistory.length>0&&<div className="table-wrap">
    <table className="role-table">
     <thead><tr><th>Verified bank item</th><th>Amount</th><th>Confirmed</th></tr></thead>
     <tbody>{data.payoutHistory.map(x=><tr key={x.bankMatchRef}>
      <td>{x.bankItemLabel}</td><td>{money(x.amountMinor)}</td>
      <td>{new Date(x.verifiedAt).toLocaleDateString("en-IN")}</td>
     </tr>)}</tbody>
    </table>
   </div>}
   {data.state!=="SETTLED"&&<>
    {data.bankDisbursements.length===0&&<p>
     No independently verified CG09 disbursement matching the remaining payable
     is available. Do not record a provider payment from an unverified receipt.</p>}
    <label className="field">Original verified bank disbursement
     <select value={bankRef} disabled={busy||uncertain}
      onChange={e=>{setBankRef(e.target.value);setAttested(false);
       if(attempt.current?.bankRef!==e.target.value)attempt.current=null;}}>
      <option value="">Select an actual verified bank item</option>
      {data.bankDisbursements.map(x=><option value={x.bankMatchRef}
       key={x.bankMatchRef}>{x.bankItemLabel} — {money(x.amountMinor)}
       {" ("+x.statementDate+")"}</option>)}
     </select>
    </label>
    <label className="field">
     <input type="checkbox" checked={attested} disabled={busy||uncertain}
      onChange={e=>setAttested(e.target.checked)}/>
     I checked the original bank beneficiary against the protected
     verified CG14 provider bank instruction.
    </label>
    {!uncertain&&<button type="button" className="primary"
     disabled={busy||!ID.test(bankRef)||!attested}
     onClick={()=>void confirm()}>Link existing verified bank payout</button>}
   </>}
   {uncertain&&<p role="alert">The last allocation may already exist.
    Refresh the original bank reconciliation before retrying. Do not
    use a new payment request or claim a second provider transfer.</p>}
  </>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   {busy?"Checking…":"Recheck original bank proof and claim"}</button>
 </section>;
}
