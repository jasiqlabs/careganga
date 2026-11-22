"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {FinanceClaimBillTools} from "./finance-claim-bill-tools";

type Claim={claimRef:string;claimNumber:string;category:string;purpose:string;expenseDate:string;
 amountMinor:string;status:string;version:number;createdAt:string;paymentState?:string};
function claimStatus(c:Claim){
 if(c.paymentState==="PAID_VERIFIED"&&c.status==="APPROVED")return "Paid — verified";
 if(c.paymentState==="PAYABLE"&&c.status==="APPROVED")return "Payable — payment not verified";
 return c.status==="DRAFT"?"Draft — verified bill required":c.status==="SUBMITTED"?"Awaiting protected review":
 c.status==="APPROVED"?"Approved — posting/payment separate":c.status==="RETURNED"?"Returned for correction":
 c.status==="REJECTED"?"Rejected":"Check original status";
}
function matches(c:Claim,filter:string,search:string){
 const status=c.status==="APPROVED"&&["PAYABLE","PAID_VERIFIED"].includes(c.paymentState??"")?c.paymentState:c.status;
 return (filter==="ALL"||status===filter)&&(!search.trim()||[c.claimNumber,c.category,c.purpose].join(" ").toLowerCase().includes(search.trim().toLowerCase()));
}
const filters=["ALL","DRAFT","SUBMITTED","APPROVED","PAYABLE","PAID_VERIFIED","RETURNED","REJECTED"];
const filterLabel=(v:string)=>({ALL:"All",DRAFT:"Draft",SUBMITTED:"Pending review",APPROVED:"Approved",PAYABLE:"Payable",PAID_VERIFIED:"Paid verified",RETURNED:"Returned",REJECTED:"Rejected"} as Record<string,string>)[v]??v;

