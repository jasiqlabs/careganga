"use client";
import Link from "next/link";
import {useRef,useState,type FormEvent} from "react";
type Choice={value:string;label:string};
type BankOptions={donationNumber:string;amountMinor:string;banks:Choice[];
 suspenseAccounts:Choice[];incomeAccounts:Choice[];years:Choice[]};
type Result={donationNumber:string;status:string;message:string;replayed:boolean};
const control={minHeight:44,width:"100%",padding:"10px 12px",borderRadius:8,
 border:"1px solid var(--cg-border)",background:"var(--cg-surface)",color:"inherit"} as const;
const button={minHeight:44,padding:"10px 14px",borderRadius:8,border:0,
 background:"#0a9f69",color:"white",cursor:"pointer"} as const;
const label={display:"grid",gap:6,fontSize:13,fontWeight:600} as const;
async function post<T>(route:string,value:object):Promise<T>{
 const res=await fetch("/api/donations/bank/"+route,{
  method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(value),signal:AbortSignal.timeout(19000)});
 const body:unknown=await res.json().catch(()=>null);
 if(!res.ok||!body)throw new Error(body&&typeof body==="object"&&
  "message" in body&&typeof body.message==="string"?body.message:
  "Bank collection status could not be verified.");
 return body as T;
}
/** CG09 original bank review is the ONLY acceptance authority; this form
 * merely posts a provisional BANK debit and suspense LIABILITY credit.
 * Donor is not counted as paid until distinct CG19/CG09 verification. */
export function DonationBankPanel({onRecorded}:{onRecorded:()=>void}){
 const [proof,setProof]=useState(""),[options,setOptions]=useState<BankOptions|null>(null);
 const [method,setMethod]=useState<"BANK"|"NEFT"|"CHEQUE">("NEFT");
 const [bank,setBank]=useState(""),[suspense,setSuspense]=useState(""),[income,setIncome]=useState("");
 const [year,setYear]=useState(""),[day,setDay]=useState(""),[item,setItem]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const key=useRef<string|null>(null);
 const refresh=async()=>{
  if(busy||!proof.trim())return;
  setBusy(true);setError("");setMessage("");setOptions(null);key.current=null;
  try{
   const x=await post<BankOptions>("options",{statusToken:proof.trim()});
   setOptions(x);setBank(x.banks[0]?.value??"");setSuspense(x.suspenseAccounts[0]?.value??"");
   setIncome(x.incomeAccounts[0]?.value??"");setYear(x.years[0]?.value??"");
  }catch(e){setError(e instanceof Error?e.message:"Original Foundation bank accounts are unavailable.");}
  finally{setBusy(false);}
 };
 const select=(title:string,values:Choice[],value:string,set:(x:string)=>void)=>
  <label style={label}>{title}<select style={control} required value={value} disabled={busy||!!key.current}
   onChange={e=>set(e.target.value)}><option value="">Choose {title.toLowerCase()}</option>
   {values.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;
 const submit=async(e:FormEvent)=>{
  e.preventDefault();
  if(busy||!options||!bank||!suspense||!income||!year||!day||item.trim().length<4)return;
  if(!key.current)key.current=crypto.randomUUID();
  setBusy(true);setError("");setMessage("");
  try{
   const outcome=await post<Result>("prepare",{
    statusToken:proof.trim(),requestKey:key.current,method,bankAccountRef:bank,
    suspenseAccountRef:suspense,incomeAccountRef:income,financialYearRef:year,
    postingDate:day,bankItemReference:item.trim()});
   if(outcome.status!=="PENDING"&&outcome.status!=="VERIFIED_POSTED"&&
      outcome.status!=="REJECTED_REVERSED")throw Error("Original bank posting outcome is not verified.");
   setMessage(outcome.message);
   setProof("");setOptions(null);setItem("");setDay("");key.current=null;
   onRecorded();
  }catch(e){setError((e instanceof Error?e.message:"Result uncertain.")+
   " Keep the same details and retry the same request; do not accept a second payment.");}
  finally{setBusy(false);}
 };
 return <section style={{border:"1px solid var(--cg-border)",borderRadius:12,padding:18,
   background:"var(--cg-surface)",display:"grid",gap:12}}>
  <h2>Bank, NEFT & cheque collection</h2>
  <p>Stage the original bank deposit in a suspense account. A clean-scanned bank statement and different authorized CG09 reviewer must confirm the source before it counts as a received donation.</p>
  <label style={label}>Private donor status proof
   <textarea value={proof} style={{...control,minHeight:72}} maxLength={80}
    disabled={busy||!!key.current}
    onChange={e=>{setProof(e.target.value);setOptions(null);}}/>
  </label>
  <button type="button" style={button} disabled={busy||!proof.trim()||!!key.current}
   onClick={()=>void refresh()}>Check original donation and bank accounts</button>
  {options&&<form onSubmit={e=>void submit(e)} style={{display:"grid",gap:12}}>
   <strong>{options.donationNumber} · Amount: ₹{(BigInt(options.amountMinor)/100n).toString()}</strong>
   <label style={label}>Payment method
    <select style={control} value={method} disabled={busy||!!key.current}
     onChange={e=>setMethod(e.target.value as "BANK"|"NEFT"|"CHEQUE")}>
     <option value="NEFT">NEFT / bank transfer</option>
     <option value="BANK">Bank deposit</option>
     <option value="CHEQUE">Cheque (cleared statement required)</option>
    </select></label>
   {select("Original bank account",options.banks,bank,setBank)}
   {select("Suspense liability account",options.suspenseAccounts,suspense,setSuspense)}
   {select("Donation income account",options.incomeAccounts,income,setIncome)}
   {select("Open financial year",options.years,year,setYear)}
   <label style={label}>Bank posting date
    <input type="date" value={day} style={control} required disabled={busy||!!key.current}
     onChange={e=>setDay(e.target.value)}/></label>
   <label style={label}>Actual bank item reference (not independent proof)
    <input value={item} style={control} maxLength={100} minLength={4} required
     disabled={busy||!!key.current} onChange={e=>setItem(e.target.value)}/></label>
   <button type="submit" style={button} disabled={busy}>Save pending bank verification (not received)</button>
  </form>}
  {error&&<p role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  <p><Link href="/admin/finance/reports">Open original CG09 bank reconciliation & CG19 scanned statement review</Link></p>
 </section>;
}
