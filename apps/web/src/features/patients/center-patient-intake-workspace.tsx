"use client";
import {useEffect,useRef,useState} from "react";
import {CenterPatientIntakePanel} from "./center-patient-intake-panel";
import {CenterAssistedConsultationBooking}
 from "../appointments/center-assisted-consultation-booking";

type Center={centerRef:string;centerName:string;providerName:string};
type Options={centers:Center[]};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Separate from CG14 center profile-editing. Intake-only reception roles
 * see only original currently assigned eligible center options.
 */
export function CenterPatientIntakeWorkspace(){
 const [centers,setCenters]=useState<Center[]>([]);
 const [chosen,setChosen]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [identityDisplay,setIdentityDisplay]=useState("");
 const [identityToken,setIdentityToken]=useState("");
 const [identityChecked,setIdentityChecked]=useState(false);
 const [verificationBusy,setVerificationBusy]=useState(false),[verificationUncertain,setVerificationUncertain]=useState(false);
 const [verificationMessage,setVerificationMessage]=useState("");
 const verificationKey=useRef<{signature:string;requestKey:string}|null>(null);
 async function verifyPatient(){
  if(verificationBusy||!chosen||!identityChecked||
    !/^CGP-[A-F0-9]{16}$/.test(identityDisplay)||
    !/^CGI-[A-F0-9]{24}$/.test(identityToken))return;
  setVerificationBusy(true);setVerificationMessage("");
  const signature=chosen+"|"+identityDisplay+"|"+identityToken;
  if(verificationUncertain&&verificationKey.current?.signature!==signature){setVerificationBusy(false);setVerificationMessage("Retry the original identity check without changing its details.");return;}
  if(verificationKey.current?.signature!==signature)
   verificationKey.current={signature,requestKey:crypto.randomUUID()};
  try{
   const response=await fetch("/api/appointments/patients/my-centers/"+
    encodeURIComponent(chosen)+"/verify-identity",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:verificationKey.current.requestKey,
     virtualPatientId:identityDisplay,verificationCode:identityToken,
     identityCheckedInPerson:true})}).catch(e=>{setVerificationUncertain(true);throw e;});
   const raw:unknown=await response.json().catch(()=>null);
   if(!response.ok){setVerificationUncertain(response.status>=500);throw Error(raw&&typeof raw==="object"&&"message" in raw&&
    typeof raw.message==="string"?raw.message:
    "Identity check cannot be confirmed. Retry the original request key.");}
   if(!raw||typeof raw!=="object"||!("virtualPatientId" in raw)||raw.virtualPatientId!==identityDisplay||!("profileStatus" in raw)||raw.profileStatus!=="VERIFIED"){setVerificationUncertain(true);throw Error("The original identity check could not be verified. Retry the same request.");}
   setVerificationUncertain(false);
   setVerificationMessage("Identity verification recorded. The patient can refresh their profile and book a consultation.");
   setIdentityToken("");setIdentityChecked(false);verificationKey.current=null;
  }catch(e){setVerificationMessage(e instanceof Error?e.message:
   "Identity verification is uncertain. Recheck the same request.");}
  finally{setVerificationBusy(false);}
 }

 useEffect(()=>{
  let active=true;
  void fetch("/api/appointments/patients/my-centers/intake-options",{
   cache:"no-store",credentials:"same-origin"
  }).then(async response=>{
   const data:unknown=await response.json().catch(()=>null);
   if(!response.ok)throw Error(data&&typeof data==="object"&&
    "message" in data&&typeof data.message==="string"?data.message:
    "Current center assignment could not be confirmed.");
   if(!data||typeof data!=="object"||!("centers" in data)||
    !Array.isArray(data.centers))throw Error("Current center options are unavailable.");
   return data as Options;
  }).then(options=>{
   if(!active)return;
   const valid=options.centers.filter(item=>item&&typeof item==="object"&&
    typeof item.centerRef==="string"&&UUID.test(item.centerRef)&&
    typeof item.centerName==="string"&&typeof item.providerName==="string");
   setCenters(valid);
   setChosen(valid.length===1?valid[0].centerRef:"");
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:
    "Current center assignment could not be confirmed.");})
  .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 return <div className="role-workspace">
  <header className="topbar"><div>
   <h1>Patient & Booking Management</h1>
   <p>Center reception · provisional patient registration</p>
  </div></header>
  <p>Only your assigned, currently approved healthcare centers are available.
   Register a provisional patient, record a separately verified in-person identity
   check, or book a consultation when the patient supplies their own one-time
   center authorization code. These are distinct actions.</p>
  {loading&&<p role="status">Checking authorized healthcare centers…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!loading&&!error&&centers.length===0&&
   <p>No verified healthcare center is currently assigned for patient intake.
    Ask a Foundation administrator to check your current center assignment.</p>}
  {!loading&&centers.length>0&&<div className="form-section">
   <label>Register at healthcare center
    <select value={chosen} disabled={verificationBusy||verificationUncertain} onChange={e=>{setChosen(e.target.value);setIdentityDisplay("");setIdentityToken("");setIdentityChecked(false);setVerificationMessage("");verificationKey.current=null;}}>
     <option value="">Select your assigned center</option>
     {centers.map(x=><option value={x.centerRef} key={x.centerRef}>
      {x.centerName} — {x.providerName}</option>)}
    </select>
   </label>
  </div>}
  {chosen&&centers.some(x=>x.centerRef===chosen)&&<>
   <section className="form-section" aria-label="In-person patient identity verification">
    <h2>Verify a signed-in patient's identity</h2>
    <p>Ask the patient to open their own CareGanga patient profile and generate
     a one-time verification code. Check their identity document in person.
     A shared family mobile number or Virtual Patient ID alone is insufficient.</p>
    <form onSubmit={e=>{e.preventDefault();void verifyPatient();}}
     style={{display:"grid",gap:10,maxWidth:520}}>
     <label>Patient's Virtual Patient ID
      <input type="text" required maxLength={20} value={identityDisplay} disabled={verificationBusy||verificationUncertain}
       onChange={e=>{setIdentityDisplay(e.target.value.trim().toUpperCase());
        verificationKey.current=null;}} placeholder="CGP-XXXXXXXXXXXXXXXX"/>
     </label>
     <label>Current one-time clinic code
      <input type="text" required maxLength={28} value={identityToken} disabled={verificationBusy||verificationUncertain}
       onChange={e=>{setIdentityToken(e.target.value.trim().toUpperCase());
        verificationKey.current=null;}} placeholder="CGI-XXXXXXXXXXXXXXXXXXXXXXXX"/>
     </label>
     <label><input type="checkbox" checked={identityChecked} disabled={verificationBusy||verificationUncertain}
      onChange={e=>setIdentityChecked(e.target.checked)}/>
      {" "}I checked the patient's identity document in person and it matches the
      patient presenting their signed-in CareGanga profile.</label>
     <button type="submit" disabled={verificationBusy||!identityChecked||
      !/^CGP-[A-F0-9]{16}$/.test(identityDisplay)||!/^CGI-[A-F0-9]{24}$/.test(identityToken)}>
      {verificationBusy?"Verifying…":verificationUncertain?"Retry original identity check":"Record verified identity"}</button>
     {!!verificationMessage&&<p role="status" aria-live="polite">{verificationMessage}</p>}
    </form>
   </section>
   <CenterPatientIntakePanel centerRef={chosen} key={chosen}/>
   <CenterAssistedConsultationBooking centerRef={chosen} key={"booking:"+chosen}/>
  </>}
 </div>;
}
