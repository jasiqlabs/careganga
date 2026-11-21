"use client";
import {useCallback,useEffect,useState} from "react";
import {FoundationJournalCorrectionPanel} from "./foundation-journal-correction-panel";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Year={yearRef:string;name:string};
type Account={accountRef:string;name:string;kind:"EXPENSE"|"LIABILITY"};
type Options={liabilityRef:string;postingDate:string;postingState:string;
 foundationJournalPosted:boolean;originalRequestKey:string;amountMinor:string;
 financialYears:Year[];accounts:Account[];complete:boolean};
type Posting={postingState:string;foundationJournalPosted:boolean;replayed?:boolean};
type Props={centerRef:string;liabilityRef:string;onPosted:()=>Promise<void>};
const money=(minor:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2
}).format(Number(minor)/100);
async function source<T>(path:string,body?:object):Promise<T>{
 const res=await fetch("/api/healthcare-assistance/foundation-journals/"+path,{
  method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const value:unknown=await res.json().catch(()=>null);
 if(!res.ok)throw Object.assign(new Error(value&&typeof value==="object"&&
  "message" in value&&typeof value.message==="string"?value.message:
  "Original Foundation journal outcome is unavailable."),{status:res.status});
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw Error("CG09 accounting source could not be verified.");
 return value as T;
}
/** Only uses original configured CG09 financial years/accounts.
 * The benefit liability has already been approved by source before posting.
 * Patient payments, bank transfers and provider settlements are NOT posted.
 */
export function FoundationJournalPostingPanel({centerRef,liabilityRef,onPosted}:Props){
 const [value,setValue]=useState<Options|null>(null);
 const [year,setYear]=useState(""),[expense,setExpense]=useState("");
 const [payable,setPayable]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const base="centers/"+centerRef+"/liabilities/"+liabilityRef+"/";
 const load=useCallback(async()=>{
  const result=await source<Options>(base+"options");
  if(typeof result.originalRequestKey!=="string"||
   !ID.test(result.originalRequestKey)||typeof result.postingDate!=="string"||
   !Array.isArray(result.accounts)||!Array.isArray(result.financialYears)||
   result.accounts.length>100||result.financialYears.length>20||
   typeof result.foundationJournalPosted!=="boolean")
   throw Error("Original CG09 accounting options are incomplete.");
  return result;
 },[base]);
 useEffect(()=>{
  let active=true;setLoading(true);setValue(null);
  setYear("");setExpense("");setPayable("");setError("");setMessage("");
  setUncertain(false);
  void load().then(v=>{if(active)setValue(v)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:
    "Foundation accounting options unavailable.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[load]);
 async function check(){
  if(busy)return;setBusy(true);setError("");setMessage("");
  try{
   const current=await load();setValue(current);
   if(current.foundationJournalPosted){
    setUncertain(false);await onPosted();
   }else setMessage("No original CG09 journal has been confirmed. "+
    "Do not submit a second account combination while an outcome is uncertain.");
  }catch(e){setError(e instanceof Error?e.message:
   "Original CG09 journal status is unavailable.");}
  finally{setBusy(false);}
 }
 async function post(){
  if(busy||loading||uncertain||!value||value.foundationJournalPosted||
   !ID.test(year)||!ID.test(expense)||!ID.test(payable)||expense===payable)return;
  if(!window.confirm("Post this approved Foundation liability to CG09 "+
   "using the selected expense and payable accounts? "+
   "No patient money or provider bank transfer is posted."))return;
  setBusy(true);setError("");setMessage("");
  try{
   const result=await source<Posting>(base+"post",{
    requestKey:value.originalRequestKey,financialYearRef:year,
    expenseAccountRef:expense,liabilityAccountRef:payable});
   if(result.postingState!=="POSTED"||result.foundationJournalPosted!==true)
    throw Error("Original CG09 journal posting has not been confirmed.");
   setUncertain(false);setMessage("CG09 balanced Foundation expense and "+
    "provider payable posted from the original completed consultation.");
   setValue(await load());await onPosted();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   setError(e instanceof Error?e.message:
    "Posting result uncertain; check the original CG09 record.");
  }finally{setBusy(false);}
 }
 if(!ID.test(centerRef)||!ID.test(liabilityRef))return null;
 return <section className="cg-diagnostics-card" aria-label="Original CG09 liability posting">
  <h3>Post approved Foundation liability to Accounts</h3>
  <p>Source-approved Foundation assistance is an expense and payable,
   not income from the patient. Posting requires current Foundation and
   finance permissions and actual CG09 accounts.</p>
  {loading&&<p role="status">Checking CG09 accounting options…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!message&&<p role="status" className="notice">{message}</p>}
  {value?.foundationJournalPosted&&<p role="status">The original balanced
   CG09 Foundation liability journal has been posted. No additional posting is needed.</p>}
  {value&&!value.foundationJournalPosted&&<>
   <p>Approved amount: {money(value.amountMinor)}.
    Original service accounting date: {value.postingDate}.</p>
   {!value.complete&&<p role="status">The account choices are incomplete.
    Review the original CG09 account list before posting.</p>}
   {value.financialYears.length===0&&
    <p>No open CG09 financial year covers the original service date. The
     obligation remains pending; an accountant must resolve this in CG09.</p>}
   <label className="field">Open financial year
    <select value={year} disabled={busy||uncertain} onChange={e=>setYear(e.target.value)}>
     <option value="">Select actual financial year</option>
     {value.financialYears.map(y=><option key={y.yearRef} value={y.yearRef}>
      {y.name}</option>)}
    </select>
   </label>
   <label className="field">Foundation healthcare expense account
    <select value={expense} disabled={busy||uncertain} onChange={e=>setExpense(e.target.value)}>
     <option value="">Select approved expense account</option>
     {value.accounts.filter(x=>x.kind==="EXPENSE").map(x=>
      <option key={x.accountRef} value={x.accountRef}>{x.name}</option>)}
    </select>
   </label>
   <label className="field">Foundation provider payable account
    <select value={payable} disabled={busy||uncertain} onChange={e=>setPayable(e.target.value)}>
     <option value="">Select approved liability account</option>
     {value.accounts.filter(x=>x.kind==="LIABILITY").map(x=>
      <option key={x.accountRef} value={x.accountRef}>{x.name}</option>)}
    </select>
   </label>
   {!uncertain&&<button type="button" className="primary"
    disabled={busy||!value.complete||!ID.test(year)||!ID.test(expense)||
     !ID.test(payable)||expense===payable} onClick={()=>void post()}>
    {busy?"Verifying original posting…":"Post original approved liability"}</button>}
   {uncertain&&<p role="alert">The original posting result may be committed.
    Check its exact source before retrying. No second journal request is created.</p>}
  </>}
  {value?.foundationJournalPosted&&<FoundationJournalCorrectionPanel
   centerRef={centerRef} liabilityRef={liabilityRef} onCorrected={onPosted}/>}
  <button type="button" disabled={busy||loading} onClick={()=>void check()}>
   Check current original CG09 posting</button>
 </section>;
}
