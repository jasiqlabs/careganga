"use client";
import {useState} from "react";
type Action="SUBSCRIBE"|"WITHDRAW";
type Step="REQUEST"|"CODE"|"KEY";
const mail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function Cg19NewsletterForm(){
 const [email,setEmail]=useState(""),[action,setAction]=useState<Action>("SUBSCRIBE");
 const [step,setStep]=useState<Step>("REQUEST"),[consent,setConsent]=useState(false);
 const [code,setCode]=useState(""),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
 const reset=(a:Action,s:Step="REQUEST")=>{setAction(a);setStep(s);setCode("");setConsent(false);setFeedback("");};
 async function submit(){
  if(busy)return;
  const address=email.trim();
  if(address.length>254||!mail.test(address)){setFeedback("Enter a valid email address.");return;}
  if(step==="REQUEST"&&action==="SUBSCRIBE"&&!consent){setFeedback("Confirm that you want to receive Foundation newsletters.");return;}
  if(step==="CODE"&&!/^\d{8}$/.test(code)||step==="KEY"&&!/^[A-Za-z0-9_-]{43}$/.test(code)){setFeedback("Enter the complete private verification code or withdrawal key.");return;}
  const path=step==="REQUEST"?"start":step==="KEY"?"withdraw":"confirm";
  const body=step==="REQUEST"?{email:address,action,...(action==="SUBSCRIBE"?{consent:true}:{})}:
   step==="KEY"?{email:address,key:code}:{email:address,action,code};
  setBusy(true);setFeedback("");
  try{
   const r=await fetch("/api/support/public/newsletter/"+path,{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(23000)});
   if(!r.ok){setFeedback(r.status===429?"Too many requests. Try again later.":
    r.status===400?"Check the email or private code. If it expired, request a new one.":
    "Newsletter verification is unavailable or the outcome is unconfirmed. If a code arrives, enter it; otherwise try later.");
    if(step==="REQUEST"&&r.status>=500)setStep("CODE");return;}
   const result:unknown=await r.json();
   const state=result&&typeof result==="object"&&"state" in result?result.state:null;
   if(step==="REQUEST"&&["CHECK_EMAIL","CHECK_EXISTING_CODE","SEND_UNCONFIRMED"].includes(String(state))){
    setStep("CODE");
    setFeedback(state==="CHECK_EMAIL"?"The verification email was accepted for sending. Check your inbox and spam folder.":
     state==="CHECK_EXISTING_CODE"?"Use the recently requested verification code.":"Email delivery is not confirmed. Enter the code if it arrives.");
   }else if(state===(action==="SUBSCRIBE"?"SUBSCRIBED":"WITHDRAWN")&&step!=="REQUEST"){
    setCode("");setEmail("");setConsent(false);setStep("REQUEST");
    setFeedback(state==="SUBSCRIBED"?"Your newsletter subscription is confirmed. Keep the private withdrawal key from the email.":"Your newsletter consent has been withdrawn.");
   }else setFeedback("The outcome could not be confirmed. Use the original private code.");
  }catch{if(step==="REQUEST")setStep("CODE");setFeedback("Outcome unconfirmed. Enter the verification code if it arrives.");}
  finally{setBusy(false);}
 }
 return <div>
  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
   <button type="button" disabled={busy} aria-pressed={action==="SUBSCRIBE"} onClick={()=>reset("SUBSCRIBE")}>Subscribe</button>
   <button type="button" disabled={busy} aria-pressed={action==="WITHDRAW"} onClick={()=>reset("WITHDRAW")}>Unsubscribe</button>
  </div>
  <form onSubmit={e=>{e.preventDefault();void submit();}}>
   <label className="cg-site-newsletter-field"><span className="cg-site-sr-only">Newsletter email address</span>
    <input type="email" autoComplete="email" maxLength={254} value={email} required disabled={busy||step==="CODE"}
     placeholder="Enter your email" onChange={e=>setEmail(e.target.value)}/></label>
   {step==="REQUEST"&&action==="SUBSCRIBE"&&<label style={{display:"flex",alignItems:"flex-start",gap:6,margin:"8px 0",fontSize:12}}>
    <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
    I agree to receive CareGanga Foundation newsletters by email. I can unsubscribe at any time.</label>}
   {step!=="REQUEST"&&<label className="cg-site-newsletter-field">
    <span>{step==="KEY"?"Private withdrawal key":"Email verification code"}</span>
    <input value={code} disabled={busy} autoComplete="off" type={step==="KEY"?"password":"text"}
     inputMode={step==="CODE"?"numeric":"text"} maxLength={step==="KEY"?43:8}
     onChange={e=>setCode(e.target.value.trim())}/></label>}
   <button type="submit" disabled={busy||step==="REQUEST"&&action==="SUBSCRIBE"&&!consent} className="cg-site-newsletter-button">
    {busy?"Processing…":step==="REQUEST"?"Send verification code":step==="KEY"?"Withdraw consent":"Confirm "+(action==="SUBSCRIBE"?"subscription":"withdrawal")}</button>
  </form>
  {action==="WITHDRAW"&&step!=="KEY"&&<button type="button" disabled={busy} onClick={()=>reset("WITHDRAW","KEY")}>Use private withdrawal key</button>}
  {step!=="REQUEST"&&<button type="button" disabled={busy} onClick={()=>reset(action)}>Change email or request a new code</button>}
  {feedback&&<p role="status" aria-live="polite" className="cg-site-muted">{feedback}</p>}
 </div>;
}
