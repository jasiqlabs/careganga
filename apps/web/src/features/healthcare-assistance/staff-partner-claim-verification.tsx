"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Mode="foundation"|"partner";
type Detail={
 claimCode:string;serviceKind:string;serviceDate:string;
 quotedGrossMinor:string;estimatedFoundationMinor:string;
 estimatedPatientPayableMinor:string;partnerAttestedPatientMinor:string;
 foundationApprovedMinor:string;state:string;canAttest:boolean;canDecide:boolean;
 partnerPaymentBasis:string|null;completionEvidenceRequired?:boolean;
 paymentEvidenceSubmitted?:boolean;foundationJournalPosted:boolean;
 foundationLiabilityRecognized:boolean;providerPaidVerified:false;caution:string
};
type Props={centerRef:string;claimCode:string;mode:Mode;onChanged:()=>Promise<void>};
const fmt=(minor:string)=>"₹"+(Number(BigInt(minor))/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
const rupees=(minor:string)=>((Number(BigInt(minor)))/100).toFixed(2);
const paise=(value:string)=>{
 const match=/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/.exec(value.trim());
 if(!match)throw Error("Enter the actual partner-collected amount in rupees.");
 return (BigInt(match[1])*100n+
  BigInt((match[2]??"").padEnd(2,"0"))).toString();
};
const path=(mode:Mode,center:string,code:string,suffix="")=>
 "/api/healthcare-assistance/partner-verification/"+mode+
 "/centers/"+encodeURIComponent(center)+"/claims/"+encodeURIComponent(code)+suffix;
async function call<T>(url:string,post?:object):Promise<T>{
 const res=await fetch(url,{method:post?"POST":"GET",cache:"no-store",
  credentials:"same-origin",...(post?{
   headers:{"Content-Type":"application/json"},body:JSON.stringify(post)}:{})});
 if(!res.ok){
  const obj:unknown=await res.json().catch(()=>null);
  const msg=obj&&typeof obj==="object"&&!Array.isArray(obj)&&
   "message" in obj&&typeof obj.message==="string"?
   obj.message:"The protected claim source could not be confirmed.";
  throw Error(msg);
 }
 return res.json() as Promise<T>;
}
/** No patient identity, internal UUID, unscanned private URL, or fake bank status.
 * The reviewer must download and inspect the actual original source files.
 */
export function StaffPartnerClaimVerification({centerRef,claimCode,mode,onChanged}:Props){
 const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [collected,setCollected]=useState(""),[method,setMethod]=useState("CASH_ATTESTED");
 const [reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [seen,setSeen]=useState<string[]>([]);
 const attempt=useRef<{hash:string;key:string}|null>(null);
 const load=useCallback(async()=>{
  const r=await call<Detail>(path(mode,centerRef,claimCode));
  if(r.claimCode!==claimCode||typeof r.state!=="string"||
   typeof r.canAttest!=="boolean"||typeof r.canDecide!=="boolean")
   throw Error("Original claim verification cannot be confirmed.");
  setDetail(r);
  return r;
 },[mode,centerRef,claimCode]);
 useEffect(()=>{let mounted=true;setDetail(null);setSeen([]);setError("");
  setNotice("");setUncertain(false);attempt.current=null;
  void load().then(v=>{if(mounted)setCollected(rupees(v.estimatedPatientPayableMinor));})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:
    "Original partner claim not available.");});
  return()=>{mounted=false;};
 },[load]);
 const refresh=async()=>{
  if(busy)return;setBusy(true);setError("");
  try{await load();setUncertain(false);await onChanged();}
  catch(e){setError(e instanceof Error?e.message:"Original claim status unavailable.");}
  finally{setBusy(false);}
 };
 async function inspect(kind:"invoice"|"completion"|"payment"){
  if(busy)return;setBusy(true);setError("");
  try{
   const res=await fetch(path("foundation",centerRef,claimCode,"/evidence/"+kind),{
    credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error(res.status===403?
    "Only an authorized independent Foundation reviewer can read this evidence.":
    "Scanned document is not verified or was withdrawn. Refresh.");
   const mime=res.headers.get("Content-Type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
    throw Error("Original scanned file type is unavailable.");
   const blob=await res.blob();
   if(blob.size<1||blob.size>10485760)
    throw Error("Original private file size cannot be confirmed.");
   const suffix=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":
    mime==="image/png"?"png":"webp";
   const url=URL.createObjectURL(blob);
   try{
    const link=document.createElement("a");
    link.href=url;link.download="CareGanga-"+kind+"-review."+suffix;
    link.rel="noopener";document.body.append(link);link.click();link.remove();
   }finally{URL.revokeObjectURL(url);}
   setSeen(current=>current.includes(kind)?current:[...current,kind]);
   setNotice("Original "+kind+" source downloaded for independent review. "+
    "Confirm authenticity before deciding.");
  }catch(e){setError(e instanceof Error?e.message:
   "Private source cannot be independently inspected.");}
  finally{setBusy(false);}
 }
 async function submit(action:"ATTEST"|"APPROVE"|"REJECT"){
  if(busy||uncertain||!detail)return;
  setBusy(true);setError("");setNotice("");
  try{
   const payload:Record<string,unknown>=action==="ATTEST"?{
    collectedMinor:paise(collected),paymentMethod:method,
    invoiceChecked:true,servicePerformed:true
   }:{action,reason:reason.trim(),currentPassword:password};
   if(action==="ATTEST"&&String(payload.collectedMinor)!==detail.estimatedPatientPayableMinor)
    throw Error("Use the exact amount actually collected from the patient. "+
     "A mismatch must be corrected in the original invoice before approval.");
   if(action!=="ATTEST"&&(reason.trim().length<12||password.length<8))
    throw Error("Provide a meaningful review reason and your current password.");
   const fingerprint=JSON.stringify([mode,centerRef,claimCode,action,payload]);
   if(attempt.current?.hash!==fingerprint)
    attempt.current={hash:fingerprint,key:crypto.randomUUID()};
   const suffix=action==="ATTEST"?"/attest":"/decide";
   const result=await call<Detail>(path(mode,centerRef,claimCode,suffix),{
    ...payload,requestKey:attempt.current.key
   });
   if(result.claimCode!==claimCode||typeof result.state!=="string")
    throw Error("The original review outcome cannot be verified.");
   setDetail(result);setPassword("");attempt.current=null;
   setUncertain(false);await onChanged();
   setNotice(action==="ATTEST"?
    "Original partner service/collection attestation recorded; independent Foundation review remains required.":
    action==="APPROVE"?
    "Protected approval recorded. CG09 accounting and actual bank reimbursement remain separate.":
    "The original claim was not approved. It was not made payable.");
  }catch(e){setUncertain(true);
   setError(e instanceof Error?e.message:
    "The outcome is uncertain. Check the original claim, then retry the same request.");
  }finally{setBusy(false);}
 }
 if(!detail)return <div className="notice">
  {!!error?<p role="alert">{error}</p>:<p>Checking current claim verification…</p>}
  <button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh original claim</button>
 </div>;
 const proofNeeded=detail.state==="PARTNER_ATTESTED"&&detail.canDecide;
 const allSeen=seen.includes("invoice")&&
  (detail.serviceKind==="PHARMACY"||seen.includes("completion"))&&
  (detail.partnerPaymentBasis!=="ELECTRONIC_EVIDENCE"||seen.includes("payment"));
 return <div className="notice" aria-label="Original partner claim verification">
  <h4>Claim {detail.claimCode}</h4>
  <p>Service {detail.serviceKind} · {detail.serviceDate} ·
   original bill {fmt(detail.quotedGrossMinor)} ·
   provisional patient contribution {fmt(detail.estimatedPatientPayableMinor)} ·
   approved Foundation contribution {fmt(detail.foundationApprovedMinor)}</p>
  <p>Status: <strong>{detail.state.replaceAll("_"," ").toLowerCase()}</strong>.
   {detail.caution}</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  {mode==="partner"&&detail.canAttest&&detail.state==="PENDING_VERIFICATION"&&
   <div className="form-grid">
    <p>Confirm only a genuinely supplied invoice, completed service and actual patient
     payment that the partner received directly. No Foundation money is collected here.</p>
    <label>Actually collected from patient (₹)
     <input inputMode="decimal" value={collected} disabled={busy||uncertain}
      onChange={e=>setCollected(e.target.value)}/></label>
    <label>Payment proof basis
     <select value={method} disabled={busy||uncertain}
      onChange={e=>setMethod(e.target.value)}>
      <option value="CASH_ATTESTED">Cash actually received and partner-attested</option>
      <option value="ELECTRONIC_EVIDENCE" disabled={!detail.paymentEvidenceSubmitted}>
       Electronic transfer with patient-submitted scanned receipt</option>
     </select></label>
    <button type="button" disabled={busy||uncertain} onClick={()=>void submit("ATTEST")}>
     {busy?"Checking…":"Attest actual service and patient collection"}</button>
   </div>}
  {proofNeeded&&<div className="form-grid">
   <p>Review the original privately scanned invoice and evidence. An independent
    Foundation protected reviewer must inspect every required document and
    re-enter their own password before approving any Foundation liability.</p>
   <div className="toolbar">
    <button type="button" disabled={busy} onClick={()=>void inspect("invoice")}>
     Inspect scanned partner invoice</button>
    {detail.serviceKind!=="PHARMACY"&&<button type="button" disabled={busy}
     onClick={()=>void inspect("completion")}>Inspect actual service proof</button>}
    {detail.partnerPaymentBasis==="ELECTRONIC_EVIDENCE"&&<button type="button"
     disabled={busy} onClick={()=>void inspect("payment")}>Inspect payment receipt</button>}
   </div>
   <label>Independent review reason
    <textarea value={reason} maxLength={500} disabled={busy||uncertain}
     onChange={e=>setReason(e.target.value)}
     placeholder="Explain the evidence reviewed and verification decision"/></label>
   <label>Current protected Foundation password
    <input type="password" autoComplete="current-password" value={password}
     disabled={busy||uncertain} onChange={e=>setPassword(e.target.value)}/></label>
   <div className="toolbar">
    <button type="button" disabled={busy||uncertain||!allSeen||reason.trim().length<12||
      password.length<8} onClick={()=>void submit("APPROVE")}>
     Approve verified source and record Foundation liability</button>
    <button type="button" disabled={busy||uncertain||reason.trim().length<12||
      password.length<8} onClick={()=>void submit("REJECT")}>
     Reject unsupported claim</button>
   </div>
  </div>}
  {uncertain&&<p role="alert">The previous write may have succeeded. Do not create
   another claim. Check this original claim status before retrying the exact request.</p>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   Refresh original claim status</button>
 </div>;
}
