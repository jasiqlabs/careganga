"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {PatientClinicalFileShares} from "./patient-clinical-file-shares";

type Class="PATIENT_PHOTO"|"PATIENT_UPLOADED_PRESCRIPTION"|"PATIENT_MEDICAL_REPORT";
type PatientFile={fileRef:string;classification:Class;mime:string;
 sizeBytes:number;version:number;revoked:boolean;createdAt:string};
type RecordPage={files:PatientFile[];next:string|null};
type Intent={uploadRef:string;status:string;uploadReady?:boolean;
 uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null};
const root="/api/patient-private-files/";
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const r=await fetch(root+path,{
  method,cache:"no-store",credentials:"same-origin",
  ...(method==="POST"?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body??{})}:{})
 });
 if(!r.ok)throw Error(r.status===401?"Patient sign-in expired. Please sign in again.":
  r.status===403||r.status===404?"This patient file cannot be accessed with your current account.":
  r.status===409?"The original file changed. Check its current status.":
  "Secure patient file status is unavailable. Check the original request.");
 return await r.json() as T;
}
/** Real CG19 storage, verified scanner and own CG01 patient-account source.
 * These are patient-supplied private scanned files, NOT generated prescriptions.
 */
export function PatientPrivateFilesPanel({consentGranted}:{consentGranted:boolean}){
 const [rows,setRows]=useState<PatientFile[]>([]),[next,setNext]=useState<string|null>(null);
 const [kind,setKind]=useState<Class>("PATIENT_MEDICAL_REPORT");
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [intent,setIntent]=useState<string|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const key=useRef<string|null>(null),alive=useRef(true);
 const activeBlob=useRef<string|null>(null);
 const cleanup=()=>{if(activeBlob.current)URL.revokeObjectURL(activeBlob.current);
  activeBlob.current=null;};
 const load=useCallback(async(after?:string)=>{
  const r=await request<RecordPage>("files"+(after?
   "?after="+encodeURIComponent(after):""));
  setRows(old=>after?[...old,...r.files]:r.files);setNext(r.next);
  setLoaded(true);
 },[]);
 useEffect(()=>{
  alive.current=true;void load().catch(()=>{
   if(alive.current)setError("Private file history cannot be checked.");
  });
  return()=>{alive.current=false;cleanup();};
 },[load]);
 function choose(f:File|null){
  if(busy||uncertain)return;
  setFile(f);setNotice("");setError("");setIntent(null);
  key.current=crypto.randomUUID();
 }
 async function currentIntent(){
  if(!intent||busy)return;
  setBusy(true);setError("");
  try{
   const data=await request<Intent>("intents/"+encodeURIComponent(intent));
   setUncertain(data.status!=="REJECTED"&&data.status!=="VALIDATED");
   setNotice(data.cleanVerified?
    "Original patient document passed real private storage and malware verification.":
    "Original secure upload state: "+data.status+". No unverified file is available.");
   await load();
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "Original upload status cannot be verified.");}
  finally{setBusy(false);}
 }
 async function upload(){
  if(!file||busy||uncertain||!consentGranted)return;
  if(file.size<1||file.size>10485760||
   !["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)||
   kind==="PATIENT_PHOTO"&&file.type==="application/pdf"){
   setError("Choose a supported private JPG, PNG, WebP or PDF file up to 10 MB.");
   return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const bytes=await file.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))
    .map(v=>v.toString(16).padStart(2,"0")).join("");
   if(!key.current)key.current=crypto.randomUUID();
   const started=await request<Intent>("intents","POST",{
    requestKey:key.current,classification:kind,mime:file.type,
    sizeBytes:file.size,sha256:hash
   });
   if(!started.uploadRef)throw Error("Secure private upload did not return an original reference.");
   setIntent(started.uploadRef);
   if(!started.uploadReady||!started.uploadUrl||!started.uploadHeaders){
    setUncertain(true);
    setNotice("Secure storage is unavailable. The file is not accepted; check the original upload status.");
    return;
   }
   if(!started.uploadUrl.startsWith("https://")||
    started.uploadHeaders["Content-Type"]!==file.type)
    throw Error("Secure storage permission could not be verified.");
   const sent=await fetch(started.uploadUrl,{method:"PUT",
    headers:started.uploadHeaders,body:file,credentials:"omit",
    cache:"no-store",mode:"cors"});
   if(!sent.ok)throw Error("Private upload outcome is uncertain; check original reference.");
   const confirmed=await request<Intent>("intents/"+
    encodeURIComponent(started.uploadRef)+"/confirm","POST");
   if(!confirmed.cleanVerified||!confirmed.fileRef){
    setUncertain(true);
    setNotice("The scanner has not verified this file. It will remain unavailable until verified.");
    return;
   }
   setNotice("Your scanned patient document is privately stored and verified.");
   setFile(null);setIntent(null);setUncertain(false);key.current=null;
   await load();
  }catch(e){
   setUncertain(true);
   setError(e instanceof Error?e.message:
    "The file result is uncertain. Check your original upload before trying again.");
  }finally{setBusy(false);}
 }
 async function openFile(row:PatientFile){
  if(busy||row.revoked)return;
  setBusy(true);setError("");cleanup();
  try{
   const response=await fetch(root+"files/"+
    encodeURIComponent(row.fileRef)+"/download",{
    credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("Current patient authorization or private file is unavailable.");
   const mime=response.headers.get("Content-Type")?.split(";")[0]??"";
   if(mime!==row.mime)throw Error("The original private document changed. Refresh.");
   const data=await response.blob();
   if(data.size<1||data.size>10485760)
    throw Error("The original private file failed validation.");
   const href=URL.createObjectURL(data);activeBlob.current=href;
   const a=document.createElement("a");a.href=href;
   a.download="CareGanga-private-"+row.fileRef+(mime==="application/pdf"?".pdf":
    mime==="image/jpeg"?".jpg":mime==="image/png"?".png":".webp");
   document.body.append(a);a.click();a.remove();
   // Browser download may continue after click; revoke in teardown/next
   // action, not immediately before the browser can read the object.
   setNotice("Current authorized private file download was requested.");
  }catch(e){setError(e instanceof Error?e.message:"Private download unavailable.");}
  finally{setBusy(false);}
 }
 async function revoke(row:PatientFile){
  if(busy||row.revoked)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await request<{status:string}>(
    "files/"+encodeURIComponent(row.fileRef)+"/revoke","POST",
    {expectedVersion:row.version});
   if(response.status!=="REVOKED")throw Error("File revocation was not confirmed.");
   cleanup();await load();
   setNotice("This patient's original file is revoked. Prior external copies cannot be recalled.");
  }catch(e){setError(e instanceof Error?e.message:"File revocation result uncertain.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="My privately scanned patient documents">
  <h2>My private health documents</h2>
  <p>Upload your own scanned photo, existing prescription copy or medical report.
   These documents do not become a CareGanga-issued prescription or diagnosis.
   Files remain private until the original storage provider independently
   confirms a clean malware scan.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {consentGranted?<div className="form-grid">
   <label>Document type
    <select value={kind} disabled={busy||uncertain} onChange={e=>{
     if(!busy)setKind(e.target.value as Class);}}>
     <option value="PATIENT_MEDICAL_REPORT">My scanned medical report</option>
     <option value="PATIENT_UPLOADED_PRESCRIPTION">My existing prescription copy</option>
     <option value="PATIENT_PHOTO">My private patient photo</option>
    </select>
   </label>
   <label>Private document (PDF/JPG/PNG/WebP, max 10 MB)
    <input type="file" accept={kind==="PATIENT_PHOTO"?
     ".jpg,.jpeg,.png,.webp":".pdf,.jpg,.jpeg,.png,.webp"}
     disabled={busy||uncertain} onChange={e=>choose(e.target.files?.[0]??null)}/>
   </label>
   <div className="toolbar">
    <button type="button" disabled={busy||uncertain||!file}
     onClick={()=>void upload()}>{busy?"Checking…":"Upload and scan privately"}</button>
    {intent&&<button type="button" disabled={busy}
     onClick={()=>void currentIntent()}>Check original upload</button>}
   </div>
  </div>:
  <p>Patient-care consent is withdrawn. No new private document uploads are permitted.
   Your own legally retained documents may still be viewed or revoked after verification.</p>}
  <h3>My verified private documents</h3>
  {!loaded&&<p role="status">Checking your current private file history…</p>}
  {loaded&&rows.length===0&&<p>No verified patient documents have been uploaded.</p>}
  {rows.map(row=><div className="notice" key={row.fileRef}>
   <strong>{row.classification==="PATIENT_PHOTO"?"Patient photo":
    row.classification==="PATIENT_MEDICAL_REPORT"?"Scanned medical report":
    "Patient-supplied prescription copy"}</strong>
   <p>{new Date(row.createdAt).toLocaleString("en-IN")} ·
    {row.revoked?" Revoked":" Privately verified"} ·
    {" "+(row.sizeBytes/1024).toFixed(0)} KB</p>
   {!row.revoked&&<PatientClinicalFileShares fileRef={row.fileRef}
    consentGranted={consentGranted}/>}
   {!row.revoked&&<div className="toolbar">
    <button type="button" disabled={busy} onClick={()=>void openFile(row)}>
     Download my private file</button>
    <button type="button" disabled={busy}
     onClick={()=>{if(window.confirm("Revoke new access to this original private file?"))void revoke(row);}}>
     Revoke access</button>
   </div>}
  </div>)}
  {!!next&&<button type="button" disabled={busy}
   onClick={()=>void load(next).catch(()=>setError("Older files unavailable."))}>
   Show older private files</button>}
 </section>;
}
