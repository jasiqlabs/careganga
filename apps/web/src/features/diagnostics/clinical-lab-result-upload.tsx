"use client";
import {useRef,useState,type ChangeEvent} from "react";

type Prepare={uploadRef:string;status:string;uploadReady:boolean;
 uploadUrl?:string;uploadHeaders?:Record<string,string>;message?:string};
type Verification={uploadRef:string;status:string;cleanVerified?:boolean;
 professionallyReleased?:boolean};
type Props={centerRef:string;orderRef:string;onVerified:()=>Promise<void>};
const MAX_PDF_BYTES=10*1024*1024;
async function json<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await fetch("/api/lab-clinical/"+path,{
  method,cache:"no-store",credentials:"same-origin",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
 });
 const value:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(value&&typeof value==="object"&&
  "message" in value&&typeof value.message==="string"?value.message:
  "The report verification result is unavailable. Check the existing upload.");
 return value as T;
}
function safePdf(file:File|null):file is File{
 return !!file&&file.size>0&&file.size<=MAX_PDF_BYTES&&
  file.name.toLowerCase().endsWith(".pdf")&&
  (file.type===""||file.type==="application/pdf");
}
async function checksum(file:File){
 const bytes=await file.arrayBuffer();
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
export function ClinicalLabResultUpload({centerRef,orderRef,onVerified}:Props){
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [state,setState]=useState("NOT_UPLOADED");
 const intent=useRef<string|null>(null);
 const original=useRef<{requestKey:string;sizeBytes:number;sha256:string;mime:string}|null>(null);
 const base="centers/"+centerRef+"/orders/"+orderRef+"/reports";
 async function check(){
  if(!intent.current)return;
  setBusy(true);setError("");
  try{
   const result=await json<Verification>(base+"/"+intent.current+"/status");
   setState(result.status);
   if(result.cleanVerified){
    setNotice("PDF uploaded and security-scan verified. Clinical review, professional release and patient delivery are NOT complete.");
    try{await onVerified();}catch{setError("Report verified, but the latest order view could not be refreshed.");}
   }else setNotice("Report is not yet scan-verified. No professional approval or release has occurred.");
  }catch(e){setError(e instanceof Error?e.message:"The original upload cannot be checked.");}
  finally{setBusy(false);}
 }
 async function upload(){
  if(!safePdf(file)||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const sha256=await checksum(file);
   const payload=original.current??{requestKey:crypto.randomUUID(),
    sizeBytes:file.size,sha256,mime:"application/pdf"};
   if(payload.sha256!==sha256||payload.sizeBytes!==file.size)
    throw Error("The selected PDF has changed. Refresh this page and start a new report upload.");
   original.current=payload;
   const reserved=await json<Prepare>(base+"/prepare","POST",payload);
   intent.current=reserved.uploadRef;
   setState(reserved.status);
   if(!reserved.uploadReady||!reserved.uploadUrl||!reserved.uploadHeaders){
    setNotice(reserved.message??"Storage is unavailable. No report has been verified or released.");
    return;
   }
   const destination=new URL(reserved.uploadUrl);
   if(destination.protocol!=="https:"||destination.username||destination.password||
      destination.hash)throw Error("The secure upload destination cannot be verified.");
   const response=await fetch(destination.toString(),{method:"PUT",body:file,
    headers:reserved.uploadHeaders,cache:"no-store",redirect:"error",
    credentials:"omit",mode:"cors"});
   if(!response.ok)throw Error("The PDF upload could not be confirmed. Check the same original upload before trying again.");
   setState("UPLOADED_UNVERIFIED");
   setNotice("PDF transferred. Waiting for the private storage and malware-scan checks; it is NOT a clinically approved report.");
   const verified=await json<Verification>(base+"/"+reserved.uploadRef+"/confirm","POST");
   setState(verified.status);
   if(verified.cleanVerified){
    setNotice("Private PDF uploaded and scanner-verified. Professional approval, release and patient delivery are still pending.");
    try{await onVerified();}catch{
     setError("Scan verified, but the latest order view could not be refreshed.");
    }
   }else setNotice("Verification was not completed. Check the original upload status; do not start another report.");
  }catch(e){
   setError(e instanceof Error?e.message:"This report's upload outcome is uncertain.");
  }finally{setBusy(false);}
 }
 const change=(e:ChangeEvent<HTMLInputElement>)=>{
  const next=e.target.files?.[0]??null;
  if(original.current||intent.current){
   setError("An upload was already started. Check its status instead of replacing the file.");
   return;
  }
  setFile(next);setError(next&&!safePdf(next)?"Choose a PDF smaller than 10 MB.":"");
 };
 return <section className="cg-diagnostics-card" aria-label="Private clinical report upload">
  <h3>Upload private lab report (original PDF)</h3>
  <p>Only authorized clinical staff may upload a PDF for this order. File transfer and
   malware scanning do not mean a qualified professional has approved, signed,
   released or delivered the medical report.</p>
  <label className="field">Report PDF (up to 10 MB)
   <input type="file" accept="application/pdf,.pdf" onChange={change}
    disabled={busy||!!intent.current}/>
  </label>
  <div className="toolbar">
   <button type="button" className="primary"
    disabled={busy||!safePdf(file)||["RESULT_READY","VALIDATED","REJECTED","UPLOADED_UNVERIFIED","VERIFICATION_UNAVAILABLE"].includes(state)}
    onClick={()=>void upload()}>
    {busy?"Checking secure report…":intent.current?"Retry same original upload":"Upload and verify PDF"}</button>
   {intent.current&&<button type="button" disabled={busy} onClick={()=>void check()}>
    Check existing upload</button>}
  </div>
  <p role="status">Report evidence: {state.replaceAll("_"," ").toLowerCase()}.
   Clinical approval: not performed. Patient release: not performed.</p>
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
 </section>;
}
