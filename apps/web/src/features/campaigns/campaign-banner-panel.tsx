"use client";
import {useEffect,useRef,useState} from "react";

type MediaFile={fileRef:string;fileVersion:number;mime:string;size:string;createdAt:string;classification:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};
const allowed=["image/jpeg","image/png","image/webp"];
const MB=1024*1024;
const base="/api/campaign-media/";
async function api<T>(route:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+route,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);
 if(!r.ok||!v)throw Error(typeof v?.message==="string"?v.message:"Original campaign media status is unavailable.");
 return v as T;
}
/** CG19 scanner verification is NOT CG18 public publication consent. */
export function CampaignBannerPanel({campaignRef,version,canUpload,currentFileRef,onVerified,kind="BANNER"}:{
 campaignRef:string;version:number;canUpload:boolean;currentFileRef:string|null;onVerified:(ref:string)=>void;
 kind?:"COVER"|"BANNER";
}){
 const display=kind==="COVER"?"Cover Image":"Hero Banner";
 const limit=(kind==="COVER"?2:5)*MB;
 const acceptedTypes=kind==="COVER"?["image/jpeg","image/png"]:allowed;
 const [files,setFiles]=useState<MediaFile[]|null>(null),[chosen,setChosen]=useState<File|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),
  [error,setError]=useState(""),[message,setMessage]=useState(""),
  [epoch,setEpoch]=useState(0),[intent,setIntent]=useState("");
 const command=useRef<Command|null>(null),running=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{let active=true;setFiles(null);
  void api<{files:MediaFile[];campaignVersion:number}>("campaigns/"+campaignRef)
   .then(r=>{if(!active)return;if(r.campaignVersion!==version){setError("Campaign changed. Refresh before uploading.");return;}setFiles(r.files.filter(f=>f.classification===(kind==="COVER"?"CAMPAIGN_COVER":"CAMPAIGN_BANNER")));})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Cannot verify campaign media.");});
  return()=>{active=false;};
 },[campaignRef,version,epoch,kind]);
 const accepted=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)throw Error("CG19 has not verified the banner. It cannot be saved.");
  if(live.current){onVerified(v.fileRef);setMessage("Banner scanner-verified. Save the campaign draft to attach it; public publication is separate.");setChosen(null);setConsent(false);setIntent("");setEpoch(n=>n+1);}
  command.current=null;
 };
 const confirm=async()=>{if(!command.current?.intent||running.current)return;
  running.current=true;setBusy(true);setError("");
  try{accepted(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Original banner scan cannot be confirmed.");}
  finally{running.current=false;setBusy(false);}
 };
 const upload=async()=>{if(!chosen||!consent||!canUpload||running.current)return;
  running.current=true;setBusy(true);setError("");setMessage("");
  try{
   if(!acceptedTypes.includes(chosen.type)||chosen.size<1||chosen.size>limit)
    throw Error("Choose JPG, PNG or WebP up to "+(kind==="COVER"?2:5)+" MB.");
   const bytes=await chosen.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
    v=>v.toString(16).padStart(2,"0")).join("");
   const old=command.current;
   const cmd=old?.hash===hash&&old.mime===chosen.type&&old.size===chosen.size?old:
    {key:crypto.randomUUID(),hash,mime:chosen.type,size:chosen.size};
   command.current=cmd;
   const v=await api<Upload>("intents",{campaignRef,campaignVersion:version,requestKey:cmd.key,
    mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash,kind,rightsConfirmed:true});
   cmd.intent=v.uploadRef;setIntent(v.uploadRef);
   if(v.cleanVerified){accepted(v);return;}
   if(v.status==="EXPIRED_OR_REJECTED"){command.current=null;setIntent("");throw Error("Original upload expired or failed. Choose a banner again.");}
   if(v.status!=="UPLOAD_READY"||!v.uploadUrl||!v.uploadHeaders)throw Error("Private storage is unavailable. No banner was uploaded.");
   const url=new URL(v.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||v.uploadHeaders["Content-Type"]!==cmd.mime)
    throw Error("Invalid private storage upload reservation.");
   const sent=await fetch(v.uploadUrl,{method:"PUT",headers:v.uploadHeaders,body:bytes,
    credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(45000)});
   if(!sent.ok)throw Error("Upload result is uncertain. Use Verify Original Upload before retrying.");
   accepted(await api<Upload>("intents/"+v.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Campaign banner unavailable.");}
  finally{running.current=false;setBusy(false);}
 };
 const selected=files?.find(f=>f.fileRef===currentFileRef);
 return <section aria-label={"Optional campaign "+display} style={{padding:14,border:"1px dashed var(--cg-border)",borderRadius:12,display:"grid",gap:9}}>
  <h3 style={{margin:0}}>{display} (optional)</h3>
  <p style={{margin:0,fontSize:12}}>{kind==="COVER"?"JPG or PNG":"JPG, PNG or WebP"} · maximum {kind==="COVER"?2:5} MB. Uploaded privately and scanned by CG19. Only independently approved campaign content can become public.</p>
  {currentFileRef&&selected?<div><p role="status">Verified original banner selected. Save your latest draft to attach it.</p>
    <img src={base+"files/"+selected.fileRef} alt={"Private campaign "+display+" preview"} style={{maxWidth:"100%",maxHeight:220,objectFit:"contain",borderRadius:9}}/>
    {canUpload&&<button type="button" disabled={busy} onClick={()=>onVerified("")}>Remove banner</button>}
   </div>:currentFileRef?<p role="alert">The selected banner is not in the current verified file list. Refresh before saving.</p>
    :<p>No banner attached. Text-only campaigns are valid.</p>}
  {files===null&&<p role="status">Checking currently verified files…</p>}
  {canUpload&&<>
   <label><input type="file" accept={acceptedTypes.join(",")} disabled={busy}
    onChange={e=>{setChosen(e.target.files?.[0]??null);setConsent(false);command.current=null;setIntent("");setError("");}}/>
    {chosen&&<span> Selected: {chosen.name} (not yet verified)</span>}
   </label>
   <label style={{fontSize:12,display:"flex",gap:7,alignItems:"start"}}>
    <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
    I confirm permission to retain and use this campaign image. Publication still requires independent approval.
   </label>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button type="button" onClick={()=>void upload()} disabled={busy||!chosen||!consent}>{busy?"Checking original scanner…":"Upload & verify banner"}</button>
    {intent&&<button type="button" onClick={()=>void confirm()} disabled={busy}>Verify original upload</button>}
   </div>
  </>}
  <button type="button" disabled={busy} onClick={()=>{setError("");setEpoch(x=>x+1);}}>Refresh verified files</button>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}

/** Original A15 supporting documents: same CG19 private intent/scanner as the
 * banner; no file becomes a public resource or receipt after upload. */
export function CampaignSupportingDocumentsPanel({campaignRef,version,canUpload,refs,onChange}:{
 campaignRef:string;version:number;canUpload:boolean;refs:string[];onChange:(next:string[])=>void;
}){
 const [files,setFiles]=useState<MediaFile[]|null>(null),[picked,setPicked]=useState<File|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),
  [error,setError]=useState(""),[message,setMessage]=useState(""),
  [epoch,setEpoch]=useState(0),[intent,setIntent]=useState("");
 const command=useRef<Command|null>(null),running=useRef(false),latest=useRef(refs);
 latest.current=refs;
 useEffect(()=>{let active=true;setFiles(null);
  void api<{files:MediaFile[];campaignVersion:number}>("campaigns/"+campaignRef).then(v=>{
   if(!active)return;if(v.campaignVersion!==version){setError("Campaign changed. Refresh before adding files.");return;}
   setFiles(v.files.filter(f=>f.classification==="CAMPAIGN_DOCUMENT"));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Verified documents cannot be listed.");});
  return()=>{active=false;};
 },[campaignRef,version,epoch]);
 const accepted=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)throw Error("CG19 has not verified the supporting document.");
  const current=latest.current;
  if(!current.includes(v.fileRef)){if(current.length>=6)throw Error("Maximum six supporting files.");onChange([...current,v.fileRef]);}
  setMessage("Document scanner-verified. Save your campaign draft to attach this private evidence.");
  setPicked(null);setConsent(false);setIntent("");setEpoch(n=>n+1);command.current=null;
 };
 const confirm=async()=>{if(!command.current?.intent||running.current)return;running.current=true;setBusy(true);setError("");
  try{accepted(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Document scanner unavailable.");}
  finally{running.current=false;setBusy(false);}
 };
 const upload=async()=>{if(!picked||!canUpload||!consent||running.current||refs.length>=6)return;
  running.current=true;setBusy(true);setError("");setMessage("");
  try{
   if(![...allowed,"application/pdf"].includes(picked.type)||picked.size<1||picked.size>10485760)
    throw Error("Choose a JPG, PNG, WebP or PDF document up to 10 MB.");
   const bytes=await picked.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
    v=>v.toString(16).padStart(2,"0")).join("");
   const previous=command.current;
   const cmd=previous?.hash===hash&&previous.mime===picked.type&&previous.size===picked.size?previous:
    {key:crypto.randomUUID(),hash,mime:picked.type,size:picked.size};
   command.current=cmd;
   const v=await api<Upload>("intents",{campaignRef,campaignVersion:version,requestKey:cmd.key,
    mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash,kind:"DOCUMENT",rightsConfirmed:true});
   cmd.intent=v.uploadRef;setIntent(v.uploadRef);
   if(v.cleanVerified){accepted(v);return;}
   if(v.status==="EXPIRED_OR_REJECTED"){command.current=null;setIntent("");throw Error("Upload expired or was rejected. Select the document again.");}
   if(v.status!=="UPLOAD_READY"||!v.uploadUrl||!v.uploadHeaders)throw Error("Secure private storage unavailable.");
   const url=new URL(v.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||v.uploadHeaders["Content-Type"]!==cmd.mime)
    throw Error("Private document reservation is invalid.");
   const sent=await fetch(v.uploadUrl,{method:"PUT",headers:v.uploadHeaders,body:bytes,
    credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(45000)});
   if(!sent.ok)throw Error("Upload outcome unknown. Verify the original upload before retrying.");
   accepted(await api<Upload>("intents/"+v.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Supporting document unavailable.");}
  finally{running.current=false;setBusy(false);}
 };
 return <section aria-label="Private campaign supporting documents" style={{padding:14,border:"1px dashed var(--cg-border)",borderRadius:12,display:"grid",gap:9}}>
  <h3 style={{margin:0}}>Supporting Documents (optional)</h3>
  <p style={{fontSize:12,margin:0}}>Up to six private, scanner-verified images or PDFs. Consent is recorded; public access requires a separate authorized publication.</p>
  {refs.length===0?<p>No supporting documents attached.</p>:refs.map((ref,i)=>{
   const file=files?.find(f=>f.fileRef===ref);
   return <div key={ref} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
    <span>{file?"Verified document "+(i+1):"Document "+(i+1)+" — verification not confirmed"}</span>
    {file&&<a href={base+"files/"+ref} target="_blank" rel="noopener noreferrer">Open private file</a>}
    {canUpload&&<button type="button" disabled={busy} onClick={()=>onChange(refs.filter(r=>r!==ref))}>Remove from draft</button>}
   </div>;
  })}
  {canUpload&&refs.length<6&&<>
   <input type="file" aria-label="Choose campaign supporting document"
    accept={[...allowed,"application/pdf"].join(",")} disabled={busy}
    onChange={e=>{setPicked(e.target.files?.[0]??null);setConsent(false);command.current=null;setIntent("");setError("");}}/>
   {picked&&<p>Selected: {picked.name} — not yet verified</p>}
   <label style={{display:"flex",gap:8,fontSize:12}}>
    <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>
    I confirm permission to retain this supporting document privately.
   </label>
   <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
    <button type="button" disabled={busy||!picked||!consent} onClick={()=>void upload()}>
     {busy?"Verifying…":"Upload & verify document"}</button>
    {intent&&<button type="button" disabled={busy} onClick={()=>void confirm()}>Verify original upload</button>}
   </div>
  </>}
  <button type="button" disabled={busy} onClick={()=>{setError("");setEpoch(n=>n+1);}}>Refresh document status</button>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
