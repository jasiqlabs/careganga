import {HealthcarePublicChrome} from "../../../../../shared/healthcare-public-chrome";
import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {publicDoctor} from "../../../../../features/health-network/public-directory-source";
import {PatientBookingAction} from "../../../../../features/appointments/patient-booking-action";
import {PatientRescheduleAction} from "../../../../../features/appointments/patient-reschedule-action";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Doctor working hours | CareGanga",
 description:"Preview verified doctor's published working schedule. Pay-at-center consultations may be available.",
 robots:{index:false,follow:false}};
type Props={params:Promise<{doctorRef:string}>,
 searchParams:Promise<Record<string,string|string[]|undefined>>};
type Option={centerRef:string;centerName:string;centerSlug:string;address:string;
 pinCode:string;timeZone:string;hasWorkingSchedule:boolean;
 consultationFeeMinor:string|null};
type Options={day:string;doctorName:string;centers:Option[];message:string};
type Slot={startAt:string;endAt:string;startLocal:string;endLocal:string;
 bookable:boolean};
type Daily={status:string;day:string;doctorName:string;centerName:string;
 timeZone:string;centerSlug:string;slots:Slot[];message:string;
 consultationFeeMinor:string|null;consultationFeeVersion:number|null};
type Choices={centerChoices:{centerRef:string;centerName:string;centerSlug:string;
 address:string;pinCode:string;consultationFeeMinor:string|null;
 consultationFeeVersion:number|null;timeZone:string;startAt:string;endAt:string;bookable:boolean}[];
 message:string};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function source<T>(path:string):Promise<T|null>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return null;
 try{
  const res=await fetch(new URL("/api/v1/appointments/public/"+path,backend),{
   cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!res.ok)return null;
  return await res.json() as T;
 }catch{return null;}
}
const displayFee=(minor:string|null)=>minor!==null&&/^[0-9]+$/.test(minor)?
 new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})
  .format(Number(minor)/100):"Ask the center for consultation fees.";
