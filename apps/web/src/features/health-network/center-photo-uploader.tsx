"use client";
import {useEffect,useRef,useState} from "react";
type Original={fileRef:string;fileVersion:number;rightsVersion:number|null;
 classification:string;sourceVersion:number;rights:"CONFIRMED"|"NONE";
 altText:string|null;status:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Verified={uploadRef:string;status:string;cleanVerified:boolean;
 fileRef:string|null;fileVersion:number|null};
const root="/api/documents/health-center-content";
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await fetch(root+path,{method,cache:"no-store",credentials:"same-origin",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:
  "The original photo status could not be confirmed.");
 return data as T;
}
export function CenterPhotoUploader({centerRef,version,media,onChange,disabled}:{
 centerRef:string;version:number;media:string[];
 onChange:(next:string[])=>void;disabled:boolean
}){
 const [file,setFile]=useState<File|null>(null),[alt,setAlt]=useState("");
 const [holder,setHolder]=useState(""),[basis,setBasis]=useState<
  "OWNED_ORIGINAL"|"DOCUMENTED_CONSENT">("OWNED_ORIGINAL");
 const [items,setItems]=useState<Original[]>([]),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const [uploadRef,setUploadRef]=useState(""),[uploadSource,setUploadSource]=useState(0);
 const key=useRef(""),epoch=useRef(0);
 async function load(){
  const seq=++epoch.current;
  try{
   const list=await api<{files:Original[]}>(
    "/centers/"+encodeURIComponent(centerRef)+"/files");
   if(seq===epoch.current)setItems(list.files);
  }catch(e){if(seq===epoch.current)setNotice(e instanceof Error?e.message:
   "Current original photo list cannot be checked.");}
 }
 useEffect(()=>{setItems([]);setUploadRef("");setUncertain(false);void load();
  return()=>{epoch.current++;};},[centerRef]);
 function selected(ref:string){
  if(media.includes(ref))onChange(media.filter(x=>x!==ref));
  else if(media.length<8)onChange([...media,ref]);
 }
 async function verify(ref:string){
  const result=await api<Verified>("/intents/"+encodeURIComponent(ref));
  setUploadRef(ref);
  if(!result.cleanVerified||!result.fileRef)
   throw Error("Secure photo verification is not finished. Check the original upload.");
  await api("/files/"+encodeURIComponent(result.fileRef)+"/attest","POST",{
   rightsBasis:basis,rightsHolder:holder.trim(),altText:alt.trim()
  });
  await load();
  if(!media.includes(result.fileRef)&&media.length<8)
   onChange([...media,result.fileRef]);
  setUncertain(false);setFile(null);setUploadRef("");key.current="";
  setNotice("Scanned private photo and publication rights are recorded. Save the draft to include it.");
 }
 async function upload(){
  if(busy||disabled||version<1||uncertain||!file)return;
  if(!["image/jpeg","image/png"].includes(file.type)||
    file.size<1||file.size>3*1024*1024){
   setNotice("Choose a JPG or PNG smaller than 3 MB.");return;
  }
  if(alt.trim().length<5||holder.trim().length<3){
   setNotice("Enter a meaningful image description and who owns or authorized this photo.");
   return;
  }
  setBusy(true);setNotice("");
  if(!key.current)key.current=crypto.randomUUID();
  try{
   const bytes=await file.arrayBuffer();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))
    .map(v=>v.toString(16).padStart(2,"0")).join("");
   const intent=await api<Upload>("/intents","POST",{
    centerRef,sourceVersion:version,requestKey:key.current,
    classification:"HEALTH_CENTER_PHOTO",mime:file.type,
    sizeBytes:file.size,sha256:digest
   });
   setUploadRef(intent.uploadRef);setUploadSource(version);
   if(!intent.uploadUrl||!intent.uploadHeaders||
     !intent.uploadUrl.startsWith("https://")||
     intent.uploadHeaders["Content-Type"]!==file.type)
    throw Error("Private storage is unavailable. No verified image was saved.");
   const put=await fetch(intent.uploadUrl,{method:"PUT",body:file,
    mode:"cors",credentials:"omit",cache:"no-store",headers:intent.uploadHeaders});
   if(!put.ok)throw Error("The private upload outcome is unknown. Check original status.");
   const verified=await api<Verified>("/intents/"+
    encodeURIComponent(intent.uploadRef)+"/confirm","POST",{});
   if(!verified.cleanVerified)
    throw Error("The photo is awaiting scanner verification. Do not publish it.");
   await verify(intent.uploadRef);
  }catch(e){setUncertain(true);
   setNotice(e instanceof Error?e.message:
    "The upload result is uncertain. Check original status before retrying.");}
  finally{setBusy(false);}
 }
 async function revoke(item:Original,rightsOnly:boolean){
  if(busy)return;setBusy(true);setNotice("");
  try{
   await api("/files/"+encodeURIComponent(item.fileRef)+"/"+
    (rightsOnly?"revoke-rights":"revoke"),"POST",{
     expectedVersion:rightsOnly?item.rightsVersion:item.fileVersion
   });
   if(media.includes(item.fileRef))onChange(media.filter(x=>x!==item.fileRef));
   await load();
   setNotice(rightsOnly?"Public image rights were withdrawn.":
    "The original private image was revoked.");
  }catch(e){setNotice(e instanceof Error?e.message:"Revocation not confirmed.");
   setUncertain(true);
  }finally{setBusy(false);}
 }
 const supported=items.filter(x=>x.status==="VALIDATED"&&x.rights==="CONFIRMED");
 return <section className="form-section" aria-label="Center photos and publication consent">
  <h3>Center photos · private upload and publication rights</h3>
  <p>Photos are scanned privately before a Foundation reviewer may approve them.
   Only consented JPG/PNG images can appear publicly; personal metadata is removed
   when the approved image is served. No unapproved file is published.</p>
  {version===0&&<p>Save the center description first, then add photos.</p>}
  {!!notice&&<p role={uncertain?"alert":"status"} className="notice">{notice}</p>}
  <div className="form-grid">
   <label>Facility photo (JPG/PNG, 3 MB maximum)
    <input type="file" accept=".jpg,.jpeg,.png" disabled={busy||disabled||uncertain||version===0}
     onChange={e=>{setFile(e.target.files?.[0]??null);key.current="";
      setUploadRef("");setUncertain(false);}}/>
   </label>
   <label>Photo description (for accessibility)
    <input value={alt} maxLength={180} disabled={busy||disabled}
     onChange={e=>setAlt(e.target.value)} placeholder="e.g. Front entrance of the clinic"/>
   </label>
   <label>Publication rights
    <select value={basis} disabled={busy||disabled}
     onChange={e=>setBasis(e.target.value as typeof basis)}>
     <option value="OWNED_ORIGINAL">Our center owns this original photo</option>
     <option value="DOCUMENTED_CONSENT">We have written consent to publish</option>
    </select>
   </label>
   <label>Photo owner / person giving permission
    <input value={holder} maxLength={120} disabled={busy||disabled}
     onChange={e=>setHolder(e.target.value)}/>
   </label>
  </div>
  <div className="toolbar">
   <button type="button" onClick={()=>void upload()}
    disabled={busy||disabled||uncertain||!file||version===0}>
    {busy?"Checking private photo…":"Upload, scan and record rights"}</button>
   {!!uploadRef&&uploadSource===version&&
    <button type="button" disabled={busy} onClick={()=>{
     setBusy(true);void verify(uploadRef).catch(e=>{
      setUncertain(true);setNotice(e instanceof Error?e.message:
       "Original private upload could not be verified.");
     }).finally(()=>setBusy(false));
    }}>Check original upload</button>}
   <button type="button" disabled={busy} onClick={()=>void load()}>Refresh original file list</button>
  </div>
  <h4>Verified photos available to this center</h4>
  {supported.length===0&&<p>No scanned photos with active publication rights are currently available.</p>}
  {items.map(item=><div key={item.fileRef} className="form-section">
   <p>{item.altText||"No public photo description recorded"} · {
    item.rights==="CONFIRMED"?"Rights confirmed":"Rights not active"
   } · {item.status}</p>
   {item.status==="VALIDATED"&&item.rights==="CONFIRMED"&&
    <label><input type="checkbox" disabled={disabled||busy}
     checked={media.includes(item.fileRef)}
     onChange={()=>selected(item.fileRef)}/> Include in saved presentation</label>}
   {item.rights==="CONFIRMED"&&item.rightsVersion&&
    <button type="button" disabled={busy} onClick={()=>void revoke(item,true)}>
     Withdraw public permission</button>}
   {item.status==="VALIDATED"&&
    <button type="button" disabled={busy} onClick={()=>void revoke(item,false)}>
     Revoke original photo</button>}
  </div>)}
 </section>;
}
