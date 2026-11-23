"use client";
import {useRef,useState,type FormEvent,type ReactNode} from "react";

type Choice={value:string;label:string};
type Donation={donationNumber:string;donationRef:string;status:string;amountMinor:string;
 receiptStatus:string;refundMinor:string};
type Reconciliation={donationNumber:string;amountMinor:string;providerStatus:string;signedVerified:boolean;createdAt:string};
type Online={donationNumber:string;amountMinor:string;clearingAccounts:Choice[];
 incomeAccounts:Choice[];years:Choice[]};
type Refund={refundRef:string;donationNumber:string;amountMinor:string;reason:string;
 status:string;canReview:boolean;settlementMethod:"CASH"|"ONLINE";providerState:string};
type RefundChoices={years:Choice[];amountMinor:string;complete:boolean;settlementMethod:"CASH"|"ONLINE"};
const control={minHeight:44,padding:10,width:"100%",border:"1px solid #c7cbd1",
 borderRadius:8,background:"var(--cg-surface)",color:"inherit"} as const;
const box={padding:18,border:"1px solid var(--cg-border)",borderRadius:12,
 background:"var(--cg-surface)",display:"grid",gap:12} as const;
const button={minHeight:44,padding:"10px 16px",background:"#0a9f69",color:"white",
 border:0,borderRadius:8,cursor:"pointer"} as const;
async function request<T>(route:string,body?:object):Promise<T>{
 const result=await fetch("/api/donations"+route,{method:body?"POST":"GET",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(19000)});
 const data:unknown=await result.json().catch(()=>null);
 if(!result.ok||!data)throw Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:"The original Foundation finance result could not be verified.");
 return data as T;
}
const money=(minor:string)=>{
 try{const n=BigInt(minor);return "₹"+(n/100n).toLocaleString("en-IN")+
  "."+(n%100n).toString().padStart(2,"0");}catch{return "Unavailable";}
};
const field=(name:string,children:ReactNode)=>
 <label style={{display:"grid",gap:5,fontSize:13,fontWeight:600}}>{name}{children}</label>;
