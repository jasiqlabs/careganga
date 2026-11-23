"use client";
import {useEffect,useRef,useState} from "react";
type Proof={fileRef:string;fileVersion:number;sourceVersion:number;mime:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};
type ReviewSubmit={requestKey:string;expectedVersion:number;evidenceFileRef:string};
const types=["application/pdf","image/jpeg","image/png","image/webp"];
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/csr/funding-agreements/"+path,{cache:"no-store",
  ...(body?{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok||data===null)
  throw Error(data&&typeof data==="object"&&"message" in data&&typeof data.message==="string"?
   data.message:"Private funding proof status is uncertain. Verify before repeating.");
 return data as T;
}
/** CG19 proposal-specific private evidence. A clean scan is not a signed
 * commitment or a CG03 approval; it cannot create CG09 bank money. */
export function CsrFundingAgreementPanel({proposalRef,version,canUpload,canSubmit,onSubmitted}:{
 proposalRef:string;version:number;canUpload:boolean;canSubmit:boolean;onSubmitted:()=>void}){
 const [files,setFiles]=useState<Proof[]|null>(null),
  [loadError,setLoadError]=useState(""),[error,setError]=useState(""),
  [notice,setNotice]=useState(""),[chosen,setChosen]=useState<File|null>(null),
  [allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false),
  [epoch,setEpoch]=useState(0),[intent,setIntent]=useState("");
 const command=useRef<Command|null>(null),running=useRef(false),generation=useRef(0);
 const [proof,setProof]=useState(""),[pendingReview,setPendingReview]=useState<ReviewSubmit|null>(null);
 const [reviewError,setReviewError]=useState("");
 useEffect(()=>{
  const generationId=++generation.current;
  setFiles(null);setLoadError("");
  void api<{files:Proof[];currentVersion:number}>("proposals/"+proposalRef).then(value=>{
   if(generation.current!==generationId)return;
   if(value.currentVersion!==version){
    setLoadError("Funding proposal changed. Refresh before uploading.");return;
   }
   setFiles(value.files);
  }).catch(e=>{if(generation.current===generationId)
   setLoadError(e instanceof Error?e.message:"Verified agreements unavailable.");});
  return()=>{generation.current++;};
 },[proposalRef,version,epoch]);
 useEffect(()=>{if(!pendingReview)setProof("");},[proposalRef,version]);
 const submitForReview=async(retry=false)=>{
  if(!canSubmit||busy||running.current||!files)return;
  if(!retry&&pendingReview)return;
  if(!pendingReview&&!files.some(f=>f.fileRef===proof&&f.sourceVersion===version))return;
  const request=pendingReview??{requestKey:crypto.randomUUID(),expectedVersion:version,evidenceFileRef:proof};
  setPendingReview(request);setBusy(true);setReviewError("");
  try{
   const response=await fetch("/api/csr/funding-proposals/"+proposalRef+"/submit",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(request),signal:AbortSignal.timeout(18000)});
   const body:unknown=await response.json().catch(()=>null);
   if(!response.ok||body===null)
    throw Object.assign(Error(body&&typeof body==="object"&&"message" in body&&
     typeof body.message==="string"?body.message:"Funding review submission uncertain."),
     {status:response.status||503});
   setPendingReview(null);
   setNotice("Signed funding proposal sent for independent review. No cash was posted.");
   onSubmitted();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>0&&status<500){setPendingReview(null);setReviewError(
    e instanceof Error?e.message:"Funding review was rejected.");}
   else setReviewError("Review submission outcome uncertain. Check the original review history or retry the exact command.");
  }finally{setBusy(false);}
 };
 const verified=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)
   throw Error("The protected agreement has not passed the original malware scanner.");
  command.current=null;setIntent("");setChosen(null);setAllowed(false);
  setNotice("Private file scan verified. Independent signed-commitment review is still required.");
  setEpoch(x=>x+1);
 };
 const check=async()=>{
  if(running.current||!command.current?.intent)return;
  running.current=true;setBusy(true);setError("");
  try{verified(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Private scan outcome is uncertain.");}
  finally{running.current=false;setBusy(false);}
 };
 const upload=async()=>{
  if(!canUpload||!chosen||!allowed||running.current||loadError)return;
  running.current=true;setBusy(true);setError("");setNotice("");
  try{
   if(!types.includes(chosen.type)||chosen.size<1||chosen.size>10485760)
    throw Error("Use an authorized PDF/JPG/PNG/WebP document no larger than 10 MB.");
   const bytes=await chosen.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
    x=>x.toString(16).padStart(2,"0")).join("");
   const prev=command.current;
   const cmd:Command=prev&&prev.hash===hash&&prev.mime===chosen.type&&prev.size===chosen.size?
    prev:{key:crypto.randomUUID(),hash,mime:chosen.type,size:chosen.size};
   command.current=cmd;
   const result=await api<Upload>("intents",{proposalRef,sourceVersion:version,
    requestKey:cmd.key,mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash});
   cmd.intent=result.uploadRef;setIntent(result.uploadRef);
   if(result.cleanVerified){verified(result);return;}
   if(result.status==="EXPIRED_OR_REJECTED"){
    command.current=null;setIntent("");throw Error("Private upload expired or failed. Select the document again.");
   }
   if(result.status!=="UPLOAD_READY"||!result.uploadUrl||!result.uploadHeaders)
    throw Error("Secure storage did not confirm an upload reservation.");
   const url=new URL(result.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||
    result.uploadHeaders["Content-Type"]!==cmd.mime)
    throw Error("Invalid private storage reservation.");
   const sent=await fetch(result.uploadUrl,{method:"PUT",headers:result.uploadHeaders,
    body:bytes,credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(45000)});
   if(!sent.ok)throw Error("Private upload response is uncertain. Verify its original scan status.");
   verified(await api<Upload>("intents/"+result.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Private agreement upload outcome uncertain.");}
  finally{running.current=false;setBusy(false);}
 };
 return <section aria-label="Private funding proposal agreement"
  style={{border:"1px solid var(--cg-border)",borderRadius:12,padding:15,display:"grid",gap:10}}>
  <h4 style={{margin:0}}>5. Documents & Agreement</h4>
  <p style={{fontSize:13,margin:0}}>Attach this proposal's actual private signed agreement.
   A clean file scan alone does not verify a signature, approve funding or record cash.</p>
  {loadError?<p role="alert">{loadError}</p>:
   files===null?<p role="status">Checking original CG19 evidence…</p>:
   files.length===0?<p>No verified funding documents for this proposal.</p>:
   <ul>{files.map((f,i)=><li key={f.fileRef}>
    Verified private document {i+1} · {f.sourceVersion===version?"Current proposal":"Earlier proposal revision"} ·
    {" "}<a href={"/api/csr/funding-agreements/files/"+f.fileRef}>Download privately</a>
   </li>)}</ul>}
  {canSubmit&&<div style={{display:"grid",gap:9,padding:11,
   background:"var(--cg-surface,#fff)",borderRadius:9}}>
   <h4 style={{margin:0}}>Submit for independent funding approval</h4>
   <p style={{fontSize:13,margin:0}}>Choose the current revision's scanner-verified
    signed agreement. A different Foundation reviewer validates its signature and
    terms. This creates no bank receipt.</p>
   <select value={pendingReview?.evidenceFileRef??proof}
    disabled={busy||!!pendingReview||!!loadError}
    onChange={e=>setProof(e.target.value)}>
    <option value="">Select current signed agreement</option>
    {files?.filter(f=>f.sourceVersion===version).map((f,i)=>
     <option key={f.fileRef} value={f.fileRef}>Verified private funding document {i+1}</option>)}
   </select>
   <button type="button" disabled={busy||!!pendingReview||!files?.some(f=>f.fileRef===proof&&f.sourceVersion===version)}
    onClick={()=>void submitForReview()}>Submit signed proposal for review</button>
   {pendingReview&&<button type="button" disabled={busy}
    onClick={()=>void submitForReview(true)}>Retry exact original funding submission</button>}
   {!!reviewError&&<p role="alert">{reviewError}</p>}
  </div>}
  {canUpload&&<>
   <label>Choose proposal-specific signed agreement
    <input type="file" accept={types.join(",")} disabled={busy||!!loadError}
     onChange={e=>{setChosen(e.target.files?.[0]??null);setAllowed(false);
      setError("");command.current=null;setIntent("");}}/>
   </label>
   <label style={{display:"flex",alignItems:"start",gap:8,fontSize:13}}>
    <input type="checkbox" checked={allowed} disabled={busy}
     onChange={e=>setAllowed(e.target.checked)}/>
    I confirm this Foundation is authorized to retain this private document.
   </label>
   <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
    <button type="button" disabled={busy||!chosen||!allowed||!!loadError}
     onClick={()=>void upload()}>Upload and verify private document</button>
    {!!intent&&<button type="button" disabled={busy} onClick={()=>void check()}>
     Check original scan result</button>}
   </div>
  </>}
  <button type="button" disabled={busy} onClick={()=>{setError("");setEpoch(x=>x+1);}}>
   Refresh verified documents</button>
  {!!notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
  {!!error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
 </section>;
}
