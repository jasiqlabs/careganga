"use client";
import {useRef,useState,type FormEvent} from "react";
type Outcome={status:string;amountMinor:string;statusToken:string;expiresAt:string;replayed:boolean};
type Payment={status:string;checkoutUrl:string|null;message?:string};
const input={display:"block",width:"100%",minHeight:44,borderRadius:9,padding:12,
 border:"1px solid #d4d9e1",background:"white",color:"#243349"} as const;
const label={display:"grid",gap:6,fontSize:14,fontWeight:600} as const;
const button={background:"#0a9f69",color:"white",padding:"12px 18px",minHeight:44,
 border:0,borderRadius:9,cursor:"pointer"} as const;
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
  [email,setEmail]=useState(""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState(""),[error,setError]=useState(""),[proof,setProof]=useState(""),
  [checkout,setCheckout]=useState(""),[linkState,setLinkState]=useState(""),[received,setReceived]=useState(false);
 const intentKey=useRef<string|null>(null),linkKey=useRef<string|null>(null);
 const create=async(event:FormEvent)=>{
  event.preventDefault();if(busy||!consent||!amount.trim())return;
  if(!intentKey.current)intentKey.current=crypto.randomUUID();
  setBusy(true);setError("");
  try{
   const out=await api<Outcome>("",{requestKey:intentKey.current,campaignSlug,amount,consent:true,
    donor:{name,mobile,email,pan:"",address:""}});
   setProof(out.statusToken);setStatus(out.status);setReceived(out.status==="RECEIVED_POSTED");
   if(!linkKey.current)linkKey.current=crypto.randomUUID();
  }catch(e){setError((e instanceof Error?e.message:"Donation result uncertain.")+
   " Keep the same details and retry; do not make another payment.");}
  finally{setBusy(false);}
 };
 const payment=async()=>{
  if(!proof||busy)return;
  if(!linkKey.current)linkKey.current=crypto.randomUUID();
  setBusy(true);setError("");
  try{
   const out=await api<Payment>("/payment-link",{statusToken:proof,requestKey:linkKey.current});
   setLinkState(out.status);
   if(out.status==="LINK_READY"&&out.checkoutUrl){
    const u=new URL(out.checkoutUrl);
    if(u.protocol!=="https:"||u.hostname!=="rzp.io")throw Error("The secure payment link could not be verified.");
    setCheckout(u.toString());
   }else setError(out.message??"Payment link is not confirmed. Check status before trying again.");
  }catch(e){setError(e instanceof Error?e.message:"Payment outcome uncertain.");}
  finally{setBusy(false);}
 };
 const refresh=async()=>{
  if(!proof||busy)return;
  setBusy(true);setError("");
  try{const x=await api<{status:string;received:boolean}>("/status",{statusToken:proof});
   setStatus(x.status);setReceived(x.received);
  }catch(e){setError(e instanceof Error?e.message:"Donation status currently unavailable.");}
  finally{setBusy(false);}
 };
 return <section style={{border:"1px solid #e0e5e9",borderRadius:16,padding:20,
  display:"grid",gap:15,maxWidth:640,background:"#fffefb"}} aria-label="CareGanga donation">
  <h2 style={{margin:0}}>Support CareGanga Foundation</h2>
  <p style={{margin:0,fontSize:14}}>Payment links and pending requests are not receipts.
   The Foundation records money as received only after verified finance posting.</p>
  <form onSubmit={e=>void create(e)} style={{display:"grid",gap:12}}>
   <label style={label}>Donation amount in rupees<input style={input} value={amount} required
    inputMode="decimal" placeholder="500.00" maxLength={16}
    onChange={e=>{if(!intentKey.current)setAmount(e.target.value);}}/></label>
   <label style={label}>Name (optional)<input style={input} value={name} maxLength={120}
    onChange={e=>{if(!intentKey.current)setName(e.target.value);}}/></label>
   <label style={label}>Mobile (optional)<input style={input} value={mobile} maxLength={20}
    onChange={e=>{if(!intentKey.current)setMobile(e.target.value);}}/></label>
   <label style={label}>Email (optional)<input style={input} type="email" value={email} maxLength={254}
    onChange={e=>{if(!intentKey.current)setEmail(e.target.value);}}/></label>
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
    {received?" Verified received.":" Payment is not yet confirmed."}</p>
   <p style={{fontSize:13}}>Save this private status proof somewhere safe. Do not post it publicly.</p>
   <textarea aria-label="Private donation status proof" rows={2} style={{...input,fontFamily:"monospace",fontSize:12}}
    readOnly value={proof}/>
   {!received&&!checkout&&<button type="button" style={button} disabled={busy} onClick={()=>void payment()}>
    Generate verified payment link</button>}
   {checkout&&<a href={checkout} target="_blank" rel="noopener noreferrer"
    referrerPolicy="no-referrer">Open secure payment page</a>}
   {linkState==="OUTCOME_UNKNOWN"&&<p role="alert">Payment-link outcome is uncertain. Do not create another request.</p>}
   <button type="button" style={button} disabled={busy} onClick={()=>void refresh()}>Check donation status</button>
  </div>}
 </section>;
}
