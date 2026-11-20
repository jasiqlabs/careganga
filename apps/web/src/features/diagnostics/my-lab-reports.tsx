"use client";
import {useCallback,useEffect,useState} from "react";
type Report={releaseRef:string;orderLabel:string;reportVersion:number;
 releasedAt:string};
type Response={reports:Report[];complete:boolean};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function MyLabReports(){
 const [items,setItems]=useState<Report[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  const r=await fetch("/api/lab-patient-reports/me",{
   cache:"no-store",credentials:"same-origin"});
  if(!r.ok)throw Error(r.status===401?
   "Sign in to your private patient account to see released lab reports.":
   "Your current released lab reports are unavailable.");
  const value:unknown=await r.json();
  if(!value||typeof value!=="object"||!("reports" in value)||
   !Array.isArray(value.reports))throw Error("Private reports could not be verified.");
  setItems((value as Response).reports.filter(x=>ID.test(x.releaseRef)));
 },[]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(e=>{if(active)setMessage(e instanceof Error?e.message:
   "Your private reports are unavailable.")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[refresh]);
 async function download(report:Report){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/lab-patient-reports/me/"+report.releaseRef+"/pdf",{
    credentials:"same-origin",cache:"no-store"});
   if(!r.ok||r.headers.get("content-type")?.split(";")[0]!=="application/pdf")
    throw Error("This released report cannot be downloaded from your account.");
   const bytes=await r.arrayBuffer();
   if(bytes.byteLength<5||bytes.byteLength>10485760||
    new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")
    throw Error("Your protected PDF is unavailable.");
   const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
   const a=document.createElement("a");a.href=url;
   a.download="CareGanga-Lab-Report.pdf";a.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(e){setMessage(e instanceof Error?e.message:
   "This private report is currently unavailable.");}
  finally{setBusy(false)}
 }
 return <section className="cg-diagnostics-card" aria-label="My released lab reports">
  <h2>My lab reports</h2>
  <p>Only laboratory PDFs released by an authorized clinician appear here.
   Reports are private and available only through your patient account.</p>
  {loading&&<p role="status">Checking your released reports…</p>}
  {!!message&&<p role="alert">{message}</p>}
  {!loading&&!items.length&&<p>No lab reports have been released to your account yet.</p>}
  {items.map(x=><article key={x.releaseRef}>
   <strong>{x.orderLabel}</strong> · Report version {x.reportVersion}
   <span> · Released {new Date(x.releasedAt).toLocaleDateString("en-IN")}</span>
   <button type="button" disabled={busy}
    onClick={()=>void download(x)}>Download PDF</button>
  </article>)}
  <button type="button" disabled={busy||loading}
   onClick={()=>void refresh().catch(e=>setMessage(e instanceof Error?e.message:
    "Unable to refresh your reports."))}>Refresh reports</button>
 </section>;
}
