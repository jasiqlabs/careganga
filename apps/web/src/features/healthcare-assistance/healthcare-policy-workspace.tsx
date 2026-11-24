"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {HealthcarePolicyApprovalPanel} from "./healthcare-policy-approval-panel";

type Center={centerRef:string;name:string};
type Doctor={doctorRef:string;name:string};
type Kind="CONSULTATION"|"LAB"|"PHARMACY"|"NURSING"|"OT";
type Policy={policyRef:string;revisionRef:string;centerRef:string;
 doctorRef:string|null;serviceKind:Kind;revision:number;
 validFrom:string;validUntil:string;mode:"PERCENT"|"FIXED";
 percentBasisPoints:number|null;fixedMinor:string|null;capMinor:string;
 status:string;current:boolean;eligibility:string;createdAt:string;
 reviewCaseRef:string|null;reviewStatus:string|null};
type ServiceEstimate={state:"NO_APPROVED_SERVICE_POLICY"|"POLICY_ESTIMATE_ONLY";
 grossMinor:string;estimatedSupportMinor:string;estimatedPatientDueMinor:string;
 centerName:string;serviceKind:Kind;estimateOnly:true;
 caution:string;eligiblePatientVerified:false;invoiceVerified:false};
type Payload={requestKey:string;policyRef?:string;expectedRevision:number;
 centerRef:string;doctorRef:string|null;serviceKind:Kind;validFrom:string;
 validUntil:string;mode:"PERCENT"|"FIXED";percentBasisPoints?:number;
 fixedMinor?:string;capMinor:string};
const kinds:readonly Kind[]=["CONSULTATION","LAB","PHARMACY","NURSING","OT"];
type Props={canView:boolean;canManage:boolean;canReview:boolean};
type Estimate={state:"NO_APPROVED_FEE"|"NO_EFFECTIVE_POLICY"|"POLICY_ESTIMATE_ONLY";
 grossMinor?:string;estimatedSupportMinor?:string;estimatedPatientDueMinor?:string;
 actualFeeVersion?:number;policyRevisionRef?:string;eligiblePatientVerified:false;
 caution?:string};
