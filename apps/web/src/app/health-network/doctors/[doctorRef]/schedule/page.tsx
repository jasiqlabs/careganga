import {HealthcarePublicChrome} from "../../../../../shared/healthcare-public-chrome";
import type {Metadata} from "next";
import Link from "next/link";
import styles from "../../../booking.module.css";
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
type Daily={status:string;day:string;doctorName:string;centerName:string;centerRef:string;
 timeZone:string;centerSlug:string;slots:Slot[];message:string;
 consultationFeeMinor:string|null;consultationFeeVersion:number|null};
type Choices={day:string;time:string;centerChoices:{centerRef:string;centerName:string;centerSlug:string;
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
const validMinor=(v:unknown)=>typeof v==="string"&&/^[0-9]+$/.test(v)&&Number.isSafeInteger(Number(v));
const validFee=(minor:unknown,version:unknown)=>validMinor(minor)&&typeof version==="number"&&Number.isSafeInteger(version)&&version>0;
const validZone=(zone:unknown)=>{if(typeof zone!=="string"||!zone)return false;try{new Intl.DateTimeFormat("en-IN",{timeZone:zone});return true;}catch{return false;}};
const validWindow=(slot:unknown)=>{if(!slot||typeof slot!=="object"||Array.isArray(slot))return false;const v=slot as Record<string,unknown>;return typeof v.startAt==="string"&&typeof v.endAt==="string"&&Number.isFinite(Date.parse(v.startAt))&&Number.isFinite(Date.parse(v.endAt))&&Date.parse(v.endAt)>Date.parse(v.startAt)&&typeof v.bookable==="boolean";};
// Check actual center-local calendar and clock, not only server-provided labels.
function localStamp(value:string,zone:string){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
 const part=(type:string)=>parts.find(p=>p.type===type)?.value??"";
 return {day:`${part("year")}-${part("month")}-${part("day")}`,time:`${part("hour")}:${part("minute")}`};
}
function matchesLocalStart(slot:Slot|Choices["centerChoices"][number],zone:string,day:string,time:string){
 const local=localStamp(slot.startAt,zone);
 return local.day===day&&local.time===time&&(!slot.bookable||Date.parse(slot.startAt)>Date.now());
}
const validCenterFields=(value:unknown)=>{if(!value||typeof value!=="object"||Array.isArray(value))return false;const v=value as Record<string,unknown>;return typeof v.centerRef==="string"&&ID.test(v.centerRef)&&typeof v.centerSlug==="string"&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v.centerSlug)&&["centerName","address","pinCode"].every(k=>typeof v[k]==="string")&&validZone(v.timeZone)&&(v.consultationFeeMinor===null||validMinor(v.consultationFeeMinor));};
const displayFee=(minor:string|null)=>validMinor(minor)?
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
 const rawOptions=date?await source<Options>("doctor/"+
  encodeURIComponent(doctorRef)+"/center-options?date="+encodeURIComponent(date)):null;
 const options=rawOptions?.day===date&&rawOptions.doctorName===doctor.doctorName&&Array.isArray(rawOptions.centers)&&rawOptions.centers.length<=40&&rawOptions.centers.every(c=>validCenterFields(c)&&typeof c.hasWorkingSchedule==="boolean"&&doctor.centers.some(d=>d.centerSlug===c.centerSlug))?rawOptions:null;
 const centerRef=requestedCenterRef||(query.centerRef===undefined&&preferredCenter?options?.centers.find(c=>c.centerSlug===preferredCenter.centerSlug)?.centerRef??"":"");
 const selectedCenter=options?.centers.find(x=>x.centerRef===centerRef);
 const validCenter=!!selectedCenter;
 const rawSelected=mode==="center"&&date&&validCenter?
  await source<Daily>("center-first?doctorRef="+encodeURIComponent(doctorRef)+
   "&centerRef="+encodeURIComponent(centerRef)+"&date="+encodeURIComponent(date)):null;
 const selected=rawSelected?.day===date&&rawSelected.centerRef===centerRef&&!!selectedCenter&&rawSelected.centerName===selectedCenter.centerName&&rawSelected.doctorName===doctor.doctorName&&rawSelected.timeZone===selectedCenter.timeZone&&validZone(rawSelected.timeZone)&&Array.isArray(rawSelected.slots)&&rawSelected.slots.length<=144&&(rawSelected.centerSlug===selectedCenter.centerSlug||rawSelected.slots.length===0&&rawSelected.centerSlug===undefined)&&rawSelected.slots.every(s=>validWindow(s)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.startLocal)&&/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(s.endLocal)&&matchesLocalStart(s,rawSelected.timeZone,date,s.startLocal))?rawSelected:null;
 const rawAlternatives=mode==="time"&&date&&time?
  await source<Choices>("slot-first?doctorRef="+encodeURIComponent(doctorRef)+
   "&date="+encodeURIComponent(date)+"&time="+encodeURIComponent(time)):null;
 const alternatives=rawAlternatives?.day===date&&rawAlternatives.time===time&&Array.isArray(rawAlternatives.centerChoices)&&rawAlternatives.centerChoices.length<=40&&!!options&&rawAlternatives.centerChoices.every(c=>validCenterFields(c)&&validWindow(c)&&options.centers.some(o=>o.centerRef===c.centerRef&&o.centerSlug===c.centerSlug&&o.centerName===c.centerName&&o.timeZone===c.timeZone)&&matchesLocalStart(c,c.timeZone,date,time))?rawAlternatives:null;
 const chosenStart=typeof query.slot==="string"?query.slot:"",chosenCenter=typeof query.choice==="string"?query.choice:"";
 const choose=(slot:string,choice:string)=>{const p=new URLSearchParams({date,mode});if(centerRef)p.set("centerRef",centerRef);if(time)p.set("time",time);if(preferredCenter)p.set("center",preferredCenter.centerSlug);if(slot)p.set("slot",slot);if(choice)p.set("choice",choice);if(validReschedule){p.set("reschedule",rescheduleRef);p.set("version",String(version));}return "?"+p.toString()+"#booking-summary";};
 const activeSlot=selected?.slots.find(s=>s.bookable===true&&s.startAt===chosenStart);
 const activeChoice=alternatives?.centerChoices.find(c=>c.bookable===true&&c.centerRef===chosenCenter&&c.startAt===chosenStart);
 const active=activeSlot&&selected&&typeof selected.consultationFeeMinor==="string"&&typeof selected.consultationFeeVersion==="number"&&validFee(selected.consultationFeeMinor,selected.consultationFeeVersion)?{doctorRef,centerRef,doctorName:selected.doctorName,centerName:selected.centerName,startAt:activeSlot.startAt,endAt:activeSlot.endAt,timeZone:selected.timeZone,feeMinor:selected.consultationFeeMinor,feeVersion:selected.consultationFeeVersion}:activeChoice&&typeof activeChoice.consultationFeeMinor==="string"&&typeof activeChoice.consultationFeeVersion==="number"&&validFee(activeChoice.consultationFeeMinor,activeChoice.consultationFeeVersion)?{doctorRef,centerRef:activeChoice.centerRef,doctorName:doctor.doctorName,centerName:activeChoice.centerName,startAt:activeChoice.startAt,endAt:activeChoice.endAt,timeZone:activeChoice.timeZone,feeMinor:activeChoice.consultationFeeMinor,feeVersion:activeChoice.consultationFeeVersion}:null;
 const returnPath="/health-network/doctors/"+encodeURIComponent(doctorRef)+"/schedule"+choose(active?.startAt??"",activeChoice?.centerRef??"");
 const patientHref="/patients/me?returnTo="+encodeURIComponent(returnPath);
 return <HealthcarePublicChrome><main className={"cg-public-shell "+styles.schedulePage}>
  <header className="cg-public-header"><nav aria-label="Breadcrumb">
   <Link href="/health-network">Healthcare</Link>{" / "}
   <Link href={"/health-network/doctors/"+encodeURIComponent(doctorRef)}>
    {doctor.doctorName}</Link></nav></header>
  <ol className={styles.steps} aria-label="Appointment progress"><li className={styles.done}>1. Select doctor</li><li aria-current="step" className={styles.current}>2. Choose date &amp; time</li><li>3. Review &amp; confirm</li><li>4. Appointment confirmed</li></ol>
  <div className={styles.layout}><aside className={"cg-public-section "+styles.panel}><h2>Doctor details</h2><h3>{doctor.doctorName}</h3><p>{doctor.specialties.join(", ")}</p><p>{doctor.qualifications.join(", ")}</p><p>{doctor.experienceYears} years of experience</p><Link href={"/health-network/doctors/"+encodeURIComponent(doctorRef)}>View doctor profile</Link></aside><div className={styles.middle}>
  <section className={"cg-public-section "+styles.panel}>
   <p className={"cg-eyebrow "+styles.verified}>Verified doctor — published working schedule</p>
   <h1>Choose appointment date &amp; time</h1>
   <p>Choose a day and center, or look up a time across the doctor's verified centers.
    Available times are advisory until a temporary reservation succeeds.
    Appointments are confirmed only after final review; payment is due at the center.</p>
   {validReschedule&&<p>You are choosing a new time for an existing appointment.
     Your original time is retained until the change is confirmed.</p>}
   <form method="get" className={styles.form}>
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
  <section className={"cg-public-section "+styles.panel} aria-live="polite">
   {!date&&<p>Choose a date to see published working schedules.</p>}
   {date&&!options&&<p>Current verified schedules could not be confirmed.
    Please contact the healthcare center directly.</p>}
   {!!options&&<><h2>Verified center choices</h2><div className={styles.centers}>
    {options.centers.map(c=><article key={c.centerRef}
     className={centerRef===c.centerRef?styles.selectedCard:styles.centerCard}>
     <h3><Link href={"/healthcare/centers/"+encodeURIComponent(c.centerSlug)}>
      {c.centerName}</Link></h3>
     <p>{c.address}, {c.pinCode}</p>
     <p>{c.hasWorkingSchedule?"A working schedule is configured for this period.":
      "No current weekly schedule confirmed for this date."}</p>
     <p className={styles.fee}>Approved consultation fee <strong>{displayFee(c.consultationFeeMinor)}</strong></p>
     {mode==="center"&&<Link href={(()=>{const p=new URLSearchParams({date,mode:"center",centerRef:c.centerRef});if(validReschedule){p.set("reschedule",rescheduleRef);p.set("version",String(version));}return "?"+p.toString();})()} className="cg-health-link-action">View times here</Link>}
    </article>)}</div>
   </>}
   {mode==="center"&&date&&options&&requestedCenterRef&&!validCenter&&<p role="alert">This center is no longer available for the chosen day. Select a current center.</p>}
   {mode==="center"&&validCenter&&!selected&&<p role="alert">The selected center schedule could not be checked. Try again.</p>}
   {mode==="time"&&date&&time&&!alternatives&&<p role="alert">Center choices could not be checked. Try again.</p>}
   {mode==="center"&&validCenter&&selected&&<>
    <h2>{selected.centerName} — {date}</h2>
    <p>All times shown in {selected.timeZone}. A visible time is not reserved until you receive confirmation.</p>
    {selected.slots.length===0?<p>No scheduled consultation window is
     confirmed for this date.</p>:
     <div>{[["Morning",0,12],["Afternoon",12,16],["Evening",16,24]].map(([label,from,to])=>{const slots=selected.slots.filter(s=>Number(s.startLocal.slice(0,2))>=Number(from)&&Number(s.startLocal.slice(0,2))<Number(to));return slots.length>0?<section key={label}><h3>{label}</h3><div className={styles.slots}>{slots.map(slot=>slot.bookable===true&&validFee(selected.consultationFeeMinor,selected.consultationFeeVersion)?<Link key={[doctorRef,centerRef,slot.startAt,slot.endAt,selected.consultationFeeMinor,selected.consultationFeeVersion].join("|")} className={styles.slot} aria-current={activeSlot?.startAt===slot.startAt?"true":undefined} href={choose(slot.startAt,"")}>{slot.startLocal}–{slot.endLocal}</Link>:<span key={slot.startAt} className={styles.unavailableSlot}>{slot.startLocal}–{slot.endLocal} · unavailable</span>)}</div></section>:null;})}</div>}
   </>}
   {mode==="time"&&date&&time&&alternatives&&<>
    <h2>Center choices for {time}</h2>
    {alternatives.centerChoices.length===0?
     <p>No matching verified working time was found.</p>:
     <div className={styles.centers}>{alternatives.centerChoices.map(c=><article key={[doctorRef,c.centerRef,c.startAt,c.endAt,c.consultationFeeMinor,c.consultationFeeVersion].join("|")} className={activeChoice?.centerRef===c.centerRef?styles.selectedCard:styles.centerCard}><h3><Link href={"/healthcare/centers/"+encodeURIComponent(c.centerSlug)}>{c.centerName}</Link></h3><p>{c.address}, {c.pinCode}</p><p className={styles.fee}><strong>{displayFee(c.consultationFeeMinor)}</strong> · {c.timeZone}</p>{c.bookable===true&&validFee(c.consultationFeeMinor,c.consultationFeeVersion)?<Link className={styles.slot} href={choose(c.startAt,c.centerRef)}>Select this center &amp; time</Link>:<p>Booking unavailable</p>}</article>)}</div>}
   </>}
  </section></div>
  <aside id="booking-summary" className={"cg-public-section "+styles.panel}><h2>Appointment summary</h2><p><strong>{doctor.doctorName}</strong></p><p>{date||"Choose appointment date"}</p>
   {active?<>{validReschedule?<PatientRescheduleAction key={[rescheduleRef,active.centerRef,active.startAt,active.feeVersion].join("|")} bookingRef={rescheduleRef} expectedVersion={version} {...active}/>:<PatientBookingAction key={[active.centerRef,active.startAt,active.feeVersion].join("|")} {...active}/>}</>:<p>Select an available time and center to review the actual fee before reserving.</p>}
   <p><Link href={patientHref}>Sign in or register as a patient</Link> before reserving. Center payment options are verified separately. Availability may change until the reservation is accepted.</p></aside></div>
 </main></HealthcarePublicChrome>;
}