type Draft={category:string;purpose:string;expenseDate:string;amount:string};
const empty=():Draft=>({category:"",purpose:"",expenseDate:"",amount:""});
function money(minor:string){
 try{const v=BigInt(minor);return "₹"+(v/100n).toLocaleString("en-IN")+
  "."+(v%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}
}
type SafeProblem={message?:string;field?:string;code?:string};
async function problem(res:Response):Promise<SafeProblem>{
 const data:unknown=await res.json().catch(()=>null);
 if(data&&typeof data==="object"&&!Array.isArray(data)){
  const x=data as Record<string,unknown>;
  if(typeof x.message==="string"&&x.message.length<=300)
   return {message:x.message,field:typeof x.field==="string"?x.field:undefined};
 }
 return {message:res.status===401?"Your session expired. Sign in again.":
   res.status===403?"Your role cannot access these claims. Ask the Administrator for access.":
   res.status===409?"This claim has already changed. Refresh before retrying.":
   "The result is not confirmed. Check your saved claims before sending again."};
}
export function FinanceExpenseClaimWorkspace({canCreate,canView,allowanceMode=false,canUploadBill=true}:{
 canCreate:boolean;canView:boolean;allowanceMode?:boolean;canUploadBill?:boolean}){
 const [claims,setClaims]=useState<Claim[]>([]);
 const [eligible,setEligible]=useState(false),[search,setSearch]=useState(""),[filter,setFilter]=useState("ALL");
 const [drawer,setDrawer]=useState(false);
 const allowCreate=canCreate&&(!allowanceMode||eligible);
 const [offset,setOffset]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [form,setForm]=useState<Draft>(empty());
 const [correction,setCorrection]=useState<{ref:string;version:number;number:string}|null>(null);
 const [pendingKey,setPendingKey]=useState<string|null>(null);
 const [fieldError,setFieldError]=useState<{name:string;message:string}|null>(null);
 const [openClaim,setOpenClaim]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState("");
 const [feedback,setFeedback]=useState("");
 const refresh=useCallback(async()=>{
  if(!canView)return;
  setLoading(true);setNotice("");
  try{
   const res=await fetch("/api/finance/claims/mine?offset="+offset+(allowanceMode?"&source=HR_ALLOWANCE":""),{cache:"no-store"});
   if(!res.ok)throw Error((await problem(res)).message);
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("claims" in raw)||
     !Array.isArray(raw.claims)||!("nextOffset" in raw)||
     !(raw.nextOffset===null||typeof raw.nextOffset==="number"))
    throw Error("Claim records could not be verified. Refresh the page.");
   setClaims(raw.claims as Claim[]);setNextOffset(raw.nextOffset);setEligible(true);
  }catch(e){setClaims([]);setNextOffset(null);setEligible(false);setNotice(
   e instanceof Error?e.message:"Could not load your claims. Refresh and retry.");}
  finally{setLoading(false);}
 },[offset,canView,allowanceMode]);
 useEffect(()=>{void refresh();},[refresh]);
 function change(field:keyof Draft,value:string){
  setForm(f=>({...f,[field]:value}));
  setPendingKey(null);setFieldError(null);setFeedback("");
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!allowCreate||saving)return;
  const key=pendingKey??crypto.randomUUID();setPendingKey(key);
  setSaving(true);setFeedback("");setFieldError(null);
  try{
   const res=await fetch(correction?"/api/finance/claims/"+correction.ref+"/correct":"/api/finance/claims/drafts",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...form,requestKey:key,...(correction?{expectedVersion:correction.version}:allowanceMode?{sourceKind:"HR_ALLOWANCE"}:{})})});
   if(!res.ok){
    const p=await problem(res);
    if(p.field)setFieldError({name:p.field,message:p.message??"Check this value."});
    if(res.status<500){setFeedback(p.message??"The claim could not be saved.");return;}
    throw Error(p.message??"The claim could not be saved.");
   }
   const result:unknown=await res.json();
   if(!result||typeof result!=="object"||!("confirmed" in result)||
      result.confirmed!==true||!("status" in result)||result.status!=="DRAFT")
    throw Error("The claim save could not be verified. Check its status before retrying.");
   setForm(empty());setPendingKey(null);setCorrection(null);setOffset(0);
   setFeedback(correction?"Returned claim corrected as a new original revision. Upload a fresh scanned bill before resubmitting.":"Expense claim draft saved. A verified bill and separate review are required before any payment or posting.");
   void refresh();
  }catch(e){
   try{
    const status=await fetch("/api/finance/claims/"+(correction?"workflow-commands":"draft-commands")+"/"+key,{cache:"no-store"});
    if(status.ok){
     const result:unknown=await status.json();
     if(result&&typeof result==="object"&&"confirmed" in result&&result.confirmed===true&&"status" in result&&result.status==="DRAFT"){
      setForm(empty());setPendingKey(null);setCorrection(null);setOffset(0);
      setFeedback("Your original claim draft was saved. It is not submitted, approved or paid.");
      void refresh();return;
     }
    }
   }catch{/* An unknown outcome must remain unknown. */}
   setFeedback(e instanceof Error?e.message:
    "Could not confirm the save. Check your original request before trying again.");
  }finally{setSaving(false);}
 }
 const visible=allowanceMode?claims.filter(c=>matches(c,filter,search)):claims;
 return <section className="cg-fin-manual" aria-label={allowanceMode?"Employee allowances":"Foundation expense claims"}>
  <div className="cg-fin-toolbar"><div><h1>{allowanceMode?"My Allowance Requests":"Expense Claims"}</h1>
   <p>{allowanceMode?"Request an allowance against your current approved employment and branch.":"Your actual Foundation reimbursements."} Saving a draft does not create an approved expense, payable or payment.</p>
   </div><button type="button" disabled={loading} onClick={()=>void refresh()}>Refresh</button></div>
  {feedback&&<p role="status" className="cg-fin-notice">{feedback}</p>}
  {notice&&<p role="alert" className="cg-fin-notice">{notice}</p>}
  {allowanceMode&&allowCreate&&<button type="button" className="primary" onClick={()=>setDrawer(v=>!v)}>{drawer?"Close request form":"Request Allowance"}</button>}
  {allowCreate&&(!allowanceMode||drawer)&&<div className="cg-fin-drawer">
   <h3>{correction?"Correct "+correction.number+" (new revision)":allowanceMode?"Request Allowance":"New expense claim draft"}</h3>
   <form className="cg-fin-form" onSubmit={e=>void save(e)}>
    <label className="cg-fin-field">Expense category *
     <input required minLength={2} maxLength={80} value={form.category}
      onChange={e=>change("category",e.target.value)} placeholder="e.g. Travel"/>
     {fieldError?.name==="category"&&<span role="alert">{fieldError.message}</span>}</label>
    <label className="cg-fin-field">Expense date *
     <input type="date" required value={form.expenseDate}
      onChange={e=>change("expenseDate",e.target.value)}/>
     {fieldError?.name==="expenseDate"&&<span role="alert">{fieldError.message}</span>}</label>
    <label className="cg-fin-field">Amount in rupees *
     <input required type="text" inputMode="decimal" value={form.amount}
      onChange={e=>change("amount",e.target.value)}
      placeholder="0.00" pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?"/>
     {fieldError?.name==="amount"&&<span role="alert">{fieldError.message}</span>}</label>
    <label className="cg-fin-field">Purpose *
     <textarea required minLength={3} maxLength={500} rows={3}
      value={form.purpose} onChange={e=>change("purpose",e.target.value)}/>
     {fieldError?.name==="purpose"&&<span role="alert">{fieldError.message}</span>}</label>
    <p className="cg-fin-help">Save your claim first, then attach its real privately scanned bill below. A separate protected reviewer must approve it before posting or payment.</p>
    <button className="primary" type="submit" disabled={saving}>
     {saving?"Checking the draft…":correction?"Save corrected claim draft":"Save claim draft"}</button>
   </form>
  </div>}
  {canView&&<div className="cg-fin-table-wrap">
   <h3>{allowanceMode?"My allowance requests":"My expense claims"}</h3>
   {allowanceMode&&eligible&&<div className="cg-fin-form"><p>Current page: {claims.length} requests · {claims.filter(c=>c.status==="SUBMITTED").length} pending · {claims.filter(c=>c.paymentState==="PAID_VERIFIED").length} verified paid</p><label className="cg-fin-field">Search current page<input value={search} maxLength={80} onChange={e=>setSearch(e.target.value)} placeholder="Claim, category or purpose"/></label><label className="cg-fin-field">Status<select value={filter} onChange={e=>setFilter(e.target.value)}>{filters.map(v=><option key={v} value={v}>{filterLabel(v)}</option>)}</select></label></div>}
   {loading&&<p className="cg-module-loading" role="status">Loading current claim records…</p>}
   {!loading&&<table className="cg-fin-table"><thead><tr>
    <th>Claim No.</th><th>Expense date</th><th>Category</th><th>Purpose</th>
    <th>Amount</th><th>Status</th>{allowCreate&&<th>Action</th>}</tr></thead><tbody>
    {visible.map(c=><tr key={c.claimRef}><td><strong>{c.claimNumber}</strong></td>
     <td>{c.expenseDate}</td><td>{c.category}</td><td>{c.purpose}</td>
     <td className="cg-fin-money">{money(c.amountMinor)}</td>
     <td><span className="cg-fin-status">{claimStatus(c)}</span></td>
     {allowCreate&&<td>{c.status==="RETURNED"&&
       <button type="button" onClick={()=>{
        setDrawer(true);setCorrection({ref:c.claimRef,version:c.version,number:c.claimNumber});
        setForm({purpose:c.purpose,category:c.category,expenseDate:c.expenseDate,
         amount:(BigInt(c.amountMinor)/100n).toString()+"."+(BigInt(c.amountMinor)%100n).toString().padStart(2,"0")});
        setPendingKey(null);setFeedback("");setFieldError(null);
       }}>Correct returned claim</button>}
      {c.status==="DRAFT"&&canUploadBill&&
      <button type="button" aria-expanded={openClaim===c.claimRef}
       onClick={()=>setOpenClaim(v=>v===c.claimRef?null:c.claimRef)}>
       {openClaim===c.claimRef?"Hide bill upload":"Upload verified bill"}</button>}
     </td>}</tr>)}
   </tbody></table>}
   {allowCreate&&canUploadBill&&visible.filter(c=>c.status==="DRAFT"&&c.claimRef===openClaim)
    .map(c=><FinanceClaimBillTools key={c.claimRef} claimRef={c.claimRef}
      version={c.version} onSubmitted={()=>{setOpenClaim(null);void refresh();}}/>)}
   {!loading&&!visible.length&&!notice&&<p className="cg-fin-empty">{claims.length?"No matching requests on this page.":"No saved claims yet."}</p>}
   <div className="cg-fin-paging"><button type="button" disabled={offset===0||loading}
     onClick={()=>setOffset(v=>Math.max(0,v-30))}>Previous</button>
    <button type="button" disabled={nextOffset===null||loading}
     onClick={()=>setOffset(nextOffset??0)}>Next</button></div>
  </div>}
 </section>;
}
