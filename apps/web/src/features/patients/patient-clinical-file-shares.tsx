"use client";
import {useEffect,useRef,useState} from "react";
type Booking={bookingRef:string;bookingId:string;bookingStatus:string};
type Share={grantRef:string;status:string;version:number;currentlyAuthorized:boolean;
 bookingId:string;doctorName:string;centerName:string;
 grantedAt:string;revoked:boolean};
type Shares={shares:Share[]};
async function request<T>(route:string,method:"GET"|"POST"="GET",data?:object){
 const r=await fetch("/api/patient-clinical-files/"+route,{
  method,credentials:"same-origin",cache:"no-store",
  ...(method==="POST"?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(data??{})}:{})
 });
 if(!r.ok)throw Error(r.status===401?"Patient session expired. Sign in again.":
  r.status===403||r.status===404?
   "Current identity, care consent or document does not authorize this action.":
  r.status===409?"Sharing has changed. Refresh the current permission.":
  "Clinical file-sharing result is uncertain. Check current permissions.");
 return await r.json() as T;
}
/** The patient explicitly permits ONE of their scanned files to be viewed
 * at ONE existing booking; a doctor's exact identity/center is authoritative
 * in CG14/CG15. Clinical use remains denied without current care consent.
 */
export function PatientClinicalFileShares({fileRef,consentGranted}:{
 fileRef:string;consentGranted:boolean
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [grants,setGrants]=useState<Share[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [booking,setBooking]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const keys=useRef(new Map<string,string>());
 useEffect(()=>{setOpen(false);setBusy(false);setGrants([]);setBookings([]);
  setBooking("");setError("");setNotice("");keys.current.clear();},[fileRef]);
 async function refresh(){
  const data=await request<Shares>("me/files/"+encodeURIComponent(fileRef)+"/shares");
  setGrants(data.shares);
 }
 async function reveal(){
  if(open){setOpen(false);setError("");return;}
  setOpen(true);setBusy(true);setError("");
  try{
   const [shares,visits]=await Promise.all([
    request<Shares>("me/files/"+encodeURIComponent(fileRef)+"/shares"),
    fetch("/api/consultations/me?limit=20",{cache:"no-store",
     credentials:"same-origin"}).then(async r=>{
      if(!r.ok)throw Error("Current patient appointments are unavailable.");
      return r.json() as Promise<{items:Booking[]}>;
     })
   ]);
   setGrants(shares.shares);
   setBookings(visits.items.filter(x=>x.bookingStatus==="CONFIRMED"));
  }catch(e){setError(e instanceof Error?e.message:
   "Clinical sharing cannot be verified.");}
  finally{setBusy(false);}
 }
 async function share(){
  if(!booking||busy||!consentGranted)return;
  setBusy(true);setError("");setNotice("");
  const key=keys.current.get(booking)??crypto.randomUUID();
  keys.current.set(booking,key);
  try{
   const result=await request<{status:string}>(
    "me/files/"+encodeURIComponent(fileRef)+"/shares","POST",
    {requestKey:key,bookingRef:booking});
   await refresh();
   if(result.status==="ACTIVE"){
    setNotice("You allowed the booked doctor to view this scanned file only for this appointment, subject to current patient-care consent.");
    keys.current.delete(booking);
   }else{
    setNotice("The original sharing permission is no longer active.");
   }
  }catch(e){setError(e instanceof Error?e.message:
   "Sharing result uncertain; check the original permission before retrying.");}
  finally{setBusy(false);}
 }
 async function revoke(row:Share){
  if(busy||row.status!=="ACTIVE")return;
  setBusy(true);setError("");setNotice("");
  try{
   await request("me/shares/"+encodeURIComponent(row.grantRef)+"/revoke",
    "POST",{expectedVersion:row.version});
   await refresh();setNotice("Doctor access to this appointment file was revoked. Previously downloaded copies cannot be recalled.");
  }catch(e){setError(e instanceof Error?e.message:
   "Revocation status uncertain. Refresh current permissions.");}
  finally{setBusy(false);}
 }
 return <section aria-label="Patient-approved appointment document sharing">
  <button type="button" disabled={busy} aria-expanded={open}
   onClick={()=>void reveal()}>{open?"Hide document sharing":"Choose which doctor may see this file"}</button>
  {open&&<div className="form-section">
   <p>Sharing is optional. Select your own existing confirmed consultation.
    Only that booking's verified doctor at the actual healthcare center can
    read this scanned file after check-in. No other doctor or center gets access.</p>
   {!!error&&<p role="alert">{error}</p>}
   {!!notice&&<p role="status">{notice}</p>}
   {busy&&<p role="status">Checking current permissions…</p>}
   {consentGranted&&<div className="form-grid">
    <label>My confirmed appointment
     <select value={booking} onChange={e=>setBooking(e.target.value)}
      disabled={busy}>
      <option value="">Choose an appointment</option>
      {bookings.map(item=><option value={item.bookingRef} key={item.bookingRef}>
       {item.bookingId}</option>)}
     </select>
    </label>
    <button type="button" disabled={busy||!booking}
     onClick={()=>void share()}>Allow this booked doctor to view my file</button>
   </div>}
   {!consentGranted&&<p>Patient-care consent is withdrawn. New access
    cannot be granted. Existing permission history can still be reviewed.</p>}
   <h4>Original sharing permissions</h4>
   {!grants.length&&<p>No clinical file-sharing permissions are recorded.</p>}
   {grants.map(row=><div className="notice" key={row.grantRef}>
    <strong>{row.bookingId}</strong>
    <p>{row.doctorName} · {row.centerName} ·
     {" "+(row.status!=="ACTIVE"?"Revoked":row.currentlyAuthorized?
      "Active for this booked clinician":"No longer accessible — booking or care permission changed")}</p>
    {row.status==="ACTIVE"&&<button type="button" disabled={busy}
     onClick={()=>void revoke(row)}>Revoke doctor access</button>}
   </div>)}
   <button type="button" disabled={busy}
    onClick={()=>void refresh().catch(()=>setError(
     "The current sharing permissions cannot be confirmed."))}>
    Refresh permissions</button>
  </div>}
 </section>;
}
