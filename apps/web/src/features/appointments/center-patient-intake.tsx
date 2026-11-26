"use client";
import {useEffect,useRef,useState} from "react";
type Consent={available:boolean;version:string|null;text:string|null};
type Result={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:string;createdAt:string;message:string;
 dependentCareAuthorization?:{relationship:string;scope:string;status:string}|null};
type ErrorValue={message?:string};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function json<T>(r:Response):Promise<T>{
 const value:unknown=await r.json().catch(()=>null);
 if(!r.ok){
  const message=value&&typeof value==="object"&&"message" in value?
   (value as ErrorValue).message:null;
  throw Error(typeof message==="string"?message:"The result could not be confirmed.");
 }
 return value as T;
}
export function CenterPatientIntake({centerRef}:{centerRef:string}){
 const [policy,setPolicy]=useState<Consent>({available:false,version:null,text:null});
 const [first,setFirst]=useState(""),[last,setLast]=useState(""),[dob,setDob]=useState("");
 const [attested,setAttested]=useState(false),[busy,setBusy]=useState(false);
 const [dependentCare,setDependentCare]=useState(false);
 const [guardianRelation,setGuardianRelation]=useState("PARENT");
 const [guardianIdentity,setGuardianIdentity]=useState(false);
 const [guardianAuthority,setGuardianAuthority]=useState(false);
 const [guardianConsent,setGuardianConsent]=useState(false);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const [result,setResult]=useState<Result|null>(null);
 const command=useRef<{key:string;digest:string}|null>(null);
 useEffect(()=>{
  let active=true;
  void fetch("/api/patients/policy",{cache:"no-store"})
   .then(r=>json<Consent>(r)).then(data=>{if(active)setPolicy(data);})
   .catch(()=>{if(active)setMessage("Current patient consent policy is unavailable.");});
  return()=>{active=false;};
 },[]);
 async function create(){
  if(busy||!ID.test(centerRef)||!policy.available||!attested||
   (dependentCare&&(!guardianIdentity||!guardianAuthority||!guardianConsent)))return;
  const details={firstName:first,lastName:last,dateOfBirth:dob||null,
   consentVersion:policy.version,assistedConsentAttested:true,
   ...(dependentCare?{dependentCare:{relationship:guardianRelation,
    identityCheckedInPerson:guardianIdentity,authorityCheckedInPerson:guardianAuthority,
    limitedConsentAttested:guardianConsent}}:{})};
  const digest=JSON.stringify(details);
  if(uncertain&&command.current?.digest!==digest){setMessage("Retry the original intake without changing its details.");return;}
  if(command.current?.digest!==digest)
   command.current={key:crypto.randomUUID(),digest};
  setBusy(true);setMessage("");setUncertain(false);
  try{
   const response=await fetch("/api/appointments/patients/my-centers/"+
    encodeURIComponent(centerRef)+"/intakes",{
     method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({...details,requestKey:command.current.key})
    });
   const record=await json<Result>(response);
   setResult(record);
   setMessage("Provisional intake recorded. The patient is not identity-verified.");
   setUncertain(false);
  }catch(e){
   setUncertain(true);
   setMessage(e instanceof Error?e.message:
    "Check the existing request before resubmitting.");
  }finally{setBusy(false);}
 }
 async function check(){
  if(!command.current||busy||!ID.test(centerRef))return;
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/appointments/patients/my-centers/"+
    encodeURIComponent(centerRef)+"/intakes/"+encodeURIComponent(command.current.key),
    {cache:"no-store"});
   const found=await json<Result>(r);
   setResult(found);setUncertain(false);
   setMessage("Your original provisional intake was found.");
  }catch(e){setMessage(e instanceof Error?e.message:
   "The original request could not be checked.");}
  finally{setBusy(false);}
 }
 function reset(){
  command.current=null;setResult(null);setFirst("");setLast("");setDob("");
  setAttested(false);setMessage("");setUncertain(false);
  setDependentCare(false);setGuardianRelation("PARENT");
  setGuardianIdentity(false);setGuardianAuthority(false);setGuardianConsent(false);
 }
 return <section className="form-section" aria-labelledby="cg15-assist-title">
  <h3 id="cg15-assist-title">Register provisional patient</h3>
  <p>Authorized reception staff can record a new patient's minimal details
   at this center. This does not verify identity, link a CareGanga login,
   grant medical-record access or create an appointment.</p>
  {!!message&&<p role="status" aria-live="polite">{message}</p>}
  {result?<div className="form-section">
    <h4>Intake recorded</h4>
    <p><strong>Virtual Patient ID:</strong> {result.virtualPatientId}</p>
    <p>{result.firstName} {result.lastName} · Provisional</p>
    {result.dependentCareAuthorization&&<p>Representative's
     { " "+result.dependentCareAuthorization.relationship.replaceAll("_"," ").toLowerCase()}
     {" "}authorization was staff-attested for this provisional intake only.
     This is not clinical record access or ongoing family authorization.</p>}
    <p>To protect this person's information, an authenticated patient claim
     will require independent identity verification.</p>
    <button type="button" onClick={reset}>Register another patient</button>
   </div>:<form onSubmit={e=>{e.preventDefault();void create();}}
     style={{display:"grid",gap:12,maxWidth:650}}>
    <label>First name
     <input required maxLength={100} disabled={busy||uncertain} value={first}
      onChange={e=>setFirst(e.target.value)}/></label>
    <label>Last name
     <input required maxLength={100} disabled={busy||uncertain} value={last}
      onChange={e=>setLast(e.target.value)}/></label>
    <label>Date of birth (optional)
     <input type="date" disabled={busy||uncertain} value={dob} max={new Date().toISOString().slice(0,10)}
      onChange={e=>setDob(e.target.value)}/></label>
    <div className="form-section" aria-label="Dependent-care registration authorization">
     <h4>Is this patient represented by a guardian or caregiver?</h4>
     <label><input type="checkbox" checked={dependentCare} disabled={busy||uncertain}
      onChange={e=>setDependentCare(e.target.checked)}/>
      {" "}Record in-person representative authorization for this intake only.</label>
     {dependentCare&&<>
      <label>Relationship
       <select value={guardianRelation} disabled={busy||uncertain}
        onChange={e=>setGuardianRelation(e.target.value)}>
        <option value="PARENT">Parent</option>
        <option value="LEGAL_GUARDIAN">Legal guardian</option>
        <option value="AUTHORIZED_REPRESENTATIVE">Authorized representative</option>
       </select></label>
      <label><input type="checkbox" checked={guardianIdentity} disabled={busy||uncertain}
       onChange={e=>setGuardianIdentity(e.target.checked)}/>
       {" "}I checked the representative's identity in person.</label>
      <label><input type="checkbox" checked={guardianAuthority} disabled={busy||uncertain}
       onChange={e=>setGuardianAuthority(e.target.checked)}/>
       {" "}I checked the representative's authority for this patient.</label>
      <label><input type="checkbox" checked={guardianConsent} disabled={busy||uncertain}
       onChange={e=>setGuardianConsent(e.target.checked)}/>
       {" "}The representative agreed to this minimal provisional intake only.</label>
      <p>This record creates no family link, access to reports or booking authority.</p>
     </>}
    </div>
    <div className="form-section">
     <h4>Explain patient-care consent</h4>
     {policy.available?<><p style={{whiteSpace:"pre-wrap"}}>{policy.text}</p>
      <label><input type="checkbox" checked={attested} disabled={busy||uncertain}
       onChange={e=>setAttested(e.target.checked)}/>
       {" "}I have explained the current CareGanga patient-care information
       to the patient or authorized guardian and recorded their agreement for
       this minimal provisional registration.</label>
      </>:<p role="alert">The Foundation has not configured approved patient-care
       consent. Registration is unavailable.</p>}
    </div>
    {uncertain&&<p role="alert">Submission was not confirmed.
     Check the original request before making another submission.</p>}
    {uncertain&&<button type="button" disabled={busy} onClick={()=>void check()}>
      Check previous intake result</button>}
    <button type="submit" className="primary"
     disabled={busy||!policy.available||!first.trim()||!last.trim()||!attested||
      (dependentCare&&(!guardianIdentity||!guardianAuthority||!guardianConsent))}>
     {busy?"Checking…":uncertain?"Retry the same intake":"Record provisional patient"}
    </button>
   </form>}
 </section>;
}
