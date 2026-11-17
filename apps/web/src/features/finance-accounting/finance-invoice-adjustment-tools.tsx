"use client";
import {useCallback,useEffect,useState} from "react";
type Choice={ref:string;code?:string;name:string};
type Credit={credit_note_number:string;collected_minor:string;total_minor:string};
type Refund={refundRef:string;amountMinor:string;status:string};
type Status={invoiceNumber:string;invoiceStatus:string;creditNote:Credit|null;refund:Refund|null;
 replacementInvoice:{invoiceNumber:string;status:string}|null};
type Options={refundLiabilityAccounts:Choice[];years:Choice[];banks:Choice[]};
type Pending={path:string;body:Record<string,unknown>;label:string};
const money=(minor:string)=>{try{const n=BigInt(minor);return "₹"+
 (n/100n).toLocaleString("en-IN")+"."+(n%100n).toString().padStart(2,"0");}
 catch{return "Unavailable";}};
async function errorMessage(res:Response){
 const value:unknown=await res.json().catch(()=>null);
 if(value&&typeof value==="object"&&"message" in value&&typeof value.message==="string")
  return value.message.slice(0,240);
 return res.status===403?"This original financial record is outside your current permissions.":
  "The action could not be confirmed. Check the original request before retrying.";
}
/** Original invoice remains issued. A separate credit note and refund are
 * independent immutable events; neither represents a verified bank payout.
 */