const choices=(items:Choice[],value:string,set:(v:string)=>void)=>
 <select style={control} required value={value} onChange={e=>set(e.target.value)}>
  <option value="">Choose an account or year</option>
  {items.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>;
/** A16/A17/A18: handles only original authorized finance and CG19 documents. */
export function DonationFinanceActions({items,canRecord,canReview,canIssue,onChange}:{
 items:Donation[];canRecord:boolean;canReview:boolean;canIssue:boolean;onChange:()=>void}){
 const [online,setOnline]=useState<Online|null>(null),[number,setNumber]=useState("");
 const [reconciliations,setReconciliations]=useState<Reconciliation[]>([]);
 const [clearing,setClearing]=useState(""),[income,setIncome]=useState(""),
 [year,setYear]=useState(""),[date,setDate]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [refundDonation,setRefundDonation]=useState(""),[amount,setAmount]=useState(""),
 [reason,setReason]=useState("");
 const [refunds,setRefunds]=useState<Refund[]>([]),[refundReview,setRefundReview]=useState<Refund|null>(null),
 [refundOptions,setRefundOptions]=useState<RefundChoices|null>(null),[refundYear,setRefundYear]=useState(""),
 [refundDate,setRefundDate]=useState(""),[refundVoucher,setRefundVoucher]=useState(""),
 [refundPassword,setRefundPassword]=useState(""),[paidOut,setPaidOut]=useState(false);
 const [issueFor,setIssueFor]=useState<Donation|null>(null);
 const [correctionRefund,setCorrectionRefund]=useState("");
 const onlineKey=useRef<string|null>(null),refundKey=useRef<string|null>(null),
 refundConfirmKey=useRef<string|null>(null),receiptKey=useRef<string|null>(null),correctionKey=useRef<string|null>(null);
 const run=async(fn:()=>Promise<void>)=>{
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Original result uncertain. Retry with the same request key.");}
  finally{setBusy(false);}
 };
 const refreshReconciliations=()=>run(async()=>{
  const r=await request<{items:Reconciliation[]}>("/online/reconcile-queue");
  setReconciliations(r.items);
  if(r.items.length===0)setNotice("No pending provider reconciliations in this Foundation scope.");
 });
 const onlineOptions=()=>run(async()=>{
  const x=await request<Online>("/online/options",{donationNumber:number});
  setOnline(x);setClearing(x.clearingAccounts[0]?.value??"");
  setIncome(x.incomeAccounts[0]?.value??"");setYear(x.years[0]?.value??"");
  onlineKey.current=null;
 });
 const postOnline=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  if(!online||!clearing||!income||!year||!date||!password)throw Error("Complete the actual finance options.");
  if(!onlineKey.current)onlineKey.current=crypto.randomUUID();
  const result=await request<{status:string}>("/online/post",{
   donationNumber:online.donationNumber,requestKey:onlineKey.current,
   clearingAccountRef:clearing,incomeAccountRef:income,financialYearRef:year,
   postingDate:date,currentPassword:password});
  if(result.status!=="RECEIVED_POSTED")throw Error("CG09 did not confirm this donation.");
  setNotice("Signed provider collection confirmed in the original Foundation ledger.");
  setOnline(null);setPassword("");onlineKey.current=null;onChange();
 });};
 const requestRefund=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  if(!refundDonation||!amount||reason.trim().length<12)throw Error("Choose donation, amount and reason.");
  if(!refundKey.current)refundKey.current=crypto.randomUUID();
  const result=await request<{status:string}>("/refunds/request",{
   donationNumber:refundDonation,amount,reason:reason.trim(),requestKey:refundKey.current});
  if(result.status!=="REQUESTED")throw Error("The original refund request is not confirmed.");
  setNotice("Refund requested; original money has NOT been paid out.");
  refundKey.current=null;setRefundDonation("");setAmount("");setReason("");onChange();
  const list=await request<{items:Refund[]}>("/refunds/queue");setRefunds(list.items);
 });};
 const refreshRefunds=()=>run(async()=>{
  const list=await request<{items:Refund[]}>("/refunds/queue");setRefunds(list.items);
 });
 const beginRefund=(row:Refund)=>run(async()=>{
  const options=await request<RefundChoices>("/refunds/"+row.refundRef+"/options");
  setRefundReview(row);setRefundOptions(options);setRefundYear(options.years[0]?.value??"");
  setRefundDate("");setRefundVoucher("");setRefundPassword("");setPaidOut(false);
  refundConfirmKey.current=null;
 });
 const initiateProviderRefund=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  if(!refundReview||refundReview.settlementMethod!=="ONLINE"||!refundPassword||!paidOut)
   throw Error("An independent reviewer must authorize the actual merchant refund.");
  if(!refundConfirmKey.current)refundConfirmKey.current=crypto.randomUUID();
  const result=await request<{status:string;message?:string}>(
   "/refunds/"+refundReview.refundRef+"/authorize-provider",{
    requestKey:refundConfirmKey.current,currentPassword:refundPassword});
  setNotice(result.message??"Merchant refund initiated; finance totals remain unchanged.");
  setRefundReview(null);setRefundPassword("");setPaidOut(false);
  const list=await request<{items:Refund[]}>("/refunds/queue");setRefunds(list.items);onChange();
 });};
 const reconcileProviderRefund=(row:Refund)=>run(async()=>{
  const result=await request<{status:string;message?:string;merchantStatus?:string}>(
   "/refunds/"+row.refundRef+"/reconcile-provider");
  setNotice(result.message??"Original merchant status verified. No second payout was sent.");
  const list=await request<{items:Refund[]}>("/refunds/queue");setRefunds(list.items);onChange();
 });
 const postProviderRefund=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  if(!refundReview||refundReview.settlementMethod!=="ONLINE"||
   refundReview.providerState!=="PROVIDER_PROCESSED"||
   !refundOptions?.complete||!refundYear||!refundDate||!refundPassword)
   throw Error("Only a signed processed gateway refund can be posted.");
  if(!refundConfirmKey.current)refundConfirmKey.current=crypto.randomUUID();
  const result=await request<{status:string}>(
   "/refunds/"+refundReview.refundRef+"/post-provider",{
    requestKey:refundConfirmKey.current,currentPassword:refundPassword,
    yearRef:refundYear,postingDate:refundDate});
  if(result.status!=="FINANCE_REVERSED")throw Error("Original CG09 reversal not confirmed.");
  setNotice("Razorpay processed refund and original CG09 correction posted. CG19 correction can now be issued.");
  setRefundReview(null);setRefundPassword("");refundConfirmKey.current=null;onChange();
  const list=await request<{items:Refund[]}>("/refunds/queue");setRefunds(list.items);
 });};
 const confirmRefund=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  if(!refundReview||!paidOut||!refundOptions?.complete||!refundYear||!refundDate||!refundPassword)
   throw Error("Review the original cash payout before confirming.");
  if(!refundConfirmKey.current)refundConfirmKey.current=crypto.randomUUID();
  const x=await request<{status:string}>("/refunds/"+refundReview.refundRef+"/confirm-cash",{
   requestKey:refundConfirmKey.current,yearRef:refundYear,postingDate:refundDate,
   cashVoucher:refundVoucher,currentPassword:refundPassword,payoutConfirmed:true});
  if(x.status!=="FINANCE_REVERSED")throw Error("Refund correction not verified.");
  setNotice("Physical cash refund confirmed by original CG09 balanced correction.");
  setRefundReview(null);setRefundPassword("");refundConfirmKey.current=null;onChange();
  const list=await request<{items:Refund[]}>("/refunds/queue");setRefunds(list.items);
 });};
 const issueCorrection=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  const row=refunds.find(x=>x.refundRef===correctionRefund&&x.status==="FINANCE_REVERSED");
  if(!row)throw new Error("Choose an actual posted refund with an already issued original receipt.");
  if(!correctionKey.current)correctionKey.current=crypto.randomUUID();
  const response=await fetch("/api/donation-receipts/"+row.refundRef+"/correction",{
   method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({requestKey:correctionKey.current}),signal:AbortSignal.timeout(18000)});
  const value:unknown=await response.json().catch(()=>null);
  if(!response.ok||!value||typeof value!=="object"||!("status" in value)||
    value.status!=="ISSUED")throw Error("Correction outcome uncertain. Retry the same original request.");
  setNotice("Separate CG19 correction issued. Original receipt remains unchanged.");
  setCorrectionRefund("");correctionKey.current=null;onChange();
 });};
 const issue=(event:FormEvent)=>{event.preventDefault();void run(async()=>{
  if(!issueFor)throw Error("Choose a posted donation.");
  if(!receiptKey.current)receiptKey.current=crypto.randomUUID();
  const r=await fetch("/api/donation-receipts/"+issueFor.donationRef+"/issue",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({requestKey:receiptKey.current}),cache:"no-store",
   signal:AbortSignal.timeout(19000)});
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok||!data||typeof data!=="object"||!("status" in data))
   throw Error("CG19 receipt issue outcome is uncertain. Check and retry the original request.");
  if(data.status!=="ISSUED")throw Error("Private document not yet verified; do not mark receipt issued.");
  setNotice("Original private CG19 receipt issued. The donor can download it with their private proof.");
  receiptKey.current=null;setIssueFor(null);onChange();
 });};
 const canSettle=canRecord&&canReview;
 return <div style={{display:"grid",gap:16}}>
  {canSettle&&<section style={box}><h2>Verify online donation</h2>
    <button type="button" style={button} disabled={busy} onClick={()=>void refreshReconciliations()}>
     Refresh signed gateway reconciliation queue</button>
    {reconciliations.map(x=><div key={x.donationNumber}
     style={{display:"grid",gap:5,border:"1px solid var(--cg-border)",borderRadius:8,padding:10}}>
     <strong>{x.donationNumber} · {money(x.amountMinor)}</strong>
     <span>{x.signedVerified?"Signed provider event verified; awaiting CG-09 posting.":
      "No signed provider success: request the original webhook replay, do not post money."}</span>
     {x.signedVerified&&<button type="button" style={button} disabled={busy}
      onClick={()=>{setNumber(x.donationNumber);setOnline(null);onlineKey.current=null;}}>
       Select for finance verification</button>}
    </div>)}
   <p>Only a genuine signed provider success can be posted; payment links are not received funds.</p>
   {field("Donation number",<input style={control} maxLength={15} value={number}
    onChange={e=>{if(!onlineKey.current){setNumber(e.target.value.toUpperCase());setOnline(null);}}}/>)}
   <button type="button" style={button} disabled={busy||!/^CG-DON-[0-9]{8}$/.test(number)}
    onClick={()=>void onlineOptions()}>Check verified gateway source</button>
   {online&&<form onSubmit={postOnline} style={{display:"grid",gap:10}}>
    <strong>{online.donationNumber} · {money(online.amountMinor)}</strong>
    {field("Gateway clearing account",choices(online.clearingAccounts,clearing,v=>{if(!onlineKey.current)setClearing(v);}))}
    {field("Donation income account",choices(online.incomeAccounts,income,v=>{if(!onlineKey.current)setIncome(v);}))}
    {field("Open financial year",choices(online.years,year,v=>{if(!onlineKey.current)setYear(v);}))}
    {field("Posting date",<input type="date" style={control} value={date} required
     onChange={e=>{if(!onlineKey.current)setDate(e.target.value);}}/>)}
    {field("Current reviewer password",<input type="password" autoComplete="current-password"
     style={control} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/>)}
    <button type="submit" style={button} disabled={busy}>Post verified donation once to CG-09</button>
   </form>}
  </section>}
  {canRecord&&<section style={box}><h2>Request a refund</h2>
   <p>Pending refund requests do not reduce verified totals. Physical cash refunds require a separate reviewer.</p>
   <form onSubmit={requestRefund} style={{display:"grid",gap:10}}>
    {field("Posted donation",<select style={control} value={refundDonation} required onChange={e=>{
     if(!refundKey.current)setRefundDonation(e.target.value);}}>
     <option value="">Select original donation</option>
     {items.filter(x=>x.status==="RECEIVED_POSTED").map(x=>
      <option key={x.donationNumber} value={x.donationNumber}>{x.donationNumber} · {money(x.amountMinor)}</option>)}
    </select>)}
    {field("Amount to refund (INR)",<input style={control} value={amount}
     inputMode="decimal" maxLength={16} required onChange={e=>{if(!refundKey.current)setAmount(e.target.value);}}/>)}
    {field("Reason",<textarea style={{...control,minHeight:65}} value={reason} maxLength={300}
     required onChange={e=>{if(!refundKey.current)setReason(e.target.value);}}/>)}
    <button type="submit" style={button} disabled={busy}>Save refund request (not paid out)</button>
   </form>
  </section>}
  {canSettle&&<section style={box}><h2>Independent refund verification</h2>
   <p>Cash uses an actual physical payout voucher. Razorpay requires one merchant refund, a signed processed event and a separate CG09 correction. Bank refunds cannot use either shortcut.</p>
   <button style={button} type="button" disabled={busy} onClick={()=>void refreshRefunds()}>
    Refresh refund requests</button>
   {refunds.map(x=><div key={x.refundRef} style={{display:"grid",gap:5,padding:10,
    border:"1px solid var(--cg-border)",borderRadius:8}}>
    <strong>{x.donationNumber} · {money(x.amountMinor)}</strong>
    <span>{x.reason} — {x.status.replaceAll("_"," ").toLowerCase()}
     {" · "}{x.settlementMethod==="ONLINE"?"Razorpay":"Physical cash"}
     {x.settlementMethod==="ONLINE"?" · "+x.providerState.replaceAll("_"," ").toLowerCase():""}</span>
    {x.canReview&&x.status==="REQUESTED"&&
     (x.settlementMethod==="CASH"||
      ["NOT_STARTED","PROVIDER_PROCESSED"].includes(x.providerState))&&
     <button type="button" style={button} disabled={busy} onClick={()=>void beginRefund(x)}>
      {x.settlementMethod==="CASH"?"Independently review physical cash payout":
       x.providerState==="PROVIDER_PROCESSED"?"Post signed processed gateway refund to CG09":
       "Authorize one original merchant refund"}</button>}
    {x.settlementMethod==="ONLINE"&&x.status==="REQUESTED"&&
     !["NOT_STARTED","PROVIDER_FAILED","FINANCE_POSTED"].includes(x.providerState)&&
     <button type="button" style={button} disabled={busy}
      onClick={()=>void reconcileProviderRefund(x)}>Check original merchant outcome (never reissue refund)</button>}
   </div>)}
   {refundReview&&refundOptions&&refundReview.settlementMethod==="CASH"&&
    <form onSubmit={confirmRefund} style={{display:"grid",gap:10}}>
    <strong>Cash refund {refundReview.donationNumber} · {money(refundReview.amountMinor)}</strong>
    {field("Open financial year",choices(refundOptions.years,refundYear,v=>{
     if(!refundConfirmKey.current)setRefundYear(v);} ))}
    {field("Physical cash refund date",<input type="date" style={control} required
     value={refundDate} onChange={e=>{if(!refundConfirmKey.current)setRefundDate(e.target.value);}}/>)}
    {field("Original cash refund voucher number",<input style={control} required
     value={refundVoucher} onChange={e=>{if(!refundConfirmKey.current)setRefundVoucher(e.target.value);}}/>)}
    {field("Current reviewer password",<input style={control} required type="password"
     autoComplete="current-password" minLength={8} value={refundPassword}
     onChange={e=>setRefundPassword(e.target.value)}/>)}
    <label><input type="checkbox" checked={paidOut} onChange={e=>{
      if(!refundConfirmKey.current)setPaidOut(e.target.checked);}}/> I independently confirm actual physical cash has been returned.</label>
    <button type="submit" style={button} disabled={busy||!paidOut||!refundOptions.complete}>
     Confirm physical cash refund in CG-09</button>
   </form>}
   {refundReview&&refundOptions&&refundReview.settlementMethod==="ONLINE"&&
    <form onSubmit={refundReview.providerState==="PROVIDER_PROCESSED"?
      postProviderRefund:initiateProviderRefund} style={{display:"grid",gap:10}}>
     <strong>{refundReview.donationNumber} · {money(refundReview.amountMinor)}</strong>
     <p>{refundReview.providerState==="PROVIDER_PROCESSED"?
       "The merchant confirms a signed processed refund. Correct the original CG09 journal once.":
       "This sends one real-money refund instruction to Razorpay. An unknown response must never be retried."}</p>
     {refundReview.providerState==="PROVIDER_PROCESSED"&&<>
      {field("Open financial year",choices(refundOptions.years,refundYear,v=>{
       if(!refundConfirmKey.current)setRefundYear(v);}))}
      {field("Posting date",<input type="date" style={control} required value={refundDate}
       onChange={e=>{if(!refundConfirmKey.current)setRefundDate(e.target.value);}}/>)}
     </>}
     {field("Independent current reviewer password",
      <input type="password" style={control} autoComplete="current-password" required minLength={8}
       value={refundPassword} onChange={e=>setRefundPassword(e.target.value)}/>)}
     {refundReview.providerState==="NOT_STARTED"&&
      <label><input type="checkbox" checked={paidOut} onChange={e=>{
       if(!refundConfirmKey.current)setPaidOut(e.target.checked);}}/>
       I authorize this exact original merchant refund. It has not been paid yet.</label>}
     <button type="submit" style={button} disabled={busy||
      (refundReview.providerState==="NOT_STARTED"&&!paidOut)||
      (refundReview.providerState==="PROVIDER_PROCESSED"&&!refundOptions.complete)}>
      {refundReview.providerState==="PROVIDER_PROCESSED"?
       "Post signed refund in CG09 once":"Initiate one Razorpay refund"}
     </button>
    </form>}
  </section>}
  {canIssue&&<section style={box}><h2>Issue a private donation receipt</h2>
   <p>CG-19 issues only against a real CG-09 posted donation. No automatic 80G claims.</p>
   {field("Donation with verified finance posting",<select style={control}
    value={issueFor?.donationRef??""} onChange={e=>{receiptKey.current=null;
     setIssueFor(items.find(x=>x.donationRef===e.target.value)??null);}}>
    <option value="">Select eligible posted donation</option>
    {items.filter(x=>x.status==="RECEIVED_POSTED").map(x=>
     <option key={x.donationRef} value={x.donationRef}>{x.donationNumber} · {x.receiptStatus}</option>)}
   </select>)}
   {issueFor&&<form onSubmit={issue} style={{display:"grid",gap:10}}>
    <p>Existing private document: {issueFor.receiptStatus.replaceAll("_"," ").toLowerCase()}</p>
    <button type="submit" style={button} disabled={busy||issueFor.receiptStatus==="ISSUED"}>
     {issueFor.receiptStatus==="ISSUED"?"Receipt already issued":"Issue original private receipt"}</button>
   </form>}
  </section>}
  {canIssue&&<section style={box}><h2>Issue verified refund correction</h2>
   <p>The original issued receipt stays immutable; only a posted CG09 refund may have a separate correction PDF.</p>
   <button type="button" style={button} disabled={busy} onClick={()=>void refreshRefunds()}>Load verified refund history</button>
   <form style={{display:"grid",gap:10}} onSubmit={issueCorrection}>
    {field("Verified refund",<select style={control} required value={correctionRefund}
     onChange={e=>{correctionKey.current=null;setCorrectionRefund(e.target.value);}}>
     <option value="">Select posted refund</option>
     {refunds.filter(x=>x.status==="FINANCE_REVERSED").map(x=>
      <option key={x.refundRef} value={x.refundRef}>{x.donationNumber} · {money(x.amountMinor)}</option>)}
    </select>)}
    <button type="submit" style={button} disabled={busy||!correctionRefund}>Issue separate private correction</button>
   </form>
  </section>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
 </div>;
}