export default async function DoctorSchedulePreview({params,searchParams}:Props){
 const {doctorRef}=await params,doctor=await publicDoctor(doctorRef);
 if(!doctor)notFound();
 const query=await searchParams;
 const date=typeof query.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(query.date)?
  query.date:"";
 const requestedCenterRef=typeof query.centerRef==="string"&&ID.test(query.centerRef)?query.centerRef:"";
 const preferredCenter=typeof query.center==="string"?doctor.centers.find(c=>c.centerSlug===query.center):undefined;
 const time=typeof query.time==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(query.time)?
  query.time:"";
 const mode=query.mode==="time"?"time":"center";
 const rescheduleRef=typeof query.reschedule==="string"&&ID.test(query.reschedule)?
  query.reschedule:"";
 const version=typeof query.version==="string"?Number(query.version):0;
 const validReschedule=!!rescheduleRef&&Number.isSafeInteger(version)&&version>0;
 const options=date?await source<Options>("doctor/"+
  encodeURIComponent(doctorRef)+"/center-options?date="+encodeURIComponent(date)):null;
 const centerRef=requestedCenterRef||(query.centerRef===undefined&&preferredCenter?options?.centers.find(c=>c.centerSlug===preferredCenter.centerSlug)?.centerRef??"":"");
 const validCenter=!!options?.centers.some(x=>x.centerRef===centerRef);
 const selected=mode==="center"&&date&&validCenter?
  await source<Daily>("center-first?doctorRef="+encodeURIComponent(doctorRef)+
   "&centerRef="+encodeURIComponent(centerRef)+"&date="+encodeURIComponent(date)):null;
 const alternatives=mode==="time"&&date&&time?
  await source<Choices>("slot-first?doctorRef="+encodeURIComponent(doctorRef)+
   "&date="+encodeURIComponent(date)+"&time="+encodeURIComponent(time)):null;
 return <HealthcarePublicChrome><main className="cg-public-shell">
  <header className="cg-public-header"><nav aria-label="Breadcrumb">
   <Link href="/health-network">Healthcare</Link>{" / "}
   <Link href={"/health-network/doctors/"+encodeURIComponent(doctorRef)}>
    {doctor.doctorName}</Link></nav></header>
  <section className="cg-public-section">
   <p className="cg-eyebrow">Verified doctor — published working schedule</p>
   <h1>{doctor.doctorName}: Working hours</h1>
   <p>Choose a day and center, or look up a time across the doctor's verified centers.
    Available times are advisory until a temporary reservation succeeds.
    Appointments are confirmed only after final review; payment is due at the center.</p>
   {validReschedule&&<p>You are choosing a new time for an existing appointment.
     Your original time is retained until the change is confirmed.</p>}
   <form method="get" style={{display:"grid",gap:16,maxWidth:680}}>
    {validReschedule&&<><input type="hidden" name="reschedule" value={rescheduleRef}/>
     <input type="hidden" name="version" value={version}/></>}
    {preferredCenter&&<input type="hidden" name="center" value={preferredCenter.centerSlug}/>}
    {preferredCenter&&!date&&<p>Selected center: <strong>{preferredCenter.centerName}</strong></p>}
    <fieldset style={{border:"1px solid #d7dfdb",borderRadius:12,padding:14}}>
     <legend>How would you like to search?</legend>
     <label style={{display:"inline-flex",gap:8,marginRight:18}}>
      <input type="radio" name="mode" value="center" defaultChecked={mode==="center"}/>
      Choose center and day
     </label>
     <label style={{display:"inline-flex",gap:8}}>
      <input type="radio" name="mode" value="time" defaultChecked={mode==="time"}/>
      Choose day and time
     </label>
    </fieldset>
    <label>Appointment day (next 30 days)
     <input type="date" name="date" required defaultValue={date}/>
    </label>
    <label>Doctor's center (optional for time-first search)
     <select name="centerRef" disabled={!options} defaultValue={validCenter?centerRef:""}>
      <option value="">Choose center after entering a date</option>
      {options?.centers.map(c=><option key={c.centerRef} value={c.centerRef}>
       {c.centerName}</option>)}
     </select>
    </label>
    <label>Local starting time (only used for time-first search)
     <input type="time" name="time" defaultValue={time} step={300}/>
    </label>
    <button type="submit" className="primary" style={{maxWidth:260}}>View current consultation times</button>
   </form>
  </section>
  <section className="cg-public-section" aria-live="polite">
   {!date&&<p>Choose a date to see published working schedules.</p>}
   {date&&!options&&<p>Current verified schedules could not be confirmed.
    Please contact the healthcare center directly.</p>}
   {!!options&&<><h2>Verified center choices</h2>
    {options.centers.map(c=><article key={c.centerRef}
     style={{padding:14,borderBottom:"1px solid #d7dfdb"}}>
     <h3><Link href={"/healthcare/centers/"+encodeURIComponent(c.centerSlug)}>
      {c.centerName}</Link></h3>
     <p>{c.address}, {c.pinCode}</p>
     <p>{c.hasWorkingSchedule?"A working schedule is configured for this period.":
      "No current weekly schedule confirmed for this date."}</p>
     <p>Approved consultation fee: {displayFee(c.consultationFeeMinor)}</p>
    </article>)}
   </>}
   {mode==="center"&&date&&options&&requestedCenterRef&&!validCenter&&<p role="alert">This center is no longer available for the chosen day. Select a current center.</p>}
   {mode==="center"&&validCenter&&!selected&&<p role="alert">The selected center schedule could not be checked. Try again.</p>}
   {mode==="time"&&date&&time&&!alternatives&&<p role="alert">Center choices could not be checked. Try again.</p>}
   {mode==="center"&&validCenter&&selected&&<>
    <h2>{selected.centerName} — {date}</h2>
    <p>All times shown in {selected.timeZone}. A visible time is not reserved until you receive confirmation.</p>
    {selected.slots.length===0?<p>No scheduled consultation window is
     confirmed for this date.</p>:
     <ul>{selected.slots.map(slot=><li key={slot.startAt}>
      {slot.startLocal}–{slot.endLocal}
      {slot.bookable&&selected.consultationFeeMinor!==null&&
       selected.consultationFeeVersion!==null?
       validReschedule?
       <PatientRescheduleAction bookingRef={rescheduleRef} expectedVersion={version}
        key={[rescheduleRef,doctorRef,centerRef,slot.startAt,slot.endAt,
         selected.consultationFeeMinor,selected.consultationFeeVersion].join("|")}
        doctorRef={doctorRef} centerRef={centerRef}
        doctorName={selected.doctorName} centerName={selected.centerName}
        startAt={slot.startAt} endAt={slot.endAt} timeZone={selected.timeZone}
        feeMinor={selected.consultationFeeMinor}
        feeVersion={selected.consultationFeeVersion}/>:
       <PatientBookingAction
        key={[doctorRef,centerRef,slot.startAt,slot.endAt,
         selected.consultationFeeMinor,selected.consultationFeeVersion].join("|")}
        doctorRef={doctorRef} centerRef={centerRef}
        doctorName={selected.doctorName} centerName={selected.centerName}
        startAt={slot.startAt} endAt={slot.endAt} timeZone={selected.timeZone}
        feeMinor={selected.consultationFeeMinor}
        feeVersion={selected.consultationFeeVersion}/>:
       <span> — booking unavailable</span>}
     </li>)}</ul>}
   </>}
   {mode==="time"&&date&&time&&alternatives&&<>
    <h2>Center choices for {time}</h2>
    {alternatives.centerChoices.length===0?
     <p>No matching verified working time was found.</p>:
     <ul>{alternatives.centerChoices.map(c=><li key={c.centerSlug}>
      <Link href={"/healthcare/centers/"+encodeURIComponent(c.centerSlug)}>
       {c.centerName}</Link> — {c.address}, {c.pinCode}.
      Current approved consultation: {displayFee(c.consultationFeeMinor)}.
      Time zone: {c.timeZone}.
      {c.bookable&&c.consultationFeeMinor!==null&&
       c.consultationFeeVersion!==null?
       validReschedule?
       <PatientRescheduleAction bookingRef={rescheduleRef} expectedVersion={version}
        key={[rescheduleRef,doctorRef,c.centerRef,c.startAt,c.endAt,
         c.consultationFeeMinor,c.consultationFeeVersion].join("|")}
        doctorRef={doctorRef} centerRef={c.centerRef}
        doctorName={doctor.doctorName} centerName={c.centerName}
        startAt={c.startAt} endAt={c.endAt} timeZone={c.timeZone}
        feeMinor={c.consultationFeeMinor}
        feeVersion={c.consultationFeeVersion}/>:
       <PatientBookingAction
        key={[doctorRef,c.centerRef,c.startAt,c.endAt,
         c.consultationFeeMinor,c.consultationFeeVersion].join("|")}
        doctorRef={doctorRef} centerRef={c.centerRef}
        doctorName={doctor.doctorName} centerName={c.centerName}
        startAt={c.startAt} endAt={c.endAt} timeZone={c.timeZone}
        feeMinor={c.consultationFeeMinor}
        feeVersion={c.consultationFeeVersion}/>:
       <span> — booking unavailable</span>}
     </li>)}</ul>}
   </>}
   <p><Link href="/patients/me">Sign in to my private patient profile</Link> before reserving.
    Only pay-at-center consultations are offered; no online payment, lab or other ERP booking.
    Availability may change until the reservation is accepted.</p>
  </section>
 </main></HealthcarePublicChrome>;
}
