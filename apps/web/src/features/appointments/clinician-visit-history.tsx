"use client";
import {useEffect,useRef,useState} from "react";
type Visit={bookingId:string;consultationAt:string;status:string};
type Page={appointmentRef:string;items:Visit[];next:string|null};
/** Original CG15 role+doctor+center+consent-checked timeline only.
 * Clinical documents are separately protected by CG19 and never rendered here.
 */
export function ClinicianVisitHistory({centerRef,bookingRef}:{
 centerRef:string;bookingRef:string
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [page,setPage]=useState<Page|null>(null),[error,setError]=useState("");
 const serial=useRef(0);
 useEffect(()=>{serial.current++;setOpen(false);setPage(null);setError("");
  setBusy(false);},[centerRef,bookingRef]);
 async function fetchPage(before?:string){
  const stamp=++serial.current;setBusy(true);setError("");
  try{
   const route="/api/appointments/queue/my-centers/"+encodeURIComponent(centerRef)+
    "/bookings/"+encodeURIComponent(bookingRef)+"/clinical-history"+
    (before?"?before="+encodeURIComponent(before):"");
   const r=await fetch(route,{credentials:"same-origin",cache:"no-store"});
   if(!r.ok)throw Error(r.status===403||r.status===404?
    "Current clinician, patient consent or center authorization does not permit this history.":
    "Consultation history cannot be checked. Refresh your current center assignment.");
   const data=await r.json() as Page;
   if(stamp!==serial.current||data.appointmentRef!==bookingRef)return;
   setPage(old=>before&&old?{...data,items:[...old.items,...data.items]}:data);
  }catch(e){if(stamp===serial.current)setError(e instanceof Error?e.message:
   "Consultation history unavailable.");}
  finally{if(stamp===serial.current)setBusy(false);}
 }
 return <div className="form-section" aria-label="My current patient care relationship history">
  <button type="button" disabled={busy} onClick={()=>{
   if(open){serial.current++;setOpen(false);setPage(null);setError("");setBusy(false);}
   else{setOpen(true);void fetchPage();}
  }}>{open?"Hide authorized consultation history":"View my patient's earlier consultations here"}</button>
  {open&&<>
   <p>Only this doctor's existing consultations at this center are displayed.
    This is not an all-centers medical record, diagnosis or private document viewer.</p>
   {busy&&<p role="status">Checking current patient consent and doctor authorization…</p>}
   {!!error&&<p role="alert">{error}</p>}
   {page&&page.items.length===0&&<p>No earlier consultations are visible in this scope.</p>}
   {page&&page.items.length>0&&<ul>
    {page.items.map((item,i)=><li key={item.bookingId+":"+i}>
     {item.bookingId} · {new Date(item.consultationAt).toLocaleString("en-IN")} ·
     {" "+item.status.replaceAll("_"," ")}
    </li>)}
   </ul>}
   {page?.next&&<button type="button" disabled={busy}
    onClick={()=>void fetchPage(page.next!)}>Show older consultations</button>}
  </>}
 </div>;
}
