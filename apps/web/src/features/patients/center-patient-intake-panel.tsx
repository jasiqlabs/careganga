"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Consent={available:boolean;version:string|null;text:string|null};
type Result={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:"PROVISIONAL";createdAt:string;message:string;
 dependentCareAuthorization:{relationship:string;scope:"PROVISIONAL_INTAKE";status:string}|null};
type Permission={actions?:{key:string}[]};
type Pending={requestKey:string;digest:string};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function request<T>(url:string,method="GET",body?:Record<string,unknown>):
 Promise<{status:number;data:T|null;message:string}>{
 const r=await fetch(url,{method,cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 const result:unknown=await r.json().catch(()=>null);
 const object=result&&typeof result==="object"&&!Array.isArray(result)?
  result as Record<string,unknown>:{};
 return {status:r.status,data:r.ok?result as T:null,
  message:typeof object.message==="string"?object.message:
   "The request could not be confirmed. Check its current status."};
}
/** H15 minimal own-center assisted intake. Intentionally does not search,
 * claim or verify patients by name/mobile; the issued ID is provisional.
 */
export function CenterPatientIntakePanel({centerRef}:{centerRef:string}){
 const [allowed,setAllowed]=useState(false),[ready,setReady]=useState(false);
 const [policy,setPolicy]=useState<Consent>({available:false,version:null,text:null});
 const [first,setFirst]=useState(""),[last,setLast]=useState("");
 const [dob,setDob]=useState(""),[attested,setAttested]=useState(false);
 const [dependentCare,setDependentCare]=useState(false);
 const [guardianRelation,setGuardianRelation]=useState("PARENT");
 const [guardianIdentity,setGuardianIdentity]=useState(false);
 const [guardianAuthority,setGuardianAuthority]=useState(false);
 const [guardianConsent,setGuardianConsent]=useState(false);
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const pending=useRef<Pending|null>(null);
 const [claimChecked,setClaimChecked]=useState(false),[claimBusy,setClaimBusy]=useState(false);
 const [claimCode,setClaimCode]=useState(""),[claimExpires,setClaimExpires]=useState("");
 const [claimMessage,setClaimMessage]=useState("");
 const claimRequestKey=useRef<string|null>(null);
 const path="/api/appointments/patients/my-centers/"+encodeURIComponent(centerRef)+"/intakes";
 const reset=useCallback(()=>{
  setFirst("");setLast("");setDob("");setAttested(false);
  setDependentCare(false);setGuardianRelation("PARENT");
  setGuardianIdentity(false);setGuardianAuthority(false);setGuardianConsent(false);
  setMessage("");setResult(null);setUncertain(false);pending.current=null;
  setClaimChecked(false);setClaimCode("");setClaimExpires("");setClaimMessage("");claimRequestKey.current=null;
 },[]);
 useEffect(()=>{
  let alive=true;
  reset();setReady(false);setAllowed(false);setPolicy({available:false,version:null,text:null});
  if(!UUID.test(centerRef))return()=>{alive=false;};
  void Promise.all([
   request<Permission>("/api/access/effective"),
   request<Consent>("/api/patients/policy")
  ]).then(([access,consent])=>{
   if(!alive)return;
   setAllowed(!!access.data?.actions?.some(action=>action.key==="health.patients.intake"));
   if(consent.data)setPolicy(consent.data);
   setReady(true);
  }).catch(()=>{if(alive){setAllowed(false);setReady(true);}});
  return()=>{alive=false;};
 },[centerRef,reset]);
 const payload=()=>({
  firstName:first.trim(),lastName:last.trim(),dateOfBirth:dob||null,
  consentVersion:policy.version,assistedConsentAttested:attested,
  ...(dependentCare?{dependentCare:{relationship:guardianRelation,
   identityCheckedInPerson:guardianIdentity,
   authorityCheckedInPerson:guardianAuthority,
   limitedConsentAttested:guardianConsent}}:{})
 });
 async function submit(retrying=false){
  if(busy||(uncertain&&!retrying)||!allowed||!policy.available||!attested||!first.trim()||
   !last.trim()||(dependentCare&&(!guardianIdentity||!guardianAuthority||!guardianConsent)))return;
  const input=payload(),digest=JSON.stringify(input);
  if(uncertain&&pending.current?.digest!==digest){setMessage("Retry the original intake without changing its details.");return;}
  if(pending.current?.digest!==digest)
   pending.current={digest,requestKey:crypto.randomUUID()};
  setBusy(true);setMessage("");
  try{
   const r=await request<Result>(path,"POST",
    {requestKey:pending.current.requestKey,...input});
   if(r.data){
    setResult(r.data);setMessage(r.data.message);
    setUncertain(false);pending.current=null;
   }else{
    setMessage(r.message);
    if(r.status>=500)setUncertain(true);
   }
  }catch{
   setUncertain(true);
   setMessage("The intake result is uncertain. Check the same request before retrying.");
  }finally{setBusy(false);}
 }
 async function check(){
  if(!pending.current||busy)return;
  setBusy(true);setMessage("");
  try{
   const r=await request<Result>(path+"/"+pending.current.requestKey);
   if(r.data){
    setResult(r.data);setUncertain(false);pending.current=null;
    setMessage("This intake was previously recorded. It was not created twice.");
   }else if(r.status===404){
    // An in-flight original POST may commit after this GET. Never release
    // the same source key or unlock form edits based on a temporary 404.
    setUncertain(true);
    setMessage("No completed intake was found yet. Retry the SAME request key, without changing the details.");
   }else{
    setMessage(r.message);setUncertain(true);
   }
  }catch{
   setUncertain(true);setMessage("The saved result cannot be checked right now.");
  }finally{setBusy(false);}
 }
 async function issueClaim(newCode=false){
  if(!result||!claimChecked||claimBusy)return;
  setClaimBusy(true);setClaimMessage("");
  if(newCode)claimRequestKey.current=null;
  if(!claimRequestKey.current)claimRequestKey.current=crypto.randomUUID();
  try{
   const r=await request<{status:string;claimCode?:string;expiresAt?:string;message:string}>(
    "/api/appointments/patients/my-centers/"+encodeURIComponent(centerRef)+"/claims",
    "POST",{requestKey:claimRequestKey.current,virtualPatientId:result.virtualPatientId,
     identityCheckedInPerson:true});
   if(!r.data)throw Error(r.message);
   if(r.data.status==="ISSUED"&&r.data.claimCode){
    setClaimCode(r.data.claimCode);setClaimExpires(r.data.expiresAt??"");
    setClaimMessage("Show this claim code only to the patient whose identity you checked.");
   }else setClaimMessage("The original code was already issued and cannot be redisplayed. Request a new code if it was lost.");
  }catch(e){setClaimMessage(e instanceof Error?e.message:"The identity claim request is uncertain.");}
  finally{setClaimBusy(false);}
 }
 if(!ready)return <p role="status">Checking patient-intake permission…</p>;
 if(!allowed)return null;
 return <section className="form-section" aria-label="Center-assisted provisional patient intake">
  <h3>Register a provisional patient</h3>
  <p>For permitted reception staff at this center. Enter only the patient's minimum
   details after explaining the approved consent. This is not a verified patient
   identity, an appointment, a government ID or permission to view clinical files.</p>
  {message&&<p role="status" aria-live="polite">{message}</p>}
  {result?<div role="status" className="notice">
   <strong>CareGanga Virtual Patient ID: {result.virtualPatientId}</strong>
   <p>{result.firstName} {result.lastName} · {result.profileStatus}</p>
   <p>Identity and patient-account claim remain unverified. Keep the ID private.</p>
   {result.dependentCareAuthorization&&
    <p><strong>Dependent-care authorization recorded:</strong> representative
     relationship {result.dependentCareAuthorization.relationship.replaceAll("_"," ").toLowerCase()}.
     This staff-attested consent covers only this provisional intake.
     It does not authorize clinical document access, future care, login or bookings.</p>}
   <section aria-label="Give verified patient their account claim code">
    <h4>Link this provisional record to the patient's own account</h4>
    <p>Check the person's identity document in person before issuing a code.
     The patient must separately sign in using their own verified CareGanga account
     and accept patient-care consent. A shared mobile number is not proof.</p>
    <label><input type="checkbox" checked={claimChecked} disabled={claimBusy}
     onChange={e=>setClaimChecked(e.target.checked)}/>
     {" "}I checked the patient's identity document in person.</label>
    <button type="button" disabled={claimBusy||!claimChecked}
     onClick={()=>void issueClaim()}>Give patient a one-time claim code</button>
    {!!claimCode&&<p>Claim code (expires in 15 minutes):
     <strong style={{fontFamily:"monospace"}}>{claimCode}</strong>
     {claimExpires&&" · "+new Date(claimExpires).toLocaleTimeString("en-IN")}</p>}
    {!!claimMessage&&<p role="status">{claimMessage}</p>}
    <button type="button" disabled={claimBusy||!claimChecked}
     onClick={()=>void issueClaim(true)}>Replace lost/expired claim code</button>
   </section>
   <button type="button" disabled={claimBusy} onClick={reset}>Register another person</button>
  </div>:
  <div style={{display:"grid",gap:12,maxWidth:650}}>
   {!policy.available?<p role="alert">Foundation-approved consent is not configured.
     New patient registration is unavailable.</p>:<>
    <label>First name
     <input value={first} maxLength={100} required disabled={busy||uncertain}
      onChange={e=>setFirst(e.target.value)}/></label>
    <label>Last name
     <input value={last} maxLength={100} required disabled={busy||uncertain}
      onChange={e=>setLast(e.target.value)}/></label>
    <label>Date of birth (optional)
     <input type="date" value={dob} disabled={busy||uncertain}
      max={new Date().toISOString().slice(0,10)}
      onChange={e=>setDob(e.target.value)}/></label>
    <section className="form-section" aria-label="Dependent care authorization for this intake">
     <h4>Patient represented by a parent, guardian or authorized caregiver?</h4>
     <label><input type="checkbox" checked={dependentCare} disabled={busy||uncertain}
      onChange={e=>setDependentCare(e.target.checked)}/>
      {" "}A representative is consenting to this limited provisional patient registration.</label>
     {dependentCare&&<>
      <label>Representative's verified relationship
       <select value={guardianRelation} disabled={busy||uncertain}
        onChange={e=>setGuardianRelation(e.target.value)}>
        <option value="PARENT">Parent</option>
        <option value="LEGAL_GUARDIAN">Legal guardian</option>
        <option value="AUTHORIZED_REPRESENTATIVE">Authorized representative</option>
       </select></label>
      <label><input type="checkbox" checked={guardianIdentity} disabled={busy||uncertain}
       onChange={e=>setGuardianIdentity(e.target.checked)}/>
       {" "}I checked this representative's identity in person.</label>
      <label><input type="checkbox" checked={guardianAuthority} disabled={busy||uncertain}
       onChange={e=>setGuardianAuthority(e.target.checked)}/>
       {" "}I checked the representative's authority to assist this patient.</label>
      <label><input type="checkbox" checked={guardianConsent} disabled={busy||uncertain}
       onChange={e=>setGuardianConsent(e.target.checked)}/>
       {" "}The representative agreed to record only the patient's minimal provisional
       registration details after the current consent notice was explained.</label>
      <p>This does not verify legal guardianship, create a family account link,
       or allow access to another patient's reports or future bookings.</p>
     </>}
    </section>
    <div style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12}}>
     <h4>Explain the current patient-care consent</h4>
     <p style={{whiteSpace:"pre-wrap"}}>{policy.text}</p>
     <label><input type="checkbox" checked={attested} disabled={busy||uncertain}
      onChange={e=>setAttested(e.target.checked)}/>
      {" "}I explained the current patient-care notice, and the person agreed to
      record minimum details for provisional registration only. This does not
      authorize access to clinical records.</label>
    </div>
    <button type="button" className="primary" onClick={()=>void submit()}
     disabled={busy||uncertain||!attested||first.trim().length<2||!last.trim()||
      (dependentCare&&(!guardianIdentity||!guardianAuthority||!guardianConsent))}>
     {busy?"Checking…":"Register provisional patient"}</button>
   </>}
   {uncertain&&<div role="alert">
    <p>The original request may already be saved. Check it before doing anything else.</p>
    <button type="button" disabled={busy} onClick={()=>void check()}>
     Check original intake result</button>
    <button type="button" disabled={busy||!pending.current}
     onClick={()=>void submit(true)}>Retry original intake (same request)</button>
   </div>}
  </div>}
 </section>;
}
