"use client";
import {useEffect,useRef,useState} from "react";
type Cover={fileRef:string;fileVersion:number;mime:string;size:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};
const mime=["image/jpeg","image/png","image/webp"];
async function request<T>(base:string,path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+path,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);if(!r.ok||!v)throw Error(v?.message??"Private cover service unavailable.");return v as T;
}
export function ProjectCoverPanel({projectRef,version,canUpload,initialFile,sourceKind="project"}:{projectRef:string;version:number;canUpload:boolean;initialFile?:File;sourceKind?:"project"|"activity"}){
 const isActivity=sourceKind==="activity",base=isActivity?"/api/activity-evidence/":"/api/project-covers/",label=isActivity?"Activity Evidence":"Cover Image";
 const api=<T,>(path:string,body?:Record<string,unknown>)=>request<T>(base,path,body);
 const [files,setFiles]=useState<Cover[]|null>(null),[file,setFile]=useState<File|null>(initialFile??null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[selected,setSelected]=useState<string|null>(null),[previewFailed,setPreviewFailed]=useState(false),[epoch,setEpoch]=useState(0),[intent,setIntent]=useState("");
 const command=useRef<Command|null>(null),running=useRef(false);
 useEffect(()=>{let live=true;setFiles(null);setSelected(null);setPreviewFailed(false);void api<{files:Cover[];projectVersion?:number;activityVersion?:number}>((isActivity?"activities/":"projects/")+projectRef).then(v=>{if(!live)return;if((isActivity?v.activityVersion:v.projectVersion)!==version){setError("Record changed; close and refresh the details.");return;}setFiles(v.files);setSelected(v.files[0]?.fileRef??null);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[projectRef,version,epoch,sourceKind]);
 const accept=(v:Upload)=>{if(!v.cleanVerified||!v.fileRef||!v.fileVersion)throw Error("The original scanner has not verified this image.");setMessage(label+" scanner-verified for this record revision. It remains private.");setEpoch(x=>x+1);command.current=null;setIntent("");setFile(null);};
 const verify=async()=>{if(!command.current?.intent||running.current)return;running.current=true;setBusy(true);setError("");try{accept(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}catch(e){setError(e instanceof Error?e.message:"Verification unavailable.");}finally{running.current=false;setBusy(false);}};
 const upload=async()=>{if(!canUpload||!file||running.current)return;running.current=true;setBusy(true);setError("");setMessage("");try{
  if(!mime.includes(file.type)||file.size<1||file.size>10485760)throw Error("Choose a JPEG, PNG or WebP image up to 10 MB.");
  const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
  const prior=command.current,cmd:Command=prior?.hash===hash&&prior.mime===file.type&&prior.size===file.size?prior:{key:crypto.randomUUID(),hash,mime:file.type,size:file.size};command.current=cmd;
  const v=await api<Upload>("intents",{...(isActivity?{activityRef:projectRef,activityVersion:version}:{projectRef,projectVersion:version}),requestKey:cmd.key,mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash});cmd.intent=v.uploadRef;setIntent(v.uploadRef);
  if(v.cleanVerified){accept(v);return;}
  if(v.status==="EXPIRED_OR_REJECTED"){command.current=null;setIntent("");throw Error("Original upload expired or was rejected. Choose the image again.");}
  if(v.status!=="UPLOAD_READY"||!v.uploadUrl||!v.uploadHeaders)throw Error("Secure storage is not ready. No image was accepted.");
  const url=new URL(v.uploadUrl);if(url.protocol!=="https:"||url.username||url.password||url.hash||v.uploadHeaders["Content-Type"]!==cmd.mime)throw Error("Invalid secure upload permission.");
  const sent=await fetch(v.uploadUrl,{method:"PUT",headers:v.uploadHeaders,body:bytes,credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(45000)});
  if(!sent.ok)throw Error("Upload outcome unconfirmed. Verify the original upload before retrying.");
  accept(await api<Upload>("intents/"+v.uploadRef+"/confirm",{}));
 }catch(e){setError(e instanceof Error?e.message:"Cover unavailable.");}finally{running.current=false;setBusy(false);}};
 return <section style={{border:"1px solid var(--cg-border)",borderRadius:10,padding:12,margin:"12px 0",display:"grid",gap:8}}>
 <h3 style={{margin:0}}>{label}</h3><small>{isActivity?"Private, scanner-verified activity evidence. No public consent is granted by uploading.":"Private, current verified project revision. Editing the project requires verifying a cover for its new revision."}</small>
 {files===null?<p>Image status not confirmed.</p>:!files.length?<p>No verified image for this revision.</p>:<><label>Verified images <select value={selected??""} onChange={e=>{setSelected(e.target.value);setPreviewFailed(false);}}>{files.map((v,i)=><option key={v.fileRef} value={v.fileRef}>{i===0?"Latest image":"Previous verified image"} · {new Date(v.createdAt).toLocaleString()}</option>)}</select></label>{selected&&!previewFailed&&<img alt={"Private "+label} src={base+"files/"+selected} onError={()=>setPreviewFailed(true)} style={{maxWidth:"100%",maxHeight:260,objectFit:"contain",borderRadius:8}}/>}{previewFailed&&<p>Verified image preview unavailable. Refresh before retry.</p>}</>}
 {canUpload&&<>{file&&<p>Selected image: {file.name} — not yet verified</p>}<input aria-label={"Choose "+label} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);command.current=null;setIntent("");setError("");}}/><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy||!file} onClick={()=>void upload()}>{busy?"Working…":"Upload and verify image"}</button>{intent&&<button disabled={busy} onClick={()=>void verify()}>Verify original upload</button>}</div></>}
 <button disabled={busy} onClick={()=>{setError("");setEpoch(x=>x+1);}}>Refresh image</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
