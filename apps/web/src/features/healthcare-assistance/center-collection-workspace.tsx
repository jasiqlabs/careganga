"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
type Item={collectionRef:string;method:string;amountMinor:string;state:string;
 cashReceiptNumber:string|null;recordedAt:string;receiptPdfState:string};
type Adjustment={adjustmentRef:string;collectionRef:string;amountMinor:string;
 kind:string;refundReceiptNumber:string;recordedAt:string};
type Statement={chargeRef:string;currency:"INR";patientDueMinor:string;
 collectedMinor:string;outstandingMinor:string;pendingElectronicMinor:string;
 refundedOrCorrectedMinor:string;state:string;collections:Item[];
 adjustments:Adjustment[];foundationIncomeRecorded:false;
 foundationLiabilityCreated:false};
type Props={centerRef:string;chargeRef:string;canRecord:boolean;canRefund:boolean};
type Command={path:string;body:Record<string,unknown>;label:string};
const money=(v:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",
 maximumFractionDigits:2}).format(Number(v)/100);
const minor=(v:string)=>{
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(v))
  throw Error("Enter a valid rupee amount with up to two decimal places.");
 const [w,f=""]=v.split(".");
 const n=BigInt(w)*100n+BigInt((f+"00").slice(0,2));
 if(n<1n||n>10000000000n)throw Error("The payment amount is not valid.");
 return n.toString();
};
async function fetchSource<T>(path:string,body?:object){
 const res=await fetch("/api/healthcare-assistance/center-collections/"+path,{
  method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(res.status===401?
  "Sign in again to review this private center payment.":
  res.status===403?"Your current center/cashier role does not permit this payment.":
  res.status===404?"The original accepted consultation is unavailable.":
  res.status===409?"A receipt already exists or the outstanding amount changed. Check history.":
  "Payment outcome uncertain. Do not create another receipt before checking."),{
   status:res.status});
 return res.json() as Promise<T>;
}
function valid(s:unknown):s is Statement{
 if(!s||typeof s!=="object"||Array.isArray(s))return false;
 const v=s as Partial<Statement>;
 const n=(x:unknown)=>typeof x==="string"&&/^(0|[1-9]\d{0,10})$/.test(x)&&
  Number.isSafeInteger(Number(x));
 return v.currency==="INR"&&
  n(v.patientDueMinor)&&n(v.collectedMinor)&&n(v.outstandingMinor)&&
  n(v.pendingElectronicMinor)&&n(v.refundedOrCorrectedMinor)&&
  BigInt(v.patientDueMinor!)===BigInt(v.collectedMinor!)+
   BigInt(v.outstandingMinor!)&&
  Array.isArray(v.collections)&&v.collections.length<=50&&
  Array.isArray(v.adjustments)&&v.adjustments.length<=50&&
  v.foundationIncomeRecorded===false&&v.foundationLiabilityCreated===false;
}
/** CG01/CG14 own-center form. Never turns a receipt screenshot into PAID,
 * touches CG09 cash, or promises a CG19 PDF before issued source proof.
 */
export function CenterCollectionWorkspace({centerRef,chargeRef,canRecord,canRefund}:Props){
 const [data,setData]=useState<Statement|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const [method,setMethod]=useState<"CASH"|"UPI"|"CARD"|"BANK">("CASH");
 const [amount,setAmount]=useState(""),[receipt,setReceipt]=useState("");
 const [payerRef,setPayerRef]=useState(""),[cashConfirmed,setCashConfirmed]=useState(false);
 const [refundCollection,setRefundCollection]=useState("");
 const [refundAmount,setRefundAmount]=useState("");
 const [refundReceipt,setRefundReceipt]=useState("");
 const [refundReason,setRefundReason]=useState("");
 const [refundConfirmed,setRefundConfirmed]=useState(false);
 const last=useRef<Command|null>(null),generation=useRef(0);
 const root="staff/centers/"+centerRef;
 const refresh=useCallback(async()=>{
  const next=await fetchSource<Statement>(root+"/charges/"+chargeRef);
  if(!valid(next))throw Error("Original center payment balance is unavailable.");
  setData(next);return next;
 },[root,chargeRef]);
 useEffect(()=>{
  let live=true;const serial=++generation.current;
  setData(null);setLoading(true);setUncertain(false);
  setError("");setMessage("");last.current=null;
  void refresh().catch(e=>{if(live&&serial===generation.current)
   setError(e instanceof Error?e.message:"Current payment source unavailable.");})
   .finally(()=>{if(live&&serial===generation.current)setLoading(false);});
  return()=>{live=false;++generation.current};
 },[refresh]);
 async function commit(command:Command,retry=false){
  if(busy||uncertain&&!retry)return;
  setBusy(true);setError("");setMessage("");
  try{
   const v:unknown=await fetchSource(command.path,command.body);
   if(!v||typeof v!=="object"||!("statement" in v)||!valid(v.statement))
    throw Error("The payment command could not be verified.");
   setData(v.statement);last.current=null;setUncertain(false);
   setAmount("");setReceipt("");setPayerRef("");setCashConfirmed(false);
   setRefundCollection("");setRefundAmount("");setRefundReceipt("");
   setRefundReason("");setRefundConfirmed(false);
   setMessage(command.label);
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);if(status<500)last.current=null;
   setError(e instanceof Error?e.message:"Original payment not confirmed.");
  }finally{setBusy(false)}
 }
 function record(e:FormEvent){
  e.preventDefault();if(!canRecord||!data||busy||uncertain)return;
  try{
   if(method==="CASH"&&!cashConfirmed)
    throw Error("Confirm that you physically received this cash.");
   const paid=minor(amount);
   if(BigInt(paid)>BigInt(data.outstandingMinor))
    throw Error("Payment exceeds the current outstanding patient amount.");
   const body:Record<string,unknown>={
    requestKey:crypto.randomUUID(),method,amountMinor:paid,
    ...(method==="CASH"?{cashReceiptNumber:receipt.trim(),cashReceived:true}:
     {payerReference:payerRef.trim()||undefined})};
   const cmd={path:root+"/charges/"+chargeRef+"/record",body,
    label:method==="CASH"?"Verified cash attestation saved. "+
     "The original PDF receipt must still be issued and verified.":
     "Electronic reference saved as PENDING only. No paid status or receipt was issued."};
   last.current=cmd;void commit(cmd);
  }catch(e){setError(e instanceof Error?e.message:"Check the payment amount.");}
 }
 function refund(e:FormEvent){
  e.preventDefault();if(!canRefund||!data||busy||uncertain)return;
  if(!refundCollection||!refundConfirmed){
   setError("Select a verified cash receipt and confirm cash was returned.");return;
  }
  if(!window.confirm("Record this actual cash refund/correction? "+
    "The original receipt will remain in history."))return;
  try{
   const body={requestKey:crypto.randomUUID(),kind:"CASH_REFUND",
    refundMinor:minor(refundAmount),refundReceiptNumber:refundReceipt.trim(),
    reason:refundReason.trim(),cashReturned:true};
   const cmd={path:root+"/collections/"+refundCollection+"/refund",body,
    label:"Original cash refund recorded. Patient outstanding balance is updated; "+
     "Foundation payments are unchanged."};
   last.current=cmd;void commit(cmd);
  }catch(e){setError(e instanceof Error?e.message:"Check refund details.");}
 }
 if(!/^[a-f0-9-]{36}$/i.test(centerRef)||!/^[a-f0-9-]{36}$/i.test(chargeRef))
  return null;
 return <section className="form-section" aria-label="Current center patient collection">
  <h2>Patient payment at this center</h2>
  <p>Record only money actually received at this verified center.
   Cash requires your personal attestation and a unique durable receipt number.
   UPI, card and bank references remain pending until independent provider proof.</p>
  {loading&&<p role="status">Checking the original patient payable amount…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!message&&<p role="status" className="notice">{message}</p>}
  {data&&<div className="cg-diagnostics-card">
   <h3>Actual patient balance</h3>
   <dl className="cg-diagnostics-summary">
    <div><dt>Original patient payable</dt><dd>{money(data.patientDueMinor)}</dd></div>
    <div><dt>Verified center collections</dt><dd>{money(data.collectedMinor)}</dd></div>
    <div><dt>Still due from patient</dt><dd>{money(data.outstandingMinor)}</dd></div>
    <div><dt>Electronic verification pending</dt>
     <dd>{money(data.pendingElectronicMinor)}</dd></div>
    <div><dt>Cash refunded or corrected</dt>
     <dd>{money(data.refundedOrCorrectedMinor)}</dd></div>
   </dl>
   <p>Payment state: <strong>{data.state.replaceAll("_"," ")}</strong>.
    A patient collection does not constitute Foundation income or settlement.</p>
   <button type="button" disabled={busy} onClick={()=>
    void refresh().then(()=>setMessage("Current center payment state refreshed."))
     .catch(e=>setError(e instanceof Error?e.message:"Source unavailable."))}>
    Check latest verified balance</button>
  </div>}
  {uncertain&&<div className="cg-diagnostics-card" role="alert">
   <p>The last write may have succeeded. Do not enter a different receipt number
    for the same cash. Reuse the original request or recheck the actual history.</p>
   <button type="button" disabled={busy||!last.current} onClick={()=>{
    if(last.current)void commit(last.current,true);
   }}>Retry exact original payment request</button>
   <button type="button" disabled={busy} onClick={()=>void refresh().catch(e=>
    setError(e instanceof Error?e.message:"Original state unavailable."))}>
    Inspect saved payment history</button>
  </div>}
  {canRecord&&data&&BigInt(data.outstandingMinor)>0n&&!uncertain&&
   <form className="cg-diagnostics-card" onSubmit={record}>
    <h3>Record an on-site payment</h3>
    <div className="form-grid">
     <label className="field">Method
      <select value={method} disabled={busy} onChange={e=>
       setMethod(e.target.value as typeof method)}>
       <option value="CASH">Cash received</option>
       <option value="UPI">UPI — pending independent verification</option>
       <option value="CARD">Card — pending independent verification</option>
       <option value="BANK">Bank — pending independent verification</option>
      </select>
     </label>
     <label className="field">Amount received or claimed (₹)
      <input inputMode="decimal" required disabled={busy} value={amount}
       onChange={e=>setAmount(e.target.value)} placeholder="300.00"/>
     </label>
     {method==="CASH"?<label className="field">Unique physical cash receipt number
      <input required maxLength={60} disabled={busy} value={receipt}
       onChange={e=>setReceipt(e.target.value)} placeholder="CASH-2026-001"/>
     </label>:<label className="field">Original payment/reference details (optional)
      <input maxLength={100} disabled={busy} value={payerRef}
       onChange={e=>setPayerRef(e.target.value)}
       placeholder="Unverified UPI or bank reference"/>
     </label>}
    </div>
    {method==="CASH"?<label className="field">
     <input type="checkbox" required checked={cashConfirmed} disabled={busy}
      onChange={e=>setCashConfirmed(e.target.checked)}/>
     I personally received and counted this cash at this center.
    </label>:<p role="status">A screenshot or typed transaction ID does not
     verify receipt of electronic funds. This entry stays pending.</p>}
    <button className="primary" type="submit" disabled={busy}>
     {busy?"Verifying original entry…":
      method==="CASH"?"Attest received cash":"Record as pending only"}</button>
   </form>}
  {data&&<section className="cg-diagnostics-card">
   <h3>Original payment history</h3>
   {data.collections.length===0?<p>No verified center collection is recorded.</p>:
    <div className="table-wrap"><table className="role-table">
     <thead><tr><th>Method</th><th>Amount</th><th>Verification</th>
      <th>Receipt number</th><th>Private document</th></tr></thead>
     <tbody>{data.collections.map(c=><tr key={c.collectionRef}>
      <td>{c.method}</td><td>{money(c.amountMinor)}</td>
      <td>{c.state.replaceAll("_"," ")}</td>
      <td>{c.cashReceiptNumber??"—"}</td>
      <td>{c.receiptPdfState==="NOT_ELIGIBLE"?
       "No receipt for pending evidence":"Not yet issued/verified"}</td>
     </tr>)}</tbody>
    </table></div>}
   {data.adjustments.length>0&&<p role="status">
    {data.adjustments.length} original cash adjustment(s) retained for audit.
   </p>}
  </section>}
  {canRefund&&data?.collections.some(c=>c.method==="CASH"&&
   c.state==="VERIFIED_CASH")&&!uncertain&&
   <form className="cg-diagnostics-card" onSubmit={refund}>
    <h3>Actual cash refund</h3>
    <p>Refunds are separate immutable events. Only physically returned
     cash may be recorded; the original collection is never deleted.</p>
    <label className="field">Original verified cash receipt
     <select required value={refundCollection} disabled={busy}
      onChange={e=>setRefundCollection(e.target.value)}>
      <option value="">Select cash receipt</option>
      {data.collections.filter(c=>c.state==="VERIFIED_CASH"&&c.method==="CASH")
       .map(c=><option key={c.collectionRef} value={c.collectionRef}>
        {c.cashReceiptNumber} · {money(c.amountMinor)}</option>)}
     </select>
    </label>
    <label className="field">Cash returned (₹)
     <input required inputMode="decimal" disabled={busy} value={refundAmount}
      onChange={e=>setRefundAmount(e.target.value)}/>
    </label>
    <label className="field">Unique refund receipt number
     <input required maxLength={60} disabled={busy} value={refundReceipt}
      onChange={e=>setRefundReceipt(e.target.value)}/>
    </label>
    <label className="field">Reason
     <textarea required minLength={8} maxLength={400} disabled={busy}
      value={refundReason} onChange={e=>setRefundReason(e.target.value)}/>
    </label>
    <label className="field">
     <input type="checkbox" required disabled={busy} checked={refundConfirmed}
      onChange={e=>setRefundConfirmed(e.target.checked)}/>
     I personally returned this cash and issued the referenced refund receipt.
    </label>
    <button type="submit" disabled={busy}>Record actual cash refund</button>
   </form>}
 </section>;
}
