"use client";
import {useEffect,useRef,useState} from "react";
type Original={fileRef:string;fileVersion:number;mime:string;sizeBytes:number;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Verified={uploadRef:string;status:string;fileRef:string|null;cleanVerified:boolean};
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const res=await fetch(path,{method,cache:"no-store",credentials:"same-origin",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const result:unknown=await res.json().catch(()=>null);
 if(!res.ok)throw Error(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string"?result.message:
  "Original support attachment status could not be confirmed.");
 return result as T;
}
export function CenterSupportAttachments({centerRef,caseRef,caseRevision,closed}:{
 centerRef:string;caseRef:string;caseRevision:number;closed:boolean
}){
 const prefix="/api/support/centers/"+encodeURIComponent(centerRef)+
  "/cases/"+encodeURIComponent(caseRef)+"/attachments";
 const [file,setFile]=useState<File|null>(null),[files,setFiles]=useState<Original[]>([]);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [notice,setNotice]=useState(""),[intent,setIntent]=useState("");
 const key=useRef(""),epoch=useRef(0);
 async function refresh(){
  const read=++epoch.current;
  try{
   const data=await request<{files:Original[]}>(prefix);
   if(read===epoch.current)setFiles(data.files);
  }catch(e){if(read===epoch.current)setNotice(
   e instanceof Error?e.message:"Unable to confirm original files.");}
 }
 useEffect(()=>{setFiles([]);setFile(null);setIntent("");setUncertain(false);
  void refresh();return()=>{epoch.current++;};},[centerRef,caseRef]);
 async function check(original:string){
  const read=await request<Verified>(prefix+"/intents/"+encodeURIComponent(original));
  if(read.cleanVerified&&read.fileRef){
   key.current="";setIntent("");setUncertain(false);setFile(null);
   setNotice("Secure scanned support file saved. Only authorized current staff can read it.");
   await refresh();
  }else{
   setUncertain(false);
   setNotice("Private upload status: "+read.status.replaceAll("_"," ").toLowerCase()+
    ". An unverified file is never offered for download.");
  }
 }
 async function upload(){
  if(busy||uncertain||closed||!file)return;
  if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)||
    file.size<1||file.size>10*1024*1024){
   setNotice("Select a PDF or JPG, PNG or WebP smaller than 10 MB.");return;
  }
  setBusy(true);setNotice("");
  if(!key.current)key.current=crypto.randomUUID();
  try{
   const raw=await file.arrayBuffer();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)))
    .map(b=>b.toString(16).padStart(2,"0")).join("");
   const granted=await request<Upload>(prefix,"POST",{
    requestKey:key.current,expectedRevision:caseRevision,mime:file.type,
    sizeBytes:file.size,sha256:digest
   });
   if(!granted.uploadRef)throw Error("Original private upload unavailable");
   setIntent(granted.uploadRef);
   if(!granted.uploadUrl||!granted.uploadHeaders||
     !granted.uploadUrl.startsWith("https://")||
     granted.uploadHeaders["Content-Type"]!==file.type)
    throw Error("Private storage/scanner is unavailable. No attachment was accepted.");
   const put=await fetch(granted.uploadUrl,{method:"PUT",body:file,credentials:"omit",
    mode:"cors",headers:granted.uploadHeaders,cache:"no-store"});
   if(!put.ok)throw Error("Private upload status unknown. Check the original upload.");
   const verified=await request<Verified>(
    prefix+"/intents/"+encodeURIComponent(granted.uploadRef)+"/confirm","POST",{});
   if(!verified.cleanVerified)throw Error(
    "The original malware scan is incomplete. Do not treat this as an attached file.");
   await check(granted.uploadRef);
  }catch(e){setUncertain(true);setNotice(e instanceof Error?e.message:
   "Upload outcome uncertain. Check original status before retrying.");}
  finally{setBusy(false);}
 }
 async function revoke(item:Original){
  if(busy)return;
  setBusy(true);setNotice("");
  try{
   await request(prefix+"/files/"+encodeURIComponent(item.fileRef)+"/revoke","POST",{
    expectedVersion:item.fileVersion
   });
   await refresh();setNotice("The original private attachment was revoked.");
  }catch(e){setNotice(e instanceof Error?e.message:"Revocation outcome uncertain.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-labelledby="support-attachments-title">
  <h4 id="support-attachments-title">Private support attachments</h4>
  <p>Files remain within this Foundation support case. No public share link is created.</p>
  {!!notice&&<p role={uncertain?"alert":"status"} className="notice">{notice}</p>}
  {!closed&&<div className="toolbar">
   <label>Secure PDF or image
    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy||uncertain}
     onChange={e=>{setFile(e.target.files?.[0]??null);key.current="";setIntent("");
      setUncertain(false);}}/>
   </label>
   <button type="button" disabled={busy||uncertain||!file}
    onClick={()=>void upload()}>{busy?"Scanning…":"Upload securely"}</button>
   {!!intent&&<button type="button" disabled={busy}
    onClick={()=>{setBusy(true);void check(intent).catch(e=>{
     setUncertain(true);setNotice(e instanceof Error?e.message:
      "Original attachment status unconfirmed.");
    }).finally(()=>setBusy(false));}}>Check original upload</button>}
  </div>}
  <div className="toolbar"><button type="button" disabled={busy}
   onClick={()=>void refresh()}>Refresh verified attachments</button></div>
  {files.length===0&&<p>No clean-scanned attachments for this case.</p>}
  {files.map((item,i)=><div key={item.fileRef} className="toolbar">
   <span>Attachment {i+1} · {item.mime.includes("pdf")?"PDF":"Image"} ·
    {Math.ceil(item.sizeBytes/1024)} KB</span>
   <a href={prefix+"/files/"+encodeURIComponent(item.fileRef)} download>
    Download private original</a>
   <button type="button" disabled={busy} onClick={()=>void revoke(item)}>
    Revoke attachment</button>
  </div>)}
 </section>;
}
