"use client";
import {useEffect,useState} from "react";
type Original={fileRef:string;fileVersion:number;mime:string;sizeBytes:number;createdAt:string};
export function FoundationSupportAttachments({caseRef}:{caseRef:string}){
 const [files,setFiles]=useState<Original[]>([]);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const route="/api/support/cases/"+encodeURIComponent(caseRef)+"/attachments";
 async function load(signal?:AbortSignal){
  setBusy(true);setNotice("");
  try{
   const r=await fetch(route,{cache:"no-store",credentials:"same-origin",signal});
   if(!r.ok)throw Error(r.status===403?
    "Your current role cannot view private support attachments.":
    "The original support attachment list could not be checked.");
   const data:unknown=await r.json();
   if(!data||typeof data!=="object"||!("files" in data)||
    !Array.isArray(data.files))throw Error("Original private file list is unavailable.");
   if(!signal?.aborted)setFiles(data.files.filter((v:unknown):v is Original=>
    !!v&&typeof v==="object"&&"fileRef" in v&&"mime" in v&&
    typeof v.fileRef==="string"&&typeof v.mime==="string").slice(0,20));
  }catch(e){if(!signal?.aborted){setFiles([]);setNotice(e instanceof Error?
    e.message:"The original private file list could not be confirmed.");}}
  finally{if(!signal?.aborted)setBusy(false);}
 }
 useEffect(()=>{const controller=new AbortController();
  void load(controller.signal);return()=>controller.abort();},[caseRef]);
 return <section className="permission-group" aria-labelledby="support-center-files">
  <h3 id="support-center-files">Center support attachments (private)</h3>
  <p>Files belong to this original Foundation support case. Access requires your
   current support role; scanned files are never public.</p>
  {!!notice&&<p role="alert">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void load()}>
   {busy?"Checking…":"Refresh attachments"}</button>
  {!busy&&files.length===0&&<p>No verified attachments in this case.</p>}
  <ul>{files.map((file,i)=><li key={file.fileRef}>
   <a href={route+"/files/"+encodeURIComponent(file.fileRef)} download>
    Download attachment {i+1} ({file.mime.includes("pdf")?"PDF":"image"},
    {Math.ceil(file.sizeBytes/1024)} KB)
   </a>
  </li>)}</ul>
 </section>;
}
