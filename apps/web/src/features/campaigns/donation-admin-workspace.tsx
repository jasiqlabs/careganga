"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import styles from "./campaigns-reference-ui.module.css";
import {DonationFinanceActions} from "./donation-finance-actions";
type Choice={value:string;label:string};
type Options={donationNumber:string;amountMinor:string;cashAccounts:Choice[];incomeAccounts:Choice[];
 years:Choice[];complete:boolean};
type QueueItem={evidenceRef:string;voucher:string;status:string;amountMinor:string;
 donationNumber:string;postingDate:string;recordedAt:string;canReview:boolean};
type DonationItem={donationNumber:string;donationRef:string;refundMinor:string;receiptStatus:string;
 amountMinor:string;status:string;method:string|null;
 campaignTitle:string|null;voucher:string|null;createdAt:string};
type Report={items:DonationItem[];offset:number;hasMore:boolean;
 summary:{total:number;received:number;pending:number;failed:number;receivedMinor:string;
 netReceivedMinor:string;verifiedRefundMinor:string;verifiedRefundCount:number};message:string};
const rupees=(n:string)=>{
 try{const value=BigInt(n);return "₹"+(value/100n).toLocaleString("en-IN")+
  "."+(value%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}
};
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>){
 const r=await fetch("/api/donations"+path,{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(19000)});
 const raw:unknown=await r.json().catch(()=>null);
 if(!r.ok||!raw)throw Error(raw&&typeof raw==="object"&&"message" in raw&&
  typeof raw.message==="string"?raw.message:"Current donation outcome cannot be confirmed.");
 return raw as T;
}
const input={display:"block",width:"100%",minHeight:42,padding:"10px 12px",
 border:"1px solid var(--cg-border)",borderRadius:8,background:"var(--cg-surface)",color:"inherit"} as const;
const label={display:"grid",gap:5,fontSize:13,fontWeight:600} as const;
const panel={border:"1px solid var(--cg-border)",borderRadius:12,
 padding:18,background:"var(--cg-surface)",display:"grid",gap:12} as const;
const button={padding:"10px 14px",background:"#0a9f69",color:"white",
 border:0,borderRadius:8,minHeight:44,cursor:"pointer"} as const;
