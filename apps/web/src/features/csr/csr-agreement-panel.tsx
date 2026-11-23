"use client";
import {useEffect,useRef,useState} from "react";
type Evidence={fileRef:string;fileVersion:number;sourceVersion:number;mime:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Command={requestKey:string;hash:string;mime:string;size:number;intent?:string};
type Submit={requestKey:string;expectedVersion:number;evidenceFileRef:string};
const allowed=["application/pdf","image/jpeg","image/png","image/webp"];
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/csr/agreements/"+path,{cache:"no-store",
  ...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Error(v&&typeof v==="object"&&"message" in v&&typeof v.message==="string"?v.message:"Private agreement verification is unavailable.");
 return v as T;
}
/** CG19 private source proof. Uploading never approves a CSR company or receives funds. */
export function CsrAgreementPanel({partnerRef,version,canUpload,canSubmit,onSubmitted}:{partnerRef:string;version:number;canUpload:boolean;canSubmit:boolean;onSubmitted:()=>void}){
 const [files,setFiles]=useState<Evidence[]|null>(null),[chosen,setChosen]=useState<File|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),
  [epoch,setEpoch]=useState(0),[intent,setIntent]=useState("");
 const [proofLoadError,setProofLoadError]=useState("");
 const command=useRef<Command|null>(null),running=useRef(false),mounted=useRef(true);
 const [selectedProof,setSelectedProof]=useState(""),[submission,setSubmission]=useState<Submit|null>(null),[submitError,setSubmitError]=useState("");
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let live=true;setFiles(null);setProofLoadError("");
  void api<{files:Evidence[];currentVersion:number}>("partners/"+partnerRef).then(v=>{
   if(!live)return;
   if(v.currentVersion!==version){setProofLoadError("CSR draft changed. Refresh before uploading the agreement.");return;}
   setFiles(v.files);
  }).catch(e=>{if(live)setProofLoadError(e instanceof Error?e.message:"Cannot inspect verified CSR agreements.");});
  return()=>{live=false;};
 },[partnerRef,version,epoch]);
 const accepted=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)throw Error("The private agreement has not passed the original CG19 malware scan.");
  if(mounted.current){setMessage("Agreement scan verified. Submit this CSR application for independent review separately.");
   setChosen(null);setConsent(false);setIntent("");setEpoch(e=>e+1);}
  command.current=null;
 };
 const confirm=async()=>{if(running.current||!command.current?.intent)return;
  running.current=true;setBusy(true);setError("");
  try{accepted(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Agreement verification is unavailable.");}
  finally{running.current=false;setBusy(false);}
 };
 const submitForApproval=async()=>{
  if(!canSubmit||busy||running.current||!selectedProof||!files?.some(f=>f.fileRef===selectedProof&&f.sourceVersion===version))return;
  const cmd=submission??{requestKey:crypto.randomUUID(),expectedVersion:version,evidenceFileRef:selectedProof};
  setSubmission(cmd);setBusy(true);setSubmitError("");
  try{
   const response=await fetch("/api/csr/partners/"+partnerRef+"/submit",{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(cmd),signal:AbortSignal.timeout(16000)});
   const body:unknown=await response.json().catch(()=>null);
   if(!response.ok||body===null){
    const message=body&&typeof body==="object"&&"message" in body&&typeof body.message==="string"?body.message:"CSR submission could not be confirmed.";
    throw Object.assign(Error(message),{status:response.status});
   }
   setSubmission(null);setMessage("CSR application submitted for independent approval, not yet approved.");onSubmitted();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>0&&status<500){setSubmission(null);setSubmitError(e instanceof Error?e.message:"Review submission rejected. Refresh your draft.");}
   else setSubmitError("Result uncertain. Check review history or retry the exact original submission.");
  }finally{setBusy(false);}
 };
 useEffect(()=>{if(!submission)setSelectedProof("");},[partnerRef,version]);
 const upload=async()=>{
  if(!canUpload||!chosen||!consent||running.current)return;
  running.current=true;setBusy(true);setError("");setMessage("");
  try{
   if(!allowed.includes(chosen.type)||chosen.size<1||chosen.size>10485760)throw Error("Choose a PDF/JPG/PNG/WebP file up to 10 MB.");
   const bytes=await chosen.arrayBuffer();
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
   const prior=command.current;
   const cmd:Command=prior&&prior.hash===sha&&prior.mime===chosen.type&&prior.size===chosen.size?
    prior:{requestKey:crypto.randomUUID(),hash:sha,mime:chosen.type,size:chosen.size};
   command.current=cmd;
   const v=await api<Upload>("intents",{partnerRef,sourceVersion:version,requestKey:cmd.requestKey,
    mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash});
   cmd.intent=v.uploadRef;setIntent(v.uploadRef);
   if(v.cleanVerified){accepted(v);return;}
   if(v.status==="EXPIRED_OR_REJECTED"){command.current=null;setIntent("");throw Error("Agreement upload expired or failed. Choose the file again.");}
   if(v.status!=="UPLOAD_READY"||!v.uploadUrl||!v.uploadHeaders)throw Error("Secure upload is unavailable. No document is verified.");
   const url=new URL(v.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||v.uploadHeaders["Content-Type"]!==cmd.mime)
    throw Error("Private upload reservation is invalid.");
   const sent=await fetch(v.uploadUrl,{method:"PUT",headers:v.uploadHeaders,body:bytes,
    credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(45000)});
   if(!sent.ok)throw Error("Upload status is uncertain. Check the original upload status.");
   accepted(await api<Upload>("intents/"+v.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Agreement upload could not be confirmed.");}
  finally{running.current=false;setBusy(false);}
 };
 return <section aria-label="Private CSR agreement" style={{display:"grid",gap:9,border:"1px dashed var(--cg-border)",borderRadius:12,padding:14}}>
  <h3 style={{margin:0}}>Protected CSR agreement</h3>
  <p style={{fontSize:13,margin:0}}>PDF, JPG, PNG or WebP up to 10 MB. Retained privately by CareGanga and malware-scanned. Neither file upload nor scan verification is partner approval.</p>
  {proofLoadError?<p role="alert">{proofLoadError}</p>:files===null?<p role="status">Checking verified documents…</p>:files.length===0?<p>No scanner-verified agreement yet.</p>:
   <ul>{files.map((f,i)=><li key={f.fileRef}>
    Verified private document {i+1} ({f.mime==="application/pdf"?"PDF":"image"}) {f.sourceVersion===version?"· Current draft":"· Earlier draft; not eligible for a new submission"} · <a href={"/api/csr/agreements/files/"+f.fileRef}>Download privately</a>
   </li>)}</ul>}
  {canSubmit&&<div style={{display:"grid",gap:8,padding:10,background:"var(--cg-surface,#fff)",borderRadius:9}}>
    <h4 style={{margin:0}}>Submit for independent CSR review</h4>
    <p style={{fontSize:12,margin:0}}>Select a scanner-verified agreement. Another authorized Foundation reviewer must approve this application.</p>
    <select value={submission?.evidenceFileRef??selectedProof} disabled={busy||!!submission} onChange={e=>setSelectedProof(e.target.value)}>
     <option value="">Select verified agreement</option>
     {files?.filter(f=>f.sourceVersion===version).map((f,i)=><option key={f.fileRef} value={f.fileRef}>Current draft verified agreement {i+1}</option>)}
    </select>
    <button type="button" disabled={busy||!selectedProof||!files?.some(f=>f.fileRef===selectedProof&&f.sourceVersion===version)} onClick={()=>void submitForApproval()}>{busy?"Submitting…":"Submit for review"}</button>
    {submission&&<button type="button" disabled={busy} onClick={()=>void submitForApproval()}>Retry exact submission</button>}
    {submitError&&<p role="alert">{submitError}</p>}
   </div>}
  {canUpload&&<>
   <label>Select signed CSR agreement
    <input type="file" accept={allowed.join(",")} disabled={busy||!!proofLoadError} onChange={e=>{setChosen(e.target.files?.[0]??null);setConsent(false);command.current=null;setIntent("");setError("");}}/>
   </label>
   <label style={{display:"flex",alignItems:"start",gap:6,fontSize:13}}>
    <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
    I confirm the Foundation is authorized to retain this private agreement.
   </label>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button type="button" disabled={!chosen||!consent||busy||!!proofLoadError} onClick={()=>void upload()}>{busy?"Checking verified proof…":"Upload and verify agreement"}</button>
    {intent&&<button type="button" disabled={busy} onClick={()=>void confirm()}>Check original scan result</button>}
   </div>
  </>}
  <button type="button" disabled={busy} onClick={()=>{setError("");setEpoch(v=>v+1);}}>Refresh verified agreements</button>
  {message&&<p role="status" style={{color:"#166534"}}>{message}</p>}
  {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
 </section>;
}
