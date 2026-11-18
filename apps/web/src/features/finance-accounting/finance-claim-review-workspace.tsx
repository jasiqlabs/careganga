"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
type Case={caseRef:string;reference:string;claimCategory:string;status:string;revision:number};
type Detail={caseRef:string;reference:string;claimRef:string;version:number;
 billFileRef:string;billVersion:number;status:string;revision:number;
 claim:{claimNumber:string;category:string;purpose:string;expenseDate:string;
 amountMinor:string;status:string}};
type Action="APPROVE"|"RETURN"|"REJECT";
function inr(value:string){
 try{const n=BigInt(value);return "₹"+(n/100n).toLocaleString("en-IN")+
  "."+(n%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}
}
async function problem(res:Response):Promise<string>{
 const raw:unknown=await res.json().catch(()=>null);
 if(raw&&typeof raw==="object"&&!Array.isArray(raw)&&"message" in raw&&
    typeof raw.message==="string"&&raw.message.length<=300)return raw.message;
 return res.status===403?"Only a separate authorized Foundation reviewer may decide this request.":
  res.status===409?"The current claim or reviewer decision changed. Refresh before retrying.":
  "The protected reviewer result cannot be confirmed. Check the original case.";
}
export function FinanceClaimReviewWorkspace({canConfigure}:{canConfigure:boolean}){
 const [cases,setCases]=useState<Case[]>([]);
 const [offset,setOffset]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [action,setAction]=useState<Action>("APPROVE");
 const [password,setPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [notice,setNotice]=useState("");
 const [setupPassword,setSetupPassword]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setNotice("");
  try{
   const [p,list]=await Promise.all([
    fetch("/api/finance-claim-review/process",{cache:"no-store"}),
    fetch("/api/finance-claim-review/cases?offset="+offset,{cache:"no-store"})
   ]);
   if(!p.ok||!list.ok)throw Error(await problem(!p.ok?p:list));
   const a:unknown=await p.json(),b:unknown=await list.json();
   if(!a||typeof a!=="object"||!("configured" in a)||typeof a.configured!=="boolean"||
     !b||typeof b!=="object"||!("cases" in b)||!Array.isArray(b.cases))
    throw Error("The current protected review list could not be verified.");
   setConfigured(a.configured);setCases(b.cases as Case[]);
   setNextOffset("nextOffset" in b&&typeof b.nextOffset==="number"?b.nextOffset:null);
  }catch(e){setCases([]);setNotice(e instanceof Error?e.message:
   "Protected reimbursement review is unavailable.");}
  finally{setLoading(false);}
 },[offset]);
 useEffect(()=>{void refresh();},[refresh]);
 async function open(ref:string){
  setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance-claim-review/cases/"+ref,{cache:"no-store"});
   if(!res.ok)throw Error(await problem(res));
   const value:unknown=await res.json();
   if(!value||typeof value!=="object"||!("claim" in value)||
     !value.claim||typeof value.claim!=="object"||
     !("reference" in value)||typeof value.reference!=="string")
    throw Error("The submitted claim details could not be verified.");
   setDetail(value as Detail);setPassword("");setRemarks("");
  }catch(e){setDetail(null);setNotice(e instanceof Error?e.message:"Cannot open the current claim review.");}
  finally{setBusy(false);}
 }
 async function initialize(){
  if(!canConfigure||busy)return;
  setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance-claim-review/process",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:setupPassword})});
   if(!res.ok)throw Error(await problem(res));
   setSetupPassword("");setConfigured(true);
   setNotice("The original protected reimbursement review process is configured.");
   void refresh();
  }catch(e){setNotice(e instanceof Error?e.message:"Cannot confirm review setup.");}
  finally{setBusy(false);}
 }
 async function decide(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!detail||busy||!["SUBMITTED","IN_REVIEW"].includes(detail.status))return;
  const current=detail,requestKey=crypto.randomUUID();
  setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance-claim-review/cases/"+current.caseRef+"/decisions",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,remarks,currentPassword:password,
     expectedRevision:current.revision,requestKey})});
   if(!res.ok)throw Error(await problem(res));
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||raw.confirmed!==true)
    throw Error("The reviewer decision could not be confirmed.");
   setPassword("");
   setNotice("Protected decision recorded. Finance must separately reconcile the case; no money has been paid.");
   setDetail(null);void refresh();
  }catch(e){setNotice(e instanceof Error?e.message:
   "Review outcome unconfirmed. Open the original case before repeating the decision.");
   // Password never persists in another request or audit log.
   setPassword("");
  }finally{setBusy(false);}
 }
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h2>Expense Claim Reviews</h2>
   <p>Original protected Foundation reimbursements — independent of payment and posting.</p></div>
   <button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh</button></div>
  {notice&&<p className="cg-fin-notice" role="alert">{notice}</p>}
  {configured===false&&<section className="cg-fin-card">
   <h3>Reimbursement review process not configured</h3>
   <p>A root authorized administrator must configure protected claim review before submission.</p>
   {canConfigure&&<><label className="cg-fin-field">Current administrator password
    <input type="password" value={setupPassword} autoComplete="current-password"
     onChange={e=>setSetupPassword(e.target.value)}/></label>
    <button type="button" disabled={busy||setupPassword.length<8}
     onClick={()=>void initialize()}>Configure original reviewer process</button></>}
  </section>}
  {loading&&<p role="status">Checking current review cases…</p>}
  {!loading&&<div className="cg-fin-table-wrap"><table className="cg-fin-table">
   <thead><tr><th>Case No.</th><th>Claim category</th><th>Review status</th>
    <th>Action</th></tr></thead><tbody>
    {cases.map(c=><tr key={c.caseRef}><td>{c.reference}</td>
     <td>{c.claimCategory}</td><td>{c.status==="PENDING_OWNER"?
      "Approved — pending original Finance reconciliation":c.status==="SUBMITTED"?
      "Awaiting protected review":c.status==="IN_REVIEW"?"Under review":c.status}</td>
     <td><button type="button" disabled={busy} onClick={()=>void open(c.caseRef)}>Review details</button></td>
    </tr>)}</tbody></table>
   {!cases.length&&<p className="cg-fin-empty">No reimbursement cases in this inbox.</p>}
   <div className="cg-fin-paging"><button disabled={offset===0||loading} type="button"
     onClick={()=>setOffset(v=>Math.max(0,v-30))}>Previous</button>
    <button disabled={nextOffset===null||loading} type="button"
     onClick={()=>setOffset(nextOffset??0)}>Next</button></div>
  </div>}
  {detail&&<div className="drawer-backdrop"><div className="role-drawer cg-fin-drawer"
   role="dialog" aria-modal="true" aria-labelledby="cg-claim-review-heading">
   <div className="cg-fin-drawer-header"><div><p>Finance / Reimbursement Review</p>
    <h2 id="cg-claim-review-heading">Case {detail.reference}</h2></div>
    <button type="button" onClick={()=>setDetail(null)} aria-label="Close claim review">×</button></div>
   <p><strong>{detail.claim.claimNumber}</strong> · {detail.claim.category}</p>
   <p>Purpose: {detail.claim.purpose}</p>
   <p>Expense date: {detail.claim.expenseDate}</p>
   <p>Requested amount: <strong>{inr(detail.claim.amountMinor)}</strong></p>
   <p>Original status: {detail.status}</p>
   <a href={"/api/finance-claim-bills/review/files/"+detail.billFileRef+"/download"}
      rel="noreferrer">Download verified private claim bill</a>
   {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&
    <form className="cg-fin-form" onSubmit={e=>void decide(e)}>
     <label className="cg-fin-field">Decision
      <select value={action} onChange={e=>setAction(e.target.value as Action)}>
       <option value="APPROVE">Approve reimbursement request</option>
       <option value="RETURN">Return for correction</option>
       <option value="REJECT">Reject request</option>
      </select></label>
     <label className="cg-fin-field">Remarks
      <textarea maxLength={500} rows={3} value={remarks}
       onChange={e=>setRemarks(e.target.value)}/></label>
     <label className="cg-fin-field">Current password to confirm this decision *
      <input type="password" autoComplete="current-password" required minLength={8}
       value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <button className="primary" type="submit" disabled={busy}>Confirm protected decision</button>
    </form>}
   <p className="cg-fin-help">Even approval does not confirm a bank or cash payment.
    Finance voucher posting and real payment verification remain separate.</p>
  </div></div>}
 </section>;
}
