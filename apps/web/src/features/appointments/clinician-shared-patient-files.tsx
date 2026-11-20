"use client";
import {useEffect,useRef,useState} from "react";
type Item={fileRef:string;classification:string;mime:string;
 sizeBytes:number;createdAt:string};
type List={bookingRef:string;files:Item[]};
/** Only assigned clinician sees this panel, but CG01+CG14+CG15+CG19
 * backend verifies exact booked doctor, center, checked-in patient, current
 * consent, original verified scanned file and active explicit grant.
 */
export function ClinicianSharedPatientFiles({centerRef,bookingRef}:{
 centerRef:string;bookingRef:string
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [files,setFiles]=useState<Item[]>([]);
 const [message,setMessage]=useState("");
 const active=useRef<string|null>(null);
 const serial=useRef(0);
 const root="/api/patient-clinical-files/centers/"+encodeURIComponent(centerRef)+
  "/bookings/"+encodeURIComponent(bookingRef)+"/files";
 const cleanup=()=>{
  if(active.current)URL.revokeObjectURL(active.current);
  active.current=null;
 };
 useEffect(()=>{
  serial.current++;cleanup();setOpen(false);setFiles([]);setMessage("");
  return()=>{serial.current++;cleanup();};
 },[centerRef,bookingRef]);
 async function readList(){
  const stamp=++serial.current;setBusy(true);setMessage("");
  try{
   const res=await fetch(root,{credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error(res.status===403||res.status===404?
    "Your current clinician identity or patient consent does not permit access.":
    "Patient-authorized scanned files are temporarily unavailable.");
   const data=await res.json() as List;
   if(stamp!==serial.current||data.bookingRef!==bookingRef)return;
   setFiles(data.files);
  }catch(e){if(stamp===serial.current){
   setFiles([]);setMessage(e instanceof Error?e.message:
    "File-sharing status cannot be checked.");}}
  finally{if(stamp===serial.current)setBusy(false);}
 }
 async function download(item:Item){
  const stamp=++serial.current;setBusy(true);setMessage("");cleanup();
  try{
   // Never use file IDs from other bookings or a signed public GET link.
   const res=await fetch(root+"/"+encodeURIComponent(item.fileRef)+"/download",{
    credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error("Current clinician, file grant or patient-care consent has changed.");
   const mime=res.headers.get("Content-Type")?.split(";")[0]??"";
   if(mime!==item.mime)throw Error("Private scanned file type changed.");
   const blob=await res.blob();
   if(blob.size<1||blob.size>10485760)
    throw Error("Original private file size could not be verified.");
   if(stamp!==serial.current)return;
   const url=URL.createObjectURL(blob);active.current=url;
   const a=document.createElement("a");a.href=url;
   a.download="CareGanga-patient-provided"+(
    mime==="application/pdf"?".pdf":mime==="image/jpeg"?".jpg":
    mime==="image/png"?".png":".webp");
   document.body.append(a);a.click();a.remove();
   setMessage("A current authorized download was requested. Never distribute the patient's copy without permission.");
  }catch(e){if(stamp===serial.current)
   setMessage(e instanceof Error?e.message:"Current document is unavailable.");}
  finally{if(stamp===serial.current)setBusy(false);}
 }
 return <section className="form-section" aria-label="Patient-authorized scanned documents">
  <button type="button" aria-expanded={open} disabled={busy}
   onClick={()=>{if(open){
    serial.current++;cleanup();setOpen(false);setFiles([]);setMessage("");setBusy(false);
   }else{setOpen(true);void readList();}}}>
   {open?"Hide patient-shared files":"Patient-shared scanned files"}
  </button>
  {open&&<>
   <p>Only files explicitly shared by this verified patient for this
    appointment are accessible to the assigned doctor after check-in.
    These are patient-supplied copies, never CareGanga-issued prescriptions.</p>
   {!!message&&<p role="status">{message}</p>}
   {busy&&<p role="status">Rechecking current clinician and consent access…</p>}
   {!busy&&files.length===0&&<p>No currently authorized patient files to display.</p>}
   {files.map(item=><div className="notice" key={item.fileRef}>
    <p><strong>{item.classification.replaceAll("_"," ")}</strong> ·
     {" "+Math.ceil(item.sizeBytes/1024)} KB</p>
    <button type="button" disabled={busy} onClick={()=>void download(item)}>
     Download current authorized patient copy</button>
   </div>)}
   <button type="button" disabled={busy} onClick={()=>void readList()}>
    Refresh active patient grants</button>
  </>}
 </section>;
}
