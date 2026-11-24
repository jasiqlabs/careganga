import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import type {Metadata} from "next";
import Link from "next/link";
import {
  directory,directorySearch,publicAreas,type PublicCenter,type PublicDoctor
} from "../../features/health-network/public-directory-source";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Healthcare Centers & Doctors | CareGanga",
 description:"Find currently verified CareGanga healthcare centers and doctors. Confirm services directly with the center.",
 robots:{index:true,follow:true},
 alternates:{canonical:"/health-network"}};
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
const nice=(value:string)=>value.toLowerCase().replaceAll("_"," ")
 .replace(/\b\w/g,c=>c.toUpperCase());
const rupee=(amount:number)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2}).format(amount/100);
export default async function HealthcareDirectory({searchParams}:Props){
 const raw=await searchParams,tab=raw.tab==="doctors"?"doctors":"centers";
 const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const rescheduleRef=typeof raw.reschedule==="string"&&ID.test(raw.reschedule)?
  raw.reschedule:"";
 const rescheduleVersion=typeof raw.version==="string"?
  Number(raw.version):NaN;
 const canReschedule=!!rescheduleRef&&Number.isSafeInteger(rescheduleVersion)&&
  rescheduleVersion>0;
 const areas=await publicAreas();
 const states=areas.filter(x=>x.level==="STATE"),districts=areas.filter(x=>x.level==="DISTRICT"),
  blocks=areas.filter(x=>x.level==="BLOCK");
 const requestedState=typeof raw.state==="string"?raw.state:"",
  requestedDistrict=typeof raw.district==="string"?raw.district:"",
  requestedBlock=typeof raw.block==="string"?raw.block:"";
 const selectedState=states.some(a=>a.value===requestedState)?requestedState:"",
  selectedDistrict=selectedState&&districts.some(a=>
   a.value===requestedDistrict&&a.parentRef===selectedState)?requestedDistrict:"",
  selectedBlock=selectedDistrict&&blocks.some(a=>
   a.value===requestedBlock&&a.parentRef===selectedDistrict)?requestedBlock:"";
 // A stale unrelated district/block must never remain in the submitted query.
 const query=directorySearch({...raw,state:selectedState,
  district:selectedDistrict,block:selectedBlock});
 const showAdvanced=["pin","state","district","block","category","service","day",
  "facility","specialty","minExperience","maxExperience","minFee","maxFee"]
  .some(key=>query.has(key));
 const result=tab==="doctors"?
  await directory<PublicDoctor>("doctors",query):
  await directory<PublicCenter>("centers",query);
 const next=new URLSearchParams(query);
 if(result.next)next.set("after",result.next);
 if(canReschedule){next.set("reschedule",rescheduleRef);
  next.set("version",String(rescheduleVersion));}
 return <HealthcarePublicChrome><main className="cg-public-shell">
  <header className="cg-public-header">
   <nav aria-label="Breadcrumb">
    <Link href="/">CareGanga</Link><span aria-hidden="true"> / </span>
    <span>Healthcare Network</span>
   </nav>
  </header>
  <section className="cg-public-section">
   <p className="cg-eyebrow">CareGanga · Healthcare Assistance</p>
   <h1>Find verified healthcare centers and doctors</h1>
   <p className="cg-lead">Find a verified doctor or healthcare center near you.
    Check available consultation times before booking. Payment is due at the center
    unless an approved online payment option is offered.</p>
   {canReschedule&&<p role="status">Choose another verified doctor and an available time.
    Your existing appointment remains confirmed until the change succeeds.</p>}
   <nav aria-label="Directory type" style={{display:"flex",flexWrap:"wrap",gap:16}}>
    {!canReschedule&&<Link href="/health-network?tab=centers"
     aria-current={tab==="centers"?"page":undefined}>Centers</Link>}
    {!canReschedule&&<Link href="/health-network/lab-tests">Lab tests & prices</Link>}
    <Link href={"/health-network?tab=doctors"+
     (canReschedule?"&reschedule="+encodeURIComponent(rescheduleRef)+
      "&version="+rescheduleVersion:"")} aria-current={tab==="doctors"?"page":undefined}>Doctors</Link>
   </nav>
   <p><Link href="/patients/me">My private patient profile and consent</Link></p>
  </section>
  <section className="cg-public-section" aria-label="Search the directory">
   <form action="/health-network" method="get" style={{display:"grid",gap:12,maxWidth:720}}>
    <input type="hidden" name="tab" value={tab}/>
    {canReschedule&&<>
     <input type="hidden" name="reschedule" value={rescheduleRef}/>
     <input type="hidden" name="version" value={rescheduleVersion}/>
    </>}
    <label>Search name or {tab==="doctors"?"qualification":"provider"}
     <input name="q" defaultValue={typeof raw.q==="string"?raw.q:""}
      type="search" maxLength={80} placeholder="Search verified records"/>
    </label>
    <details open={showAdvanced} style={{border:"1px solid #d7dfdb",
       borderRadius:12,padding:12}}>
     <summary style={{cursor:"pointer",fontWeight:600,padding:"8px 0"}}>
      More filters — location, center type, services and fees</summary>
     <div style={{display:"grid",gap:12,marginTop:12}}>
    <label>PIN code (optional)
     <input name="pin" defaultValue={typeof raw.pin==="string"?raw.pin:""}
      inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6}
      placeholder="Six-digit PIN"/>
    </label>
    {states.length>0&&<label>State
     <select name="state" defaultValue={selectedState}>
      <option value="">All states</option>
      {states.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
     </select>
    </label>}
    {selectedState&&districts.some(a=>a.parentRef===selectedState)&&
    <label>District
     <select name="district" defaultValue={selectedDistrict}>
      <option value="">All districts</option>
      {districts.filter(a=>!selectedState||a.parentRef===selectedState)
       .map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
     </select>
    </label>}
    {selectedDistrict&&blocks.some(a=>a.parentRef===selectedDistrict)&&
    <label>Block (optional)
     <select name="block" defaultValue={selectedBlock}>
      <option value="">All blocks</option>
      {blocks.filter(a=>a.parentRef===selectedDistrict)
       .map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
     </select>
    </label>}
    <label>Center type
     <select name="category" defaultValue={typeof raw.category==="string"?raw.category:""}>
      <option value="">All verified center types</option>
      {(["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING","OTHER",
        "POLYCLINIC","DIAGNOSTIC_CENTER","DENTAL_CLINIC","MEDICAL_LABORATORY",
        "NURSING_HOME","ORTHOPEDIC_CLINIC","HOMEOPATHY_CLINIC","AYURVEDIC_CLINIC"] as const)
       .map(type=><option key={type} value={type}>{nice(type)}</option>)}
     </select>
    </label>
    <label>Verified center service
     <select name="service" defaultValue={typeof raw.service==="string"?raw.service:""}>
      <option value="">All declared services</option>
      {(["CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING","SURGERY","EMERGENCY"] as const)
       .map(v=><option key={v} value={v}>{nice(v)}</option>)}
     </select>
    </label>
    <label>Operating weekday (not live opening status)
     <select name="day" defaultValue={typeof raw.day==="string"?raw.day:""}>
      <option value="">Any recorded day</option>
      {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
       .map((v,i)=><option key={v} value={i}>{v}</option>)}
     </select>
    </label>
    <label>Facilities (optional)
     <input name="facility"
      defaultValue={typeof raw.facility==="string"?raw.facility:""}
      maxLength={80} placeholder="e.g. Wheelchair access"/>
    </label>
    {tab==="doctors"&&<>
     <label>Specialty <input name="specialty"
      defaultValue={typeof raw.specialty==="string"?raw.specialty:""}
      maxLength={60} placeholder="e.g. General Medicine"/></label>
     <label>Minimum consultation fee (₹)
      <input name="minFee" inputMode="numeric" type="number" min={0} max={9999999}
       defaultValue={typeof raw.minFee==="string"?raw.minFee:""}/></label>
     <label>Minimum years of experience
      <input name="minExperience" inputMode="numeric" type="number"
       min={0} max={70} defaultValue={typeof raw.minExperience==="string"?raw.minExperience:""}/>
     </label>
     <label>Maximum years of experience
      <input name="maxExperience" inputMode="numeric" type="number"
       min={0} max={70} defaultValue={typeof raw.maxExperience==="string"?raw.maxExperience:""}/>
     </label>
     <label>Maximum consultation fee (₹)
      <input name="maxFee" inputMode="numeric" type="number" min={0} max={9999999}
       defaultValue={typeof raw.maxFee==="string"?raw.maxFee:""}/></label>
    </>}
     </div>
    </details>
    <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"center"}}>
     <button type="submit">Apply filters</button>
     <Link href={"/health-network?tab="+tab+
      (canReschedule?"&reschedule="+encodeURIComponent(rescheduleRef)+
       "&version="+rescheduleVersion:"")}>Reset filters</Link>
    </div>
   </form>
  </section>
  <section className="cg-public-section" aria-live="polite">
   <h2>{tab==="centers"?"Published healthcare centers":"Verified professionals"}</h2>
   {result.state==="UNAVAILABLE"?<p role="alert">Current verified directory results
     could not be checked. Please try again. No outdated listing is shown.</p>:
    result.items.length===0?<p>No currently approved listings match your search.</p>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:16}}>
     {tab==="centers"?
      (result.items as PublicCenter[]).map(c=><article key={c.slug}
        style={{border:"1px solid #d7dfdb",borderRadius:12,padding:18}}>
       <p className="cg-eyebrow">{nice(c.type)} · Verified center</p>
       <h3><Link href={"/healthcare/centers/"+encodeURIComponent(c.slug)}>{c.centerName}</Link></h3>
       <p>{c.providerName}</p><p>{c.address}, {c.pinCode}</p>
       <Link href={"/healthcare/centers/"+encodeURIComponent(c.slug)}>View center details</Link>
      </article>):
      (result.items as PublicDoctor[]).map(d=><article
        key={d.doctorRef+":"+d.centerSlug}
        style={{border:"1px solid #d7dfdb",borderRadius:12,padding:18}}>
       <p className="cg-eyebrow">Verified doctor · {d.centerName}</p>
       <h3><Link href={"/health-network/doctors/"+encodeURIComponent(d.doctorRef)}>
        {d.doctorName}</Link></h3>
       <p>{d.specialties.join(", ")||"Specialty not listed"}</p>
       {d.qualifications.length>0&&<p>{d.qualifications.join(", ")}</p>}
       {Number.isInteger(d.experienceYears)&&d.experienceYears>=0&&
        <p>{d.experienceYears} {d.experienceYears===1?"year":"years"} of experience</p>}
       <p>{d.address}, {d.pinCode}</p>
       <p><strong>{d.fee?rupee(d.fee.amountMinor):"Fee not listed"}</strong>
        {d.fee?" · In-person consultation":""}</p>
       <div className="cg-health-directory-actions">
        <Link href={"/health-network/doctors/"+encodeURIComponent(d.doctorRef)}>
         View doctor profile</Link>
        {!canReschedule&&d.fee&&<Link className="cg-health-link-action primary"
         href={"/health-network/doctors/"+encodeURIComponent(d.doctorRef)+"/schedule"}>
         Check appointment times</Link>}
       </div>
       {canReschedule&&<p><Link href={"/health-network/doctors/"+
        encodeURIComponent(d.doctorRef)+"/schedule?reschedule="+
        encodeURIComponent(rescheduleRef)+"&version="+rescheduleVersion}>
        Choose a time with this doctor</Link></p>}
      </article>)}
    </div>}
   {result.state==="READY"&&result.next&&<p style={{marginTop:20}}>
    <Link href={"/health-network?tab="+tab+"&"+next.toString()}>Next results</Link>
   </p>}
  </section>
  <section className="cg-public-section">
   <p>Listings do not imply availability, a booking, a benefit amount, or a medical recommendation.</p>
  </section>
 </main></HealthcarePublicChrome>;
}
