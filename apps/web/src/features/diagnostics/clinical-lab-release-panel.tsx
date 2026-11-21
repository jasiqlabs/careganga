"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Status={resultRef:string;reportDigest:string;releaseState:string;
 patientDownloadAvailable:boolean;
 notificationStates?:{channel:string;state:string}[];
 notificationDelivered?:boolean};
type Props={centerRef:string;orderRef:string};
const base="/api/lab-clinical/";
async function api<T>(path:string,body?:object):Promise<T>{
 const res=await fetch(base+path,{method:body?"POST":"GET",
  credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(
  res.status===404?"Wait for the independent clinician's report approval.":
  res.status===403?"Your current lab role or clinical license is not authorized.":
  res.status===409?"The approved PDF changed. Check the original report.":
  "The original release state could not be confirmed. Check before retrying."),
  {status:res.status});
 return res.json() as Promise<T>;
}
/** One separate click to release an already approved original PDF.
 * No digital signature, second password, document copy or notification. */
export function ClinicalLabReleasePanel({centerRef,orderRef}:Props){
 const [status,setStatus]=useState<Status|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const key=useRef<string|null>(null);
 const path="centers/"+centerRef+"/orders/"+orderRef+"/release";
 const refresh=useCallback(async()=>{
  const x=await api<Status>(path);
  if(!x||typeof x.resultRef!=="string"||
   !/^[a-f0-9]{64}$/.test(x.reportDigest)||
   typeof x.patientDownloadAvailable!=="boolean")
   throw Error("Approved report status is incomplete.");
  setStatus(x);
  if(x.patientDownloadAvailable){setUncertain(false);key.current=null;}
 },[path]);
 useEffect(()=>{
  let live=true;
  void refresh().catch(e=>{if(live)setMessage(e instanceof Error?e.message:
   "Approved clinician report not yet ready.");});
  return()=>{live=false};
 },[refresh]);
 async function release(){
  if(busy||uncertain||!status||status.patientDownloadAvailable)return;
  if(!window.confirm("Release this approved laboratory PDF to its verified patient?"))
   return;
  key.current??=crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const result=await api<{patientDownloadAvailable:boolean}>(path,{
    requestKey:key.current,resultRef:status.resultRef,
    reportDigest:status.reportDigest});
   if(result.patientDownloadAvailable!==true)
    throw Error("The original release was not confirmed.");
   key.current=null;setUncertain(false);
   setMessage("Approved report released. The patient can download the PDF securely.");
   await refresh();
  }catch(e){
   const http=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(http>=500);
   if(http<500)key.current=null;
   setMessage(e instanceof Error?e.message:"Release result uncertain.");
  }finally{setBusy(false);}
 }
 return <section className="cg-diagnostics-card">
  <h3>Release approved laboratory report</h3>
  <p>No digital signature is required. Only an already independently approved
   PDF can be released to the verified patient.</p>
  {!!message&&<p role="status">{message}</p>}
  {status?.patientDownloadAvailable?
   <p role="status">Released to the patient's private reports.</p>:
   status&&!uncertain&&<button type="button" disabled={busy}
    onClick={()=>void release()}>{busy?"Releasing…":"Release approved PDF"}</button>}
  {uncertain&&<p role="alert">The release may have succeeded.
   Check the original state before another action.</p>}
  <button type="button" disabled={busy}
   onClick={()=>void refresh().catch(e=>setMessage(e instanceof Error?
    e.message:"The report is not ready."))}>Refresh release status</button>
 </section>;
}
