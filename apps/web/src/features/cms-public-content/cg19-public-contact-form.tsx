"use client";
import {useEffect,useState} from "react";
type Faq={faqRef:string;question:string;answer:string};
type Receipt={receipt:string;ticketNumber:string;expiresAt:string;status:string;result:string};
class SupportActionError extends Error{
 constructor(readonly category:"LIMIT"|"CONFLICT"|"INVALID"|"UNKNOWN",message:string){
  super(message);this.name="SupportActionError";
 }
}
async function call<T>(path:string,body:object){
  let response:Response;
  try{response=await fetch("/api/support/"+path,{method:"POST",
    credentials:"omit",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})}
  catch{throw Error("UNKNOWN")}
  if(!response.ok){
    const body:unknown=await response.json().catch(()=>null);
    const candidate=body&&typeof body==="object"&&!Array.isArray(body)&&
      "message" in body&&typeof body.message==="string"?body.message:null;
    const safe=candidate&&candidate.length>=8&&candidate.length<=240&&
      !/[<>\u0000-\u001f\u007f]/.test(candidate)?candidate:null;
    const category=response.status===429?"LIMIT":response.status===409?"CONFLICT":
      response.status===400?"INVALID":"UNKNOWN";
    throw new SupportActionError(category,safe??
      (category==="LIMIT"?"Too many requests. Try again later.":
       category==="INVALID"?"Check the details in the form before retrying.":
       category==="CONFLICT"?"This request was already used. Review its original status.":
       "The original request outcome is not confirmed. Check its status before retrying."));
  }
  return await response.json() as T;
}
export function Cg19PublicContactForm({contact:publishedContact={}}:{contact?:Record<string,unknown>}={}){
 const publicText=(v:unknown)=>typeof v==="string"?v:"";
 const phone=publicText(publishedContact.phone),email=publicText(publishedContact.email),address=publicText(publishedContact.address);
  const [name,setName]=useState(""),[contact,setContact]=useState("");
  const [subject,setSubject]=useState(""),[message,setMessage]=useState("");
  const [requestKey,setRequestKey]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [proof,setProof]=useState(""),[proofState,setProofState]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [errorArea,setErrorArea]=useState<"message"|"receipt">("message");
  const [copyState,setCopyState]=useState("");
  const [faqs,setFaqs]=useState<Faq[]>([]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/support/public/faqs",{cache:"no-store",
      credentials:"omit",signal:controller.signal})
      .then(r=>r.ok?r.json():Promise.reject()).then((data:unknown)=>{
        if(!controller.signal.aborted&&data&&typeof data==="object"&&
          "faqs" in data&&Array.isArray(data.faqs))
          setFaqs((data.faqs as Faq[]).slice(0,30));
      }).catch(()=>{});
    return()=>controller.abort();
  },[]);
  async function send(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||receipt)return;
    setErrorArea("message");setError("");setBusy(true);
    const key=requestKey||crypto.randomUUID();
    setRequestKey(key);
    try{
      const response=await call<Receipt>("public/contact",
        {requestKey:key,name,contact,subject,message});
      if(!response.receipt)throw Error("UNKNOWN");
      setReceipt(response);setProof(response.receipt);setRequestKey("");
      setMessage("");setError("");
    }catch(e){
      setError(e instanceof SupportActionError?e.message:
        "Submission could not be confirmed. Retry the same message to recover its original receipt without creating another request.");
    }finally{setBusy(false)}
  }
  async function check(){
    if(busy||!proof)return;
    setErrorArea("receipt");setBusy(true);setError("");setProofState("");
    try{
      const result=await call<{status:string;ticketNumber:string}>("receipt/status",{receipt:proof.trim()});
      setProofState(`${result.ticketNumber} · ${result.status.replaceAll("_"," ")}`);
    }catch(e){
      setError(e instanceof SupportActionError?e.message:
        "This receipt could not be verified. Check the original private code.");
    }finally{setBusy(false)}
  }
  return <section className="cg-site-contact-layout cg-site-content"
    aria-label="Foundation Contact and private support">
      <div className="cg-site-contact-panel cg-site-contact-message">
        <div className="cg-site-contact-intro">
          <h2>Send us a message</h2>
          <p>Your message is handled privately by the Foundation support system; no account is needed.</p>
        </div>
        {receipt?<section aria-live="polite">
          <h2>Request received</h2>
          <p><strong>Ticket number: {receipt.ticketNumber}</strong></p>
          <p>The Foundation recorded your request. This confirms receipt in the support system, not an email or SMS delivery.</p>
          <p>Keep this private receipt. It expires on {new Date(receipt.expiresAt).toLocaleDateString()}.</p>
          <code style={{display:"block",overflowWrap:"anywhere"}}>{receipt.receipt}</code>
          <div className="toolbar"><button className="cg-site-contact-button" type="button"
            onClick={()=>{setCopyState("");void (async()=>{try{await navigator.clipboard.writeText(receipt.receipt);setCopyState("Private receipt copied.");}catch{setCopyState("Copy unavailable. Select and save the private code shown above.");}})();}}>
            Copy private receipt
          </button></div>
          {copyState&&<p role="status">{copyState}</p>}
        </section>:<form className="cg-site-contact-fields" onSubmit={send}>
          <div className="cg-site-contact-field"><label htmlFor="c-name">Your name</label>
            <input id="c-name" disabled={busy} required minLength={2} maxLength={90}
              autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="cg-site-contact-field"><label htmlFor="c-contact">Email or phone</label>
            <input id="c-contact" disabled={busy} required minLength={5} maxLength={120}
              autoComplete="email" value={contact} onChange={e=>setContact(e.target.value)}/></div>
          <div className="cg-site-contact-field"><label htmlFor="c-subject">Subject</label>
            <input id="c-subject" disabled={busy} required minLength={5} maxLength={140}
              value={subject} onChange={e=>setSubject(e.target.value)}/></div>
          <div className="cg-site-contact-field"><label htmlFor="c-message">How can we help?</label>
            <textarea id="c-message" disabled={busy} required minLength={10} maxLength={2000}
              rows={5} value={message} onChange={e=>setMessage(e.target.value)}/></div>
          <p>Your details are visible only to authorized Foundation support staff.</p>
          <button className="cg-site-contact-button" disabled={busy} type="submit">
            {busy&&errorArea==="message"?"Sending private request…":"Send private request"}
          </button>
        </form>}
        {error&&errorArea==="message"&&<p className="cg-cms-error" role="alert">{error}</p>}
      </div>
      <aside className="cg-site-contact-side">
       {(phone||email||address)&&<section className="cg-site-contact-panel"><h2>Contact information</h2><address>{address&&<p>{address}</p>}{phone&&<p><a href={"tel:"+phone.replace(/[^+0-9]/g,"")}>{phone}</a></p>}{email&&<p><a href={"mailto:"+email}>{email}</a></p>}</address></section>}
      <div className="cg-site-contact-panel" style={{padding:"1.4rem"}}>
        <h2>Check a private receipt</h2>
        <p>Enter the receipt supplied when you submitted. Only the current status is shown; private messages are never exposed here.</p>
        <div className="cg-site-contact-field"><label htmlFor="c-receipt">Private receipt code</label>
          <input id="c-receipt" disabled={busy} value={proof} onChange={e=>{setProof(e.target.value);setProofState("");if(errorArea==="receipt")setError("");}}
            maxLength={43} autoComplete="off" spellCheck={false}/></div>
        <button type="button" className="cg-site-contact-button" disabled={busy||!proof}
          onClick={()=>void check()}>{busy&&errorArea==="receipt"?"Checking request status…":"Check request status"}</button>
        {proofState&&<p role="status">Current status: {proofState}</p>}
        {error&&errorArea==="receipt"&&<p className="cg-cms-error" role="alert">{error}</p>}
      </div></aside>
      {faqs.length>0&&<section className="cg-site-contact-panel cg-site-contact-support-faq" style={{padding:"1.4rem"}}>
        <h2>Frequently asked questions</h2>
        {faqs.map(f=><details key={f.faqRef}>
          <summary>{f.question}</summary><p>{f.answer}</p>
        </details>)}
      </section>}
  </section>;
}
