"use client";
import {useState,type FormEvent} from "react";
type Kind="HOSPITAL"|"CLINIC"|"DIAGNOSTIC_LAB"|"DOCTOR"|"PHARMACY"|"NURSING"|"SURGERY_CENTER";
type Fields={partnerType:Kind;applicantName:string;contactName:string;
 contactPhone:string;contactEmail:string;registrationNumber:string;
 addressLine:string;districtName:string;stateName:string;pinCode:string;
 consentAccepted:boolean};
type Sent=Fields&{requestKey:string};
type Receipt={reference:string;receipt:string;status:string};
const kinds:{code:Kind;label:string}[]=[
 {code:"HOSPITAL",label:"Hospital"},{code:"CLINIC",label:"Clinic"},
 {code:"DIAGNOSTIC_LAB",label:"Diagnostic laboratory"},
 {code:"DOCTOR",label:"Doctor / medical professional"},
 {code:"PHARMACY",label:"Pharmacy"},{code:"NURSING",label:"Nursing service provider"},
 {code:"SURGERY_CENTER",label:"OT / procedure provider (hospital or clinic)"}
];
const empty:Fields={partnerType:"HOSPITAL",applicantName:"",
 contactName:"",contactPhone:"",contactEmail:"",registrationNumber:"",
 addressLine:"",districtName:"",stateName:"",pinCode:"",consentAccepted:false};
