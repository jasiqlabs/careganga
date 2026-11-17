"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {FinanceVoucherSubmissionTools,type VoucherWorkflowRow} from "./finance-voucher-submission-tools";

type Year={yearRef:string;name:string;startOn:string;endOn:string;status:string};
type Branch={branchRef:string;name:string;code:string;version:number};
type Voucher=VoucherWorkflowRow&{type:string;postingDate:string;
 payeeName:string;purpose:string;totalMinor:string;version:number};
type Item={description:string;quantity:string;unitRate:string};
type Detail={voucherRef:string;voucherNumber:string;version:number;status:string;
 header:{financialYearRef?:string;branchRef?:string|null;type?:string;
  postingDate?:string;payeeName?:string;purpose?:string;paymentAccountRef?:string|null;
  debitAccountRef?:string|null;creditAccountRef?:string|null};
 lines:{description:string;quantity:number;unitRateMinor:string;lineTotalMinor:string}[];
 taxMinor:string;chargesMinor:string;grossMinor:string;totalMinor:string};
type Pending={key:string;path:string;method:"POST"|"PATCH";payload:Record<string,unknown>};
function money(minor:string){
 try{const n=BigInt(minor),abs=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+"."+
   (abs%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}
}
function decimal(minor:string){
 try{let n=BigInt(minor);return (n/100n).toString()+"."+
  (n%100n).toString().padStart(2,"0");}
 catch{return "0.00";}
}
async function failure(res:Response):Promise<string>{
 const body:unknown=await res.json().catch(()=>null);
 const obj=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:{};
 if(typeof obj.code==="string"&&obj.code.startsWith("FINANCE_")&&
   typeof obj.message==="string"&&obj.message.length<=300)return obj.message;
 return res.status===403?"Your role cannot save Finance vouchers. Ask the Administrator.":
  res.status===401?"Your session expired. Sign in again.":
  res.status===409?"The voucher or financial period changed. Refresh its current details before editing.":
  res.status===400?"Review the voucher fields, quantities and amounts before saving.":
  "The save outcome could not be confirmed. Check the original request before retrying.";
}
const item=():Item=>({description:"",quantity:"1",unitRate:""});
const initial=()=>({type:"EXPENSE",financialYearRef:"",branchRef:"",
 postingDate:"",payeeName:"",purpose:"",paymentAccountRef:"",
 debitAccountRef:"",creditAccountRef:"",tax:"0",charges:"0"});
export function FinanceVoucherDraftWorkspace({years,branches,canManage,canViewEvidence=false,canUploadEvidence=false}:{
 years:readonly Year[];branches:readonly Branch[];canManage:boolean;
 canViewEvidence?:boolean;canUploadEvidence?:boolean
}){
 const [data,setData]=useState<Voucher[]>([]);
 const [offset,setOffset]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [editing,setEditing]=useState(false);
 const [loadingDraft,setLoadingDraft]=useState(false);
 const [target,setTarget]=useState<{ref:string;number:string;version:number}|null>(null);
 const [form,setForm]=useState(initial());
 const [items,setItems]=useState<Item[]>([item()]);
 const [paymentAccounts,setPaymentAccounts]=useState<Array<{accountRef:string;name:string;code:string;kind:string;branchRef:string|null;branchName:string|null}>>([]);
 const [paymentSearch,setPaymentSearch]=useState("");
 const [accountSearch,setAccountSearch]=useState("");
 const [accounts,setAccounts]=useState<Array<{accountRef:string;name:string;code:string;kind:string;category:string;branchRef:string|null;branchName:string|null}>>([]);
 const [accountError,setAccountError]=useState("");
 const [accountMore,setAccountMore]=useState(false);
 const [paymentError,setPaymentError]=useState("");
 const [paymentMore,setPaymentMore]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [notFound,setNotFound]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const res=await fetch("/api/finance/vouchers/drafts?offset="+offset,{cache:"no-store"});
   if(!res.ok)throw Error(await failure(res));
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("vouchers" in raw)||!Array.isArray(raw.vouchers)||
     !("nextOffset" in raw)||!(raw.nextOffset===null||typeof raw.nextOffset==="number"))
    throw Error("Voucher records could not be verified. Refresh and try again.");
   setData(raw.vouchers as Voucher[]);setNextOffset(raw.nextOffset);
  }catch(e){setData([]);setNextOffset(null);setError(e instanceof Error?e.message:
   "Cannot load voucher drafts. Check your connection and retry.");}
  finally{setLoading(false);}
 },[offset]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!editing)return;
  let live=true;
  void(async()=>{
   try{
    const r=await fetch("/api/finance/vouchers/posting-accounts?q="+
      encodeURIComponent(accountSearch),{cache:"no-store"});
    if(!r.ok)throw Error(await failure(r));
    const raw:unknown=await r.json();
    if(!raw||typeof raw!=="object"||!("accounts" in raw)||!Array.isArray(raw.accounts)||
      !("hasMore" in raw)||typeof raw.hasMore!=="boolean")
     throw Error("The permitted debit and credit accounts could not be verified.");
    if(live){setAccounts(raw.accounts);setAccountMore(raw.hasMore);setAccountError("");}
   }catch(e){if(live){setAccounts([]);setAccountMore(false);setAccountError(
     e instanceof Error?e.message:"Account choices are unavailable. Check again.");}}
  })();
  return()=>{live=false;};
 },[editing,accountSearch]);
 useEffect(()=>{
  if(!editing)return;
  let live=true;
  void(async()=>{
   try{
    const response=await fetch("/api/finance/vouchers/payment-accounts?q="+
      encodeURIComponent(paymentSearch),{cache:"no-store"});
    if(!response.ok)throw Error(await failure(response));
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object"||!("accounts" in raw)||!Array.isArray(raw.accounts)||
      !("hasMore" in raw)||typeof raw.hasMore!=="boolean")
     throw Error("Cash and bank account choices could not be verified.");
    if(live){setPaymentAccounts(raw.accounts);setPaymentMore(raw.hasMore);setPaymentError("");}
   }catch(e){if(live){setPaymentAccounts([]);setPaymentMore(false);
    setPaymentError(e instanceof Error?e.message:
     "Cash and bank accounts are unavailable. Refresh the selector.");}}
  })();
  return()=>{live=false;};
 },[editing,paymentSearch]);

 function start(){
  if(!canManage)return;
  setEditing(true);setTarget(null);setNotice("");setPending(null);setNotFound(false);
  setForm(initial());setItems([item()]);setSuccess("");
 }
 async function edit(draft:Voucher){
  if(!canManage||!["DRAFT","RETURNED"].includes(draft.status))return;
  setLoadingDraft(true);setNotice("");
  try{
   const res=await fetch("/api/finance/vouchers/drafts/"+draft.voucherRef,{cache:"no-store"});
   if(!res.ok)throw Error(await failure(res));
   const raw=await res.json() as Detail;
   if(!raw||!["DRAFT","RETURNED"].includes(raw.status)||
     !Array.isArray(raw.lines)||!raw.header)
     throw Error("The voucher is no longer a draft. Refresh its review status.");
   setTarget({ref:raw.voucherRef,number:raw.voucherNumber,version:raw.version});
   setForm({type:raw.header.type??"EXPENSE",financialYearRef:raw.header.financialYearRef??"",
    branchRef:raw.header.branchRef??"",postingDate:raw.header.postingDate??"",
    payeeName:raw.header.payeeName??"",purpose:raw.header.purpose??"",
    paymentAccountRef:raw.header.paymentAccountRef??"",
    debitAccountRef:raw.header.debitAccountRef??"",
    creditAccountRef:raw.header.creditAccountRef??"",
    tax:decimal(raw.taxMinor),charges:decimal(raw.chargesMinor)});
   setItems(raw.lines.map(l=>({description:l.description,quantity:String(l.quantity),
    unitRate:decimal(l.unitRateMinor)})));
   setPending(null);setNotFound(false);setEditing(true);setSuccess("");
  }catch(e){setNotice(e instanceof Error?e.message:"The draft cannot be opened. Refresh and retry.");}
  finally{setLoadingDraft(false);}
 }
 function field(name:keyof ReturnType<typeof initial>,value:string){
  setForm(v=>({...v,[name]:value}));setNotice("");
 }
 function updateItem(index:number,field:keyof Item,value:string){
  setItems(v=>v.map((l,i)=>i===index?{...l,[field]:value}:l));setNotice("");
 }
 function requestBody(){
  const branch=branches.find(x=>x.branchRef===form.branchRef);
  return {
   financialYearRef:form.financialYearRef,voucherType:form.type,
   postingDate:form.postingDate,payeeName:form.payeeName,purpose:form.purpose,
   paymentAccountRef:form.paymentAccountRef,
   debitAccountRef:form.debitAccountRef,
   creditAccountRef:["PAYMENT","CONTRA"].includes(form.type)?
     form.paymentAccountRef:form.creditAccountRef,
   ...(form.branchRef?{branchRef:form.branchRef,branchVersion:branch?.version}:{}),
   lines:items.map(l=>({description:l.description,
     quantity:Number(l.quantity),unitRate:l.unitRate})),
   tax:form.tax,charges:form.charges,
   ...(target?{expectedVersion:target.version}:{})
  };
 }
 async function save(original:Pending){
  setBusy(true);setNotice("");setNotFound(false);
  try{
   const res=await fetch("/api/finance/"+original.path,{
    method:original.method,headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...original.payload,requestKey:original.key})});
   if(!res.ok){
    setNotice(await failure(res));
    setPending(res.status>=500?original:null);return;
   }
   const raw:unknown=await res.json().catch(()=>null);
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||raw.confirmed!==true||
     !("voucherNumber" in raw)||typeof raw.voucherNumber!=="string")
    throw Error("UNCONFIRMED");
   setPending(null);setEditing(false);
   setSuccess("Voucher "+raw.voucherNumber+" saved as Draft. It is not approved, posted or paid.");
   await refresh();
  }catch{
   setPending(original);
   setNotice("The voucher save outcome could not be confirmed. Check the original request before trying again.");
  }finally{setBusy(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!canManage||busy||pending)return;
  const invalid=items.some(l=>!/^([1-9][0-9]{0,5})$/.test(l.quantity));
  if(invalid){setNotice("Enter each item's whole-unit quantity between 1 and 1,000,000.");return;}
  if(["PAYMENT","CONTRA"].includes(form.type)&&!form.paymentAccountRef){
   setNotice("Select an active cash or bank account for this payment voucher.");return;
  }
  const payload=requestBody();
  void save({key:crypto.randomUUID(),
   path:target?"vouchers/drafts/"+target.ref:"vouchers/drafts",
   method:target?"PATCH":"POST",payload});
 }
 async function verify(){
  if(!pending||busy)return;
  setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance/vouchers/draft-commands/"+pending.key,{cache:"no-store"});
   if(!res.ok){setNotice(await failure(res));return;}
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||
     typeof raw.confirmed!=="boolean")throw Error("UNVERIFIED");
   if(raw.confirmed){
    setPending(null);setEditing(false);
    setSuccess("The original voucher draft was saved. This is not an approval or payment.");
    await refresh();
   }else{
    setNotFound(true);
    setNotice("No completed change was found for this request. Retry the same request only.");
   }
  }catch{
   setNotice("The original voucher save cannot be confirmed. Check again before retrying.");
  }finally{setBusy(false);}
 }
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h2>Finance Voucher Drafts</h2>
   <p>Drafts are not approved, posted or paid. Verified file and reviewer workflows follow separately.</p></div>
   <div className="cg-fin-toolbar-actions">
    <button type="button" disabled={loading} onClick={()=>void refresh()}>Refresh</button>
    {canManage&&<button className="primary" onClick={start} type="button">+ New Voucher</button>}
   </div></div>
  {success&&<p role="status" className="cg-fin-success">{success}</p>}
  {(error||(!editing&&notice))&&<div className="cg-fin-notice" role="alert">
   <p>{error||notice}</p><button type="button" onClick={()=>void refresh()}>Retry</button></div>}
  {loadingDraft&&<p role="status" className="cg-fin-empty">Opening the latest voucher revision…</p>}
  {loading&&<p role="status" className="cg-fin-empty">Loading real voucher drafts…</p>}
  {!loading&&!error&&<div className="cg-fin-table-wrap">
   <table className="cg-fin-table"><thead><tr>
    <th>Voucher No.</th><th>Type</th><th>Posting Date</th><th>Payee</th>
    <th>Purpose</th><th>Total (₹)</th><th>Status</th>{canManage&&<th>Action</th>}</tr></thead>
    <tbody>{data.map(v=><tr key={v.voucherRef}>
     <td><strong>{v.voucherNumber}</strong></td><td>{v.type}</td>
     <td>{v.postingDate}</td><td>{v.payeeName}</td><td>{v.purpose}</td>
     <td className="cg-fin-money">{money(v.totalMinor)}</td>
     <td><span className="cg-fin-status">{v.status==="DRAFT"?"Draft — not posted":
      v.status==="SUBMITTED"?"Awaiting real approval":v.status==="APPROVED"?
      "Approved — not paid":v.status==="RETURNED"?"Returned for correction":
      v.status==="REJECTED"?"Rejected":"Review status unavailable"}</span></td>
     {canManage&&<td>
      {["DRAFT","RETURNED"].includes(v.status)&&<button type="button"
       disabled={loadingDraft||busy} onClick={()=>void edit(v)}>
       {v.status==="RETURNED"?"Correct returned voucher":"Edit draft"}</button>}
      {["DRAFT","SUBMITTED"].includes(v.status)&&<FinanceVoucherSubmissionTools
       voucher={v} canViewEvidence={canViewEvidence}
       canUploadEvidence={canUploadEvidence} onUpdated={()=>void refresh()}/>}
      {!["DRAFT","RETURNED","SUBMITTED"].includes(v.status)&&
       <span className="cg-fin-help">Read-only review outcome</span>}
     </td>}
    </tr>)}</tbody>
   </table>{!data.length&&<p className="cg-fin-empty">No vouchers have been drafted.
    {canManage?" Choose New Voucher to start a genuine draft.":""}</p>}
   <div className="cg-fin-paging"><span>{data.length} voucher drafts displayed</span>
    <button type="button" disabled={offset===0||loading}
      onClick={()=>setOffset(v=>Math.max(0,v-40))}>Previous</button>
    <button type="button" disabled={nextOffset===null||loading}
      onClick={()=>setOffset(nextOffset??0)}>Next</button>
   </div>
  </div>}
  {editing&&<div className="drawer-backdrop" role="presentation">
   <div role="dialog" aria-modal="true" aria-labelledby="cg-fin-voucher-title"
    className="role-drawer cg-fin-drawer">
    <div className="cg-fin-drawer-header"><div><p>Finance Management / Voucher</p>
     <h2 id="cg-fin-voucher-title">{target?"Edit "+target.number:"New Voucher Draft"}</h2></div>
     <button type="button" aria-label="Close voucher form" disabled={busy||Boolean(pending)}
      onClick={()=>setEditing(false)}>×</button></div>
    <p className="cg-fin-description">Stage 1: voucher details · Stage 2: line items and totals.
     Saving creates only a draft; evidence verification and approval are separate.</p>
    <form className="cg-fin-form" onSubmit={submit}>
     <label className="cg-fin-field">Voucher type *
      <select required value={form.type} onChange={e=>field("type",e.target.value)}>
       <option value="PAYMENT">Payment voucher</option><option value="EXPENSE">Expense voucher</option>
       <option value="CONTRA">Contra voucher</option><option value="GENERAL">General voucher</option>
      </select></label>
     <label className="cg-fin-field">Open financial year *
      <select required value={form.financialYearRef}
       onChange={e=>field("financialYearRef",e.target.value)}>
       <option value="">Choose an open year</option>
       {years.filter(y=>y.status==="OPEN").map(y=><option key={y.yearRef} value={y.yearRef}>
        {y.name} — {y.startOn} to {y.endOn}</option>)}
      </select></label>
     <label className="cg-fin-field">Posting date *
      <input type="date" required value={form.postingDate}
       onChange={e=>field("postingDate",e.target.value)}/></label>
     <label className="cg-fin-field">Scope
      <select value={form.branchRef} onChange={e=>field("branchRef",e.target.value)}>
       <option value="">Foundation-wide</option>
       {branches.map(b=><option key={b.branchRef} value={b.branchRef}>
        {b.name} — {b.code}</option>)}
      </select></label>
     <div className="cg-fin-field">
      <label htmlFor="cg-fin-account-search">Find debit and credit accounts by name or code</label>
      <input id="cg-fin-account-search" value={accountSearch} maxLength={80}
       placeholder="Search current permitted accounts"
       onChange={e=>setAccountSearch(e.target.value)}/>
      {accountError&&<p role="alert">{accountError}</p>}
      <label htmlFor="cg-fin-debit-account">Debit account *</label>
      <select id="cg-fin-debit-account" value={form.debitAccountRef} required
       onChange={e=>field("debitAccountRef",e.target.value)}>
       <option value="">Select which account receives the debit</option>
       {accounts.filter(a=>(!a.branchRef||a.branchRef===form.branchRef)&&
        (form.type==="EXPENSE"?a.category==="EXPENSE":
         form.type==="CONTRA"?["BANK","CASH"].includes(a.kind):true))
        .map(a=><option key={a.accountRef} value={a.accountRef}>
         {a.name} · {a.code}{a.branchName?" ("+a.branchName+")":""}</option>)}
      </select>
      {["PAYMENT","CONTRA"].includes(form.type)?
       <p className="cg-fin-help">Credit account is the cash/bank account you select below.</p>:
       <><label htmlFor="cg-fin-credit-account">Credit account *</label>
        <select id="cg-fin-credit-account" value={form.creditAccountRef} required
         onChange={e=>field("creditAccountRef",e.target.value)}>
         <option value="">Select the balancing credit account</option>
         {accounts.filter(a=>(!a.branchRef||a.branchRef===form.branchRef)&&
          (form.type==="EXPENSE"?a.category==="LIABILITY":true))
          .map(a=><option key={a.accountRef} value={a.accountRef}>
           {a.name} · {a.code}{a.branchName?" ("+a.branchName+")":""}</option>)}
        </select></>}
      {accountMore&&<p className="cg-fin-help">More permitted accounts exist. Refine the search.</p>}
      <p className="cg-fin-help">The total is posted only once, after actual review and applicable payment proof. Posting and payment remain distinct.</p>
     </div>
     <div className="cg-fin-field">
      <label htmlFor="cg-fin-payments-search">Find cash or bank account by name / code</label>
      <input id="cg-fin-payments-search" value={paymentSearch} maxLength={80}
       placeholder="Search permitted Foundation or branch accounts"
       onChange={e=>setPaymentSearch(e.target.value)}/>
      {paymentError&&<p role="alert">{paymentError}</p>}
      <label htmlFor="cg-fin-payments-account">Cash or bank account
       {["PAYMENT","CONTRA"].includes(form.type)?" *":" (optional)"}</label>
      <select id="cg-fin-payments-account" value={form.paymentAccountRef}
       required={["PAYMENT","CONTRA"].includes(form.type)}
       onChange={e=>field("paymentAccountRef",e.target.value)}>
       <option value="">Choose a real permitted cash/bank account</option>
       {paymentAccounts.filter(a=>!a.branchRef||a.branchRef===form.branchRef)
        .map(a=><option key={a.accountRef} value={a.accountRef}>
         {a.name} · {a.kind} · {a.code}{a.branchName?" ("+a.branchName+")":""}
        </option>)}
      </select>
      {paymentMore&&<p className="cg-fin-help">More accounts exist. Refine the search to find the right one.</p>}
      <p className="cg-fin-help">Selecting an account does not transfer funds or confirm payment.</p>
     </div>
     <label className="cg-fin-field">Payee / Counterparty name *
      <input required minLength={2} maxLength={150} value={form.payeeName}
       onChange={e=>field("payeeName",e.target.value)}/></label>
     <label className="cg-fin-field">Purpose *
      <textarea required minLength={3} maxLength={500} rows={3}
       value={form.purpose} onChange={e=>field("purpose",e.target.value)}/></label>
     {items.map((it,index)=><div key={index} className="cg-fin-journal-line">
      <div className="cg-fin-journal-line-head"><strong>Item {index+1}</strong>
       {items.length>1&&<button type="button"
        onClick={()=>setItems(v=>v.filter((_,i)=>i!==index))}>Remove</button>}
      </div>
      <label className="cg-fin-field">Item description *
       <input required minLength={2} maxLength={180} value={it.description}
        onChange={e=>updateItem(index,"description",e.target.value)}/></label>
      <div className="cg-fin-journal-amounts">
       <label className="cg-fin-field">Quantity (whole units) *
        <input required inputMode="numeric" value={it.quantity} maxLength={7}
         onChange={e=>updateItem(index,"quantity",e.target.value)}/></label>
       <label className="cg-fin-field">Unit rate (₹) *
        <input required inputMode="decimal" maxLength={16} value={it.unitRate}
         onChange={e=>updateItem(index,"unitRate",e.target.value)}/></label>
      </div>
     </div>)}
     {items.length<40&&<button type="button" onClick={()=>setItems(v=>[...v,item()])}>
      + Add voucher item</button>}
     <div className="cg-fin-journal-amounts">
      <label className="cg-fin-field">Tax amount (₹)
       <input value={form.tax} maxLength={16} inputMode="decimal"
        onChange={e=>field("tax",e.target.value)}/></label>
      <label className="cg-fin-field">Other charges (₹)
       <input value={form.charges} maxLength={16} inputMode="decimal"
        onChange={e=>field("charges",e.target.value)}/></label>
     </div>
     <p className="cg-fin-help">Money will not be posted from this draft. A genuine verified reviewer decision and required evidence are needed before any later financial effect.</p>
     {notice&&<div className="cg-fin-notice" role="alert"><p>{notice}</p></div>}
     {pending&&<div className="cg-fin-pending">
      <p>The previous draft save has an unconfirmed result. Check the same request before retrying.</p>
      <button type="button" disabled={busy} onClick={()=>void verify()}>Check original save</button>
      {notFound&&<button type="button" disabled={busy}
        onClick={()=>void save(pending)}>Retry same request</button>}
     </div>}
     <div className="cg-fin-form-actions">
      <button type="button" disabled={busy||Boolean(pending)}
       onClick={()=>setEditing(false)}>Cancel</button>
      <button className="primary" type="submit" disabled={busy||Boolean(pending)}>
       {busy?"Saving…":"Save Draft — Not Posted"}</button>
     </div>
    </form>
   </div>
  </div>}
 </section>;
}
