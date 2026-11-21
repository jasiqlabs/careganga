"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Kind="PHARMACY"|"NURSING"|"OT";
type Choice={centerRef:string;centerName:string;kind:Kind};
type FileItem={fileRef:string;classification:string;revoked:boolean;createdAt:string};
type Page={files:FileItem[];next:string|null};
type Claim={claimCode:string;serviceKind:Kind;invoiceNumber:string;
 serviceDate:string;quotedGrossMinor:string;estimatedFoundationMinor:string;
 estimatedPatientPayableMinor:string;state:"PENDING_VERIFICATION";
 guidance:string;submittedAt:string};
type Response={claims:Claim[];complete:boolean};
const money=(v:string)=>"₹"+(Number(BigInt(v))/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
async function get<T>(url:string):Promise<T>{
 const r=await fetch(url,{cache:"no-store",credentials:"same-origin"});
 const value:unknown=await r.json().catch(()=>null);
 if(!r.ok){
  const item=value&&typeof value==="object"&&"message" in value?value as {message:unknown}:null;
  throw Error(item&&typeof item.message==="string"?item.message:
   "The original claim or scanned documents could not be checked.");
 }
 return value as T;
}
async function post<T>(url:string,body:unknown):Promise<T>{
 const r=await fetch(url,{method:"POST",cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const value:unknown=await r.json().catch(()=>null);
 if(!r.ok){
  const item=value&&typeof value==="object"&&"message" in value?value as {message:unknown}:null;
  throw Error(item&&typeof item.message==="string"?item.message:
   "The outcome is uncertain. Check your existing claim before retrying.");
 }
 return value as T;
}
const paise=(v:string)=>{
 const match=/^([1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/.exec(v.trim());
 if(!match)throw Error("Enter a valid positive amount in rupees, up to two decimals.");
 const amount=BigInt(match[1])*100n+BigInt((match[2]??"").padEnd(2,"0"));
 if(amount>10000000000n)throw Error("The service amount exceeds the allowed limit.");
 return amount.toString();
};
/** An authenticated patient's original CG19 upload is a claim candidate,
 * not evidence of paid cash, completed care or Foundation entitlement.
 */
export function PatientPartnerClaims({consentGranted}:{consentGranted:boolean}){
 const [choices,setChoices]=useState<Choice[]>([]);
 const [files,setFiles]=useState<FileItem[]>([]),[next,setNext]=useState<string|null>(null);
 const [rows,setRows]=useState<Claim[]>([]);
 const [selected,setSelected]=useState(""),[invoice,setInvoice]=useState("");
 const [date,setDate]=useState(""),[gross,setGross]=useState("");
 const [invoiceFile,setInvoiceFile]=useState(""),[proofFile,setProofFile]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const request=useRef<{digest:string;key:string}|null>(null);
 const refresh=useCallback(async()=>{
  const [services,scans,claims]=await Promise.all([
   get<{services:Choice[]}>("/api/partner-claims/eligible-services"),
   get<Page>("/api/patient-private-files/files"),
   get<Response>("/api/partner-claims/mine")
  ]);
  if(!Array.isArray(services.services)||!Array.isArray(scans.files)||
    !Array.isArray(claims.claims))throw Error("The original partner records could not be verified.");
  setChoices(services.services);setFiles(scans.files);setNext(scans.next);
  setRows(claims.claims);setUncertain(false);
 },[]);
 useEffect(()=>{let active=true;void refresh().catch(e=>{
  if(active)setError(e instanceof Error?e.message:"Partner claims are unavailable.");
 });return()=>{active=false;};},[refresh]);
 const chosen=choices.find(c=>c.centerRef+"|"+c.kind===selected);
 const invoices=files.filter(f=>f.classification==="PATIENT_PARTNER_INVOICE"&&!f.revoked);
 const proofs=files.filter(f=>f.classification==="PATIENT_PARTNER_SERVICE_PROOF"&&!f.revoked);
 function resetReplay(){request.current=null;setUncertain(false);setNotice("");setError("");}
 async function loadOlder(){
  if(!next||busy)return;
  setBusy(true);setError("");
  try{
   const page=await get<Page>("/api/patient-private-files/files?after="+encodeURIComponent(next));
   setFiles(prev=>[...prev,...page.files]);setNext(page.next);
  }catch(e){setError(e instanceof Error?e.message:"Older files could not be loaded.");}
  finally{setBusy(false);}
 }
 async function send(){
  if(busy||!consentGranted||!chosen||!invoiceFile)return;
  setBusy(true);setError("");setNotice("");
  try{
   const body={
    centerRef:chosen.centerRef,serviceKind:chosen.kind,
    invoiceNumber:invoice.trim(),serviceDate:date,grossMinor:paise(gross),
    invoiceFileRef:invoiceFile,
    ...(chosen.kind==="PHARMACY"?{}:{completionFileRef:proofFile})
   };
   if(chosen.kind!=="PHARMACY"&&!proofFile)
    throw Error("Upload and select a scanned completed-service document.");
   const digest=JSON.stringify(body);
   if(request.current?.digest!==digest)
    request.current={digest,key:crypto.randomUUID()};
   const result=await post<Claim>("/api/partner-claims/mine",{
    ...body,requestKey:request.current.key
   });
   if(result.state!=="PENDING_VERIFICATION"||!result.claimCode)
    throw Error("The submission state could not be verified.");
   setNotice("Claim "+result.claimCode+" received for independent review. "+
    "No patient payment or Foundation reimbursement is approved yet.");
   setUncertain(false);await refresh();
  }catch(e){
   setUncertain(true);
   setError(e instanceof Error?e.message:
    "The outcome is uncertain. Check your own claim history before retrying.");
  }finally{setBusy(false);}
 }
 return <section aria-label="My partner-service claims" className="cg-diagnostics-card">
  <h2>My pharmacy, nursing and procedure benefit claims</h2>
  <p>Use this only after receiving a real invoice from a verified CareGanga partner.
   Upload the invoice under <strong>My private health documents</strong> first.
   For nursing or procedures also upload evidence that the service was actually performed.
   Submitted files and amounts require independent Foundation verification.
   This form does not record or confirm payment.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {consentGranted?<div className="form-grid">
   <label>Verified partner and service
    <select value={selected} disabled={busy} onChange={e=>{
     setSelected(e.target.value);resetReplay();}}>
     <option value="">Choose a currently approved partner</option>
     {choices.map(o=><option key={o.centerRef+"|"+o.kind}
      value={o.centerRef+"|"+o.kind}>{o.centerName} — {o.kind==="OT"?"Procedure / OT":o.kind==="PHARMACY"?"Pharmacy":"Nursing"}</option>)}
    </select>
   </label>
   <label>Partner invoice number
    <input value={invoice} maxLength={60} disabled={busy}
     onChange={e=>{setInvoice(e.target.value);resetReplay();}}
     placeholder="Printed on your original invoice"/></label>
   <label>Actual service/purchase date
    <input type="date" value={date} disabled={busy}
     onChange={e=>{setDate(e.target.value);resetReplay();}}/></label>
   <label>Invoice total before assistance (₹)
    <input inputMode="decimal" value={gross} maxLength={12}
     disabled={busy} onChange={e=>{setGross(e.target.value);resetReplay();}}
     placeholder="1000.00"/></label>
   <label>My verified scanned invoice
    <select value={invoiceFile} disabled={busy} onChange={e=>{
     setInvoiceFile(e.target.value);resetReplay();}}>
     <option value="">Choose my verified invoice</option>
     {invoices.map((f,i)=><option value={f.fileRef} key={f.fileRef}>
      Invoice document {i+1} — {new Date(f.createdAt).toLocaleDateString("en-IN")}</option>)}
    </select>
   </label>
   {chosen?.kind!=="PHARMACY"&&<label>Verified scanned evidence of completed care
    <select value={proofFile} disabled={busy} onChange={e=>{
     setProofFile(e.target.value);resetReplay();}}>
     <option value="">Choose completed-service evidence</option>
     {proofs.map((f,i)=><option key={f.fileRef} value={f.fileRef}>
      Service document {i+1} — {new Date(f.createdAt).toLocaleDateString("en-IN")}</option>)}
    </select>
   </label>}
   {!!next&&<button type="button" disabled={busy} onClick={()=>void loadOlder()}>
    Find older verified documents</button>}
   <div className="toolbar">
    <button type="button" disabled={busy||uncertain||!chosen||!invoiceFile||
     !invoice.trim()||!date||!gross||
     (chosen.kind!=="PHARMACY"&&!proofFile)} onClick={()=>void send()}>
     {busy?"Verifying original sources…":"Submit evidence for Foundation review"}</button>
    {uncertain&&<button type="button" disabled={busy} onClick={()=>
     void refresh().catch(e=>setError(e instanceof Error?e.message:
      "Current claim history is unavailable."))}>
     Check my original claims before retrying</button>}
   </div>
  </div>:<p>Grant patient-care consent in your profile before submitting any new claim.</p>}
  <h3>My submitted partner claims</h3>
  {rows.length===0?<p>No submitted partner claims.</p>:
   rows.map(c=><div className="notice" key={c.claimCode}>
    <strong>{c.claimCode}</strong> · {c.serviceKind} · {c.invoiceNumber}
    <p>{c.serviceDate} · Quoted invoice {money(c.quotedGrossMinor)} ·
     provisional Foundation share {money(c.estimatedFoundationMinor)} ·
     provisional patient amount {money(c.estimatedPatientPayableMinor)}</p>
    <p><strong>Awaiting independent verification.</strong> {c.guidance}</p>
   </div>)}
 </section>;
