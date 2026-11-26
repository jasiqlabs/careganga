"use client";
import {useRef,useState,type FormEvent} from "react";
type Outcome={status:string;amountMinor:string;currency:string;statusToken:string;expiresAt:string;replayed:boolean};
type Payment={status:string;checkoutUrl:string|null;message?:string};
type CorrectionRow={correctionNumber:string;originalNumber:string;amountMinor:string;issuedAt:string};
type HistoricalDonation={donationNumber:string;proofIndex:number;createdAt:string;
 grossMinor:string;refundedMinor:string;netReceivedMinor:string;currency:string;
 status:string;receiptStatus:string;receiptNumber:string|null};
const input={display:"block",width:"100%",minHeight:48,borderRadius:9,padding:12,
 border:"1px solid #d4d9e1",background:"white",color:"#243349"} as const;
const label={display:"grid",gap:6,fontSize:14,fontWeight:600} as const;
const button={background:"#194a3a",color:"white",padding:"12px 18px",minHeight:48,
 border:0,borderRadius:9,cursor:"pointer"} as const;
const sourceStatuses=["REQUESTED","LINK_READY","PAYMENT_PENDING","VERIFIED_EXTERNAL","RECONCILIATION_PENDING","RECEIVED_POSTED","FAILED","EXPIRED"];
const postedStatuses=["RECEIVED_POSTED","REFUNDED_FULL","REFUNDED_PARTIAL"];
function amountInMinor(value:string):string|null{
 if(!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(value))return null;
 const [units,fraction=""]=value.split(".");const minor=BigInt(units)*100n+BigInt(fraction.padEnd(2,"0"));
 return minor>=100n&&minor<=99999999999999n?minor.toString():null;
}
const validMinor=(value:unknown):value is string=>typeof value==="string"&&/^\d+$/.test(value)&&value.length<=30;
function formatMinor(value:unknown){
 if(!validMinor(value))return "Unavailable";
 const minor=BigInt(value);
 return (minor/100n).toString()+"."+(minor%100n).toString().padStart(2,"0");
}
async function api<T>(route:string,value:object):Promise<T>{
 const res=await fetch("/api/public/donations"+route,{method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(value),signal:AbortSignal.timeout(18000)});
 const response:unknown=await res.json().catch(()=>null);
 if(!res.ok||!response)throw Error(response&&typeof response==="object"&&
  "message" in response&&typeof response.message==="string"?response.message:
  "Donation response cannot be confirmed. Retry the original request.");
 return response as T;
}
/** Never treat link creation as receipt; private status proof stays in POST body. */
export function PublicDonationForm({campaignSlug=null}:{campaignSlug?:string|null}){
 const [amount,setAmount]=useState(""),[name,setName]=useState(""),[mobile,setMobile]=useState(""),
  [email,setEmail]=useState(""),[pan,setPan]=useState(""),[address,setAddress]=useState(""),
  [geography,setGeography]=useState(""),[remarks,setRemarks]=useState(""),
  [paymentReferenceNote,setPaymentReferenceNote]=useState(""),[recurringIntent,setRecurringIntent]=useState(false),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState(""),[error,setError]=useState(""),[proof,setProof]=useState(""),
  [checkout,setCheckout]=useState(""),[linkState,setLinkState]=useState(""),[received,setReceived]=useState(false);
 const [receiptStatus,setReceiptStatus]=useState("NOT_ISSUED"),
  [netMinor,setNetMinor]=useState("0"),[refundMinor,setRefundMinor]=useState("0"),
  [refundPending,setRefundPending]=useState(false),[refundStatus,setRefundStatus]=useState("NO_REFUND");
 const [additionalProofs,setAdditionalProofs]=useState(""),
  [history,setHistory]=useState<HistoricalDonation[]>([]),
  [historyTokens,setHistoryTokens]=useState<string[]>([]),
  [corrections,setCorrections]=useState<CorrectionRow[]>([]),
  [correctionProof,setCorrectionProof]=useState("");
 const intentKey=useRef<string|null>(null),linkKey=useRef<string|null>(null);
 const receiptMessageKeys=useRef<{EMAIL:string|null;WHATSAPP:string|null}>({EMAIL:null,WHATSAPP:null});
 const [receiptMessage,setReceiptMessage]=useState("");
 const create=async(event:FormEvent)=>{
  event.preventDefault();if(busy||!consent||proof)return;
  const expectedMinor=amountInMinor(amount);if(expectedMinor===null){setError("Enter a donation of at least ₹1, with no more than two decimal places.");return;}
  if(!intentKey.current)intentKey.current=crypto.randomUUID();
  setBusy(true);setError("");
  try{
   const out=await api<Outcome>("",{requestKey:intentKey.current,campaignSlug,amount,consent:true,
    donor:{name,mobile,email,pan,address,geography,remarks,recurringIntent,paymentReferenceNote}});
   if(typeof out.statusToken!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(out.statusToken)||!sourceStatuses.includes(out.status)||out.amountMinor!==expectedMinor||out.currency!=="INR"||typeof out.replayed!=="boolean"||!Number.isFinite(Date.parse(out.expiresAt))||Date.parse(out.expiresAt)<=Date.now())throw Error("Donation request cannot be confirmed.");
   setProof(out.statusToken);setStatus(out.status);setReceived(false);
   if(!linkKey.current)linkKey.current=crypto.randomUUID();
  }catch(e){setError((e instanceof Error?e.message:"Donation result uncertain.")+
   " Keep the same details and retry; do not make another payment.");}
  finally{setBusy(false);}
 };
 const payment=async()=>{
  if(!proof||busy||!["REQUESTED","LINK_READY"].includes(status))return;
  if(!linkKey.current)linkKey.current=crypto.randomUUID();
  setBusy(true);setError("");
  try{
   const out=await api<Payment>("/payment-link",{statusToken:proof,requestKey:linkKey.current});
   setCheckout("");setLinkState(out.status);
   if(out.status==="LINK_READY"&&out.checkoutUrl){
    const u=new URL(out.checkoutUrl);
    if(u.protocol!=="https:"||u.hostname!=="rzp.io"||u.username||u.password||u.port)throw Error("The secure payment link could not be verified.");
    setCheckout(u.toString());
   }else setError(out.message??"Payment link is not confirmed. Check status before trying again.");
  }catch(e){setError(e instanceof Error?e.message:"Payment outcome uncertain.");}
  finally{setBusy(false);}
 };
 const refresh=async()=>{
  if(!proof||busy)return;
  setBusy(true);setError("");
  try{const x=await api<{status:string;received:boolean;receiptStatus:string;
    netReceivedMinor:string;refundedMinor:string;refundPending:boolean;refundStatus:string;amountMinor:string;currency:string}>("/status",{statusToken:proof});
   if(typeof x.status!=="string"||typeof x.received!=="boolean"||typeof x.receiptStatus!=="string"||!validMinor(x.netReceivedMinor)||!validMinor(x.refundedMinor)||typeof x.refundPending!=="boolean"||typeof x.refundStatus!=="string"||x.currency!=="INR"||!validMinor(x.amountMinor)||x.amountMinor!==amountInMinor(amount)||
    ![...sourceStatuses,...postedStatuses].includes(x.status)||x.received!==postedStatuses.includes(x.status)||
    (x.received?BigInt(x.netReceivedMinor)+BigInt(x.refundedMinor)!==BigInt(x.amountMinor):BigInt(x.netReceivedMinor)!==0n||BigInt(x.refundedMinor)!==0n))throw Error("Donation status cannot be confirmed.");
   if(x.received||!["REQUESTED","LINK_READY"].includes(x.status))setCheckout("");
   if(!x.received||x.receiptStatus!=="ISSUED"){setReceiptMessage("");setCorrections([]);setCorrectionProof("");}
   setStatus(x.status);setReceived(x.received);setReceiptStatus(x.received?x.receiptStatus:"NOT_ISSUED");
   setNetMinor(x.netReceivedMinor);setRefundMinor(x.refundedMinor);
   setRefundPending(x.refundPending);setRefundStatus(x.refundStatus);
  }catch(e){setCheckout("");setStatus("STATUS_UNAVAILABLE");setReceived(false);setReceiptStatus("NOT_ISSUED");setReceiptMessage("");setCorrections([]);setCorrectionProof("");setHistory([]);setHistoryTokens([]);setError(e instanceof Error?e.message:"Donation status currently unavailable.");}
  finally{setBusy(false);}
 };
 const loadHistory=async()=>{
  if(busy||!proof)return;
  setBusy(true);setError("");
  try{
   const tokens=[proof,...additionalProofs.split(/\s+/)].filter(Boolean);
   if(tokens.length>20||new Set(tokens).size!==tokens.length)
    throw new Error("Enter up to 20 distinct original private donation proofs.");
   const result=await api<{items:HistoricalDonation[]}>("/history",{statusTokens:tokens});
   if(!Array.isArray(result.items)||result.items.some(item=>!item||typeof item.donationNumber!=="string"||typeof item.status!=="string"||typeof item.receiptStatus!=="string"||!validMinor(item.netReceivedMinor)||!Number.isInteger(item.proofIndex)||item.proofIndex<0||item.proofIndex>=tokens.length))throw Error("Private donation history cannot be confirmed.");
   setHistoryTokens(tokens);setHistory(result.items);
  }catch(e){setHistory([]);setHistoryTokens([]);setError(e instanceof Error?e.message:"Private history unavailable.");}
  finally{setBusy(false);}
 };
 const requestReceiptMessage=async(channel:"EMAIL"|"WHATSAPP")=>{
  if(!proof||busy||receiptStatus!=="ISSUED")return;
  if(!receiptMessageKeys.current[channel])receiptMessageKeys.current[channel]=crypto.randomUUID();
  setBusy(true);setError("");
  try{
   const result=await api<{downloadAvailable:boolean;messageStatus:string;delivered:boolean;notice:string}>(
    "/receipt/message",{statusToken:proof,channel,requestKey:receiptMessageKeys.current[channel]});
   if(result.delivered||!result.downloadAvailable)throw Error("Receipt status cannot be verified.");
   setReceiptMessage(channel==="WHATSAPP"?
    "WhatsApp delivery is unavailable. Your private receipt remains downloadable.":
    result.notice);
  }catch(e){setError(e instanceof Error?e.message:"Receipt message outcome uncertain; do not change the request key.");}
  finally{setBusy(false);}
 };
 const refreshReceiptMessage=async()=>{
  if(!proof||busy)return;
  setBusy(true);setError("");
  try{
   const r=await api<{downloadAvailable:boolean;delivered:boolean;notice:string}>(
    "/receipt/message/status",{statusToken:proof});
   if(r.delivered||!r.downloadAvailable)throw Error("Receipt message proof cannot be confirmed.");
   setReceiptMessage(r.notice);
  }catch(e){setError(e instanceof Error?e.message:"Receipt message status unavailable.");}
  finally{setBusy(false);}
 };
 const listCorrections=async(historyToken=proof)=>{
  if(!historyToken||busy)return;
  setBusy(true);setError("");
  try{
   const result=await api<{items:CorrectionRow[]}>("/receipt/corrections",
    {statusToken:historyToken});
   if(!Array.isArray(result.items)||result.items.some(item=>!item||typeof item.correctionNumber!=="string"||typeof item.originalNumber!=="string"||!validMinor(item.amountMinor)))throw Error("Refund corrections cannot be confirmed.");
   setCorrections(result.items);setCorrectionProof(historyToken);
  }catch(e){setCorrections([]);setCorrectionProof("");setError(e instanceof Error?e.message:"Protected corrections unavailable.");}
  finally{setBusy(false);}
 };
 const downloadCorrection=async(number:string)=>{
  if(!correctionProof||busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/public/donations/receipt/correction-download",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({statusToken:correctionProof,correctionNumber:number}),
    signal:AbortSignal.timeout(17000)});
   if(!response.ok||response.headers.get("content-type")?.split(";")[0]!=="application/pdf")
    throw Error("Your private refund correction is unavailable.");
   const bytes=await response.blob();
   if(bytes.size<100||bytes.size>10485760)throw Error("Protected correction PDF was not verified.");
   const url=URL.createObjectURL(bytes),anchor=document.createElement("a");
   anchor.href=url;anchor.download="CareGanga-Donation-Correction.pdf";
   anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){setError(e instanceof Error?e.message:"Private correction unavailable.");}
  finally{setBusy(false);}
 };
 const download=async(historyToken=proof)=>{
  if(!historyToken||busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/public/donations/receipt/download",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({statusToken:historyToken}),cache:"no-store",signal:AbortSignal.timeout(17000)});
   if(!r.ok||r.headers.get("content-type")?.split(";")[0]!=="application/pdf")
    throw Error("Your private receipt is not currently available.");
   const blob=await r.blob();
   if(blob.size<100||blob.size>10485760)throw Error("Receipt file could not be verified.");
   const url=URL.createObjectURL(blob),anchor=document.createElement("a");
   anchor.href=url;anchor.download="CareGanga-Donation-Receipt.pdf";
   anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(e){setError(e instanceof Error?e.message:"Receipt download unavailable.");}
  finally{setBusy(false);}
 };
 return <section className="cg-public-donation-form" style={{border:"1px solid #e0e5e9",borderRadius:16,padding:20,
  display:"grid",gap:15,maxWidth:640,background:"#fffefb"}} aria-label="CareGanga donation">
  <h2 style={{margin:0}}>Support CareGanga Foundation</h2>
  <p style={{margin:0,fontSize:14}}>Payment links and pending requests are not receipts.
   The Foundation records money as received only after verified finance posting.</p>
  <form onSubmit={e=>void create(e)} style={{display:"grid",gap:12}}>
   <label style={label}>Donation amount in rupees<input style={input} value={amount} readOnly={!!intentKey.current} required
    inputMode="decimal" placeholder="500.00" maxLength={16}
    onChange={e=>{if(!intentKey.current)setAmount(e.target.value);}}/></label>
   <label style={label}>Name (optional)<input style={input} readOnly={!!intentKey.current} value={name} maxLength={120}
    onChange={e=>{if(!intentKey.current)setName(e.target.value);}}/></label>
   <label style={label}>Mobile (optional)<input style={input} readOnly={!!intentKey.current} value={mobile} maxLength={20}
    onChange={e=>{if(!intentKey.current)setMobile(e.target.value);}}/></label>
   <label style={label}>Email (optional)<input style={input} readOnly={!!intentKey.current} type="email" value={email} maxLength={254}
    onChange={e=>{if(!intentKey.current)setEmail(e.target.value);}}/></label>
   <label style={label}>Address (optional)<textarea style={{...input,minHeight:70}}
    readOnly={!!intentKey.current} value={address} maxLength={300} onChange={e=>{if(!intentKey.current)setAddress(e.target.value);}}/></label>
   <label style={label}>PAN (optional, private Foundation records)
    <input style={input} readOnly={!!intentKey.current} value={pan} maxLength={10} autoCapitalize="characters"
     onChange={e=>{if(!intentKey.current)setPan(e.target.value.toUpperCase());}}/></label>
   <label style={label}>City / area (optional)
    <input style={input} readOnly={!!intentKey.current} value={geography} maxLength={100}
     onChange={e=>{if(!intentKey.current)setGeography(e.target.value);}}/></label>
   <label style={label}>Donation remarks (optional)
    <textarea style={{...input,minHeight:64}} readOnly={!!intentKey.current} value={remarks} maxLength={300}
     onChange={e=>{if(!intentKey.current)setRemarks(e.target.value);}}/></label>
   <label style={label}>Payment reference note (optional, unverified)
    <input style={input} readOnly={!!intentKey.current} value={paymentReferenceNote} maxLength={100}
     onChange={e=>{if(!intentKey.current)setPaymentReferenceNote(e.target.value);}}/>
   </label>
   <label style={{display:"flex",alignItems:"center",gap:9}}>
    <input type="checkbox" checked={recurringIntent} disabled={!!intentKey.current}
     onChange={e=>setRecurringIntent(e.target.checked)}/>
    I may donate again (does not enable automatic recurring payments).
   </label>
   <p style={{fontSize:12,margin:0}}>Typed references do not verify a bank transfer. No recurring payment is scheduled.</p>
   <p style={{fontSize:12,margin:0}}>PAN is optional, kept encrypted, and does not automatically qualify a donation for 80G tax deduction.</p>
   <label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:14}}>
    <input type="checkbox" checked={consent} disabled={!!intentKey.current} required
     onChange={e=>setConsent(e.target.checked)}/>
    I agree to the donation request and the Foundation's processing of supplied payment-contact information.</label>
   <button type="submit" style={button} disabled={busy||!consent||!!proof}>
    {busy?"Checking donation…":"Create donation request"}</button>
  </form>
  {error&&<p role="alert" style={{color:"#9e3030"}}>{error}</p>}
  {proof&&<div style={{display:"grid",gap:12}}>
   <p role="status">Donation status: <strong>{status.replaceAll("_"," ").toLowerCase()}</strong>.
    {received?" Verified received.":status==="RECEIVED_POSTED"?" Check current status to confirm the received amount and receipt.":" Payment is not yet confirmed."}</p>
   <p style={{fontSize:13}}>Save this private status proof somewhere safe. Do not post it publicly.</p>
   <textarea aria-label="Private donation status proof" rows={2} style={{...input,fontFamily:"monospace",fontSize:12}}
    readOnly value={proof}/>
   {!received&&!checkout&&["REQUESTED","LINK_READY"].includes(status)&&<button type="button" style={button} disabled={busy} onClick={()=>void payment()}>
    Generate verified payment link</button>}
   {checkout&&!received&&["REQUESTED","LINK_READY"].includes(status)&&<a href={checkout} target="_blank" rel="noopener noreferrer"
    referrerPolicy="no-referrer">Open secure payment page</a>}
   {status==="PAYMENT_PENDING"&&<p role="status">Your bank or other payment is awaiting original finance verification. Do not create another payment link.</p>}
   {linkState==="OUTCOME_UNKNOWN"&&<p role="alert">Payment-link outcome is uncertain. Do not create another request.</p>}
   {received&&<p>Verified net received: ₹{formatMinor(netMinor)}.
    {refundMinor!=="0"?" Confirmed refund(s) have been applied.":""}
    {refundPending?" Refund requested — payout not yet verified.":""}
    {" "}Receipt: {receiptStatus.replaceAll("_"," ").toLowerCase()}.</p>}
    {refundStatus==="REFUND_RECONCILIATION_PENDING"&&
     <p role="status">Gateway refund reconciliation is pending. The original CG09 ledger has not yet confirmed a reversal. Never repeat the payout.</p>}
    {refundStatus==="REFUND_FAILED_REVIEW_REQUIRED"&&
     <p role="alert">Gateway reported a failed refund. Foundation review is required; verified net has not changed.</p>}
   {receiptStatus==="ISSUED"&&<button type="button" style={button} disabled={busy}
    onClick={()=>void download()}>Download your original verified receipt (PDF)</button>}
   {receiptStatus==="ISSUED"&&<div style={{display:"grid",gap:7}}>
    <strong>Optional receipt availability notice</strong>
    <p>No private PDF, amount, PAN or status proof is included in email. Provider acceptance is not delivery.</p>
    <button type="button" style={button} disabled={busy}
     onClick={()=>void requestReceiptMessage("EMAIL")}>Request one receipt email notice</button>
    <button type="button" style={button} disabled={busy}
     onClick={()=>void requestReceiptMessage("WHATSAPP")}>Check WhatsApp notice availability</button>
    <button type="button" style={button} disabled={busy}
     onClick={()=>void refreshReceiptMessage()}>Check receipt message status</button>
    {receiptMessage&&<p role="status">Download available. {receiptMessage}</p>}
   </div>}
   {received&&refundMinor!=="0"&&<button type="button" style={button} disabled={busy}
    onClick={()=>void listCorrections()}>View issued refund corrections</button>}
   {corrections.map(item=><div key={item.correctionNumber} style={{display:"grid",gap:6,
    border:"1px solid #d4d9e1",borderRadius:8,padding:10}}>
    <strong>{item.correctionNumber} — linked to original receipt {item.originalNumber}</strong>
    <span>Verified refund: ₹{formatMinor(item.amountMinor)}</span>
    <button type="button" style={button} disabled={busy}
     onClick={()=>void downloadCorrection(item.correctionNumber)}>
     Download separate verified correction</button>
   </div>)}
   <div style={{display:"grid",gap:8,borderTop:"1px solid #d4d9e1",paddingTop:14}}>
    <h3>My donation history</h3>
    <p style={{fontSize:13}}>Paste up to 19 other private donation proofs. Only donations proven by your supplied tokens will appear. No account lookup by phone, PAN or email.</p>
    <textarea aria-label="Additional private donation proofs" style={{...input,minHeight:72}}
     value={additionalProofs} maxLength={1600} disabled={busy}
     onChange={e=>setAdditionalProofs(e.target.value)}
     placeholder="Paste one private proof per line"/>
    <button type="button" style={button} disabled={busy} onClick={()=>void loadHistory()}>
     View my proven donation history</button>
    {history.map(item=><div key={item.donationNumber}
      style={{display:"grid",gap:5,padding:10,border:"1px solid #d4d9e1",borderRadius:8}}>
      <strong>{item.donationNumber}</strong>
      <span>{item.status.replaceAll("_"," ").toLowerCase()} · {item.currency} · verified net {formatMinor(item.netReceivedMinor)}</span>
      <span>Receipt: {item.receiptNumber??item.receiptStatus.replaceAll("_"," ").toLowerCase()}</span>
      {item.receiptStatus==="ISSUED"&&historyTokens[item.proofIndex]&&
       <button type="button" style={button} disabled={busy}
        onClick={()=>void download(historyTokens[item.proofIndex])}>
        Download this proven receipt</button>}
      {item.status.startsWith("REFUNDED")&&historyTokens[item.proofIndex]&&
       <button type="button" style={button} disabled={busy}
        onClick={()=>void listCorrections(historyTokens[item.proofIndex])}>
        View this donation's refund corrections</button>}
     </div>)}
   </div>
   <button type="button" style={button} disabled={busy} onClick={()=>void refresh()}>Check donation status</button>
  </div>}
 </section>;
}