async function api<T>(parts:string,method:"GET"|"POST"="GET",body?:object){
 const response=await fetch("/api/healthcare-assistance/policies/"+parts,{
  method,credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
 });
 if(!response.ok){
  const body:unknown=await response.json().catch(()=>null);
  const safe=body&&typeof body==="object"&&!Array.isArray(body)?
   body as Record<string,unknown>:null;
  const text=safe&&typeof safe.message==="string"&&
   safe.message.length>=16&&safe.message.length<=220&&
   !/[<>\r\n]/.test(safe.message)?safe.message:null;
  throw Object.assign(new Error(text??(
  response.status===401?"Staff session expired. Sign in again.":
  response.status===403?"You are not authorized to change healthcare assistance.":
  response.status===404?"Verified center, doctor or policy is unavailable.":
  response.status===409?"Policy dates or revision conflict. Refresh the original record.":
  response.status===400?"Check the valid dates, support amount and approved center.":
  "The policy outcome is uncertain. Check the original record; never submit a new request.")),
  {status:response.status});
 }
 return response.json() as Promise<T>;
}
function rupees(v:string){
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(v))
  throw Error("Enter a positive rupee amount with up to 2 paise digits.");
 const [whole,decimal=""]=v.split(".");
 const minor=BigInt(whole)*100n+BigInt((decimal+"00").slice(0,2));
 if(minor<1n||minor>10000000000n)
  throw Error("Amount is outside the approved policy limit.");
 return minor.toString();
}
const money=(v:string|null)=>v&&/^\d{1,11}$/.test(v)?
 "₹"+(Number(v)/100).toLocaleString("en-IN",{
  minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const when=(value:string)=>{
 const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))
  throw Error("Select valid starting and ending dates.");
 return d.toISOString();
};
const dateInput=(v:string)=>new Date(v).toISOString().slice(0,16);
const pct=(value:string)=>{
 if(!/^(?:[0-9]{1,2}(?:\.[0-9]{1,2})?|100(?:\.0{1,2})?)$/.test(value))
  throw Error("Percentage must be between 0.01 and 100 with two decimals.");
 const [whole,decimal=""]=value.split(".");
 const basis=Number(whole)*100+Number((decimal+"00").slice(0,2));
 if(basis<1||basis>10000)throw Error("Percentage outside approved range.");
 return basis;
};
export function HealthcarePolicyWorkspace({canView,canManage,canReview}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [doctors,setDoctors]=useState<Doctor[]>([]),[doctor,setDoctor]=useState("");
 const [policies,setPolicies]=useState<Policy[]>([]);
 const [estimate,setEstimate]=useState<Estimate|null>(null);
 const [quotedGross,setQuotedGross]=useState(""),
  [serviceEstimate,setServiceEstimate]=useState<ServiceEstimate|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const [mode,setMode]=useState<"PERCENT"|"FIXED">("PERCENT");
 const [service,setService]=useState<Kind>("CONSULTATION");
 const [percent,setPercent]=useState("50"),[fixed,setFixed]=useState(""),
  [cap,setCap]=useState("500"),[from,setFrom]=useState(""),
  [until,setUntil]=useState("");
 const [revision,setRevision]=useState<Policy|null>(null);
 const last=useRef<{parts:string;body:Payload;label:string}|null>(null);
 useEffect(()=>setEstimate(null),[center,doctor]);
 useEffect(()=>setServiceEstimate(null),[center,service,quotedGross]);
 const request=useRef(0);
 const refresh=useCallback(async(c:string)=>{
  const id=++request.current;
  const result=await api<{policies:Policy[]}>("centers/"+c);
  if(id===request.current)setPolicies(result.policies);
 },[]);
 useEffect(()=>{
  let active=true;
  if(!canView){setLoading(false);return()=>{active=false};}
  void api<{centers:Center[]}>("centers/eligible").then(v=>{
   if(!active)return;
   setCenters(v.centers);
   if(v.centers.length===1)setCenter(v.centers[0].centerRef);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Approved healthcare centers are unavailable.");})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;++request.current};
 },[canView]);
 useEffect(()=>{
  ++request.current;setPolicies([]);setDoctors([]);setDoctor("");
  setRevision(null);setUncertain(false);last.current=null;
  if(!center)return;
  setLoading(true);setError("");
  void Promise.all([
   refresh(center),
   api<{doctors:Doctor[]}>("centers/"+center+"/doctors").then(x=>setDoctors(x.doctors))
  ]).catch(e=>setError(e instanceof Error?e.message:"Current center policy unavailable."))
   .finally(()=>setLoading(false));
 },[center,refresh]);
 async function preview(){
  if(!center||!doctor||busy||uncertain)return;
  setBusy(true);setError("");setEstimate(null);
  try{
   const value=await api<Estimate>(
    "centers/"+center+"/doctors/"+doctor+"/estimate");
   setEstimate(value);
  }catch(e){setError(e instanceof Error?e.message:
   "Current fee and assistance source cannot be verified.");}
  finally{setBusy(false);}
 }
 async function previewPartnerService(){
  if(!center||service==="CONSULTATION"||busy||uncertain)return;
  setBusy(true);setError("");setServiceEstimate(null);
  try{
   const grossMinor=rupees(quotedGross);
   const result=await api<ServiceEstimate>(
    "centers/"+center+"/services/"+service+"/estimate?grossMinor="+grossMinor);
   if(result.estimateOnly!==true||result.serviceKind!==service)
    throw Error("The original partner estimate could not be verified.");
   setServiceEstimate(result);
  }catch(e){setError(e instanceof Error?e.message:
   "The verified partner policy estimate is unavailable.");}
  finally{setBusy(false);}
 }
 function edit(p:Policy){
  if(p.status!=="ACTIVE")return;
  setRevision(p);setMode(p.mode);setService(p.serviceKind);
  setDoctor(p.doctorRef??"");
  setPercent(p.percentBasisPoints===null?"50":(p.percentBasisPoints/100).toFixed(2));
  setFixed(p.fixedMinor?String(Number(p.fixedMinor)/100):"");
  setCap(String(Number(p.capMinor)/100));
  setFrom(dateInput(p.validFrom));setUntil(dateInput(p.validUntil));
  setMessage("Editing a new version. Previously accepted booking values remain unchanged.");
 }
 function clear(){
  setRevision(null);setMode("PERCENT");setService("CONSULTATION");
  setPercent("50");setFixed("");setCap("500");setFrom("");setUntil("");
 }
 async function commit(parts:string,body:object,label:string,retry=false){
  if(busy||!center||uncertain&&!retry)return;
  setBusy(true);setMessage("");setError("");
  try{
   const result=await api<{status:string;warning?:string;replayed?:boolean}>(
    parts,"POST",body);
   last.current=null;setUncertain(false);
   setMessage(result.status==="PENDING_APPROVAL"?
    result.warning??"Policy request recorded but not approved or effective.":
    label+(result.replayed?" Earlier request recovered.":""));
   try{await refresh(center);}catch{
    setMessage("Policy response recorded, but original list refresh failed.");}
   if(parts==="submit")clear();
  }catch(e){
   const s=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(s>=500);
   if(s<500)last.current=null;
   setError(e instanceof Error?e.message:"Policy result unconfirmed.");
  }finally{setBusy(false);}
 }
 function submit(e:FormEvent){
  e.preventDefault();
  if(!canManage||!center||uncertain)return;
  try{
   const validFrom=when(from),validUntil=when(until);
   if(new Date(validUntil)<=new Date(validFrom))
    throw Error("The ending date must be later than the starting date.");
   const body:Payload={requestKey:crypto.randomUUID(),
    ...(revision?{policyRef:revision.policyRef}:{}),
    expectedRevision:revision?.revision??0,centerRef:center,
    doctorRef:doctor||null,serviceKind:service,
    validFrom,validUntil,mode,
    ...(mode==="PERCENT"?{percentBasisPoints:pct(percent)}:
     {fixedMinor:rupees(fixed)}),
    capMinor:rupees(cap)};
   last.current={parts:"submit",body,label:"Assistance policy saved."};
   void commit("submit",body,"Assistance policy saved.");
  }catch(e){setError(e instanceof Error?e.message:"Check policy details.");}
 }
 function withdraw(p:Policy){
  if(!canManage||uncertain||p.status!=="ACTIVE")return;
  if(!window.confirm("Withdraw this healthcare assistance policy? "+
   "Existing accepted patient charges will keep their original policy snapshot."))return;
  const body={expectedRevision:p.revision};
  last.current=null;
  void commit(p.policyRef+"/withdraw",body,"Policy withdrawn.");
 }
 return <section className="form-section" aria-label="Foundation healthcare support policies">
  <h1>Foundation Contribution Policies</h1>
  <p>Configure assistance for a genuine approved center, and optionally a
   currently verified doctor. A displayed 50% value is only an editable
   starting point; no patient receives support until an effective policy and
   individual eligibility are verified. No money is collected here.</p>
  {!!message&&<p className="notice" role="status">{message}</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {canView&&<label className="field">Verified healthcare center
   <select value={center} disabled={busy||uncertain} onChange={e=>setCenter(e.target.value)}>
    <option value="">Select an approved center</option>
    {centers.map(v=><option key={v.centerRef} value={v.centerRef}>{v.name}</option>)}
   </select>
  </label>}
  {loading&&<p role="status">Checking original center and policy source…</p>}
  {canView&&!loading&&centers.length===0&&<p className="cg-module-empty">
   No eligible approved healthcare centers are available.</p>}
  {uncertain&&<section className="cg-diagnostics-card" role="alert">
   <p>Last policy command may already have been committed. Do not submit a
    new request with different details.</p>
   <div className="toolbar">
    <button type="button" disabled={busy||!last.current} onClick={()=>{
     const v=last.current;if(v)void commit(v.parts,v.body,v.label,true);
    }}>Retry the exact original request</button>
    <button type="button" disabled={busy||!center} onClick={()=>
     void refresh(center).catch(e=>setError(e instanceof Error?e.message:
      "Cannot check original policy state."))}>Check existing policy history</button>
   </div>
  </section>}
  {canManage&&canView&&!!center&&!uncertain&&<form className="cg-diagnostics-card"
   onSubmit={submit} aria-label="Original assistance policy">
   <h2>{revision?"Revise approved policy":"Configure healthcare support"}</h2>
   <h3>1. Service &amp; eligibility scope</h3>
   <div className="form-grid">
    <label className="field">Service type
     <select value={service} disabled={busy||!!revision}
      onChange={e=>{const kind=e.target.value as Kind;
       setService(kind);if(kind!=="CONSULTATION")setDoctor("");}}>
      {kinds.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}
     </select>
    </label>
    {service==="CONSULTATION"&&<label className="field">Verified doctor (optional center-wide rule)
     <select value={doctor} disabled={busy||!!revision}
      onChange={e=>setDoctor(e.target.value)}>
      <option value="">All eligible doctors at this center</option>
      {doctors.map(v=><option key={v.doctorRef} value={v.doctorRef}>{v.name}</option>)}
     </select>
    </label>}
    {!!doctor&&<div className="cg-diagnostics-card">
     <h3>Current verified fee estimate</h3>
     <p>Read-only illustration from the actual CG-14 fee and current approved
      support policy; never an accepted patient charge.</p>
     <button type="button" disabled={busy||uncertain}
      onClick={()=>void preview()}>Check current fee and cap</button>
     {estimate&&<p role="status">
      {estimate.state==="POLICY_ESTIMATE_ONLY"?
       "Actual gross "+money(estimate.grossMinor??null)+
       " · capped support "+money(estimate.estimatedSupportMinor??null)+
       " · estimated patient due "+money(estimate.estimatedPatientDueMinor??null)+
       ". Patient eligibility has NOT been verified.":
       estimate.state==="NO_EFFECTIVE_POLICY"?
       "Current approved fee exists, but no effective assistance policy applies.":
       "No currently approved consultation fee is available."}
     </p>}
    </div>}
    {service!=="CONSULTATION"&&<section className="cg-diagnostics-card">
     <h3>Estimated partner service contribution</h3>
     <p>Enter the partner's quoted gross total for an illustrative calculation.
      No retail invoice, patient consent, performed care, patient payment
      or Foundation liability has been verified by this estimate.</p>
     <label className="field">Partner-quoted gross amount (₹)
      <input inputMode="decimal" value={quotedGross} disabled={busy}
       onChange={e=>setQuotedGross(e.target.value)} placeholder="1000.00"/>
     </label>
     <button type="button" disabled={busy||uncertain||!quotedGross}
      onClick={()=>void previewPartnerService()}>
      Calculate provisional Foundation share</button>
     {serviceEstimate&&<p role="status">
      {serviceEstimate.state==="POLICY_ESTIMATE_ONLY"?
       "Quoted gross "+money(serviceEstimate.grossMinor)+
       " · estimated Foundation contribution "+money(serviceEstimate.estimatedSupportMinor)+
       " · estimated patient payable "+money(serviceEstimate.estimatedPatientDueMinor):
       "No current approved contribution; patient-quoted total "+
        money(serviceEstimate.grossMinor)}.
      {" "}{serviceEstimate.caution}
     </p>}
    </section>}
   </div>
   <h3>2. Contribution &amp; maximum support</h3>
   <div className="form-grid">
    <label className="field">Assistance type
     <select value={mode} disabled={busy} onChange={e=>
      setMode(e.target.value as "PERCENT"|"FIXED")}>
      <option value="PERCENT">Percentage</option>
      <option value="FIXED">Fixed rupee amount</option>
     </select>
    </label>
    {mode==="PERCENT"?<label className="field">Foundation support percentage
     <input value={percent} disabled={busy} required inputMode="decimal"
      onChange={e=>setPercent(e.target.value)} placeholder="50.00"/>
    </label>:<label className="field">Fixed support amount (₹)
     <input value={fixed} disabled={busy} required inputMode="decimal"
      onChange={e=>setFixed(e.target.value)}/>
    </label>}
    <label className="field">Maximum Foundation contribution (₹)
     <input required inputMode="decimal" disabled={busy} value={cap}
      onChange={e=>setCap(e.target.value)}/>
    </label>
   </div>
   <h3>3. Effective dates</h3>
   <div className="form-grid">
    <label className="field">Valid from (your local time)
     <input type="datetime-local" required disabled={busy} value={from}
      onChange={e=>setFrom(e.target.value)}/>
    </label>
    <label className="field">Valid until (your local time)
     <input type="datetime-local" required disabled={busy} value={until}
      onChange={e=>setUntil(e.target.value)}/>
    </label>
   </div>
   <p>Eligibility: patient identity and consent must be verified by the
    original CG-15 source when a real appointment is charged. All non-consultation policies and 100% consultation
    support require separate genuine CG-03 protected approval and owner finalization.
    No medicine, nursing or OT amount is payable without real completed service proof.
    Unavailable laboratory, pharmacy, nursing and OT integrations remain
    pending, not a published offer.</p>
   <div className="toolbar">
    <button className="primary" type="submit" disabled={busy}>
     {busy?"Checking original policy…":revision?"Save policy revision":"Create policy"}</button>
    {revision&&<button type="button" disabled={busy} onClick={clear}>
     Cancel revision</button>}
   </div>
  </form>}
  {canView&&!!center&&<section className="form-section">
   <h2>Actual policy revisions</h2>
   <button type="button" disabled={busy||uncertain} onClick={()=>
    void refresh(center).catch(e=>setError(e instanceof Error?e.message:
     "Original policy history is unavailable."))}>Refresh history</button>
   {policies.length===0&&!loading?<p className="cg-module-empty">
    No assistance policy has been recorded for this center.</p>:
   <div className="table-wrap"><table className="role-table">
    <thead><tr><th>Service / scope</th><th>Support</th><th>Cap</th>
     <th>Effective period</th><th>Source status</th><th>Action</th></tr></thead>
    <tbody>{policies.map(p=><tr key={p.revisionRef}>
     <td>{p.serviceKind} · {p.doctorRef?
      doctors.find(d=>d.doctorRef===p.doctorRef)?.name??"Verified doctor":"Center-wide"}</td>
     <td>{p.mode==="PERCENT"?(p.percentBasisPoints??0)/100+"%":
      money(p.fixedMinor)}</td>
     <td>{money(p.capMinor)}</td>
     <td>{new Date(p.validFrom).toLocaleDateString("en-IN")} to
      {" "+new Date(p.validUntil).toLocaleDateString("en-IN")}</td>
     <td>{p.status==="ACTIVE"&&p.current?"Effective":
      p.status==="ACTIVE"?"Approved, outside active dates":
      p.status==="PENDING_APPROVAL"?"Not effective — independent approval pending":
      p.status.toLowerCase().replaceAll("_"," ")}</td>
     <td>{canManage&&p.status==="ACTIVE"&&<>
      <button type="button" disabled={busy||uncertain} onClick={()=>edit(p)}>
       Revise</button>
      <button type="button" disabled={busy||uncertain} onClick={()=>withdraw(p)}>
       Withdraw</button>
     </>}</td>
    </tr>)}</tbody>
   </table></div>}
  </section>}
  <HealthcarePolicyApprovalPanel canReview={canReview} canManage={canManage}
   pendingPolicies={policies} onChanged={async()=>{
    if(center)await refresh(center);
   }}/>
 </section>;
}
