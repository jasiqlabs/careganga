"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Case={caseRef:string;reference:string;title:string;status:string;revision:number};
type Content={description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[];
 media:string[]};
type Detail={caseRef:string;reference:string;title:string;centerRef:string;
 status:string;revision:number;
 content:Content|null;isCurrentPublished:boolean;
 publicationGeneration:number|null;approvedRevisionRef:string|null;
 requiresIndependentReviewer:boolean};
async function api<T>(path:string,init?:RequestInit){
 const r=await fetch("/api/health/content-reviews/"+path,{
  ...init,cache:"no-store",credentials:"same-origin"});
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:"Review outcome could not be confirmed.");
 return data as T;
}
export function CenterContentReviewInbox({canPublish}:{canPublish:boolean}){
 const [cases,setCases]=useState<Case[]>([]);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState(""),[password,setPassword]=useState("");
 const [publicationPassword,setPublicationPassword]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),key=useRef(""),epoch=useRef(0);
 const load=useCallback(async()=>{
  const n=++epoch.current;
  try{
   const records=await api<{cases:Case[]}>("list");
   if(n===epoch.current)setCases(records.cases);
  }catch(e){if(n===epoch.current)setError(
   e instanceof Error?e.message:"Review queue cannot be checked.");}
 },[]);
 useEffect(()=>{void load();return()=>{epoch.current++};},[load]);
 async function select(ref:string){
  const n=++epoch.current;setDetail(null);setError("");setNotice("");
  try{
   const data=await api<Detail>(encodeURIComponent(ref));
   if(n===epoch.current){setDetail(data);setPassword("");setPublicationPassword("");
    key.current="";setUncertain(false);}
  }catch(e){if(n===epoch.current)setError(
   e instanceof Error?e.message:"Current review unavailable.");}
 }
 async function decide(){
  if(!detail||busy||uncertain||password.length<8||
    !["SUBMITTED","IN_REVIEW"].includes(detail.status))return;
  setBusy(true);setError("");setNotice("");
  if(!key.current)key.current=crypto.randomUUID();
  try{
   const currentRef=detail.caseRef;
   const response=await api<{status:string}>(encodeURIComponent(currentRef)+"/decide",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:key.current,expectedRevision:detail.revision,
     action,remarks,currentPassword:password})
   });
   setPassword("");key.current="";
   await load();await select(currentRef);
   setNotice(response.status==="PENDING_OWNER"?
    "Independent approval recorded. Foundation must separately publish this reviewed version.":
    "The decision is recorded in the original approval history.");
  }catch(e){setUncertain(true);setPassword("");setError(
   e instanceof Error?e.message:"Decision outcome uncertain. Refresh original review.");}
  finally{setBusy(false);}
 }
 async function publish(){
  if(!detail||busy||uncertain||!canPublish||publicationPassword.length<8||
    detail.status!=="PENDING_OWNER")return;
  setBusy(true);setError("");setNotice("");
  try{
   const ref=detail.caseRef;
   const r=await fetch("/api/health-network/my-centers/content/reviews/"+
    encodeURIComponent(ref)+"/apply",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:publicationPassword})
   });
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
    typeof data.message==="string"?data.message:
    "Publication was not confirmed. Refresh the original case.");
   setPublicationPassword("");await load();await select(ref);
   setNotice("Independently approved center presentation was published.");
  }catch(e){setUncertain(true);setError(
   e instanceof Error?e.message:"Publication unconfirmed. Recheck the original case.");}
  finally{setBusy(false);}
 }
 async function withdraw(){
  if(!detail||busy||uncertain||!canPublish||publicationPassword.length<8||
    !detail.isCurrentPublished||detail.publicationGeneration===null||
    !detail.approvedRevisionRef)return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/health-network/my-centers/"+
    encodeURIComponent(detail.centerRef)+"/content/withdraw",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({currentPassword:publicationPassword,
      expectedGeneration:detail.publicationGeneration,
      approvedRevisionRef:detail.approvedRevisionRef})
   });
   const data:unknown=await r.json().catch(()=>null);
   if(!r.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
    typeof data.message==="string"?data.message:
    "Withdrawal was not confirmed. Recheck the published center.");
   setPublicationPassword("");await load();await select(detail.caseRef);
   setNotice("Approved center presentation was withdrawn from public pages.");
  }catch(e){setUncertain(true);setError(
   e instanceof Error?e.message:"Withdrawal outcome unconfirmed.");}
  finally{setBusy(false);}
 }
 return <section className="role-workspace">
  <header className="topbar"><div><h1>Center content reviews</h1>
   <p>Independent CG-03 verification of each immutable center presentation.
    Only Foundation approvers can decide; the submitter cannot approve.</p>
  </div></header>
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  <div className="toolbar">
   <button type="button" disabled={busy} onClick={()=>{void load();if(detail)void select(detail.caseRef);}}>
    Refresh original review</button>
  </div>
  {cases.length===0&&<p>No content review cases currently visible.</p>}
  <div className="toolbar">
   {cases.map(c=><button type="button" key={c.caseRef}
    aria-pressed={detail?.caseRef===c.caseRef}
    onClick={()=>void select(c.caseRef)}>
    {c.reference} · {c.title} · {c.status.replaceAll("_"," ")}</button>)}
  </div>
  {detail&&<article className="form-section">
   <h2>{detail.title}</h2>
   <p>Review: {detail.reference} · {detail.status.replaceAll("_"," ")}</p>
   {!detail.content&&<p>This review is not awaiting another decision.
    Refresh the original center status to check its outcome.</p>}
   {canPublish&&["PENDING_OWNER","OWNER_COMPLETED"].includes(detail.status)&&
    <label>Confirm publication change with your current Foundation password
     <input type="password" autoComplete="current-password"
      value={publicationPassword} disabled={busy}
      onChange={e=>setPublicationPassword(e.target.value)}/>
    </label>}
   {detail.status==="PENDING_OWNER"&&canPublish&&
     <button type="button" className="primary" disabled={busy||uncertain||publicationPassword.length<8}
      onClick={()=>void publish()}>
      Publish independently approved content
     </button>}
   {detail.status==="OWNER_COMPLETED"&&detail.isCurrentPublished&&canPublish&&
     <button type="button" disabled={busy||uncertain||publicationPassword.length<8}
      onClick={()=>void withdraw()}>
      Withdraw currently published center presentation
     </button>}
   {detail.status==="OWNER_COMPLETED"&&!detail.isCurrentPublished&&
    <p role="status">This reviewed version is not currently published.
     Only the current approved presentation can be withdrawn.</p>}
   {detail.content&&<>
    <h3>Submitted content (read-only)</h3>
    <p>{detail.content.description}</p>
    <h4>Declared services</h4>
    <ul>{detail.content.services.map(x=><li key={x}>{x}</li>)}</ul>
    <h4>Facilities</h4>
    <ul>{detail.content.facilities.map(x=><li key={x}>{x}</li>)}</ul>
    <p>Working hours note: {detail.content.hoursNote||"Not provided"}</p>
    <p>Public contact email: {detail.content.publicEmail||"Not provided"}</p>
    {detail.content.media.length>0&&<>
     <h4>Submitted, scanned center photos</h4>
     <p>Images are sourced only from this immutable CG-03 review, verified by CG-19.
      Missing or withdrawn rights show no image.</p>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:12}}>
      {detail.content.media.map(file=><figure key={file}>
       {/* eslint-disable-next-line @next/next/no-img-element */}
       <img loading="lazy" width="450" height="280" alt="Submitted facility photo for independent review"
        style={{width:"100%",height:"auto",borderRadius:10}}
        src={"/api/documents/health-center-content/reviews/"+
         encodeURIComponent(detail.caseRef)+"/photos/"+encodeURIComponent(file)}/>
      </figure>)}
     </div>
    </>}
    <h4>Center questions</h4>
    {detail.content.faqs.map((f,i)=><div key={i}>
     <p><strong>{f.question}</strong></p><p>{f.answer}</p>
    </div>)}
    <div className="form-grid">
     <label>Review decision
      <select value={action} onChange={e=>{
       setAction(e.target.value as "APPROVE"|"RETURN"|"REJECT");key.current="";}}>
       <option value="APPROVE">Approve this frozen version</option>
       <option value="RETURN">Return for correction</option>
       <option value="REJECT">Reject</option>
      </select></label>
     <label>Reviewer remarks (optional)
      <textarea value={remarks} maxLength={500} rows={3}
       onChange={e=>{setRemarks(e.target.value);key.current="";}}/></label>
     <label>Confirm with your current Foundation password
      <input type="password" autoComplete="current-password" value={password}
       onChange={e=>{setPassword(e.target.value);key.current="";}}/></label>
    </div>
    <button type="button" className="primary" disabled={busy||uncertain||password.length<8}
     onClick={()=>void decide()}>{busy?"Confirming…":"Record independent decision"}</button>
   </>}
   {uncertain&&<p role="alert">Your last decision could have succeeded.
    Reopen the original review to check before retrying.</p>}
  </article>}
 </section>;
}
