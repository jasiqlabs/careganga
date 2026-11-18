"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CenterSupportAttachments} from "./center-support-attachments";

type Case={caseRef:string;subject:string;status:string;revision:number;updatedAt:string};
type Detail={caseRef:string;subject:string;message:string;status:string;revision:number;
 replies:{message:string;createdAt:string}[]};
async function request<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch("/api/support/"+path,{...init,cache:"no-store",
  credentials:"same-origin"});
 const result:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string"?result.message:
  "Your current support case could not be confirmed.");
 return result as T;
}
export function CenterSupportDesk({centerRef}:{centerRef:string}){
 const [items,setItems]=useState<Case[]>([]),[detail,setDetail]=useState<Detail|null>(null);
 const [subject,setSubject]=useState(""),[message,setMessage]=useState("");
 const [reply,setReply]=useState(""),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const createKey=useRef(""),replyKey=useRef(""),epoch=useRef(0);
 const prefix="centers/"+encodeURIComponent(centerRef)+"/cases";
 const list=useCallback(async()=>{
  const seq=++epoch.current;
  try{
   const result=await request<{cases:Case[]}>(prefix);
   if(seq===epoch.current)setItems(result.cases);
  }catch(e){if(seq===epoch.current)setError(
   e instanceof Error?e.message:"Current center support unavailable");}
 },[prefix]);
 useEffect(()=>{setItems([]);setDetail(null);void list();
  return()=>{epoch.current++;};},[list]);
 async function open(ref:string){
  const seq=++epoch.current;setDetail(null);setError("");setNotice("");
  try{
   const result=await request<Detail>(prefix+"/"+encodeURIComponent(ref));
   if(seq===epoch.current){setDetail(result);replyKey.current="";}
  }catch(e){if(seq===epoch.current)setError(
   e instanceof Error?e.message:"This support case is unavailable.");}
 }
 async function create(){
  if(busy||subject.trim().length<5||message.trim().length<10)return;
  if(!createKey.current)createKey.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const result=await request<{caseRef:string;replayed:boolean}>(prefix,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:createKey.current,subject:subject.trim(),
      message:message.trim()})
   });
   createKey.current="";setSubject("");setMessage("");
   await list();await open(result.caseRef);
   setNotice(result.replayed?"Recovered your original support request.":
    "Your center support case was submitted to the Foundation.");
  }catch(e){setError(e instanceof Error?e.message:
   "The request outcome is uncertain. Refresh your original cases before creating another.");}
  finally{setBusy(false);}
 }
 async function submitReply(){
  if(busy||!detail||reply.trim().length<2)return;
  if(!replyKey.current)replyKey.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const saved=detail.caseRef;
   await request(prefix+"/"+encodeURIComponent(saved)+"/reply",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:replyKey.current,
      expectedRevision:detail.revision,message:reply.trim()})
   });
   replyKey.current="";setReply("");await open(saved);await list();
   setNotice("Your message was added to the original Foundation support case.");
  }catch(e){setError(e instanceof Error?e.message:
   "Reply outcome not confirmed. Recheck the case before retrying.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-labelledby="center-support-heading">
  <h2 id="center-support-heading">Center support &amp; help</h2>
  <p>Ask CareGanga Foundation about this center. All messages stay in the
   Foundation helpdesk and are private to current authorized center staff.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  <div className="form-grid">
   <label>Request subject
    <input value={subject} onChange={e=>{setSubject(e.target.value);createKey.current="";}}
     maxLength={140} placeholder="What do you need help with?"/></label>
   <label>Message
    <textarea value={message} onChange={e=>{setMessage(e.target.value);createKey.current="";}}
     maxLength={2000} rows={4} placeholder="Explain your question for the Foundation"/>
   </label>
  </div>
  <div className="toolbar">
   <button type="button" disabled={busy||subject.trim().length<5||message.trim().length<10}
    onClick={()=>void create()}>{busy?"Saving…":"Send support request"}</button>
   <button type="button" disabled={busy} onClick={()=>{void list();if(detail)void open(detail.caseRef);}}>
    Recheck current support cases</button>
  </div>
  <h3>My center support cases</h3>
  {items.length===0&&<p>No cases currently available to this center.</p>}
  <div className="toolbar">
   {items.map(item=><button type="button" key={item.caseRef}
    aria-pressed={item.caseRef===detail?.caseRef}
    onClick={()=>void open(item.caseRef)}>{item.subject} · {item.status}</button>)}
  </div>
  {detail&&<article className="form-section">
   <h3>{detail.subject}</h3>
   <p>Status: {detail.status}</p>
   <p>{detail.message}</p>
   <CenterSupportAttachments key={detail.caseRef} centerRef={centerRef}
    caseRef={detail.caseRef} caseRevision={detail.revision}
    closed={detail.status==="CLOSED"}/>
   <h4>Conversation</h4>
   {detail.replies.length===0&&<p>The Foundation has not yet replied.</p>}
   {detail.replies.map((item,i)=><p key={i}>{item.message}</p>)}
   {detail.status!=="CLOSED"&&<>
    <label>Write a reply
     <textarea value={reply} onChange={e=>{setReply(e.target.value);replyKey.current="";}}
      rows={3} maxLength={2400}/></label>
    <button type="button" disabled={busy||reply.trim().length<2}
     onClick={()=>void submitReply()}>{busy?"Sending…":"Reply to this case"}</button>
   </>}
  </article>}
 </section>;
}
