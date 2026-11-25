"use client";
import Link from "next/link";
import {ConsultationContribution} from "../healthcare-assistance/consultation-contribution";
import {useCallback,useEffect,useRef,useState} from "react";
type Booking={bookingRef:string;bookingId:string;doctorName:string;centerName:string;
 centerAddress:string;startAt:string;endAt:string;timeZone:string;
 bookingStatus:string;collectionStatus:string;paymentMode:string;
 consultationFeeMinor:string;version:number};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function PatientAppointmentDetail({bookingRef}:{bookingRef:string}){
 const [booking,setBooking]=useState<Booking|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [slip,setSlip]=useState<{status:string;canDownload:boolean}|null>(null);
 const [busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 const [downloadBusy,setDownloadBusy]=useState(false);
 const issueKey=useRef<string|null>(null);
 const [preview,setPreview]=useState<string|null>(null);
 const previewUrl=useRef<string|null>(null),previewGeneration=useRef(0);
 const refreshSequence=useRef(0);
 const clearPreview=useCallback(()=>{previewGeneration.current++;if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=null;setPreview(null);},[]);
 const refresh=useCallback(async()=>{
  const sequence=++refreshSequence.current;
  clearPreview();setBooking(null);setSlip(null);setError("");setLoading(true);
  try{
   if(document.visibilityState!=="visible")return;
   if(!ID.test(bookingRef))throw Error("This appointment link is invalid.");
   const response=await fetch("/api/consultations/me/"+bookingRef,{
    credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)});
   const data:unknown=await response.json().catch(()=>null);
   if(sequence!==refreshSequence.current)return;
   if(!response.ok)throw Error("The appointment cannot be checked. Sign in and try again.");
   if(!data||typeof data!=="object"||Array.isArray(data))throw Error("The selected appointment cannot be verified.");
   const value=data as Record<string,unknown>;
   if(value.bookingRef!==bookingRef||!["bookingId","doctorName","centerName","centerAddress","startAt","endAt","timeZone","bookingStatus","collectionStatus","paymentMode","consultationFeeMinor"].every(k=>typeof value[k]==="string")||
    !["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION","COMPLETED","NO_SHOW","CANCELLED"].includes(String(value.bookingStatus))||
    value.paymentMode!=="PAY_AT_CENTER"||
    value.collectionStatus!==(value.bookingStatus==="CANCELLED"?"NOT_COLLECTIBLE":"DUE_AT_CENTER")||
    typeof value.version!=="number"||!Number.isSafeInteger(value.version)||value.version<1||
    !Number.isFinite(Date.parse(String(value.startAt)))||!Number.isFinite(Date.parse(String(value.endAt)))||Date.parse(String(value.endAt))<=Date.parse(String(value.startAt))||
    !/^[0-9]+$/.test(String(value.consultationFeeMinor))||!Number.isSafeInteger(Number(value.consultationFeeMinor)))throw Error("The selected appointment cannot be verified.");
   new Intl.DateTimeFormat("en-IN",{timeZone:String(value.timeZone)});
   setBooking(data as Booking);
   const status=await fetch("/api/appointments/slips/me/"+bookingRef+"/status",{
    cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(12000)});
   const raw:unknown=status.ok?await status.json().catch(()=>null):null;
   if(sequence!==refreshSequence.current)return;
   if(raw&&typeof raw==="object"&&"status" in raw&&typeof raw.status==="string"&&"canDownload" in raw&&typeof raw.canDownload==="boolean")setSlip({status:raw.status,canDownload:raw.canDownload});
  }finally{if(sequence===refreshSequence.current)setLoading(false);}
 },[bookingRef,clearPreview]);
 useEffect(()=>{
  const check=()=>void refresh().catch(()=>setError("This consultation cannot currently be verified. Try again."));
  const onVisibility=()=>{
   if(document.visibilityState!=="visible"){refreshSequence.current++;clearPreview();setBooking(null);setSlip(null);setLoading(true);}
   else check();
  };
  check();document.addEventListener("visibilitychange",onVisibility);
  return()=>{document.removeEventListener("visibilitychange",onVisibility);refreshSequence.current++;previewGeneration.current++;if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=null;};
 },[refresh,clearPreview]);
 const activeBooking=!!booking&&!["CANCELLED","NO_SHOW"].includes(booking.bookingStatus);
 const canDownload=activeBooking&&slip?.status==="ISSUED"&&slip.canDownload===true;
 const canIssue=activeBooking&&!!slip&&(slip.status==="NOT_ISSUED"||(["PENDING","UNKNOWN"].includes(slip.status)&&!!issueKey.current));
 async function issue(){
  if(busy||unknown||!canIssue)return;
  setBusy(true);setError("");
  if(!issueKey.current)issueKey.current=crypto.randomUUID();
  try{
   const r=await fetch("/api/appointments/slips/me/"+bookingRef+"/issue",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:issueKey.current})});
   const value:unknown=await r.json().catch(()=>null);
   if(!r.ok)throw Error(value&&typeof value==="object"&&"message" in value&&
    typeof value.message==="string"?value.message:"The private PDF issue result is uncertain.");
   const state=value&&typeof value==="object"&&"status" in value&&"confirmed" in value&&value.confirmed===true?value.status:null;
   if(state!=="ISSUED"){
    setUnknown(true);setError("The private PDF issue is not confirmed. Check the current status.");
   }else{
    await refresh();setUnknown(false);
   }
  }catch(e){setUnknown(true);setError(e instanceof Error?e.message:"Slip issue status is uncertain.");}
  finally{setBusy(false);}
 }
 async function downloadPrivateSlip(mode:"download"|"preview"="download"){
  if(downloadBusy||busy||unknown||!canDownload||!ID.test(bookingRef))return;
  clearPreview();const generation=previewGeneration.current;
  setDownloadBusy(true);setError("");
  try{
   const issued=await fetch("/api/appointments/slips/me/"+
    encodeURIComponent(bookingRef)+"/download-grant",{
     method:"POST",cache:"no-store",credentials:"same-origin",
     headers:{"Content-Type":"application/json"},body:"{}"});
   const raw:unknown=await issued.json().catch(()=>null);
   if(!issued.ok||!raw||typeof raw!=="object"||!("grant" in raw)||
    typeof raw.grant!=="string"||
    !/^[0-9]{10}\.[a-f0-9]{64}$/.test(raw.grant))
    throw Error("The private slip download could not be authorized. Check its current status.");
   const url="/api/appointments/slips/me/"+encodeURIComponent(bookingRef)+
    "/restricted-file?grant="+encodeURIComponent(raw.grant);
   const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
   if(!response.ok||response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase()!=="application/pdf")
    throw Error("The current secure slip is no longer available. Refresh its status.");
   const bytes=await response.arrayBuffer();
   const view=new Uint8Array(bytes);
   if(view.length<100||view.length>10485760||
    view[0]!==37||view[1]!==80||view[2]!==68||view[3]!==70)
    throw Error("The verified appointment PDF could not be read.");
   if(generation!==previewGeneration.current)return;
   const privateUrl=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
   if(mode==="preview"){previewUrl.current=privateUrl;setPreview(privateUrl);return;}
   const a=document.createElement("a");
   a.href=privateUrl;a.download="careganga-consultation.pdf";
   a.rel="noopener noreferrer";a.click();
   setTimeout(()=>URL.revokeObjectURL(privateUrl),60000);
  }catch(e){setError(e instanceof Error?e.message:
   "The private PDF download could not be confirmed.");}
  finally{setDownloadBusy(false);}
 }
 const money=(s:string)=>new Intl.NumberFormat("en-IN",{
  style:"currency",currency:"INR"}).format(Number(s)/100);
 return <section className="cg-public-section cg-health-appointment-detail">
  <h1>My consultation</h1>
  {loading&&<p role="status">Checking this appointment…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {!loading&&<button type="button" disabled={busy||downloadBusy} onClick={()=>void refresh().catch(()=>setError("This consultation cannot currently be verified. Try again."))}>Refresh appointment status</button>}
  {booking&&<div className="cg-health-patient-layout"><div className="cg-health-document-panel">
   <h2>Booking ID: {booking.bookingId}</h2>
   <p><strong>Status:</strong> {booking.bookingStatus.replaceAll("_"," ")}</p>
   <p><strong>Doctor:</strong> {booking.doctorName}</p>
   <p><strong>Healthcare center:</strong> {booking.centerName}</p>
   <p>{booking.centerAddress}</p>
   <p><strong>Date/time:</strong> {new Date(booking.startAt).toLocaleString("en-IN",{
    timeZone:booking.timeZone,dateStyle:"full",timeStyle:"short"})} ({booking.timeZone})</p>
   <p><strong>Consultation fee:</strong> {money(booking.consultationFeeMinor)}</p>
   <p><strong>Payment status:</strong> {booking.collectionStatus.replaceAll("_"," ")}
    · {booking.paymentMode.replaceAll("_"," ")}</p>
   <ConsultationContribution bookingRef={bookingRef}/>
   <p>The healthcare center collects patient payments. Review the current collection status and any verified receipt below.</p>
   {["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION"].includes(booking.bookingStatus)&&
    <p><a href={"/api/consultations/me/"+encodeURIComponent(bookingRef)+"/calendar.ics"}>
     Add appointment to my calendar</a></p>}
   </div><section className="cg-health-document-panel" aria-label="Private appointment slip">
    <h3>My appointment slip</h3>
    <p>Private appointment PDF · one patient copy for pay-at-center.
     The QR code confirms booking status only.</p>
    {canDownload?
     <div><p><button className="primary" type="button" disabled={busy||unknown||downloadBusy} onClick={()=>void downloadPrivateSlip("preview")}>Preview private appointment slip</button></p><p><button type="button" disabled={busy||unknown||downloadBusy}
       onClick={()=>void downloadPrivateSlip()}>
       {downloadBusy?"Verifying private download…":"Download my private PDF & QR slip"}
      </button></p></div>:
     ["CANCELLED","NO_SHOW"].includes(booking.bookingStatus)?<p>This appointment has no current slip.</p>:canIssue?<button type="button" disabled={busy||unknown} onClick={()=>void issue()}>
      {busy?"Issuing…":"Issue my secure appointment slip"}</button>:<p role="status">The current private slip is not available. Refresh appointment status before trying again.</p>}
    {preview&&canDownload&&<div><iframe title="Private appointment slip PDF" src={preview} style={{width:"100%",height:500,border:"1px solid #bccfc6",borderRadius:8}}/><p><a href={preview} target="_blank" rel="noopener noreferrer">Open PDF in viewer to print</a></p><button type="button" onClick={clearPreview}>Close preview</button></div>}
    {unknown&&<button type="button" disabled={busy} onClick={()=>{clearPreview();void refresh()
     .then(()=>setUnknown(false)).catch(e=>setError(String(e)));}}>
     Check original document status</button>}
    <p>The QR reveals only whether this booking is currently valid.
     It does not identify the patient publicly.</p>
   <p><Link href="/patients/me">Back to my consultations</Link></p>
   </section>
  </div>}
 </section>;
}
