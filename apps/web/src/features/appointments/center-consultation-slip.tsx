"use client";
import {useRef,useState} from "react";
type Result={status:string;documentRef:string|null;canDownload:boolean;issuedAt:string|null};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function call<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await fetch("/api/appointments/staff-slips/"+path,{
  method,cache:"no-store",credentials:"same-origin",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(raw&&typeof raw==="object"&&"message" in raw&&
  typeof raw.message==="string"?raw.message:"Original consultation slip could not be verified.");
 return raw as T;
}
/** One clicked-on-demand lookup per center-owned booking. The server checks
 * the actual current center affiliation, visit capability and patient consent
 * on every issue/status/download; this UI never guesses from booking IDs.
 */
export function CenterConsultationSlip({bookingRef,bookingStatus}:{
 bookingRef:string;bookingStatus:string
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const [record,setRecord]=useState<Result|null>(null);
 const requestKey=useRef("");
 const path=encodeURIComponent(bookingRef);
 async function status(){
  if(!ID.test(bookingRef)||busy)return;
  setBusy(true);setMessage("");
  try{
   const result=await call<Result>(path+"/status");
   setRecord(result);setUncertain(false);
   setMessage(result.canDownload?"Original consultation slip is available.":
    "The latest consultation slip has not been issued.");
  }catch(e){setMessage(e instanceof Error?e.message:"Private consultation slip is unavailable.");}
  finally{setBusy(false);}
 }
 async function issue(){
  if(!ID.test(bookingRef)||busy||uncertain)return;
  if(!requestKey.current)requestKey.current=crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const result=await call<{status:string;confirmed:boolean}>(path+"/issue","POST",
    {requestKey:requestKey.current});
   const current=await call<Result>(path+"/status");
   setRecord(current);
   if(result.confirmed===true&&current.canDownload){
    setUncertain(false);setMessage("Original private consultation PDF is ready.");
   }else{
    setUncertain(true);
    setMessage("PDF generation outcome is uncertain. Check original slip status before requesting another.");
   }
  }catch(e){
   setUncertain(true);
   setMessage((e instanceof Error?e.message:"Private PDF issue is uncertain.")+
    " Check original slip status before requesting a different issue reference.");
  }finally{setBusy(false);}
 }
 if(!ID.test(bookingRef)||bookingStatus==="CANCELLED"||bookingStatus==="NO_SHOW")
  return null;
 return <section aria-label="Original private consultation slip" style={{marginTop:8}}>
  <button type="button" disabled={busy} onClick={()=>{
   if(open){setOpen(false);return;}
   setOpen(true);void status();
  }}>{open?"Hide consultation slip":"Consultation slip"}</button>
  {open&&<div style={{padding:12,border:"1px solid #d7dfdb",borderRadius:8}}>
   <p>Only this center's assigned staff can see the current consented appointment slip.
    This is not a consultation receipt or payment confirmation.</p>
   {message&&<p role={uncertain?"alert":"status"}>{message}</p>}
   <button type="button" disabled={busy} onClick={()=>void status()}>
    {busy?"Checking…":"Check original slip status"}</button>
   {record?.canDownload&&
    <a href={"/api/appointments/staff-slips/"+path+"/file"}
     target="_blank" rel="noopener noreferrer">Open private consultation PDF</a>}
   {record?.status==="NOT_ISSUED"&&!uncertain&&
    <button type="button" disabled={busy} onClick={()=>void issue()}>
     Issue current consultation slip</button>}
   {record&&!record.canDownload&&record.status!=="NOT_ISSUED"&&
    <p role="status">This original document is in {record.status.toLowerCase()} state.
     Check its status; no new issue request will be made automatically.</p>}
   {uncertain&&<p role="alert">Keep the same original request reference.
    Refresh the status before generating any new document.</p>}
  </div>}
 </section>;
}
