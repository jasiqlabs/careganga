"use client";
import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";

type Year={yearRef:string;name:string;startOn:string;endOn:string;status:string};
type Option={accountRef:string;name:string;code:string;branchRef:string|null;
 branchName:string|null;branchVersion:number|null};
type LedgerRow={journalRef:string;description:string;postingDate:string;yearName:string;
 debitMinor:string;reversed:boolean;differentCreator:boolean;payrollBankReturn?:boolean};
type DraftLine={accountRef:string;debit:string;credit:string};
type Pending={requestKey:string;body:Record<string,unknown>};
type Problem={message:string;field:string|null};
const endpoint="/api/finance";
function money(minor:string){
 try{const n=BigInt(minor),abs=n<0n?-n:n;
 return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+
  "."+(abs%100n).toString().padStart(2,"0");
 }catch{return "Amount unavailable";}
}
async function issueText(res:Response):Promise<Problem>{
 const raw:unknown=await res.json().catch(()=>null);
 const body=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 const known=typeof body.code==="string"&&body.code.startsWith("FINANCE_");
 return {message:known&&typeof body.message==="string"&&body.message.length<=300?
   body.message:res.status===401?"Your session expired. Please sign in again.":
   res.status===403?"Your role does not permit this Finance action. Ask the Administrator.":
   res.status===409?"The journal or accounts changed. Refresh the records and try again.":
   res.status===429?"Too many requests. Try again after a short break.":
   "The journal result cannot be confirmed. Check the original request before retrying.",
  field:known&&typeof body.field==="string"?body.field:null};
}
const emptyLine=():DraftLine=>({accountRef:"",debit:"",credit:""});
export function FinanceManualJournalWorkspace({years,canPost,canReverse,onUpdated}:{
 years:readonly Year[];canPost:boolean;canReverse:boolean;onUpdated:()=>void
}){
 const [items,setItems]=useState<LedgerRow[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [editing,setEditing]=useState(false);
 const [year,setYear]=useState("");
 const [date,setDate]=useState("");
 const [description,setDescription]=useState("");
 const [lines,setLines]=useState<DraftLine[]>([emptyLine(),emptyLine()]);
 const [search,setSearch]=useState("");
 const [options,setOptions]=useState<Option[]>([]);
 const [remembered,setRemembered]=useState<Record<string,Option>>({});
 const [searchError,setSearchError]=useState("");
 const [moreChoices,setMoreChoices]=useState(false);
 const [searchLoading,setSearchLoading]=useState(false);
 const [searchRetry,setSearchRetry]=useState(0);
 const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);
 const [confirmedMissing,setConfirmedMissing]=useState(false);
 const [problem,setProblem]=useState<Problem|null>(null);
 const [protectedEligible,setProtectedEligible]=useState(false);
 const canCorrect=canReverse&&protectedEligible;
 const [correction,setCorrection]=useState<string>("");
 const [correctionYear,setCorrectionYear]=useState("");
 const [correctionDate,setCorrectionDate]=useState("");
 const [correctionReason,setCorrectionReason]=useState("");
 const [correctionPassword,setCorrectionPassword]=useState("");
 const [returnBankReference,setReturnBankReference]=useState("");
 const [returningPayroll,setReturningPayroll]=useState(false);
 const [correctionPending,setCorrectionPending]=useState<{
  journalRef:string;requestKey:string;body:Record<string,unknown>}|null>(null);
 useEffect(()=>{
  if(!canReverse){setProtectedEligible(false);return;}
  let live=true;
  void (async()=>{
   try{
    const r=await fetch(endpoint+"/manual-journals/reversal-eligibility",{cache:"no-store"});
    if(!r.ok)throw Error("Eligibility not confirmed");
    const p=await r.json() as {canReverse?:boolean};
    if(live)setProtectedEligible(p.canReverse===true);
   }catch{if(live)setProtectedEligible(false);}
  })();
  return()=>{live=false;};
 },[canReverse]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const response=await fetch(endpoint+"/manual-journals",{cache:"no-store"});
   if(!response.ok)throw Error((await issueText(response)).message);
   const value:unknown=await response.json();
   if(!value||typeof value!=="object"||Array.isArray(value)||
      !("journals" in value)||!Array.isArray(value.journals))
      throw Error("Posted journal records could not be verified. Refresh and try again.");
   setItems(value.journals as LedgerRow[]);
  }catch(e){setItems([]);setError(e instanceof Error?e.message:
    "Cannot load journal records. Check your connection and retry.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!editing||!canPost)return;
  let active=true;
  const abort=new AbortController();
  const timer=setTimeout(async()=>{
   setSearchLoading(true);setSearchError("");
   try{
    const response=await fetch(endpoint+"/account-options?q="+encodeURIComponent(search.trim()),
      {cache:"no-store",signal:abort.signal});
    if(!response.ok)throw Error((await issueText(response)).message);
    const value:unknown=await response.json();
    if(!value||typeof value!=="object"||Array.isArray(value)||
       !("accounts" in value)||!Array.isArray(value.accounts)||
       !("hasMore" in value)||typeof value.hasMore!=="boolean")
      throw Error("Account search could not be verified.");
    if(active){setOptions(value.accounts as Option[]);setMoreChoices(value.hasMore);}
   }catch{
    if(active){setOptions([]);setSearchError(
      "Eligible accounts could not be loaded. Check your connection and retry the search.");}
   }finally{if(active)setSearchLoading(false);}
  },300);
  return()=>{active=false;clearTimeout(timer);abort.abort();};
 },[editing,canPost,search,searchRetry]);
 const choices=useMemo(()=>[...options,...Object.values(remembered)
  .filter(x=>!options.some(o=>o.accountRef===x.accountRef))],[options,remembered]);
 function start(){
  setEditing(true);setInfo("");setProblem(null);setPending(null);setConfirmedMissing(false);
  setYear("");setDate("");setDescription("");setLines([emptyLine(),emptyLine()]);
  setSearch("");setOptions([]);setRemembered({});
 }
 function updateLine(index:number,key:keyof DraftLine,value:string){
  if(key==="accountRef"){
   const selected=choices.find(x=>x.accountRef===value);
   if(selected)setRemembered(v=>({...v,[value]:selected}));
  }
  setLines(old=>old.map((row,i)=>i===index?{...row,[key]:value}:row));
  setProblem(old=>old?.field==="lines"?null:old);
 }
 function body(){
  const selected=lines.map(l=>choices.find(x=>x.accountRef===l.accountRef));
  const version=selected.find(x=>x?.branchRef)?.branchVersion;
  return {financialYearRef:year,postingDate:date,description,
   lines:lines.map(l=>({...l})),...(version?{branchVersion:version}:{})};
 }
 async function submitOriginal(action:Pending){
  setBusy(true);setProblem(null);setConfirmedMissing(false);
  try{
   const res=await fetch(endpoint+"/manual-journals",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...action.body,requestKey:action.requestKey})});
   if(!res.ok){
    const p=await issueText(res);
    setProblem(p);setPending(res.status>=500?action:null);return;
   }
   const confirmed:unknown=await res.json().catch(()=>null);
   if(!confirmed||typeof confirmed!=="object"||Array.isArray(confirmed)||
      !("confirmed" in confirmed)||confirmed.confirmed!==true||
      !("recordRef" in confirmed)||typeof confirmed.recordRef!=="string")
    throw Error("UNKNOWN");
   setEditing(false);setPending(null);
   setInfo("Balanced journal posted successfully. This is a journal, not a verified payment.");
   await refresh();onUpdated();
  }catch{
   setPending(action);setProblem({message:
    "The save result could not be confirmed. Check the original request before trying again.",field:null});
  }finally{setBusy(false);}
 }
 async function applyCorrection(command:{journalRef:string;requestKey:string;
  body:Record<string,unknown>}){
  if(busy)return;
  setBusy(true);setError("");setInfo("");
  setCorrectionPending(command);
  try{
   const res=await fetch(endpoint+"/manual-journals/"+command.journalRef+"/reverse",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...command.body,requestKey:command.requestKey})});
   if(!res.ok)throw Error((await issueText(res)).message);
   const data=await res.json() as {confirmed?:boolean;status?:string};
   if(data.confirmed!==true||data.status!=="REVERSED")
    throw Error("The exact financial correction is not confirmed.");
   setCorrectionPending(null);setCorrection("");
   setCorrectionPassword("");setInfo("Protected original journal reversal posted. History is preserved.");
   await refresh();onUpdated();
  }catch(e){setError(e instanceof Error?e.message:
   "Original correction outcome uncertain. Check this request before retrying.");}
  finally{setBusy(false);}
 }
 async function checkCorrection(){
  if(!correctionPending||busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch(endpoint+"/manual-journals/reversal-commands/"+
    correctionPending.requestKey,{cache:"no-store"});
   if(!r.ok)throw Error((await issueText(r)).message);
   const d=await r.json() as {confirmed?:boolean;status?:string};
   if(d.confirmed===true&&d.status==="REVERSED"){
    setCorrectionPending(null);setCorrection("");setCorrectionPassword("");
    setInfo("The original protected correction is confirmed.");
    await refresh();onUpdated();
   }else setInfo("No final correction found. Retry the SAME original request only.");
  }catch(e){setError(e instanceof Error?e.message:"Original correction status unavailable.");}
  finally{setBusy(false);}
 }
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||pending||!canPost)return;
  void submitOriginal({requestKey:crypto.randomUUID(),body:body()});
 }
 async function check(){
  if(!pending||busy)return;
  setBusy(true);setProblem(null);
  try{
   const res=await fetch(endpoint+"/commands/GENERAL_POST/"+pending.requestKey,{cache:"no-store"});
   if(!res.ok){setProblem(await issueText(res));return;}
   const value:unknown=await res.json();
   if(!value||typeof value!=="object"||!("confirmed" in value)||
     typeof value.confirmed!=="boolean")throw Error("UNKNOWN");
   if(value.confirmed===true){
    setPending(null);setEditing(false);setInfo("Original balanced journal posting confirmed.");
    await refresh();onUpdated();return;
   }
   setConfirmedMissing(true);
   setProblem({message:"The original request has not completed. You can retry the same request without creating a duplicate.",field:null});
  }catch{
   setProblem({message:"The original result is not available. Check again before retrying.",field:null});
  }finally{setBusy(false);}
 }
 return <div className="cg-fin-manual">
  <header className="cg-fin-toolbar"><div><h2>General Journal Entries</h2>
   <p>Only immutable posted journals are shown. Posting an entry does not confirm a payment.</p></div>
   <div className="cg-fin-toolbar-actions">
    <button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh</button>
    {canPost&&<button className="primary" type="button" onClick={start}>+ New Journal</button>}
   </div>
  </header>
  {info&&<p role="status" className="cg-fin-success">{info}</p>}
  {error&&<div role="alert" className="cg-fin-notice"><p>{error}</p>
   <button type="button" onClick={()=>void refresh()}>Try again</button></div>}
  {loading&&<p role="status" className="cg-fin-empty">Loading actual journal entries…</p>}
  {!loading&&!error&&<div className="cg-fin-table-wrap">
   <table className="cg-fin-table"><thead><tr><th>Posting Date</th>
    <th>Journal Description</th><th>Financial Year</th><th>Total Debits / Credits</th>
    <th>Status</th>{canCorrect&&<th>Correction</th>}</tr></thead><tbody>
    {items.map(j=><tr key={j.journalRef}><td>{j.postingDate}</td>
     <td><strong>{j.description}</strong></td><td>{j.yearName}</td>
     <td className="cg-fin-money">{money(j.debitMinor)}</td>
     <td><span className="cg-fin-status is-active">{j.reversed?
      "Reversed — historical entry":"Posted (not paid)"}</span></td>
     {canCorrect&&<td>{j.differentCreator&&!j.reversed&&
      <button type="button" disabled={busy||Boolean(correctionPending)} onClick={()=>{
       setCorrection(j.journalRef);setReturningPayroll(!!j.payrollBankReturn);setReturnBankReference("");setCorrectionYear("");setCorrectionDate("");
       setCorrectionReason("");setCorrectionPassword("");setError("");}}>{j.payrollBankReturn?"Record payroll bank return":"Correct posted journal"}</button>}</td>}</tr>)}
   </tbody></table>
   {!items.length&&<p className="cg-fin-empty">No manual journals have been posted.
    {canPost?" Choose New Journal to record a balanced entry.":""}</p>}
  </div>}
  {correction&&canCorrect&&<div className="drawer-backdrop" role="presentation">
   <section role="dialog" aria-modal="true" aria-labelledby="cg-journal-correction-title"
    className="role-drawer cg-fin-drawer">
    <div className="cg-fin-drawer-header"><div>
     <p>Finance Management / Protected Correction</p>
     <h2 id="cg-journal-correction-title">{returningPayroll?"Record actual payroll bank return":"Reverse original manual journal"}</h2>
    </div><button type="button" disabled={busy||Boolean(correctionPending)}
     onClick={()=>setCorrection("")}>Close</button></div>
    <p className="cg-fin-description">The original entry stays immutable. A different authorized
     reviewer posts one exact balancing reversal in an open financial year.
     {returningPayroll?"Use only when the original bank transfer has actually been returned. Reconcile the matching bank credit independently before another payroll payout is allowed.":"This does not reverse an issued invoice or settle a payment."}</p>
    <label className="cg-fin-field">Open correction year
     <select value={correctionYear} onChange={e=>setCorrectionYear(e.target.value)}>
      <option value="">Choose year</option>
      {years.filter(y=>y.status==="OPEN").map(y=><option key={y.yearRef} value={y.yearRef}>
       {y.name}</option>)}
     </select></label>
    <label className="cg-fin-field">Correction posting date
     <input type="date" value={correctionDate}
      onChange={e=>setCorrectionDate(e.target.value)}/></label>
    {returningPayroll&&<label className="cg-fin-field">Actual return bank transaction reference<input value={returnBankReference} maxLength={64} onChange={e=>setReturnBankReference(e.target.value)} /></label>}
    <label className="cg-fin-field">Business reason for correction
     <textarea rows={3} minLength={12} maxLength={300} value={correctionReason}
      onChange={e=>setCorrectionReason(e.target.value)}/></label>
    <label className="cg-fin-field">Current reviewer password
     <input type="password" value={correctionPassword} autoComplete="current-password"
      onChange={e=>setCorrectionPassword(e.target.value)}/></label>
    <div className="cg-fin-toolbar-actions">
     <button type="button" disabled={busy||Boolean(correctionPending)||
      !correctionYear||!correctionDate||correctionReason.trim().length<12||
      correctionPassword.length<8||(returningPayroll&&!/^[A-Z0-9 /._-]{6,64}$/.test(returnBankReference.trim().toUpperCase()))} onClick={()=>void applyCorrection({
       journalRef:correction,requestKey:crypto.randomUUID(),body:{
        financialYearRef:correctionYear,postingDate:correctionDate,
        reason:correctionReason,currentPassword:correctionPassword,...(returningPayroll?{returnBankReference:returnBankReference.trim().toUpperCase()}:{})}})}>
      Post exact protected reversal</button>
    </div>
    {correctionPending&&<div className="cg-fin-pending" role="status">
     <p>Original correction result uncertain. Check that request before trying again.</p>
     <button type="button" disabled={busy} onClick={()=>void checkCorrection()}>
      Check original correction</button>
     <button type="button" disabled={busy}
      onClick={()=>void applyCorrection(correctionPending)}>Retry SAME request</button>
    </div>}
   </section>
  </div>}
  {editing&&<div className="drawer-backdrop" role="presentation">
   <section role="dialog" aria-modal="true" aria-labelledby="cg-journal-title"
    className="role-drawer cg-fin-drawer">
    <div className="cg-fin-drawer-header"><div>
     <p>Finance Management / Journal</p><h2 id="cg-journal-title">New General Journal</h2>
    </div><button type="button" disabled={busy||Boolean(pending)}
      onClick={()=>setEditing(false)} aria-label="Close journal form">×</button></div>
    <p className="cg-fin-description">Enter two or more balanced debit and credit lines.
     This posts to the ledger but does not mark a voucher, bill or payment approved.</p>
    <form className="cg-fin-form" onSubmit={submit}>
     <label className="cg-fin-field">Open financial year *
      <select required value={year} onChange={e=>{setYear(e.target.value);setProblem(null);}}>
       <option value="">Choose a financial year</option>
       {years.filter(y=>y.status==="OPEN").map(y=><option key={y.yearRef} value={y.yearRef}>
        {y.name} ({y.startOn} to {y.endOn})</option>)}
      </select>
     </label>
     <label className="cg-fin-field">Posting date *
      <input type="date" required value={date} onChange={e=>{setDate(e.target.value);setProblem(null);}}/>
     </label>
     <label className="cg-fin-field">Journal description *
      <textarea required minLength={3} maxLength={500} rows={3} value={description}
       placeholder="Describe the business reason for this entry"
       onChange={e=>{setDescription(e.target.value);setProblem(null);}}/>
     </label>
     <label className="cg-fin-field">Find permitted accounts
      <input type="search" maxLength={80} value={search} placeholder="Search account name or business code"
       onChange={e=>setSearch(e.target.value)}/>
     </label>
     {searchLoading&&<p role="status">Finding accounts…</p>}
     {moreChoices&&<p className="cg-fin-help">More accounts exist. Refine the search for a precise account.</p>}
     {searchError&&<div className="cg-fin-notice" role="alert"><p>{searchError}</p>
      <button type="button" onClick={()=>setSearchRetry(v=>v+1)}>Retry account search</button></div>}
     {lines.map((row,index)=><div className="cg-fin-journal-line" key={index}>
       <div className="cg-fin-journal-line-head"><strong>Journal line {index+1}</strong>
        {lines.length>2&&<button type="button" disabled={busy||Boolean(pending)}
         onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))}>Remove line</button>}</div>
       <label className="cg-fin-field">Account *
        <select required value={row.accountRef}
         onChange={e=>updateLine(index,"accountRef",e.target.value)}>
         <option value="">Choose an eligible account</option>
         {choices.map(a=><option key={a.accountRef} value={a.accountRef}>
          {a.name} — {a.code}{a.branchName?" ("+a.branchName+")":""}</option>)}
        </select>
       </label>
       <div className="cg-fin-journal-amounts">
        <label className="cg-fin-field">Debit (₹)
         <input type="text" inputMode="decimal" maxLength={16} value={row.debit}
          placeholder="0.00" onChange={e=>updateLine(index,"debit",e.target.value)}/>
        </label>
        <label className="cg-fin-field">Credit (₹)
         <input type="text" inputMode="decimal" maxLength={16} value={row.credit}
          placeholder="0.00" onChange={e=>updateLine(index,"credit",e.target.value)}/>
        </label>
       </div>
      </div>)}
     {lines.length<40&&<button type="button" disabled={busy||Boolean(pending)}
       onClick={()=>setLines(prev=>[...prev,emptyLine()])}>+ Add journal line</button>}
     {problem&&<div className="cg-fin-notice" role="alert"><p>{problem.message}</p>
       {problem.field==="lines"&&<p>Review each debit/credit line and ensure the two totals match.</p>}</div>}
     {pending&&<div className="cg-fin-pending" role="status">
      <p>The previous journal posting has an unconfirmed result. Check it before retrying.</p>
      <button type="button" disabled={busy} onClick={()=>void check()}>Check original journal</button>
      {confirmedMissing&&<button type="button" disabled={busy}
        onClick={()=>void submitOriginal(pending)}>Retry same request</button>}
     </div>}
     <div className="cg-fin-form-actions">
      <button type="button" disabled={busy||Boolean(pending)}
       onClick={()=>setEditing(false)}>Cancel</button>
      <button className="primary" type="submit" disabled={busy||Boolean(pending)||
        !years.some(y=>y.status==="OPEN")}>{busy?"Saving…":"Post Balanced Journal"}</button>
     </div>
    </form>
   </section>
  </div>}
 </div>;
}
