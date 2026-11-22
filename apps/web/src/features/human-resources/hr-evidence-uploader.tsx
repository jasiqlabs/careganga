"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Verified={fileRef:string;fileVersion:number;classification:string;
 sourceVersion:number;status:string;cleanVerified:boolean};
type Intent={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>;expiresAt?:string;cleanVerified?:boolean};
type Props={applicationRef:string;revision:number;canManage:boolean;
 onValidated?:()=>void};
const types=[
 {value:"HR_IDENTITY_PROOF",label:"Identity proof"},
 {value:"HR_PAN_PROOF",label:"PAN proof (optional)"},
 {value:"HR_QUALIFICATION",label:"Qualification evidence"},
 {value:"HR_PORTRAIT",label:"Employee photograph"}
] as const;
async function json(path:string,init?:RequestInit):Promise<unknown>{
 const response=await fetch("/api/hr-evidence/"+path,{
  ...init,credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json",...init?.headers}
 });
 const value:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  if(value&&typeof value==="object"&&"message" in value&&
   typeof value.message==="string")throw Error(value.message);
  throw Error("Private employee evidence cannot be confirmed.");
 }
 return value;
}
const digest=async(data:ArrayBuffer)=>{
 const hash=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,"0")).join("");
};
const looksLikeFiles=(v:unknown):v is {files:Verified[]}=>Boolean(v)&&
 typeof v==="object"&&"files" in v&&Array.isArray((v as {files:unknown}).files);
