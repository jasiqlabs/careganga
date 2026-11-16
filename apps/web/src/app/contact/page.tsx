"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
type Faq={faqRef:string;question:string;answer:string};
type Receipt={receipt:string;expiresAt:string;status:string;result:string};
async function call<T>(path:string,body:object){
  let response:Response;
  try{response=await fetch("/api/support/"+path,{method:"POST",
    credentials:"omit",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})}
  catch{throw Error("UNKNOWN")}
  if(!response.ok)throw Error(response.status===429?"LIMIT":
    response.status===409?"CONFLICT":
    response.status===400?"INVALID":"UNKNOWN");
  return await response.json() as T;
}
export default function FoundationContactPage(){
  const [name,setName]=useState(""),[contact,setContact]=useState("");
  const [subject,setSubject]=useState(""),[message,setMessage]=useState("");
  const [requestKey,setRequestKey]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [proof,setProof]=useState(""),[proofState,setProofState]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
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
    setError("");setBusy(true);
    const key=requestKey||crypto.randomUUID();
    setRequestKey(key);
    try{
      const response=await call<Receipt>("public/contact",
        {requestKey:key,name,contact,subject,message});
      if(!response.receipt)throw Error("UNKNOWN");
      setReceipt(response);setProof(response.receipt);setRequestKey("");
      setMessage("");setError("");
    }catch(e){
      const code=e instanceof Error?e.message:"UNKNOWN";
      setError(code==="LIMIT"?"Too many attempts. Try again later.":
        code==="INVALID"?"Check every field and its length.":
        code==="CONFLICT"?"The original request key already belongs to a different message.":
        "Submission could not be confirmed. Retry this same message to recover its original receipt without creating another request.");
    }finally{setBusy(false)}
  }
  async function check(){
    if(busy||!proof)return;
    setBusy(true);setError("");
    try{
      const result=await call<{status:string}>("receipt/status",{receipt:proof.trim()});
      setProofState(result.status);
    }catch(e){
      setError(e instanceof Error&&e.message==="LIMIT"?
        "Too many receipt checks. Try again later.":
        "This receipt could not be verified. Check the original private code.");
    }finally{setBusy(false)}
  }
  return <main className="page main" style={{maxWidth:"60rem"}}>
    <header className="topbar"><div className="toolbar">
      <img src="/careganga-mark.png" alt="CareGanga Foundation" width={52} height={52}/>
      <div><strong>CAREGANGA FOUNDATION</strong>
        <p>Contact & Help</p></div>
    </div><Link href="/">Home</Link></header>
    <section className="role-workspace" style={{paddingBlock:"2rem"}}>
      <div><h1>Contact the Foundation</h1>
        <p>Send a private request to the Foundation support team. You do not need an account.</p></div>
      <div className="role-pane" style={{padding:"1.4rem"}}>
        {receipt?<section aria-live="polite">
          <h2>Request received</h2>
          <p>The Foundation recorded your request. This confirms receipt in the support system, not an email or SMS delivery.</p>
          <p>Keep this private receipt. It expires on {new Date(receipt.expiresAt).toLocaleDateString()}.</p>
          <code style={{display:"block",overflowWrap:"anywhere"}}>{receipt.receipt}</code>
          <div className="toolbar"><button className="primary" type="button"
            onClick={()=>void navigator.clipboard.writeText(receipt.receipt)}>
            Copy private receipt
          </button></div>
        </section>:<form className="form" onSubmit={send}>
          <div className="field"><label htmlFor="c-name">Your name</label>
            <input id="c-name" required minLength={2} maxLength={90}
              autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="field"><label htmlFor="c-contact">Email or phone</label>
            <input id="c-contact" required minLength={5} maxLength={120}
              autoComplete="email" value={contact} onChange={e=>setContact(e.target.value)}/></div>
          <div className="field"><label htmlFor="c-subject">Subject</label>
            <input id="c-subject" required minLength={5} maxLength={140}
              value={subject} onChange={e=>setSubject(e.target.value)}/></div>
          <div className="field"><label htmlFor="c-message">How can we help?</label>
            <textarea id="c-message" required minLength={10} maxLength={2000}
              rows={5} value={message} onChange={e=>setMessage(e.target.value)}/></div>
          <p>Your details are visible only to authorized Foundation support staff.</p>
          <button className="primary" disabled={busy} type="submit">
            {busy?"Checking original request…":"Send private request"}
          </button>
        </form>}
      </div>
      <div className="role-pane" style={{padding:"1.4rem"}}>
        <h2>Check a private receipt</h2>
        <p>Enter the receipt supplied when you submitted. Only the current status is shown; private messages are never exposed here.</p>
        <div className="field"><label htmlFor="c-receipt">Private receipt code</label>
          <input id="c-receipt" value={proof} onChange={e=>setProof(e.target.value)}
            maxLength={43} autoComplete="off" spellCheck={false}/></div>
        <button type="button" className="primary" disabled={busy||!proof}
          onClick={()=>void check()}>Check request status</button>
        {proofState&&<p role="status">Current status: {proofState.replaceAll("_"," ")}</p>}
      </div>
      {faqs.length>0&&<section className="role-pane" style={{padding:"1.4rem"}}>
        <h2>Frequently asked questions</h2>
        {faqs.map(f=><details key={f.faqRef}>
          <summary>{f.question}</summary><p>{f.answer}</p>
        </details>)}
      </section>}
      {error&&<p className="error" role="alert">{error}</p>}
    </section>
  </main>;
}
