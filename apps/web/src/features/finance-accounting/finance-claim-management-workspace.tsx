"use client";
import {useCallback,useEffect,useState} from "react";
type Claim={claimRef:string;claimNumber:string;category:string;purpose:string;
 expenseDate:string;amountMinor:string;status:string;version:number;
 approvalCaseRef:string|null;payableVoucherNumber:string|null;payoutVoucherNumber:string|null};
type Voucher={voucherRef:string;voucherNumber:string;type:string;
 totalMinor:string;kind:string|null};
async function failure(res:Response):Promise<string>{
 const raw:unknown=await res.json().catch(()=>null);
 if(raw&&typeof raw==="object"&&!Array.isArray(raw)&&"message" in raw&&
  typeof raw.message==="string"&&raw.message.length<=300)return raw.message;
 return res.status===403?"Your current role cannot manage reimbursements.":
  res.status===409?"The original claim or posted voucher changed. Refresh before proceeding.":
  "The result cannot be confirmed. Check the existing claim state before repeating the request.";
}
const money=(x:string)=>{try{let n=BigInt(x);return "₹"+(n/100n).toLocaleString("en-IN")+
 "."+(n%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
export function FinanceClaimManagementWorkspace(){
 const [claims,setClaims]=useState<Claim[]>([]);
 const [offset,setOffset]=useState(0);
 const [next,setNext]=useState<number|null>(null);
 const [focused,setFocused]=useState<Claim|null>(null);
 const [vouchers,setVouchers]=useState<Voucher[]>([]);
 const [selection,setSelection]=useState("");
 const [kind,setKind]=useState<"PAYABLE"|"PAYOUT">("PAYABLE");
 const [pending,setPending]=useState<{key:string;path:string;body:Record<string,unknown>}|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const res=await fetch("/api/finance/claims/managed?offset="+offset,{cache:"no-store"});
   if(!res.ok)throw Error(await failure(res));
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("claims" in raw)||!Array.isArray(raw.claims))
    throw Error("The original reimbursement register could not be verified.");
   setClaims(raw.claims as Claim[]);
   setNext("nextOffset" in raw&&typeof raw.nextOffset==="number"?raw.nextOffset:null);
  }catch(e){setClaims([]);setNext(null);setError(e instanceof Error?e.message:
   "The reimbursement register is unavailable.");}
  finally{setLoading(false);}
 },[offset]);
 useEffect(()=>{void refresh();},[refresh]);
 async function open(c:Claim){
  setFocused(c);setVouchers([]);setSelection("");setFeedback("");
  try{
   const res=await fetch("/api/finance/claims/"+c.claimRef+"/eligible-vouchers",{cache:"no-store"});
   if(!res.ok)throw Error(await failure(res));
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("vouchers" in raw)||
      !Array.isArray(raw.vouchers))throw Error("Posted source vouchers could not be verified.");
   setVouchers(raw.vouchers as Voucher[]);
  }catch(e){setFeedback(e instanceof Error?e.message:
   "Cannot load approved original voucher sources.");}
 }
 async function send(path:string,body:Record<string,unknown>){
  if(busy)return;
  const key=pending?.key??crypto.randomUUID();
  const request={key,path,body};
  if(pending&&(pending.path!==path||JSON.stringify(pending.body)!==JSON.stringify(body))){
   setFeedback("A previous result is still uncertain. Check that original request before changing it.");
   return;
  }
  setPending(request);setBusy(true);setFeedback("");
  try{
   const res=await fetch("/api/finance/"+path,{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...body,requestKey:key})});
   if(!res.ok)throw Error(await failure(res));
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||raw.confirmed!==true)
    throw Error("The outcome could not be confirmed. Check original request status.");
   setPending(null);
   setFeedback("The original Finance source was updated. Posting and verified payment remain distinct.");
   await refresh();
   if(focused){
    const latest=await fetch("/api/finance/claims/managed?offset=0",{cache:"no-store"});
    if(latest.ok){
     const data=await latest.json() as {claims?:Claim[]};
     const row=data.claims?.find(v=>v.claimRef===focused.claimRef);
     if(row)await open(row);
    }
   }
  }catch(e){
   try{
    const check=await fetch("/api/finance/claims/workflow-commands/"+key,{cache:"no-store"});
    if(check.ok){
     const result=await check.json() as {confirmed?:boolean;status?:string};
     if(result.confirmed){
      setPending(null);setFeedback("The original request is confirmed: "+(result.status??"Updated")+".");
      void refresh();return;
     }
    }
   }catch{/* No invented write result. */}
   setFeedback(e instanceof Error?e.message:
    "The original update could not be confirmed. Check its request status.");
  }finally{setBusy(false);}
 }
 return <section className="cg-fin-manual" aria-label="Actual reimbursement finance register">
  <div className="cg-fin-toolbar"><div><h2>Reimbursement Finance Register</h2>
   <p>Link only original approved claims to the matching posted expense payable and separately verified payout.</p>
  </div><button type="button" disabled={loading} onClick={()=>void refresh()}>Refresh</button></div>
  {error&&<p role="alert" className="cg-fin-notice">{error}</p>}
  {feedback&&<p role="status" className="cg-fin-notice">{feedback}</p>}
  {loading&&<p role="status">Checking current reimbursement records…</p>}
  {!loading&&!error&&<div className="cg-fin-table-wrap">
   <table className="cg-fin-table"><thead><tr><th>Claim</th><th>Date</th><th>Purpose</th>
    <th>Amount</th><th>Review</th><th>Payable</th><th>Payout</th><th>Action</th></tr></thead>
   <tbody>{claims.map(c=><tr key={c.claimRef}>
    <td>{c.claimNumber}</td><td>{c.expenseDate}</td><td>{c.purpose}</td>
    <td className="cg-fin-money">{money(c.amountMinor)}</td>
    <td>{c.status==="APPROVED"?"Approved — financial posting separate":
     c.status==="SUBMITTED"?"Awaiting CG03 reviewer":c.status==="DRAFT"?"Draft — no effect":
     c.status==="REJECTED"?"Rejected":c.status==="RETURNED"?"Returned":"Check status"}</td>
    <td>{c.payableVoucherNumber??"Not posted"}</td>
    <td>{c.payoutVoucherNumber??"Not verified or linked"}</td>
    <td><button type="button" onClick={()=>void open(c)}>Manage</button></td>
   </tr>)}</tbody></table>
   {!claims.length&&<p className="cg-fin-empty">No real Foundation claims found.</p>}
   <div className="cg-fin-paging"><button type="button" disabled={offset===0||loading}
    onClick={()=>setOffset(n=>Math.max(0,n-30))}>Previous</button>
    <button type="button" disabled={next===null||loading}
    onClick={()=>setOffset(next??0)}>Next</button></div>
  </div>}
  {focused&&<div className="drawer-backdrop"><div className="role-drawer cg-fin-drawer"
    role="dialog" aria-modal="true" aria-labelledby="cg-claim-manager-heading">
   <div className="cg-fin-drawer-header"><div><p>Finance / Reimbursement</p>
    <h2 id="cg-claim-manager-heading">{focused.claimNumber}</h2></div>
    <button type="button" onClick={()=>{setFocused(null);setPending(null);}}
     aria-label="Close claim finance register">×</button></div>
   <p>{focused.category} · {money(focused.amountMinor)} · {focused.status}</p>
   <p>{focused.purpose}</p>
   {focused.status==="SUBMITTED"&&focused.approvalCaseRef&&
    <button type="button" disabled={busy||Boolean(pending)} onClick={()=>
      void send("claims/"+focused.claimRef+"/reconcile",{
       caseRef:focused.approvalCaseRef})}>
     Confirm original protected CG03 outcome</button>}
   {focused.status==="APPROVED"&&<>
    <p className="cg-fin-help">Create a genuine voucher from the approved claim in Finance Voucher Drafts.
     After independent voucher approval and journal posting, select its generated voucher number here.
     Payment requires a distinct verified bank/cash proof.</p>
    <label className="cg-fin-field">Financial effect
     <select value={kind} onChange={e=>{setKind(e.target.value as "PAYABLE"|"PAYOUT");setSelection("");}}>
      <option value="PAYABLE">Record original posted expense/payable</option>
      <option value="PAYOUT">Record separately verified payout</option>
     </select></label>
    <label className="cg-fin-field">Original posted Finance voucher
     <select value={selection} onChange={e=>setSelection(e.target.value)}>
      <option value="">Select only an eligible claim-linked posted voucher</option>
      {vouchers.filter(v=>v.kind===null&&v.type===(kind==="PAYABLE"?"EXPENSE":"PAYMENT"))
       .map(v=><option value={v.voucherRef} key={v.voucherRef}>
        {v.voucherNumber} · {money(v.totalMinor)}</option>)}
     </select></label>
    <button type="button" className="primary" disabled={busy||!selection||Boolean(pending)}
     onClick={()=>void send("claims/"+focused.claimRef+"/link-voucher",{
      voucherRef:selection,linkKind:kind})}>
     Link confirmed posted {kind==="PAYABLE"?"payable":"payout"} once</button>
   </>}
   {pending&&<p role="alert">The previous request is unconfirmed. Check its original
    status before making another financial change.</p>}
  </div></div>}
 </section>;
}
