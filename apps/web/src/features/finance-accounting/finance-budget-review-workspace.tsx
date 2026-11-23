"use client";
import {useEffect,useState} from "react";
type Case={caseRef:string;caseNumber:string;budgetNumber:string;status:string;revision:number};
type Detail={caseRef:string;caseNumber:string;status:string;revision:number;
 source:{budgetNumber:string;name:string;projectLabel?:string|null;category:string;amountMinor:string;periodStart:string;periodEnd:string;status:string;
 items?:{description:string;quantityMilli:string;unitRateMinor:string;totalMinor:string}[]}};
const message=async(r:Response)=>{
 const d:unknown=await r.json().catch(()=>null);
 return d&&typeof d==="object"&&"message" in d&&typeof d.message==="string"?
  d.message:"Protected budget decision is not confirmed. Refresh its original case.";
};
const rupees=(raw:string)=>{try{const amount=BigInt(raw);
 return "₹"+(amount/100n).toLocaleString("en-IN")+"."+
  (amount%100n).toString().padStart(2,"0");
}catch{return "Amount unavailable";}};
export function FinanceBudgetReviewWorkspace({canConfigure}:{canConfigure:boolean}){
 const [list,setList]=useState<Case[]>([]);
 const [offset,setOffset]=useState(0),[nextOffset,setNextOffset]=useState<number|null>(null);
 const [current,setCurrent]=useState<Detail|null>(null);
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [password,setPassword]=useState("");
 const [setupPassword,setSetupPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 async function load(){
  setError("");
  try{
   const [p,r]=await Promise.all([
    fetch("/api/finance-budget-review/process",{cache:"no-store"}),
    fetch("/api/finance-budget-review/cases?offset="+offset,{cache:"no-store"})]);
   if(!p.ok||!r.ok)throw Error(await message(!p.ok?p:r));
   const a=await p.json() as {configured?:boolean};
   const b=await r.json() as {cases?:Case[];nextOffset?:number|null};
   if(typeof a.configured!=="boolean"||!Array.isArray(b.cases))
    throw Error("Cannot verify the original review process.");
   setConfigured(a.configured);setList(b.cases);setNextOffset(b.nextOffset??null);
  }catch(e){setError(e instanceof Error?e.message:"Protected review is unavailable.");}
 }
 useEffect(()=>{void load();},[offset]);
 async function detail(id:string){
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/finance-budget-review/cases/"+id,{cache:"no-store"});
   if(!res.ok)throw Error(await message(res));
   const d=await res.json() as Detail;
   if(!d.source?.budgetNumber)throw Error("Cannot verify original budget source.");
   setCurrent(d);setRemarks("");setPassword("");
  }catch(e){setError(e instanceof Error?e.message:"Reviewer case could not be read.");}
  finally{setBusy(false);}
 }
 async function configure(){
  if(busy||!canConfigure)return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/finance-budget-review/process",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:setupPassword})});
   if(!res.ok)throw Error(await message(res));
   setSetupPassword("");setConfigured(true);
   setNotice("Protected original budget reviewer process is configured.");void load();
  }catch(e){setError(e instanceof Error?e.message:"Review configuration is unavailable.");}
  finally{setBusy(false);}
 }
 async function decide(){
  if(!current||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/finance-budget-review/cases/"+current.caseRef+"/decisions",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,remarks,currentPassword:password,
     expectedRevision:current.revision,requestKey:crypto.randomUUID()})});
   if(!res.ok)throw Error(await message(res));
   const result=await res.json() as {confirmed?:boolean;status?:string};
   if(!result.confirmed)throw Error("Reviewer outcome is uncertain. Refresh original case.");
   setNotice("Protected review: "+result.status+". Finance posting and payment remain separate.");
   setCurrent(null);setPassword("");void load();
  }catch(e){setError(e instanceof Error?e.message:"Original decision cannot be confirmed.");
   setPassword("");}
  finally{setBusy(false);}
 }
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h1>Protected Budget Reviews</h1>
   <p>Different authorized reviewer, frozen source, explicit password confirmation.</p></div>
   <button type="button" onClick={()=>void load()}>Refresh</button></div>
  {error&&<p role="alert" className="cg-fin-notice">{error}</p>}
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
  {configured===false&&<section className="cg-fin-card">
   <h3>Budget reviewer process not configured</h3>
   {canConfigure&&<><input type="password" placeholder="Current administrator password"
    autoComplete="current-password" aria-label="Current administrator password"
    value={setupPassword} onChange={e=>setSetupPassword(e.target.value)}/>
    <button type="button" onClick={()=>void configure()}
     disabled={busy||setupPassword.length<8}>Configure protected budget review</button></>}
  </section>}
  <div className="cg-fin-table-wrap"><table className="cg-fin-table">
   <thead><tr><th>Review Case</th><th>Budget</th><th>Status</th><th>Action</th></tr></thead>
   <tbody>{list.map(v=><tr key={v.caseRef}><td>{v.caseNumber}</td>
    <td>{v.budgetNumber}</td><td>{v.status}</td>
    <td><button type="button" disabled={busy} onClick={()=>void detail(v.caseRef)}>Review budget</button></td>
   </tr>)}</tbody></table>
   {!list.length&&<p className="cg-fin-empty">No original budget review cases.</p>}
   <div className="cg-fin-paging">
    <button type="button" disabled={busy||offset===0}
     onClick={()=>setOffset(v=>Math.max(0,v-40))}>Previous</button>
    <button type="button" disabled={busy||nextOffset===null}
     onClick={()=>setOffset(nextOffset??0)}>Next</button>
   </div>
  </div>
  {current&&<div className="drawer-backdrop"><div role="dialog" aria-modal="true"
    aria-labelledby="cg-budget-review-heading" className="role-drawer cg-fin-drawer">
    <div className="cg-fin-drawer-header"><h3 id="cg-budget-review-heading">
     {current.source.budgetNumber}</h3>
     <button type="button" onClick={()=>setCurrent(null)} aria-label="Close">×</button></div>
    <p>Original case: {current.caseNumber} · {current.status}</p>
    <p>Budget: {current.source.name}</p>
    <h4>Original requested category items</h4>
    {current.source.items?.length?<table className="cg-fin-table">
     <thead><tr><th>Description</th><th>Quantity</th><th>Unit rate</th><th>Amount</th></tr></thead>
     <tbody>{current.source.items.map((v,i)=><tr key={i}>
      <td>{v.description}</td>
      <td>{(Number(v.quantityMilli)/1000).toFixed(3)}</td>
      <td>{rupees(v.unitRateMinor)}</td><td>{rupees(v.totalMinor)}</td>
     </tr>)}</tbody></table>:
     <p>No itemized quantities or unit costs are recorded for this revision.</p>}
    <p>Category: {current.source.category}</p><p>Project: {current.source.projectLabel??"Not linked"}</p>
    <p>Period: {current.source.periodStart} – {current.source.periodEnd}</p>
    <p>Original approval ceiling: {rupees(current.source.amountMinor)}</p>
    <p>The original budget category, period and approved ceiling are frozen for this separate review. Approval does not prove bank funding or expenditure.</p>
    {["SUBMITTED","IN_REVIEW"].includes(current.status)&&<>
     <label className="cg-fin-field">Reviewer decision
      <select value={action} onChange={e=>setAction(e.target.value as typeof action)}>
       <option value="APPROVE">Approve original budget</option>
       <option value="RETURN">Return budget for correction</option>
       <option value="REJECT">Reject budget</option>
      </select></label>
     <label className="cg-fin-field">Remarks
      <textarea value={remarks} maxLength={500} rows={3}
       onChange={e=>setRemarks(e.target.value)}/></label>
     <label className="cg-fin-field">Current password
      <input type="password" autoComplete="current-password" value={password}
       onChange={e=>setPassword(e.target.value)}/></label>
     <button className="primary" type="button" disabled={busy||password.length<8}
      onClick={()=>void decide()}>Confirm separate protected reviewer decision</button>
    </>}
   </div></div>}
 </section>;
}