async function call(action:"apply"|"status",body:unknown){
 const response=await fetch("/api/public/healthcare-partners/"+action,{
  method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
  body:JSON.stringify(body)});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const message=data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:
   "The result is uncertain. Check the private reference before retrying.";
  throw new Error(message);
 }
 if(!data||typeof data!=="object"||!("reference" in data)||
  typeof data.reference!=="string"||!("status" in data)||
  typeof data.status!=="string")throw new Error("The result could not be verified.");
 return data as Receipt;
}
const label=(type:Kind)=>type==="DOCTOR"?"Doctor's full name":"Organization / facility name";
export function HealthcarePartnerApplication(){
 const [fields,setFields]=useState<Fields>(empty);
 const [mode,setMode]=useState<"apply"|"check">("apply");
 const [sent,setSent]=useState<Sent|null>(null);
 const [result,setResult]=useState<Receipt|null>(null);
 const [tracking,setTracking]=useState("");
 const [checked,setChecked]=useState<{reference:string;status:string}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const update=<K extends keyof Fields,>(key:K,value:Fields[K])=>{
  if(!sent&&!result)setFields(prev=>({...prev,[key]:value}));
 };
 async function send(payload:Sent){
  if(busy)return;
  setError("");setBusy(true);
  try{
   const r=await call("apply",payload);
   if(!r.receipt||!/^[A-Za-z0-9_-]{43}$/.test(r.receipt))throw Error("Unverified receipt");
   setResult(r);setSent(null);
  }catch(e){
   setError(e instanceof Error?e.message:"The result is uncertain.");
  }finally{setBusy(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||result||sent)return;
  const payload={...fields,requestKey:crypto.randomUUID()};
  setSent(payload);
  void send(payload);
 }
 async function check(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setError("");setChecked(null);setBusy(true);
  try{
   const data=await call("status",{receipt:tracking.trim()});
   setChecked({reference:data.reference,status:data.status});
  }catch(e){setError(e instanceof Error?e.message:"Unable to verify the application.");}
  finally{setBusy(false);}
 }
 const txt=(key:Exclude<keyof Fields,"partnerType"|"consentAccepted">,
  title:string,required=false,extra:{type?:string;maxLength?:number;placeholder?:string}={})=>
  <label style={{display:"grid",gap:5}} key={key}>{title}
   <input name={key} value={fields[key] as string}
    type={extra.type??"text"} maxLength={extra.maxLength??120}
    placeholder={extra.placeholder} required={required}
    disabled={busy||!!sent||!!result}
    onChange={e=>update(key,e.target.value)} /></label>;
 return <div style={{maxWidth:760,display:"grid",gap:16}}>
  <nav aria-label="Application actions" style={{display:"flex",flexWrap:"wrap",gap:12}}>
   <button type="button" disabled={busy||!!sent}
    aria-current={mode==="apply"?"page":undefined}
    onClick={()=>{setMode("apply");setError("");}}>Apply as partner</button>
   <button type="button" disabled={busy||!!sent}
    aria-current={mode==="check"?"page":undefined}
    onClick={()=>{setMode("check");setError("");}}>Check application status</button>
  </nav>
  {mode==="apply"&&result?<section aria-live="polite"
    style={{border:"1px solid #d7dfdb",borderRadius:14,padding:20}}>
   <h2>Application received</h2>
   <p>Your reference: <strong>{result.reference}</strong></p>
   <p>Status: <strong>Pending Foundation review</strong>.
    We will contact you using the details you supplied.</p>
   <p>Save your private tracking code. It is needed to check the application status.
    Do not share it publicly.</p>
   <p style={{overflowWrap:"anywhere",fontFamily:"monospace"}}>{result.receipt}</p>
   <button type="button" onClick={()=>{setTracking(result.receipt);setMode("check");}}>
    Check my status</button>
   <p>Verification, partnership publication and any Foundation-funded discount
    require separate approval.</p>
  </section>:mode==="apply"?<form onSubmit={submit}
   style={{display:"grid",gap:15}}>
   <h2>Partner details</h2>
   <label style={{display:"grid",gap:5}}>What kind of partner are you?
    <select value={fields.partnerType} disabled={busy||!!sent}
     onChange={e=>update("partnerType",e.target.value as Kind)}>
     {kinds.map(k=><option key={k.code} value={k.code}>{k.label}</option>)}
    </select>
   </label>
   {txt("applicantName",label(fields.partnerType),true,{maxLength:180})}
   {txt("contactName","Contact person's full name",true)}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
    {txt("contactPhone","Contact phone number",true,{type:"tel",maxLength:16})}
    {txt("contactEmail","Contact email (optional)",false,{type:"email",maxLength:180})}
   </div>
   {txt("registrationNumber","Registration / license number"+
     (fields.partnerType==="DOCTOR"?"":" (if available)"),
     fields.partnerType==="DOCTOR",{maxLength:120})}
   {txt("addressLine","Practice or facility address",true,{maxLength:300})}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
    {txt("districtName","District",true,{maxLength:100})}
    {txt("stateName","State",true,{maxLength:100})}
    {txt("pinCode","Six-digit PIN",true,{maxLength:6})}
   </div>
   <label style={{display:"flex",gap:10,alignItems:"start"}}>
    <input type="checkbox" checked={fields.consentAccepted} required
     disabled={busy||!!sent}
     onChange={e=>update("consentAccepted",e.target.checked)}/>
    <span>I consent to CareGanga Foundation contacting me and reviewing my
     registration information for partner verification. This application does
     not create a verified partner account or guarantee a discount.</span>
   </label>
   {sent&&<p role="status">The submission result is uncertain.
    Do not change these details. Retry the <strong>same application</strong>
    to avoid a duplicate.</p>}
   {sent?<button type="button" disabled={busy} onClick={()=>void send(sent)}>
     {busy?"Checking original submission…":"Retry the same application"}</button>:
    <button className="cg-site-action" type="submit" disabled={busy}>
     {busy?"Submitting…":"Submit for Foundation review"}</button>}
  </form>:<form onSubmit={check} style={{display:"grid",gap:12}}>
   <h2>Check application status</h2>
   <p>Enter the private tracking code given when you submitted the application.
    The reference number alone cannot reveal your information.</p>
   <label style={{display:"grid",gap:5}}>Private tracking code
    <input value={tracking} required maxLength={43} autoComplete="off"
     disabled={busy} onChange={e=>setTracking(e.target.value)}/></label>
   <button type="submit" disabled={busy}>{busy?"Checking…":"Check status"}</button>
   {checked&&<p role="status">Application <strong>{checked.reference}</strong>:
    <strong> {checked.status.replaceAll("_"," ")}</strong>.
    Foundation verification is required before approval.</p>}
  </form>}
  {error&&<p role="alert" style={{color:"#933",fontWeight:600}}>{error}</p>}
  <p style={{fontSize:13}}>The Foundation may request additional license and
   banking evidence through secure channels. Do not upload or enter bank
   account details, medical records or sensitive documents in this form.</p>
 </div>;
}
