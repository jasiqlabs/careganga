"use client";
import {useCallback,useEffect,useState} from "react";

type Case={caseRef:string;reference:string;voucherNumber:string;status:string;revision:number;
 submittedAt:string};
type CaseDetail=Case&{voucherRef:string;sourceVersion:number;proofFileRef:string;proofRevision:number};
type VoucherDetail={status:string;header:{type:string;postingDate:string;
 payeeName:string;purpose:string};lines:{description:string;quantity:number;
 unitRateMinor:string;lineTotalMinor:string}[];grossMinor:string;taxMinor:string;
 chargesMinor:string;totalMinor:string};
type Pending={caseRef:string;body:Record<string,unknown>};
function money(value:string){
 try{const n=BigInt(value),v=n<0n?-n:n;return(n<0n?"−":"")+"₹"+
 (v/100n).toLocaleString("en-IN")+"."+(v%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}
}
async function failure(res:Response){
 const raw:unknown=await res.json().catch(()=>null);
 const data=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 if(typeof data.code==="string"&&data.code.startsWith("FINANCE_")&&
  typeof data.message==="string"&&data.message.length<301)return data.message;
 return res.status===401?"Your session expired. Please sign in again.":
  res.status===403?"Only a currently authorized Foundation reviewer may use this decision.":
  res.status===409?"The review or voucher revision changed. Reload the case before deciding.":
  res.status===429?"Too many confirmation attempts. Try again later.":
  "This review result cannot be confirmed. Check the original case before retrying.";
}
export function FinanceVoucherReviewerWorkspace({canInitialize}:{
 canInitialize:boolean
}){
 const [cases,setCases]=useState<Case[]>([]);
 const [offset,setOffset]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [open,setOpen]=useState<CaseDetail|null>(null);
 const [voucher,setVoucher]=useState<VoucherDetail|null>(null);
 const [fetching,setFetching]=useState(false);
 const [busy,setBusy]=useState(false);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState("");
 const [password,setPassword]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [setup,setSetup]=useState(false);
 const [setupPassword,setSetupPassword]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/finance-review/cases?offset="+offset,{cache:"no-store"});
   if(!r.ok)throw Error(await failure(r));
   const value:unknown=await r.json();
   if(!value||typeof value!=="object"||!("cases" in value)||
     !Array.isArray(value.cases)||!("nextOffset" in value)||
     !(value.nextOffset===null||typeof value.nextOffset==="number"))
    throw Error("Finance reviewer cases could not be confirmed.");
   setCases(value.cases as Case[]);setNextOffset(value.nextOffset);
  }catch(e){setCases([]);setNextOffset(null);setError(
   e instanceof Error?e.message:"Cannot load reviewer cases. Check your connection.");}
  finally{setLoading(false);}
 },[offset]);
 useEffect(()=>{void load();},[load]);
 async function openCase(row:Case){
  setFetching(true);setError("");setInfo("");
  try{
   const c=await fetch("/api/finance-review/"+row.caseRef,{cache:"no-store"});
   if(!c.ok)throw Error(await failure(c));
   const detail:unknown=await c.json();
   if(!detail||typeof detail!=="object"||!("voucherRef" in detail)||
     typeof detail.voucherRef!=="string"||!("proofFileRef" in detail))
    throw Error("The original submitted Finance source could not be verified.");
   const d=detail as CaseDetail;
   const v=await fetch("/api/finance/vouchers/drafts/"+d.voucherRef,{cache:"no-store"});
   if(!v.ok)throw Error(await failure(v));
   const source:unknown=await v.json();
   if(!source||typeof source!=="object"||!("lines" in source)||
     !Array.isArray(source.lines)||!("header" in source))
    throw Error("The frozen voucher details are not available for review.");
   setOpen(d);setVoucher(source as VoucherDetail);setAction("APPROVE");
   setRemarks("");setPassword("");setPending(null);
  }catch(e){setOpen(null);setVoucher(null);setError(
    e instanceof Error?e.message:"The original voucher could not be verified.");}
  finally{setFetching(false);}
 }
 function close(){
  if(busy||pending)return;
  setOpen(null);setVoucher(null);setPassword("");setRemarks("");
 }
 async function sendDecision(original:Pending){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/finance-review/"+original.caseRef+"/decisions",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(original.body)});
   if(!r.ok){setError(await failure(r));setPending(r.status>=500?original:null);return;}
   const raw:unknown=await r.json();
   if(!raw||typeof raw!=="object"||!("status" in raw)||typeof raw.status!=="string")
    throw Error("Unknown reviewer result");
   setPending(null);setPassword("");setOpen(null);setVoucher(null);
   setInfo("CG-03 decision recorded: "+raw.status+
    ". Financial posting or payment is not automatic.");
   await load();
  }catch{
   setPending(original);
   setError("The original reviewer decision may have committed. Reload/check that same case before retrying.");
  }finally{setBusy(false);}
 }
 function decide(){
  if(!open||!voucher||busy||pending)return;
  if(password.length<8){setError("Enter your current account password to confirm the reviewer decision.");return;}
  void sendDecision({caseRef:open.caseRef,body:{
   requestKey:crypto.randomUUID(),expectedRevision:open.revision,action,remarks,
   currentPassword:password}});
 }
 async function checkCase(){
  if(!pending||busy)return;
  setFetching(true);setError("");
  try{
   const r=await fetch("/api/finance-review/"+pending.caseRef,{cache:"no-store"});
   if(!r.ok)throw Error(await failure(r));
   const detail=await r.json() as CaseDetail;
   const expected=Number(pending.body.expectedRevision);
   if(detail.revision>expected){
    setPending(null);setOpen(null);setVoucher(null);setPassword("");
    setInfo("The original review has changed. Its current status is "+detail.status+".");
    await load();
   }else{
    setError("The case has not advanced. Retry only the same reviewer request if necessary.");
   }
  }catch(e){setError(e instanceof Error?e.message:
    "Cannot confirm the original reviewer result.");}
  finally{setFetching(false);}
 }
 async function configure(){
  if(!canInitialize||setupPassword.length<8||busy)return;
  setBusy(true);setError("");setInfo("");
  try{
   const r=await fetch("/api/finance-review/process/initialize",{method:"POST",
    headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({currentPassword:setupPassword})});
   if(!r.ok)throw Error(await failure(r));
   const result:unknown=await r.json();
   if(!result||typeof result!=="object"||!("configured" in result)||
     result.configured!==true)throw Error("The Finance reviewer process was not confirmed.");
   setInfo("Protected Finance voucher approval process is configured.");
   setSetup(false);setSetupPassword("");
  }catch(e){setError(e instanceof Error?e.message:
   "The Finance reviewer configuration result is unconfirmed. Check its status.");}
  finally{setBusy(false);}
 }
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h2>Finance Voucher Reviews</h2>
   <p>Original, version-pinned submissions require a different authorized reviewer.
    Approval never equals payment.</p></div>
   <div className="cg-fin-toolbar-actions">
    <button type="button" disabled={loading} onClick={()=>void load()}>Refresh</button>
    {canInitialize&&<button type="button" onClick={()=>setSetup(v=>!v)}>
     Configure protected review</button>}
   </div>
  </div>
  {setup&&canInitialize&&<div className="cg-fin-notice">
   <p>Only a current Foundation Super Admin can initialize the genuine Finance review route.</p>
   <label className="cg-fin-field">Current password
    <input type="password" autoComplete="current-password" value={setupPassword}
     onChange={e=>setSetupPassword(e.target.value)}/></label>
   <button type="button" disabled={busy||setupPassword.length<8}
    onClick={()=>void configure()}>Confirm Finance review route</button>
  </div>}
  {info&&<p className="cg-fin-success" role="status">{info}</p>}
  {error&&<div className="cg-fin-notice" role="alert"><p>{error}</p>
   <button type="button" disabled={loading} onClick={()=>void load()}>Refresh cases</button></div>}
  {(loading||fetching)&&<p role="status">Checking original Finance case and voucher records…</p>}
  {!loading&&!error&&<div className="cg-fin-table-wrap"><table className="cg-fin-table">
   <thead><tr><th>Case</th><th>Voucher</th><th>Submitted</th><th>Review state</th><th>Action</th></tr></thead>
   <tbody>{cases.map(c=><tr key={c.caseRef}>
    <td><strong>{c.reference}</strong></td><td>{c.voucherNumber}</td>
    <td>{c.submittedAt?new Date(c.submittedAt).toLocaleDateString("en-IN"):"—"}</td>
    <td>{c.status}</td>
    <td><button type="button" disabled={fetching} onClick={()=>void openCase(c)}>
     Open original review</button></td>
   </tr>)}</tbody>
  </table>
  {!cases.length&&<p className="cg-fin-empty">There are no Finance voucher cases on this page.</p>}
  <div className="cg-fin-paging">
   <button type="button" disabled={loading||offset===0}
    onClick={()=>setOffset(v=>Math.max(0,v-50))}>Previous</button>
   <span>{cases.length} cases on this page</span>
   <button type="button" disabled={loading||nextOffset===null}
    onClick={()=>setOffset(nextOffset??0)}>Next</button>
  </div></div>}
  {open&&voucher&&<div className="drawer-backdrop" role="presentation">
   <section className="role-drawer cg-fin-drawer" role="dialog" aria-modal="true"
    aria-labelledby="cg-fin-review-title">
    <div className="cg-fin-drawer-header"><div><p>Finance Approval / Original Submission</p>
     <h2 id="cg-fin-review-title">{open.reference} · {open.voucherNumber}</h2></div>
     <button type="button" disabled={busy||Boolean(pending)}
      onClick={close} aria-label="Close original Finance review">×</button></div>
    <p className="cg-fin-description">The original submitted voucher and private evidence are immutable.
     A reviewer cannot approve their own submission.</p>
    <div className="cg-fin-review-summary">
     <p><strong>Type:</strong> {voucher.header.type}</p>
     <p><strong>Payee:</strong> {voucher.header.payeeName}</p>
     <p><strong>Date:</strong> {voucher.header.postingDate}</p>
     <p><strong>Purpose:</strong> {voucher.header.purpose}</p>
     <p><strong>Current CG-03 state:</strong> {open.status}</p>
    </div>
    <div className="cg-fin-table-wrap"><table className="cg-fin-table">
     <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
     <tbody>{voucher.lines.map((l,i)=><tr key={i}>
      <td>{l.description}</td><td>{l.quantity}</td>
      <td>{money(l.unitRateMinor)}</td><td>{money(l.lineTotalMinor)}</td>
     </tr>)}</tbody>
    </table></div>
    <div className="cg-fin-review-summary">
     <p>Items: {money(voucher.grossMinor)} · Tax: {money(voucher.taxMinor)}</p>
     <p>Charges: {money(voucher.chargesMinor)}</p>
     <p><strong>Grand total: {money(voucher.totalMinor)}</strong></p>
     <a href={"/api/finance-evidence/files/"+open.proofFileRef+"/download"}
      target="_blank" rel="noopener noreferrer">Download verified private voucher evidence</a>
    </div>
    {["SUBMITTED","IN_REVIEW"].includes(open.status)&&<>
     <label className="cg-fin-field">Decision
      <select value={action} onChange={e=>setAction(e.target.value as typeof action)}>
       <option value="APPROVE">Approve</option><option value="RETURN">Return for correction</option>
       <option value="REJECT">Reject</option>
      </select></label>
     <label className="cg-fin-field">Reviewer remarks
      <textarea value={remarks} maxLength={500} rows={3}
       onChange={e=>setRemarks(e.target.value)}/></label>
     <label className="cg-fin-field">Confirm your current password *
      <input type="password" autoComplete="current-password" value={password}
       onChange={e=>setPassword(e.target.value)}/></label>
     {pending&&<div className="cg-fin-pending">
      <p>Original review decision has an uncertain outcome. Check case state before retrying.</p>
      <button type="button" disabled={fetching} onClick={()=>void checkCase()}>
       Check original decision</button>
      <button type="button" disabled={busy} onClick={()=>void sendDecision(pending)}>
       Retry same reviewer request</button>
     </div>}
     <div className="cg-fin-form-actions">
      <button type="button" disabled={busy||Boolean(pending)} onClick={close}>Cancel</button>
      <button className="primary" type="button" disabled={busy||Boolean(pending)||password.length<8}
       onClick={decide}>{busy?"Confirming…":"Confirm "+action.toLowerCase()}</button>
     </div>
    </>}
   </section>
  </div>}
 </section>;
}
