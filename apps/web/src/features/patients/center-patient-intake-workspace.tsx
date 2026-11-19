"use client";
import {useEffect,useState} from "react";
import {CenterPatientIntakePanel} from "./center-patient-intake-panel";

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
   const valid=options.centers.filter(item=>UUID.test(item.centerRef)&&
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
   This form does not create a consultation booking or verify clinical identity.</p>
  {loading&&<p role="status">Checking authorized healthcare centers…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!loading&&!error&&centers.length===0&&
   <p>No verified healthcare center is currently assigned for patient intake.
    Ask a Foundation administrator to check your current center assignment.</p>}
  {!loading&&centers.length>0&&<div className="form-section">
   <label>Register at healthcare center
    <select value={chosen} onChange={e=>setChosen(e.target.value)}>
     <option value="">Select your assigned center</option>
     {centers.map(x=><option value={x.centerRef} key={x.centerRef}>
      {x.centerName} — {x.providerName}</option>)}
    </select>
   </label>
  </div>}
  {chosen&&centers.some(x=>x.centerRef===chosen)&&
   <CenterPatientIntakePanel centerRef={chosen} key={chosen}/>}
 </div>;
}
