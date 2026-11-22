"use client";
import {useState} from "react";
type Details={contactPhone:string|null;postalAddress:string|null;
 emergencyName:string|null;emergencyPhone:string|null;
 pan:string|null;bankAccount:string|null;bankIfsc:string|null;fatherName:string|null;motherName:string|null;dateOfBirth:string|null;gender:string|null;bloodGroup:string|null;contactEmail:string|null;pinCode:string|null;bankName:string|null;accountHolder:string|null;bankBranch:string|null;accountType:string|null;upiId:string|null};
const groups=[
 {title:"Personal and contact information",fields:[
  ["fatherName","Father's name (optional)"],["motherName","Mother's name (optional)"],
  ["dateOfBirth","Date of birth"],["gender","Gender (optional)"],
  ["bloodGroup","Blood group (optional)"],["pan","PAN (if required)"],
  ["contactPhone","Contact phone"],["contactEmail","Email address"],["postalAddress","Postal address"],["pinCode","PIN code"],
  ["emergencyName","Emergency contact name"],["emergencyPhone","Emergency contact phone"]
 ]},
 {title:"Bank details",fields:[
  ["bankName","Bank name"],["accountHolder","Account holder name"],["bankAccount","Bank account number"],["bankIfsc","IFSC"],
  ["bankBranch","Bank branch"],["accountType","Account type"],["upiId","UPI ID (optional)"]
 ]}
] as const;
const choices={bloodGroup:["A+","A-","B+","B-","AB+","AB-","O+","O-"],accountType:["SAVINGS","CURRENT","OTHER"]} as const;

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
 const [savedAccount,setSavedAccount]=useState("");
 const [confirmAccount,setConfirmAccount]=useState("");
 const confirmNeeded=canManage&&Boolean(data.bankAccount)&&data.bankAccount!==savedAccount;
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
   setData(value.details as Details);setSavedAccount((value.details as Details).bankAccount??"");setConfirmAccount("");setRevision(value.revision);setOpen(true);
  }catch(e){setData(empty());setOpen(false);
   setError(e instanceof Error?e.message:"Private employee information is unavailable.");}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!canManage||!open||busy)return;
  if(confirmNeeded&&data.bankAccount!==confirmAccount.trim()){setError("Confirm the new bank account number before saving.");return;}
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
   setRevision(value.revision);setSavedAccount(data.bankAccount??"");setConfirmAccount("");
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
   {groups.map(group=><section key={group.title} style={{borderTop:"1px solid var(--cg-border)",paddingTop:12,display:"grid",gap:12}}>
    <h3 style={{margin:0,color:"var(--cg-accent)",fontSize:"1rem"}}>{group.title}</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,200px),1fr))",gap:12}}>
     {group.fields.map(([key,title])=><div key={key} style={{display:"grid",gap:6}}>
      <label style={{display:"grid",gap:5}}>
       <span style={{fontWeight:600}}>{title}</span>
       {key==="bloodGroup"||key==="accountType"?<select value={data[key]??""} disabled={!canManage||busy} onChange={e=>setData(old=>({...old,[key]:e.target.value}))} style={{padding:10,borderRadius:9,border:"1px solid var(--cg-border)",background:"var(--cg-surface,#fff)"}}><option value="">Not provided</option>{choices[key].map(v=><option key={v} value={v}>{key==="accountType"?v[0]+v.slice(1).toLowerCase():v}</option>)}</select>:
        <input autoComplete="off" value={data[key]??""} disabled={!canManage||busy}
         type={key==="dateOfBirth"?"date":key==="contactEmail"?"email":"text"} maxLength={key==="postalAddress"?700:key==="contactEmail"?254:key==="upiId"?128:key==="contactPhone"||key==="emergencyPhone"?20:key==="bankAccount"?22:key==="bankIfsc"?11:key==="pan"||key==="dateOfBirth"?10:key==="pinCode"?6:key==="gender"?32:120}
         inputMode={key==="bankAccount"||key==="pinCode"?"numeric":key==="contactPhone"||key==="emergencyPhone"?"tel":undefined}
         onChange={e=>{if(key==="bankAccount")setConfirmAccount("");setData(old=>({...old,[key]:e.target.value}));}}
         style={{padding:10,borderRadius:9,border:"1px solid var(--cg-border)",background:canManage?"#fff":"#F8FAFC"}}/>}
      </label>
      {key==="bankAccount"&&confirmNeeded&&<label style={{display:"grid",gap:5,fontWeight:600}}>Confirm bank account number<input autoComplete="off" inputMode="numeric" type="text" maxLength={22} value={confirmAccount} disabled={busy} onChange={e=>setConfirmAccount(e.target.value)} style={{padding:10,borderRadius:9,border:"1px solid var(--cg-border)"}}/></label>}
     </div>)}
    </div>
   </section>)}
   <div style={{display:"flex",gap:10}}>
    {canManage&&<button type="button" onClick={()=>void save()} disabled={busy}
     style={{padding:11,border:0,background:"var(--cg-accent)",
      color:"#fff",borderRadius:9,fontWeight:700}}>
     {busy?"Saving private details…":"Save encrypted private details"}</button>}
    <button type="button" disabled={busy} onClick={()=>{setOpen(false);setData(empty());setSavedAccount("");setConfirmAccount("");setError("");setMessage("");}}
     style={{padding:11,border:"1px solid var(--cg-border)",borderRadius:9,
      background:"#F8FAFC"}}>Close and clear</button>
   </div>
  </>}
 </section>;
}
