"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {FinanceClaimBillTools} from "../finance-accounting/finance-claim-bill-tools";

type Options={volunteerName:string;projects:{value:string;label:string}[]};
type Created={confirmed:boolean;claimRef:string;status:string;version:number;replayed?:boolean};
const methods=[["BANK_TRANSFER","Bank transfer"],["UPI","UPI"],["CASH","Cash"],["OTHER","Other"]] as const;
const initial=()=>({purpose:"",category:"Travel",expenseDate:"",amount:"",paymentMethod:"BANK_TRANSFER",
 volunteerProjectRef:"",utr:""});
export function VolunteerReimbursementPanel({volunteerRef,onClose}:{volunteerRef:string;onClose:()=>void}){
 const [options,setOptions]=useState<Options|null>(null),[input,setInput]=useState(initial);
 const [result,setResult]=useState<Created|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),
  [notice,setNotice]=useState(""),[submitted,setSubmitted]=useState(false);
 const key=useRef<string|null>(null),sequence=useRef(0);
 useEffect(()=>{
  const controller=new AbortController(),n=++sequence.current;
  setOptions(null);setResult(null);setSubmitted(false);setError("");setInput(initial());key.current=null;
  void fetch("/api/volunteers/roster/"+encodeURIComponent(volunteerRef)+"/reimbursement-options",{
   cache:"no-store",signal:controller.signal}).then(async r=>{
   if(!r.ok)throw Error("Your current permission or volunteer eligibility does not permit reimbursement.");
   const data:unknown=await r.json();
   if(!data||typeof data!=="object"||!Array.isArray((data as Options).projects))throw Error();
   if(!controller.signal.aborted&&sequence.current===n)setOptions(data as Options);
  }).catch(e=>{if(!controller.signal.aborted&&sequence.current===n)setError(e instanceof Error?e.message:"Cannot verify reimbursement source.");});
  return()=>{controller.abort();sequence.current++;};
 },[volunteerRef]);
 const changed=(field:keyof ReturnType<typeof initial>,value:string)=>{
  if(key.current)return;
  setInput(v=>({...v,[field]:value}));
 };
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy||result||!options)return;
  const requestKey=key.current??crypto.randomUUID();key.current=requestKey;setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/finance/claims/drafts",{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey,volunteerRef,volunteerProjectRef:input.volunteerProjectRef||null,
     paymentMethod:input.paymentMethod,utr:input.utr||null,purpose:input.purpose,category:input.category,
     expenseDate:input.expenseDate,amount:input.amount})});
   if(!r.ok)throw Error(r.status===409?"The original volunteer or project has changed. Refresh and retry.":"Claim draft was not confirmed. Check the original request.");
   const c=await r.json() as Created;
   if(c.confirmed!==true||typeof c.claimRef!=="string"||!Number.isSafeInteger(c.version))throw Error();
   setResult(c);key.current=null;setNotice("Actual CG-09 draft saved. Attach a verified CG-19 bill before independent approval. Nothing is paid.");
  }catch{
   try{
    const earlier=await fetch("/api/finance/claims/draft-commands/"+requestKey,{cache:"no-store"});
    if(earlier.ok){
     const c=await earlier.json() as Created;
     if(c.confirmed===true&&c.claimRef&&Number.isSafeInteger(c.version)){
      setResult(c);key.current=null;setNotice("Existing original draft confirmed. No duplicate expense was created.");
      return;
     }
    }
   }catch{/* Keep original request key for safe retry. */}
   setError("Draft result is not confirmed. Retry this same request or review CG-09 claims; do not start another reimbursement.");
  }finally{setBusy(false);}
 };
 return <section className="cg04-panel" aria-label="Original volunteer reimbursement U42">
  <h3>Volunteer reimbursement request</h3>
  <p className="cg04-muted">U42 uses the existing CG-09 expense claim, CG-19 verified bill and independent CG-03 review. A bank reference or selected payment method does not prove money was paid.</p>
  {!options&&!error&&<p role="status">Checking current approved volunteer and eligible projects…</p>}
  {error&&<p role="alert" className="cg04-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {options&&<p><strong>Volunteer:</strong> {options.volunteerName}</p>}
  {options&&!result&&<form onSubmit={submit} className="cg04-review-details">
   <label>Expense category<input required maxLength={80} minLength={2} value={input.category} disabled={busy||!!key.current} onChange={e=>changed("category",e.target.value)}/></label>
   <label>Purpose<textarea required maxLength={500} minLength={3} value={input.purpose} disabled={busy||!!key.current} onChange={e=>changed("purpose",e.target.value)}/></label>
   <label>Expense date<input type="date" required value={input.expenseDate} disabled={busy||!!key.current} onChange={e=>changed("expenseDate",e.target.value)}/></label>
   <label>Amount (INR)<input type="text" required inputMode="decimal" pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?" value={input.amount} disabled={busy||!!key.current} onChange={e=>changed("amount",e.target.value)}/></label>
   <label>Project (optional)<select value={input.volunteerProjectRef} disabled={busy||!!key.current} onChange={e=>changed("volunteerProjectRef",e.target.value)}>
    <option value="">No linked project</option>{options.projects.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
   <label>Requested payment method<select value={input.paymentMethod} disabled={busy||!!key.current} onChange={e=>changed("paymentMethod",e.target.value)}>
    {methods.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>Reference note (optional, not payment proof)<input maxLength={100} value={input.utr} disabled={busy||!!key.current} onChange={e=>changed("utr",e.target.value)}/></label>
   <button type="submit" className="cg04-primary" disabled={busy}>{busy?"Confirming claim…":key.current?"Retry original draft request":"Save expense claim draft"}</button>
  </form>}
  {result&&<div className="cg04-panel">
   <p role="status">Original expense claim: {submitted?"Submitted for independent review":result.status.replaceAll("_"," ")}. No invoice, payable or payment is created by this action.</p>
   {!submitted&&<FinanceClaimBillTools claimRef={result.claimRef} version={result.version} onSubmitted={()=>{setSubmitted(true);setNotice("Submitted for independent review. Final posting and verified payment remain with CG-09.");}}/>}
  </div>}
  <button type="button" onClick={onClose} disabled={busy}>Close reimbursement form</button>
 </section>;
}