export function HrEvidenceUploader({applicationRef,revision,canManage,
 onValidated}:Props){
 const [files,setFiles]=useState<Verified[]>([]);
 const [kind,setKind]=useState<string>("HR_IDENTITY_PROOF");
 const [selected,setSelected]=useState<File|null>(null);
 const [message,setMessage]=useState("");
 const [problem,setProblem]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const activeUpload=useRef<{key:string;digest:string;kind:string;
   uploadRef:string|null}|null>(null);
 const refresh=useCallback(async()=>{
  setLoading(true);setProblem("");
  try{
   const result=await json("applications/"+applicationRef);
   if(!looksLikeFiles(result))throw Error("The original evidence list could not be verified.");
   setFiles(result.files);
  }catch(e){
   setFiles([]);
   setProblem(e instanceof Error?e.message:"Private files are temporarily unavailable.");
  }finally{setLoading(false);}
 },[applicationRef]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  setSelected(null);setProblem("");setMessage("");
  activeUpload.current=null;
 },[applicationRef,revision]);
 const revoke=async(file:Verified)=>{
  if(!canManage||busy||!file.cleanVerified||file.sourceVersion!==revision)return;
  setBusy(true);setProblem("");setMessage("");
  try{
   const outcome=await json("files/"+file.fileRef+"/revoke",{
    method:"POST",body:JSON.stringify({expectedRevision:file.fileVersion})});
   if(!outcome||typeof outcome!=="object"||!("revoked" in outcome)||
    outcome.revoked!==true)
    throw Error("Original evidence revocation was not confirmed.");
   await refresh();
   setMessage("Private evidence revoked. Original audit history is retained.");
  }catch(e){
   setProblem(e instanceof Error?e.message:
    "Revocation outcome is uncertain. Refresh before taking another action.");
  }finally{setBusy(false);}
 };
 const upload=async()=>{
  if(!canManage||!selected||busy)return;
  if(kind==="HR_PORTRAIT"&&!["image/jpeg","image/png"].includes(selected.type)){
   setProblem("Choose a JPEG or PNG employee photograph.");return;
  }
  if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(selected.type)||
    selected.size<1||selected.size>10485760){
   setProblem("Choose a PDF or image smaller than 10 MB.");return;
  }
  setBusy(true);setProblem("");setMessage("");
  try{
   const bytes=await selected.arrayBuffer();
   const checksum=await digest(bytes);
   const previous=activeUpload.current;
   const command=previous&&previous.digest===checksum&&previous.kind===kind?
    previous:{key:crypto.randomUUID(),digest:checksum,kind,uploadRef:null};
   activeUpload.current=command;
   let intent:Intent;
   if(command.uploadRef){
    const prior=await json("intents/"+command.uploadRef);
    if(!prior||typeof prior!=="object"||!("status" in prior))throw Error("Upload status unavailable");
    if("cleanVerified" in prior&&prior.cleanVerified===true){
     await refresh();setMessage("Original file was already validated.");return;
    }
   }
   const proposed=await json("intents",{method:"POST",body:JSON.stringify({
    applicationRef,sourceVersion:revision,classification:kind,requestKey:command.key,
    mime:selected.type,sizeBytes:selected.size,sha256:checksum
   })});
   if(!proposed||typeof proposed!=="object"||!("uploadRef" in proposed)||
    !("status" in proposed))
    throw Error("Private upload authorization was not confirmed.");
   intent=proposed as Intent;
   command.uploadRef=intent.uploadRef;
   if(intent.status==="VALIDATED"){
    await refresh();setMessage("Original file was already verified.");return;
   }
   if(intent.status!=="UPLOAD_READY"||!intent.uploadUrl||!intent.uploadHeaders)
    throw Error("Secure storage or malware verification is unavailable. No document was accepted.");
   if(!intent.uploadUrl.startsWith("https://"))
    throw Error("Secure upload address was not verified.");
   const stored=await fetch(intent.uploadUrl,{method:"PUT",headers:intent.uploadHeaders,
    body:bytes,cache:"no-store",credentials:"omit"});
   if(!stored.ok)throw Error("Document transfer could not be confirmed. Check the original upload status.");
   const checked=await json("intents/"+intent.uploadRef+"/confirm",{method:"POST"});
   if(!checked||typeof checked!=="object"||!("cleanVerified" in checked)||
    checked.cleanVerified!==true)
    throw Error("The original malware scan has not verified this file.");
   await refresh();onValidated?.();
   setMessage("Private evidence accepted after original checksum and malware verification.");
   setSelected(null);activeUpload.current=null;
  }catch(e){
   setProblem(e instanceof Error?e.message:"Secure file status is uncertain. Check it before retrying.");
  }finally{setBusy(false);}
 };
 return <section aria-label="Original private employee evidence"
  style={{padding:"1rem",borderRadius:12,background:"#F8FAFC",
   display:"grid",gap:12,border:"1px solid var(--cg-border)"}}>
  <header><h3 style={{margin:0,fontSize:"1rem"}}>Private employee documents</h3>
   <p style={{margin:"4px 0 0",color:"var(--cg-muted)",fontSize:13}}>
    Identity evidence is required for genuine Foundation review.
    Files remain private and are not accepted until storage and malware checks pass.
   </p>
  </header>
  {problem&&<p role="alert" style={{color:"#991B1B",margin:0}}>{problem}</p>}
  {message&&<p role="status" style={{color:"#166534",margin:0}}>{message}</p>}
  {loading?<p role="status">Checking verified documents…</p>:
   files.length?<ul style={{margin:0,paddingLeft:18}}>
    {files.map(file=><li key={file.fileRef}>
      {types.find(x=>x.value===file.classification)?.label??"Private evidence"}:
      {" "}{file.cleanVerified?"Verified":file.status.replaceAll("_"," ")}
      {file.sourceVersion!==revision?" (prior draft version)":""}
      {canManage&&file.cleanVerified&&file.sourceVersion===revision&&
       <button type="button" onClick={()=>void revoke(file)} disabled={busy}
        style={{marginLeft:10,border:"1px solid var(--cg-border)",background:"#fff",
         color:"#991B1B",borderRadius:8,padding:"5px 9px",cursor:"pointer"}}>
        Revoke unused proof</button>}
     </li>)}</ul>:<p style={{margin:0}}>No verified files for this application.</p>}
  {canManage&&<div style={{display:"grid",gap:10}}>
    <label style={{display:"grid",gap:5,fontWeight:600}}>Evidence category
     <select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setSelected(null);activeUpload.current=null;}}
      style={{padding:12,borderRadius:9,border:"1px solid var(--cg-border)"}}>
      {types.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}
     </select></label>
    <label style={{display:"grid",gap:5,fontWeight:600}}>Choose protected file
     <input key={kind} type="file" disabled={busy} accept={kind==="HR_PORTRAIT"?"image/jpeg,image/png":"application/pdf,image/jpeg,image/png,image/webp"}
      onChange={e=>{setSelected(e.target.files?.[0]??null);activeUpload.current=null;}}
      style={{padding:10,border:"1px solid var(--cg-border)",borderRadius:9}}/>
    </label>
    <button type="button" disabled={!selected||busy}
     onClick={()=>void upload()}
     style={{padding:12,border:0,borderRadius:10,background:"var(--cg-accent)",
      fontWeight:700,color:"#fff",cursor:"pointer"}}>
     {busy?"Checking private evidence…":"Upload and verify evidence"}</button>
  </div>}
  <button type="button" onClick={()=>void refresh()} disabled={loading}
   style={{background:"#fff",border:"1px solid var(--cg-border)",
    borderRadius:9,padding:10,cursor:"pointer"}}>Refresh document status</button>
 </section>;
}
