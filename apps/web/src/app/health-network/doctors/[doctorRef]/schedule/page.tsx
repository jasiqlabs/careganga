import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {publicDoctor} from "../../../../../features/health-network/public-directory-source";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Doctor working hours | CareGanga",
 description:"Preview verified doctor's published working schedule. Online booking is not yet available.",
 robots:{index:false,follow:false}};
type Props={params:Promise<{doctorRef:string}>,
 searchParams:Promise<Record<string,string|string[]|undefined>>};
type Option={centerRef:string;centerName:string;centerSlug:string;address:string;
 pinCode:string;timeZone:string;hasWorkingSchedule:boolean;
 consultationFeeMinor:string|null};
type Options={day:string;doctorName:string;centers:Option[];message:string};
type Slot={startAt:string;endAt:string;startLocal:string;endLocal:string;
 bookable:false};
type Daily={status:string;day:string;doctorName:string;centerName:string;
 timeZone:string;centerSlug:string;slots:Slot[];message:string;
 consultationFeeMinor:string|null};
type Choices={centerChoices:{centerName:string;centerSlug:string;
 address:string;pinCode:string;consultationFeeMinor:string|null;
 timeZone:string;startAt:string;endAt:string;bookable:false}[];
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
 const centerRef=typeof query.centerRef==="string"&&ID.test(query.centerRef)?
  query.centerRef:"";
 const time=typeof query.time==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(query.time)?
  query.time:"";
 const mode=query.mode==="time"?"time":"center";
 const options=date?await source<Options>("doctor/"+
  encodeURIComponent(doctorRef)+"/center-options?date="+encodeURIComponent(date)):null;
 const validCenter=!!options?.centers.some(x=>x.centerRef===centerRef);
 const selected=mode==="center"&&date&&validCenter?
  await source<Daily>("center-first?doctorRef="+encodeURIComponent(doctorRef)+
   "&centerRef="+encodeURIComponent(centerRef)+"&date="+encodeURIComponent(date)):null;
 const alternatives=mode==="time"&&date&&time?
  await source<Choices>("slot-first?doctorRef="+encodeURIComponent(doctorRef)+
   "&date="+encodeURIComponent(date)+"&time="+encodeURIComponent(time)):null;
 return <main className="cg-public-shell">
  <header className="cg-public-header"><nav aria-label="Breadcrumb">
   <Link href="/health-network">Healthcare</Link>{" / "}
   <Link href={"/health-network/doctors/"+encodeURIComponent(doctorRef)}>
    {doctor.doctorName}</Link></nav></header>
  <section className="cg-public-section">
   <p className="cg-eyebrow">Verified doctor — published working schedule</p>
   <h1>{doctor.doctorName}: Working hours</h1>
   <p>Choose a day and center, or look up a time across the doctor's verified centers.
    This is a schedule preview, <strong>not live booking availability</strong>.
    No appointment or payment is created here.</p>
   <form method="get" style={{display:"grid",gap:16,maxWidth:680}}>
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
    <label>Appointment day to preview (next 30 days)
     <input type="date" name="date" required defaultValue={date}/>
    </label>
    <label>Doctor's center (optional for time-first search)
     <select name="centerRef" defaultValue={validCenter?centerRef:""}>
      <option value="">Choose center after entering a date</option>
      {options?.centers.map(c=><option key={c.centerRef} value={c.centerRef}>
       {c.centerName}</option>)}
     </select>
    </label>
    <label>Local starting time (only used for time-first search)
     <input type="time" name="time" defaultValue={time} step={300}/>
    </label>
    <button type="submit" style={{maxWidth:260}}>View actual working hours</button>
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
   {mode==="center"&&validCenter&&selected&&<>
    <h2>{selected.centerName} — {date}</h2>
    <p>All times shown in {selected.timeZone}. These are working-time
     previews, not guaranteed free appointment slots.</p>
    {selected.slots.length===0?<p>No scheduled consultation window is
     confirmed for this date.</p>:
     <ul>{selected.slots.map(slot=><li key={slot.startAt}>
      {slot.startLocal}–{slot.endLocal} — preview only
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
      Time zone: {c.timeZone}. Preview only
     </li>)}</ul>}
   </>}
   <p>Online appointment booking, confirmation, cancellation and payment
    will appear only when the actual booking service is available.
    For now, contact the center to arrange a visit.</p>
  </section>
 </main>;
}
