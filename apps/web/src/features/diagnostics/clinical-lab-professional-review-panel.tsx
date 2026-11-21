"use client";
import {useEffect,useRef,useState} from "react";

type Current={resultRef:string;resultVersion:number;reportDigest:string;
 hasReview:boolean;reviewDecision:string|null;patientRelease:string;
 notificationDelivery:string};
type Decision={requestKey:string;resultRef:string;expectedVersion:number;
 reportDigest:string;decision:"APPROVE"|"REJECT";decisionNote:string;
 currentPassword:string};
type Props={centerRef:string;orderRef:string};
async function api<T>(route:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const result=await fetch("/api/lab-clinical/"+route,{
  cache:"no-store",credentials:"same-origin",method,
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
 });
 if(!result.ok)throw Object.assign(new Error(
  result.status===401?"Session expired. Sign in again.":
  result.status===403?"Your current clinical credentials or report permission are not eligible.":
  result.status===404?"The verified report is not ready for independent review.":
  result.status===409?"Report changed. Reopen its original source before reviewing.":
  "Private clinician review cannot be confirmed. Check original status before retrying."
 ),{status:result.status});
 return result.json() as Promise<T>;
}
export function ClinicalLabProfessionalReviewPanel({centerRef,orderRef}:Props){
 const [current,setCurrent]=useState<Current|null>(null);
 const [fileRead,setFileRead]=useState(false);
 const [attested,setAttested]=useState(false);
 const [note,setNote]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const original=useRef<Decision|null>(null);
 const base="centers/"+centerRef+"/orders/"+orderRef;
 async function refresh(){
  const data=await api<Current>(base+"/reviews/current");
  if(!data||!data.resultRef||!Number.isSafeInteger(data.resultVersion)||
     !/^[a-f0-9]{64}$/.test(data.reportDigest))
   throw Error("Protected original report cannot be verified.");
  setCurrent(data);
  if(data.hasReview){
   setNotice("Independent professional review recorded: "+
    (data.reviewDecision==="APPROVE"?"approved":"rejected")+
    (data.patientRelease==="RELEASED"?". The approved PDF has been released to the patient.":". The PDF awaits a separate Release action."));
   setUncertain(false);original.current=null;setPassword("");
  }
 }
 useEffect(()=>{
  let live=true;
  void refresh().catch(e=>{if(live)setError(e instanceof Error?e.message:
   "Current professional report access is unavailable.");})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;};
 },[base]);
 async function readOriginal(){
  if(!current||busy)return;
  setBusy(true);setError("");setFileRead(false);setAttested(false);
  try{
   const response=await fetch("/api/lab-clinical/"+base+"/reports/reviewer-file",{
    method:"GET",credentials:"same-origin",cache:"no-store"
   });
   if(!response.ok||response.headers.get("content-type")!=="application/pdf")
    throw Error("The private original PDF cannot be opened for this clinician.");
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<5||bytes.byteLength>10485760||
      new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")
    throw Error("Original PDF bytes did not pass verification.");
   const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
   const a=document.createElement("a");a.href=url;
   a.download="careganga-private-clinical-review.pdf";a.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1500);
   setFileRead(true);
   setNotice("Private file provided for qualified clinical inspection. "+
    "This does not itself approve, sign, issue or deliver any medical report.");
  }catch(e){setError(e instanceof Error?e.message:"Private PDF unavailable.");}
  finally{setBusy(false);}
 }
 async function decide(action:"APPROVE"|"REJECT",retry=false){
  if(!current||busy||current.hasReview||(!retry&&uncertain))return;
  if(!retry&&(!fileRead||!attested||note.trim().length<12||password.length<8)){
   setError("Read the original PDF and provide a detailed review note and current password.");
   return;
  }
  const prior=original.current;
  const choice:Decision=retry&&prior?prior:{
   requestKey:crypto.randomUUID(),resultRef:current.resultRef,
   expectedVersion:current.resultVersion,reportDigest:current.reportDigest,
   decision:action,decisionNote:note.trim(),currentPassword:password
  };
  if(retry&&!prior)return;
  if(!retry){
   if(!window.confirm(action==="APPROVE"?
     "Record your independent review of this exact PDF? This will NOT release it to the patient.":
     "Reject the report evidence? The original report remains private and auditable."))
    return;
   original.current=choice;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const response=await api<{professionallyReviewed:boolean;patientReleased:boolean}>(
    base+"/reviews","POST",choice);
   if(!response.professionallyReviewed||response.patientReleased)
    throw Error("Professional review source response was unexpected.");
   original.current=null;setUncertain(false);setPassword("");
   await refresh().catch(()=>setNotice(
    "Decision recorded, but refresh failed. Recheck the original report status."));
  }catch(e){
   setError(e instanceof Error?e.message:"Professional review outcome is uncertain.");
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)original.current=null;
  }finally{setBusy(false);}
 }
 return <section className="cg-diagnostics-card" aria-label="Independent clinical report review">
  <h3>Qualified independent clinical review</h3>
  <p>Only an assigned, currently credential-verified clinician can assess the
   original scanner-verified private PDF. The processing operator cannot
   review their own result. Approval alone does not release the report to the patient
   release, patient download or delivery notification.</p>
  {loading&&<p role="status">Checking current clinical credentials…</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  {current&&!current.hasReview&&<>
   <button type="button" disabled={busy} onClick={()=>void readOriginal()}>
    Read original private report PDF</button>
   {fileRead&&<label className="field">
    <input type="checkbox" checked={attested} disabled={busy||uncertain}
     onChange={e=>setAttested(e.target.checked)}/>
    I have inspected the original PDF, including patient, specimens and test details.
   </label>
   <label className="field">Clinical assessment and decision rationale
    <textarea value={note} maxLength={1000} disabled={busy||uncertain}
     onChange={e=>setNote(e.target.value)}
     placeholder="Explain the clinical report evidence decision (12–1000 characters)"/>
   </label>
   <label className="field">Current clinician account password
    <input type="password" autoComplete="current-password" minLength={8}
     maxLength={1024} value={password} disabled={busy||uncertain}
     onChange={e=>setPassword(e.target.value)}/>
   </label>
   {uncertain?<div className="toolbar">
    <button type="button" disabled={busy}
     onClick={()=>void refresh().catch(e=>setError(e instanceof Error?e.message:
      "Review source cannot be refreshed."))}>Check the original decision</button>
    <button type="button" disabled={busy||!original.current}
     onClick={()=>{if(original.current)void decide(original.current.decision,true);}}>
     Retry exactly the same review request</button>
   </div>:<div className="toolbar">
    <button type="button" disabled={busy||!fileRead||!attested||note.trim().length<12||password.length<8}
     onClick={()=>void decide("APPROVE")}>Record professional approval</button>
    <button type="button" disabled={busy||!fileRead||!attested||note.trim().length<12||password.length<8}
     onClick={()=>void decide("REJECT")}>Reject report evidence</button>
   </div>}
  </>}
  {current?.hasReview&&<p role="status">Independent review: {current.reviewDecision}.
   Patient report: {current.patientRelease==="RELEASED"?"Released privately":"Awaiting release"}.
   No notification was sent.</p>}
 </section>;
}