export function DonationAdminWorkspace({canView,canRecord,canReview,canIssue}:{
 canView:boolean;canRecord:boolean;canReview:boolean;canIssue:boolean}){
 const [data,setData]=useState<Report|null>(null),[queue,setQueue]=useState<QueueItem[]>([]);
 const [filter,setFilter]=useState("ALL"),[search,setSearch]=useState(""),[offset,setOffset]=useState(0);
 const [proof,setProof]=useState(""),[options,setOptions]=useState<Options|null>(null);
 const [cash,setCash]=useState(""),[income,setIncome]=useState(""),[year,setYear]=useState("");
 const [voucher,setVoucher]=useState(""),[postingDate,setPostingDate]=useState("");
 const [review,setReview]=useState<QueueItem|null>(null),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const pending=useRef<{key:string;payload:Record<string,unknown>}|null>(null);
 const confirmPending=useRef<{key:string;ref:string}|null>(null);
 const seq=useRef(0),mounted=useRef(true);
 const refresh=useCallback(async()=>{
  const id=++seq.current;
  try{
   const [report,work]=await Promise.all([
    canView?api<Report>("?"+new URLSearchParams({status:filter,q:search,offset:String(offset)})):Promise.resolve(null),
    canRecord?api<{items:QueueItem[]}>("/manual/queue"):Promise.resolve(null)]);
   if(id!==seq.current||!mounted.current)return;
   if(report)setData(report);
   if(work)setQueue(work.items);
   setError("");
  }catch(e){if(id===seq.current&&mounted.current){setError(e instanceof Error?e.message:"Donations unavailable.");setData(null);setQueue([]);}}
 },[canView,canRecord,filter,search,offset]);
 useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;seq.current++;};},[refresh]);
 const findOptions=async()=>{
  if(busy||!canRecord||!proof.trim())return;
  setBusy(true);setError("");setNotice("");setOptions(null);pending.current=null;
  try{const x=await api<Options>("/manual/options","POST",{statusToken:proof.trim()});if(mounted.current){
   setOptions(x);setCash(x.cashAccounts[0]?.value??"");setIncome(x.incomeAccounts[0]?.value??"");
   setYear(x.years[0]?.value??"");}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Cash account choices unavailable.");}
  finally{if(mounted.current)setBusy(false);}
 };
 const prepare=async(event:FormEvent)=>{
  event.preventDefault();
  if(!options||busy||!cash||!income||!year||!postingDate||!voucher.trim()||!canRecord)return;
  if(!pending.current)pending.current={key:crypto.randomUUID(),payload:{
   statusToken:proof.trim(),requestKey:"",cashVoucher:voucher.trim(),
   cashAccountRef:cash,incomeAccountRef:income,financialYearRef:year,postingDate}};
  const p=pending.current;p.payload.requestKey=p.key;setBusy(true);setError("");setNotice("");
  try{
   const out=await api<{voucher:string;status:string}>("/manual/prepare","POST",p.payload);
   if(mounted.current){
    setNotice("Cash voucher "+out.voucher+" recorded for independent review. No donation is marked paid yet.");
    setProof("");setOptions(null);setCash("");setIncome("");setYear("");setVoucher("");setPostingDate("");
    pending.current=null;void refresh();
   }
  }catch(e){if(mounted.current)setError((e instanceof Error?e.message:"Voucher result is uncertain.")+
    " Retry this voucher without changing its original details.");}
  finally{if(mounted.current)setBusy(false);}
 };
 const verify=async(event:FormEvent)=>{
  event.preventDefault();if(!review||!canReview||busy||!password)return;
  if(!confirmPending.current||confirmPending.current.ref!==review.evidenceRef)
   confirmPending.current={key:crypto.randomUUID(),ref:review.evidenceRef};
  const p=confirmPending.current;setBusy(true);setError("");setNotice("");
  try{
   const outcome=await api<{status:string;voucher:string}>(
    "/manual/"+p.ref+"/confirm","POST",{requestKey:p.key,currentPassword:password});
   if(mounted.current){
    setNotice("Voucher "+outcome.voucher+" confirmed in the original Foundation finance ledger.");
    setPassword("");setReview(null);confirmPending.current=null;void refresh();
   }
  }catch(e){if(mounted.current)setError((e instanceof Error?e.message:"Verification is uncertain.")+
   " Check this voucher before retrying the same confirmation.");}
  finally{if(mounted.current)setBusy(false);}
 };
 const select=(xs:Choice[],value:string,onChange:(x:string)=>void,title:string)=>
  <label style={label}>{title}<select value={value} onChange={e=>{pending.current=null;onChange(e.target.value);}}
    style={input} required><option value="">Choose {title.toLowerCase()}</option>
   {xs.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;
 return <section className={styles.workspace}>
  <header className={styles.titleRow}><div><h1>Donations & Cash Verification</h1>
   <p>Original CareGanga donation records. A request or voucher is not received money.</p></div>
   <button type="button" style={button} disabled={busy} onClick={()=>void refresh()}>Refresh</button></header>
  {notice&&<p role="status" className={styles.note}>{notice}</p>}
  {error&&<p role="alert" className={styles.note}>{error}</p>}
  {canView&&<><div className={styles.statGrid}>
   {([["Total requests",data?.summary.total??null],
    ["Received",data?.summary.received??null],
    ["Pending",data?.summary.pending??null],
    ["Failed / expired",data?.summary.failed??null],
    ["Gross verified",data?.summary.receivedMinor?rupees(data.summary.receivedMinor):null],
    ["Confirmed refunds",data?.summary.verifiedRefundMinor?rupees(data.summary.verifiedRefundMinor):null],
    ["Net verified",data?.summary.netReceivedMinor?rupees(data.summary.netReceivedMinor):null]]
    as const).map(([name,value])=><div className={styles.statCard} key={name}>
     <div><div className={styles.statNumber}>{value??"—"}</div>
     <div className={styles.statLabel}>{name}</div></div></div>)}
  </div><div style={panel}><h2>Donation records</h2>
   <div className={styles.filterGrid}><label style={label}>Search campaign or donation number
    <input style={input} value={search} onChange={e=>{setOffset(0);setSearch(e.target.value);}} maxLength={80}/></label>
    <label style={label}>Payment state
     <select style={input} value={filter} onChange={e=>{setOffset(0);setFilter(e.target.value);}}>
      {["ALL","REQUESTED","PAYMENT_PENDING","RECONCILIATION_PENDING","RECEIVED_POSTED","FAILED","EXPIRED"].map(x=>
       <option key={x} value={x}>{x==="ALL"?"All":x.replaceAll("_"," ").toLowerCase()}</option>)}</select></label></div>
   {data?.items.length===0?<p>No matching donation records.</p>:
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
     <thead><tr>{["Donation","Campaign","Amount","Method","Status","Date"].map(t=>
      <th key={t} scope="col" style={{textAlign:"left",padding:10,borderBottom:"1px solid var(--cg-border)"}}>{t}</th>)}</tr></thead>
     <tbody>{data?.items.map(x=><tr key={x.donationNumber}>
      <td style={{padding:10}}>{x.donationNumber}</td><td style={{padding:10}}>{x.campaignTitle??"General donation"}</td>
      <td style={{padding:10}}>{rupees(x.amountMinor)}</td><td style={{padding:10}}>{x.method??"Not selected"}</td>
      <td style={{padding:10}}>{x.status.replaceAll("_"," ").toLowerCase()}</td>
      <td style={{padding:10}}>{new Date(x.createdAt).toLocaleDateString("en-IN")}</td>
     </tr>)}</tbody></table></div>}
   <div style={{display:"flex",gap:10}}>
    <button type="button" disabled={offset===0||busy} onClick={()=>setOffset(x=>Math.max(0,x-25))}>Previous</button>
    <button type="button" disabled={!data?.hasMore||busy} onClick={()=>setOffset(x=>x+25)}>Next</button>
   </div></div></>}
  {canRecord&&<div style={panel}><h2>Record physical cash</h2>
   <p>Use the donor's private status proof. An independent Foundation reviewer must confirm the cash voucher before accounting records it as received.</p>
   <label style={label}>Private donor status proof
    <textarea style={{...input,minHeight:68}} value={proof}
     onChange={e=>{if(!pending.current){setProof(e.target.value);setOptions(null);}}}
     placeholder="Enter the private proof supplied by the donor" maxLength={80}/></label>
   <button type="button" disabled={busy||!proof.trim()||!!pending.current} style={button} onClick={()=>void findOptions()}>
    Check donation and eligible accounts</button>
   {options&&<form onSubmit={e=>void prepare(e)} style={{display:"grid",gap:12}}>
    <strong>Donation {options.donationNumber} — {rupees(options.amountMinor)}</strong>
    {!options.complete&&<p role="alert">Finance account choices are incomplete. Ask a Foundation Administrator.</p>}
    {select(options.cashAccounts,cash,setCash,"Cash account")}
    {select(options.incomeAccounts,income,setIncome,"Donation income account")}
    {select(options.years,year,setYear,"Open financial year")}
    <label style={label}>Physical cash voucher number
     <input style={input} value={voucher} maxLength={100}
      onChange={e=>{if(!pending.current)setVoucher(e.target.value);}} required/></label>
    <label style={label}>Cash receipt date
     <input type="date" style={input} value={postingDate}
      onChange={e=>{if(!pending.current)setPostingDate(e.target.value);}} required/></label>
    <button type="submit" style={button} disabled={busy||!options.complete}>
     Save for independent review (not paid)</button>
   </form>}</div>}
  {canRecord&&<div style={panel}><h2>Cash voucher review</h2>
   {queue.length===0?<p>No recent cash vouchers.</p>:queue.map(x=><div key={x.evidenceRef}
     style={{padding:12,border:"1px solid var(--cg-border)",borderRadius:10,display:"grid",gap:8}}>
    <strong>{x.voucher}</strong>
    <span>{x.donationNumber} · {rupees(x.amountMinor)} · {x.status.replaceAll("_"," ").toLowerCase()}</span>
    {canReview&&x.canReview&&x.status==="PENDING_REVIEW"&&
     <button type="button" style={button} disabled={busy}
      onClick={()=>{setReview(x);setPassword("");confirmPending.current=null;}}>
       Independently review</button>}
   </div>)}
   {review&&<form onSubmit={e=>void verify(e)} style={{display:"grid",gap:12}}>
    <h3>Confirm cash voucher {review.voucher}</h3>
    <p>Confirm only after independently checking the actual physical cash and the selected original accounts. This posts to CG-09 once.</p>
    <label style={label}>Current password
     <input type="password" autoComplete="current-password" style={input}
      value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label>
    <div style={{display:"flex",gap:12}}>
     <button style={button} disabled={busy||!password} type="submit">Confirm received cash</button>
     <button type="button" disabled={busy} onClick={()=>{setReview(null);setPassword("");confirmPending.current=null;}}>Cancel</button>
    </div></form>}
  </div>}
  <DonationFinanceActions items={data?.items??[]} canRecord={canRecord} canReview={canReview}
   canIssue={canIssue} onChange={()=>void refresh()}/>
  <p className={styles.note}>Cash and verified Razorpay collections post into the original CG-09 journal. Bank/NEFT/cheque and provider refunds remain unavailable without genuine payment evidence.</p>
 </section>;
}