export function FinanceInvoiceAdjustmentTools({invoiceRef,canReview,canManage,onCredited}:{
 invoiceRef:string;canReview:boolean;canManage:boolean;onCredited:()=>void
}){
 const [data,setData]=useState<Status|null>(null);
 const [options,setOptions]=useState<Options|null>(null);
 const [creditYear,setCreditYear]=useState(""),[creditDate,setCreditDate]=useState("");
 const [reason,setReason]=useState(""),[liability,setLiability]=useState("");
 const [creditPassword,setCreditPassword]=useState("");
 const [refundYear,setRefundYear]=useState(""),[refundDate,setRefundDate]=useState("");
 const [refundBank,setRefundBank]=useState(""),[refundPassword,setRefundPassword]=useState("");
 const [transferReference,setTransferReference]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const [details,opts]=await Promise.all([
    fetch("/api/finance/invoices/"+invoiceRef+"/adjustment",{cache:"no-store"}),
    fetch("/api/finance/invoices/"+invoiceRef+"/adjustment-options",{cache:"no-store"})
   ]);
   if(!details.ok||!opts.ok)throw Error(await errorMessage(!details.ok?details:opts));
   setData(await details.json() as Status);setOptions(await opts.json() as Options);
  }catch(e){setError(e instanceof Error?e.message:"Original invoice adjustment unavailable.");}
 },[invoiceRef]);
 useEffect(()=>{void refresh();setPending(null);setError("");setNotice("");},[refresh]);
 async function submit(command:Pending){
  if(busy)return;
  setBusy(true);setPending(command);setError("");setNotice("");
  try{
   const res=await fetch("/api/finance/invoices/"+command.path,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(command.body)});
   if(!res.ok)throw Error(await errorMessage(res));
   const result=await res.json() as {confirmed?:boolean;status?:string};
   if(!result.confirmed)throw Error("Financial result is not yet confirmed.");
   setPending(null);setCreditPassword("");setRefundPassword("");
   if(result.status==="CREDIT_NOTE_POSTED")onCredited();
   setNotice(command.label+" recorded: "+(result.status??"confirmed")+
     ". An approved credit note does not prove a bank refund.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"The financial result is unconfirmed. Retry the same request.");}
  finally{setBusy(false);}
 }
 async function download(){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/finance/invoices/"+invoiceRef+"/credit-note/pdf",{cache:"no-store"});
   if(!res.ok||!res.headers.get("content-type")?.startsWith("application/pdf"))
    throw Error(await errorMessage(res));
   const blob=await res.blob();
   if(blob.size<100||blob.size>10485760)throw Error("Private credit note PDF could not be verified.");
   const url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download="CareGanga-Credit-Note.pdf";
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){setError(e instanceof Error?e.message:"Protected PDF unavailable.");}
  finally{setBusy(false);}
 }
 const base=invoiceRef+"/";
 return <section className="cg-fin-card" aria-label="Issued invoice corrections and refunds">
  <div className="cg-fin-toolbar"><h3>Credit note & refund</h3>
   <button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh status</button></div>
  <p className="cg-fin-help">The issued invoice and original payment stay unchanged.
   Use a credit note for a mistake. A bank refund needs a separate approval and statement verification.</p>
  {error&&<p role="alert" className="cg-fin-notice">{error}</p>}
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
  {data?.creditNote?<div className="cg-fin-summary">
   <p><strong>Credit note:</strong> {data.creditNote.credit_note_number} · {money(data.creditNote.total_minor)}</p>
   <p>Verified collections covered by refund: {money(data.creditNote.collected_minor)}</p>
   {data.replacementInvoice&&<p>Replacement invoice: <strong>{data.replacementInvoice.invoiceNumber}</strong> · {data.replacementInvoice.status}</p>}
   <button type="button" disabled={busy} onClick={()=>void download()}>Download / print credit note</button>
   {data.refund?<p role="status"><strong>Refund status:</strong> {data.refund.status.replaceAll("_"," ")}
    {data.refund.status==="BANK_POSTED_AWAITING_STATEMENT"&&
     " — verify the original outgoing bank statement in Finance reports."}</p>:
    BigInt(data.creditNote.collected_minor)>0n&&<p role="status">Refund has not been requested.</p>}
  </div>:canReview&&options&&<div className="cg-fin-form">
   <h4>Correct an issued invoice</h4>
   <label className="cg-fin-field">Open financial year
    <select value={creditYear} onChange={e=>setCreditYear(e.target.value)}>
     <option value="">Select year</option>{options.years.map(x=><option key={x.ref} value={x.ref}>{x.name}</option>)}
    </select></label>
   <label className="cg-fin-field">Credit note date
    <input type="date" value={creditDate} onChange={e=>setCreditDate(e.target.value)}/></label>
   <label className="cg-fin-field">Reason
    <textarea rows={2} minLength={8} maxLength={300} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <label className="cg-fin-field">Refund payable account (only if collected money exists)
    <select value={liability} onChange={e=>setLiability(e.target.value)}>
     <option value="">No refund payable / no collection</option>
     {options.refundLiabilityAccounts.map(x=><option key={x.ref} value={x.ref}>{x.name}</option>)}
    </select></label>
   <p className="cg-fin-help">If the original invoice has verified payments, select a liability account;
    otherwise leave it empty. Pending unverified collections must be reconciled first.</p>
   <label className="cg-fin-field">Current reviewer password
    <input type="password" autoComplete="current-password" value={creditPassword}
     onChange={e=>setCreditPassword(e.target.value)}/></label>
   <button type="button" disabled={busy||Boolean(pending)||!creditYear||!creditDate||
     reason.trim().length<8||creditPassword.length<8}
    onClick={()=>void submit({label:"Credit note",path:base+"credit-note",
     body:{requestKey:crypto.randomUUID(),financialYearRef:creditYear,
      postingDate:creditDate,reason,currentPassword:creditPassword,
      refundLiabilityAccountRef:liability||null}})}>Post linked credit note</button>
  </div>}
  {data?.creditNote&&BigInt(data.creditNote.collected_minor)>0n&&!data.refund&&
   canManage&&options&&<div className="cg-fin-form">
    <h4>Request bank refund</h4>
    <label className="cg-fin-field">Refund from bank
     <select value={refundBank} onChange={e=>setRefundBank(e.target.value)}>
      <option value="">Select bank</option>{options.banks.map(x=><option key={x.ref} value={x.ref}>
       {x.name}</option>)}</select></label>
    <label className="cg-fin-field">Open financial year
     <select value={refundYear} onChange={e=>setRefundYear(e.target.value)}>
      <option value="">Select year</option>{options.years.map(x=><option key={x.ref} value={x.ref}>
       {x.name}</option>)}</select></label>
    <label className="cg-fin-field">Bank posting date
     <input type="date" value={refundDate} onChange={e=>setRefundDate(e.target.value)}/></label>
    <p>Refund amount: {money(data.creditNote.collected_minor)} (original verified collection).</p>
    <button type="button" disabled={busy||Boolean(pending)||!refundBank||!refundYear||!refundDate}
     onClick={()=>void submit({label:"Refund request",path:base+"refunds",
      body:{requestKey:crypto.randomUUID(),financialYearRef:refundYear,
       bankAccountRef:refundBank,postingDate:refundDate}})}>Submit refund for approval</button>
   </div>}
  {data?.refund?.status==="PENDING_APPROVAL"&&canReview&&<div className="cg-fin-form">
   <h4>Independently approve refund</h4>
   <p>The requester cannot approve their own refund. Enter the actual bank transfer reference;
    the outgoing journal still awaits independent statement verification.</p>
   <label className="cg-fin-field">Actual bank transfer reference
    <input value={transferReference} maxLength={100} onChange={e=>setTransferReference(e.target.value)}
     placeholder="Transaction reference from the completed bank transfer"/>
   </label>
   <label className="cg-fin-field">Current reviewer password
    <input type="password" autoComplete="current-password" value={refundPassword}
     onChange={e=>setRefundPassword(e.target.value)}/></label>
   <button type="button" disabled={busy||Boolean(pending)||refundPassword.length<8||
    !/^[A-Za-z0-9._/: -]{4,100}$/.test(transferReference.trim())}
    onClick={()=>void submit({label:"Refund approval",
     path:"refunds/"+data.refund!.refundRef+"/approve",
     body:{requestKey:crypto.randomUUID(),currentPassword:refundPassword,
      transferReference:transferReference.trim()}})}>
    Approve refund and post bank journal</button>
  </div>}
  {pending&&<div role="status" className="cg-fin-pending">
   <p>The prior financial action may have been recorded. Do not send a new request key.</p>
   <button type="button" disabled={busy} onClick={()=>void submit(pending)}>Retry original request</button>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Check current financial status</button>
  </div>}
 </section>;
}
