"use client";
import {useState} from "react";
type Details={contactPhone:string|null;postalAddress:string|null;
 emergencyName:string|null;emergencyPhone:string|null;
 pan:string|null;bankAccount:string|null;bankIfsc:string|null;fatherName:string|null;motherName:string|null;dateOfBirth:string|null;gender:string|null;bloodGroup:string|null;contactEmail:string|null;pinCode:string|null;bankName:string|null;accountHolder:string|null;bankBranch:string|null;accountType:string|null;upiId:string|null};
const fields=[
 ["contactPhone","Contact phone"],
 ["postalAddress","Postal address"],
 ["emergencyName","Emergency contact name"],
 ["emergencyPhone","Emergency contact phone"],
 ["pan","PAN (if required)"],
 ["bankAccount","Bank account number"],
 ["bankIfsc","IFSC"],
 ["fatherName","Father's name (optional)"],
 ["motherName","Mother's name (optional)"],
 ["dateOfBirth","Date of birth (YYYY-MM-DD)"],
 ["gender","Gender (optional)"],
 ["bloodGroup","Blood group (optional, e.g. A+)"],
 ["contactEmail","Email address"],
 ["pinCode","PIN code"],
 ["bankName","Bank name"],
 ["accountHolder","Account holder name"],
 ["bankBranch","Bank branch"],
 ["accountType","Account type (Savings / Current / Other)"],
 ["upiId","UPI ID (optional)"]
] as const;
const empty=():Details=>({
 contactPhone:null,postalAddress:null,emergencyName:null,emergencyPhone:null,
 pan:null,bankAccount:null,bankIfsc:null,fatherName:null,motherName:null,dateOfBirth:null,gender:null,bloodGroup:null,contactEmail:null,pinCode:null,bankName:null,accountHolder:null,bankBranch:null,accountType:null,upiId:null
});
export function HrPrivateDetails({applicationRef,canView,canManage}:{
 applicationRef:string;canView:boolean;canManage:boolean;
}){
 const [open,setOpen]=useState(false);
 const [data,setData]=useState<Details>(empty);
 const [revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const load=async()=>{
  if(!canView||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const res=await fetch("/api/hr/private/"+applicationRef,{
    credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error(res.status===403?
    "Your role cannot read protected employee details.":
    "The original private employee data is unavailable.");
   const value:unknown=await res.json();
   if(!value||typeof value!=="object"||!("details" in value)||
    !("revision" in value)||typeof value.revision!=="number"||
    !value.details||typeof value.details!=="object")
    throw Error("Protected details cannot be verified.");
   setData(value.details as Details);setRevision(value.revision);setOpen(true);
  }catch(e){setData(empty());setOpen(false);
   setError(e instanceof Error?e.message:"Private employee information is unavailable.");}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!canManage||!open||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const res=await fetch("/api/hr/private/"+applicationRef,{
    method:"PATCH",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({expectedRevision:revision,details:data})});
   if(!res.ok){const rejected:unknown=await res.json().catch(()=>null);throw Error(res.status===400&&rejected&&typeof rejected==="object"&&"message" in rejected&&typeof rejected.message==="string"?rejected.message:res.status===409?
     "Protected employee details changed. Refresh before saving.":
     res.status===403?"Your current role cannot change private details.":
     "The protected data save cannot be confirmed. Refresh before retrying.");}
   const value:unknown=await res.json();
   if(!value||typeof value!=="object"||!("saved" in value)||
    value.saved!==true||!("revision" in value)||typeof value.revision!=="number")
    throw Error("The original protected update cannot be confirmed.");
   setRevision(value.revision);
   setMessage("Protected employee data saved and audited. No approval or login was granted.");
  }catch(e){setError(e instanceof Error?e.message:
   "The update status is uncertain. Check before repeating.");}
  finally{setBusy(false);}
 };
 return <section aria-label="Separate protected employee personal details"
  style={{display:"grid",gap:10,padding:13,border:"1px solid var(--cg-border)",borderRadius:10}}>
  <strong>Restricted personal and bank information</strong>
  <p style={{margin:0,color:"var(--cg-muted)",fontSize:13}}>
   Government identity scans remain in original CG-19 private evidence.
   Bank and contact data are encrypted separately and are not used to grant permissions.
  </p>
  {error&&<p role="alert" style={{color:"#991B1B",margin:0}}>{error}</p>}
  {message&&<p role="status" style={{color:"#166534",margin:0}}>{message}</p>}
  {!open&&canView&&<button type="button" onClick={()=>void load()} disabled={busy}
   style={{padding:10,alignSelf:"start",borderRadius:9,background:"#F1F5F9",
    border:"1px solid var(--cg-border)"}}>Open audited private details</button>}
  {open&&<>
   {fields.map(([key,title])=><label key={key} style={{display:"grid",gap:5}}>
     <span style={{fontWeight:600}}>{title}</span>
     <input autoComplete="off" value={data[key]??""} disabled={!canManage||busy}
      type={key==="dateOfBirth"?"date":key==="contactEmail"?"email":"text"} maxLength={key==="postalAddress"?700:key==="contactEmail"?254:key==="upiId"?128:key==="contactPhone"||key==="emergencyPhone"?20:key==="bankAccount"?22:key==="bankIfsc"?11:key==="pan"||key==="dateOfBirth"?10:key==="pinCode"?6:key==="bloodGroup"?3:key==="accountType"?16:key==="gender"?32:120}
      onChange={e=>setData(old=>({...old,[key]:e.target.value}))}
      style={{padding:10,borderRadius:9,border:"1px solid var(--cg-border)",
       background:canManage?"#fff":"#F8FAFC"}}/>
    </label>)}
   <div style={{display:"flex",gap:10}}>
    {canManage&&<button type="button" onClick={()=>void save()} disabled={busy}
     style={{padding:11,border:0,background:"var(--cg-accent)",
      color:"#fff",borderRadius:9,fontWeight:700}}>
     {busy?"Saving private details…":"Save encrypted private details"}</button>}
    <button type="button" disabled={busy} onClick={()=>{setOpen(false);setData(empty());setError("");setMessage("");}}
     style={{padding:11,border:"1px solid var(--cg-border)",borderRadius:9,
      background:"#F8FAFC"}}>Close and clear</button>
   </div>
  </>}
 </section>;
}
