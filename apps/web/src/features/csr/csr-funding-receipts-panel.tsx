"use client";
import {useEffect,useRef,useState} from "react";
type Summary={proposalStatus:string;sourceVersion:number;
 csrCommittedMinor:string;foundationCommittedMinor:string;
 csrReceivedMinor:string;foundationReceivedMinor:string;
 csrNeedsRevalidationMinor:string;foundationNeedsRevalidationMinor:string;
 allocationStatus:string};
type Candidate={reconciliationRef:string;verifiedDate:string;amountMinor:string;
 bankName:string;bankItemMasked:string};
type Command={requestKey:string;expectedVersion:number;partyKind:"CSR"|"FOUNDATION";reconciliationRef:string;remitterConfirmed:true};
const currency=(raw:string)=>{try{const n=BigInt(raw);
 return "₹"+(n/100n).toLocaleString("en-IN")+"."+(n%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}};
async function fetchOriginal<T>(proposal:string,path:string,command?:Command):Promise<T>{
 const r=await fetch("/api/csr/funding-proposals/"+proposal+"/finance"+path,{
  cache:"no-store",signal:AbortSignal.timeout(18000),
  ...(command?{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(command)}:{})});
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok||data===null)throw Object.assign(Error(
  data&&typeof data==="object"&&"message" in data&&typeof data.message==="string"?
   data.message:"Original CG09 bank record is unavailable."),{status:r.status||503});
 return data as T;
}
export function CsrFundingReceiptsPanel({proposalRef,version,canLink}:{
 proposalRef:string;version:number;canLink:boolean}){
 const [summary,setSummary]=useState<Summary|null>(null);
 const [items,setItems]=useState<Candidate[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),
  [notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [candidate,setCandidate]=useState(""),[party,setParty]=useState<"CSR"|"FOUNDATION">("CSR");
 const [remitterConfirmed,setRemitterConfirmed]=useState(false);
 const [command,setCommand]=useState<Command|null>(null),[epoch,setEpoch]=useState(0);
 const seq=useRef(0),lock=useRef(false);
 useEffect(()=>{
  const id=++seq.current;setLoading(true);setError("");
  void Promise.all([
   fetchOriginal<Summary>(proposalRef,""),
   fetchOriginal<{items:Candidate[]}>(proposalRef,"/eligible-receipts")
  ]).then(([v,eligible])=>{
   if(id!==seq.current)return;
   if(v.sourceVersion!==version)throw Error("Approved funding source changed. Refresh.");
   setSummary(v);setItems(eligible.items);setCandidate("");setRemitterConfirmed(false);
   setParty(BigInt(v.csrCommittedMinor)>0n?"CSR":"FOUNDATION");
  }).catch(e=>{if(id===seq.current){
   setSummary(null);setItems([]);
   setError(e instanceof Error?e.message:"Finance evidence cannot be verified.");}})
   .finally(()=>{if(id===seq.current)setLoading(false);});
  return()=>{seq.current++;};
 },[proposalRef,version,epoch]);
 const submit=async()=>{
  if(lock.current||!canLink||loading||!summary||!candidate&&!command||!remitterConfirmed&&!command)return;
  if(!command&&!items.some(v=>v.reconciliationRef===candidate))return;
  const input=command??{requestKey:crypto.randomUUID(),expectedVersion:version,
   partyKind:party,reconciliationRef:candidate,remitterConfirmed:true as const};
  lock.current=true;setBusy(true);setCommand(input);setError("");setNotice("");
  try{
   await fetchOriginal(proposalRef,"/receipts",input);
   setCommand(null);setCandidate("");setRemitterConfirmed(false);
   setNotice("Linked independently verified original CG09 bank money. This is not an allocation.");
   setEpoch(v=>v+1);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500)setCommand(null);
   setError(code>=500||code===0?
    "Link outcome uncertain. Check original receipt and retry with the exact request key.":
    e instanceof Error?e.message:"Cannot link bank receipt.");
  }finally{lock.current=false;setBusy(false);}
 };
 return <section aria-label="Verified CG09 bank receipts" style={{
  border:"1px solid var(--cg-border)",borderRadius:12,padding:16,display:"grid",gap:10}}>
  <h3 style={{margin:0}}>Verified Receipts & Financial Status</h3>
  <p style={{fontSize:13,margin:0}}>Only actual posted and independently reconciled
   CG09 bank deposits count as received. Attribution to CSR or Foundation
   must be checked against the bank statement; it does not approve spending.</p>
  {loading?<p role="status">Verifying original CG09 financial records…</p>:
   summary&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
    <div>CSR committed: <strong>{currency(summary.csrCommittedMinor)}</strong></div>
    <div>CSR bank received: <strong>{currency(summary.csrReceivedMinor)}</strong></div>
    <div>Foundation committed: <strong>{currency(summary.foundationCommittedMinor)}</strong></div>
    <div>Foundation bank received: <strong>{currency(summary.foundationReceivedMinor)}</strong></div>
    <div>Budget allocation: <strong>Not yet linked to CG09 budget source</strong></div>
   </div>}
  {summary&&(BigInt(summary.csrNeedsRevalidationMinor)>0n||
   BigInt(summary.foundationNeedsRevalidationMinor)>0n)&&
   <p role="alert" style={{color:"#b91c1c"}}>Earlier linked bank receipt evidence
    has been revoked or reversed. Recheck CG09 and do not allocate against it.</p>}
  {canLink&&summary&&<>
   <p style={{fontSize:13,margin:0}}>Only eligible, unused, scanner-backed bank
    deposits are selectable. Record a real journal and independently verify its
    bank statement in Finance first.</p>
   <label>Original verified bank deposit
    <select value={candidate} disabled={busy||!!command||loading}
     onChange={e=>setCandidate(e.target.value)}>
     <option value="">Choose eligible verified receipt</option>
     {items.map((v,i)=><option key={v.reconciliationRef} value={v.reconciliationRef}>
      {v.verifiedDate} · {v.bankName} {v.bankItemMasked} · {currency(v.amountMinor)}
     </option>)}
    </select>
   </label>
   <label>Actual funding party
    <select value={party} disabled={busy||!!command} onChange={e=>setParty(e.target.value as "CSR"|"FOUNDATION")}>
     {BigInt(summary.csrCommittedMinor)>0n&&<option value="CSR">CSR partner portion</option>}
     {BigInt(summary.foundationCommittedMinor)>0n&&<option value="FOUNDATION">Foundation portion</option>}
    </select>
   </label>
   <label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13}}>
    <input type="checkbox" checked={remitterConfirmed} disabled={busy||!!command}
     onChange={e=>setRemitterConfirmed(e.target.checked)}/>
    I checked the actual CG09 bank statement and confirmed the remitter belongs to
    the selected CSR partner or Foundation funding share. The bank match alone
    does not independently establish who paid.
   </label>
   <button type="button" disabled={busy||(!candidate||!remitterConfirmed)&&!command} onClick={()=>void submit()}>
    {command?"Retry the exact original receipt link":"Link verified bank receipt"}</button>
  </>}
  <button type="button" disabled={busy} onClick={()=>setEpoch(x=>x+1)}>
   Refresh original CG09 verification</button>
  {!!notice&&<p role="status">{notice}</p>}
  {!!error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
 </section>;
}
