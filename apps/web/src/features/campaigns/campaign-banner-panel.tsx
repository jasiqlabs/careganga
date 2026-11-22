"use client";
import {useEffect,useRef,useState} from "react";

type MediaFile={fileRef:string;fileVersion:number;mime:string;size:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};
const allowed=["image/jpeg","image/png","image/webp"];
const MAX_BANNER=2*1024*1024;
const base="/api/campaign-media/";
async function api<T>(route:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+route,{cache:"no-store",...body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{}});
 const v=await r.json().catch(()=>null);
 if(!r.ok||!v)throw Error(typeof v?.message==="string"?v.message:"Original campaign media status is unavailable.");
 return v as T;
}
/** CG19 scanner verification is NOT CG18 public publication consent. */
export function CampaignBannerPanel({campaignRef,version,canUpload,currentFileRef,onVerified}:{
 campaignRef:string;version:number;canUpload:boolean;currentFileRef:string|null;onVerified:(ref:string)=>void;
}){
 const [files,setFiles]=useState<MediaFile[]|null>(null),[chosen,setChosen]=useState<File|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),
  [error,setError]=useState(""),[message,setMessage]=useState(""),
  [epoch,setEpoch]=useState(0),[intent,setIntent]=useState("");
 const command=useRef<Command|null>(null),running=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{let active=true;setFiles(null);
  void api<{files:MediaFile[];campaignVersion:number}>("campaigns/"+campaignRef)
   .then(r=>{if(!active)return;if(r.campaignVersion!==version){setError("Campaign changed. Refresh before uploading.");return;}setFiles(r.files);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Cannot verify campaign media.");});
  return()=>{active=false;};
 },[campaignRef,version,epoch]);
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
   if(!allowed.includes(chosen.type)||chosen.size<1||chosen.size>MAX_BANNER)
    throw Error("Choose JPG, PNG or WebP up to 2 MB, as shown in the client campaign form.");
   const bytes=await chosen.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
    v=>v.toString(16).padStart(2,"0")).join("");
   const old=command.current;
   const cmd=old?.hash===hash&&old.mime===chosen.type&&old.size===chosen.size?old:
    {key:crypto.randomUUID(),hash,mime:chosen.type,size:chosen.size};
   command.current=cmd;
   const v=await api<Upload>("intents",{campaignRef,campaignVersion:version,requestKey:cmd.key,
    mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash,kind:"BANNER",rightsConfirmed:true});
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
 return <section aria-label="Optional campaign banner" style={{padding:14,border:"1px dashed var(--cg-border)",borderRadius:12,display:"grid",gap:9}}>
  <h3 style={{margin:0}}>Cover Image (optional)</h3>
  <p style={{margin:0,fontSize:12}}>JPG, PNG or WebP · maximum 2 MB. Uploaded privately and scanned by CG19. Only independently approved campaign content can become public.</p>
  {currentFileRef&&selected?<div><p role="status">Verified original banner selected. Save your latest draft to attach it.</p>
    <img src={base+"files/"+selected.fileRef} alt="Private campaign banner preview" style={{maxWidth:"100%",maxHeight:220,objectFit:"contain",borderRadius:9}}/>
    {canUpload&&<button type="button" disabled={busy} onClick={()=>onVerified("")}>Remove banner</button>}
   </div>:currentFileRef?<p role="alert">The selected banner is not in the current verified file list. Refresh before saving.</p>
    :<p>No banner attached. Text-only campaigns are valid.</p>}
  {files===null&&<p role="status">Checking currently verified files…</p>}
  {canUpload&&<>
   <label><input type="file" accept={allowed.join(",")} disabled={busy}
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
