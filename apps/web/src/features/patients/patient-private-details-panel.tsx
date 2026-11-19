"use client";
import {useEffect,useState} from "react";
type Details={version:number;bloodGroup:string|null;emergencyName:string|null;
 emergencyMobile:string|null;medicalInfo:string|null};
const endpoint="/api/patients/me/private-details";
async function request(method:"GET"|"POST",body?:object){
 const response=await fetch(endpoint,{method,cache:"no-store",
  credentials:"same-origin",headers:method==="POST"?
   {"Content-Type":"application/json"}:undefined,
  body:method==="POST"?JSON.stringify(body??{}):undefined});
 if(!response.ok)throw Error(response.status===401?
  "Please sign in to view your private patient details.":
  response.status===403||response.status===404?
   "Your current verified patient account cannot access these details.":
  response.status===409?"Your private details changed. Refresh before saving.":
  "Secure patient information cannot be confirmed. Check your account.");
 return await response.json() as Details;
}
/** Self-only encrypted CG15 patient context; not a clinic medical record or
 * diagnostic advice. Never expose the patient's emergency number to staff
 * search, notifications, anonymous availability or external analytics.
 */
export function PatientPrivateDetailsPanel({consentGranted}:{consentGranted:boolean}){
 const [record,setRecord]=useState<Details|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [blood,setBlood]=useState(""),[name,setName]=useState("");
 const [mobile,setMobile]=useState(""),[medical,setMedical]=useState("");
 function apply(x:Details){
  setRecord(x);setBlood(x.bloodGroup??"");setName(x.emergencyName??"");
  setMobile(x.emergencyMobile??"");setMedical(x.medicalInfo??"");
 }
 async function refresh(){
  setLoading(true);setError("");
  try{apply(await request("GET"));}
  catch(e){setError(e instanceof Error?e.message:
   "Private details cannot be verified.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{
  let mounted=true;
  void request("GET").then(x=>{if(mounted)apply(x);})
   .catch(()=>{if(mounted)setError("Your private details are temporarily unavailable.");})
   .finally(()=>{if(mounted)setLoading(false);});
  return()=>{mounted=false;};
 },[]);
 async function save(){
  if(!record||busy||!consentGranted)return;
  setBusy(true);setError("");setNotice("");
  try{
   const current=await request("POST",{
    expectedVersion:record.version,
    bloodGroup:blood||null,emergencyName:name.trim()||null,
    emergencyMobile:mobile.trim()||null,medicalInfo:medical.trim()||null});
   apply(current);
   setNotice("Your optional private patient details were saved securely.");
  }catch(e){setError(e instanceof Error?e.message:
   "Private patient details could not be saved.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="My optional private care information">
  <h2>Optional private care information</h2>
  <p>Only your verified patient account can update these details.
   Blood group and medical notes are self-reported, not verified laboratory
   evidence or a clinician's diagnosis. Your emergency contact is never used
   to identify, merge or authorize other patient accounts.</p>
  {!!error&&<p role="alert">{error}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  {loading?<p role="status">Checking private information…</p>:record?<>
   <div className="form-grid">
    <label>Blood group (optional; self-reported)
     <select value={blood} disabled={busy||!consentGranted}
      onChange={e=>setBlood(e.target.value)}>
      <option value="">Prefer not to say</option>
      {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=>
       <option key={g} value={g}>{g}</option>)}
     </select>
    </label>
    <label>Emergency contact name (optional)
     <input value={name} maxLength={100} autoComplete="off"
      disabled={busy||!consentGranted}
      onChange={e=>setName(e.target.value)}/>
    </label>
    <label>Emergency contact mobile number (optional)
     <input value={mobile} maxLength={10} inputMode="numeric"
      autoComplete="off" disabled={busy||!consentGranted}
      onChange={e=>setMobile(e.target.value)} placeholder="10-digit Indian mobile"/>
    </label>
    <label>Private medical information you choose to share (optional)
     <textarea value={medical} maxLength={500} rows={3}
      disabled={busy||!consentGranted}
      onChange={e=>setMedical(e.target.value)}
      placeholder="Optional existing conditions or allergies, in your own words"/>
    </label>
   </div>
   {consentGranted?<div className="toolbar">
    <button type="button" disabled={busy} onClick={()=>void save()}>
     {busy?"Saving…":"Save my private details"}</button>
    <button type="button" disabled={busy} onClick={()=>void refresh()}>
     Refresh original details</button>
   </div>:<p>Your patient-care consent is withdrawn. Existing private information
    remains visible only to your own verified account; changes need current
    consent. No new clinic sharing is authorized.</p>}
  </>:!loading&&<button type="button" disabled={busy} onClick={()=>void refresh()}>
   Retry secure private details</button>}
 </section>;
}
