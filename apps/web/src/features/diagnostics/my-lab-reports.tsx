"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Report={releaseRef:string;orderLabel:string;reportVersion:number;
 releasedAt:string;superseded?:boolean;approvedByClinician:true};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function validReport(raw:unknown):raw is Report{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const x=raw as Record<string,unknown>;
 return typeof x.releaseRef==="string"&&ID.test(x.releaseRef)&&
  typeof x.orderLabel==="string"&&x.orderLabel.trim().length>0&&
  typeof x.reportVersion==="number"&&Number.isSafeInteger(x.reportVersion)&&x.reportVersion>0&&
  typeof x.releasedAt==="string"&&Number.isFinite(Date.parse(x.releasedAt))&&
  x.approvedByClinician===true&&(x.superseded===undefined||typeof x.superseded==="boolean");
}
export function MyLabReports(){
 const [items,setItems]=useState<Report[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(""),[complete,setComplete]=useState(false);
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++sequence.current;
  setItems([]);setMessage("");setComplete(false);setLoading(true);setBusy(false);
  try{
   if(document.visibilityState!=="visible")return;
   const r=await fetch("/api/lab-patient-reports/me",{
    cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error(r.status===401||r.status===403?
    "Sign in with your verified patient account and current consent to see released lab reports.":
    "Your current released lab reports are unavailable.");
   const value:unknown=await r.json();
   if(!value||typeof value!=="object"||Array.isArray(value)||!("reports" in value)||
    !Array.isArray(value.reports)||value.reports.length>50||!value.reports.every(validReport)||
    new Set(value.reports.map(x=>x.releaseRef)).size!==value.reports.length||
    !("complete" in value)||typeof value.complete!=="boolean")throw Error("Private reports could not be verified.");
   if(current===sequence.current){setItems(value.reports);setComplete(value.complete);}
  }catch(e){if(current===sequence.current)setMessage(e instanceof Error?e.message:"Your private reports are unavailable.");}
  finally{if(current===sequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{
  const visibility=()=>{
   if(document.visibilityState!=="visible"){
    sequence.current++;setItems([]);setMessage("");setComplete(false);setLoading(true);setBusy(false);
   }else void refresh();
  };
  void refresh();document.addEventListener("visibilitychange",visibility);
  return()=>{sequence.current++;document.removeEventListener("visibilitychange",visibility);};
 },[refresh]);
 async function download(report:Report){
  if(busy||loading||document.visibilityState!=="visible"||!items.some(x=>x.releaseRef===report.releaseRef))return;
  const current=sequence.current;setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/lab-patient-reports/me/"+encodeURIComponent(report.releaseRef)+"/pdf",{
    credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!r.ok||r.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/pdf")
    throw Error("This released report cannot be downloaded from your account.");
   const bytes=await r.arrayBuffer();
   if(bytes.byteLength<5||bytes.byteLength>10485760||
    new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")
    throw Error("Your protected PDF is unavailable.");
   if(current!==sequence.current||document.visibilityState!=="visible")return;
   const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
   const a=document.createElement("a");a.href=url;
   a.download="CareGanga-Lab-Report.pdf";a.rel="noopener noreferrer";a.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(e){if(current===sequence.current)setMessage(e instanceof Error?e.message:
   "This private report is currently unavailable.");}
  finally{if(current===sequence.current)setBusy(false);}
 }
 return <section className="cg-diagnostics-card cg-private-lab-reports" aria-label="My released lab reports">
  <h2>My lab reports</h2>
  <p>Only laboratory PDFs released by an authorized clinician appear here.
   Reports are private and available only through your patient account.</p>
  {loading&&<p role="status">Checking your released reports…</p>}
  {!!message&&<p role="alert">{message}</p>}
  {!loading&&!message&&!items.length&&complete&&<p>No lab reports have been released to your account yet.</p>}
  {!loading&&!message&&!complete&&<p role="status">Only the latest available reports are listed. Contact the Foundation for older reports.</p>}
  {items.map(x=><article key={x.releaseRef}>
   <div><strong>{x.orderLabel}</strong><p>Report version {x.reportVersion} · Released {new Date(x.releasedAt).toLocaleDateString("en-IN")}</p>
   {x.superseded&&<strong>Earlier version — corrected report available</strong>}</div>
   <button type="button" disabled={busy||loading} onClick={()=>void download(x)}>Download PDF</button>
  </article>)}
  <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Refresh reports</button>
 </section>;
}
