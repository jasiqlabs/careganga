import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {publicDoctor} from "../../../../features/health-network/public-directory-source";
export const dynamic="force-dynamic";
type Props={params:Promise<{doctorRef:string}>};
const money=(minor:number)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR"}).format(minor/100);
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {doctorRef}=await params,doctor=await publicDoctor(doctorRef);
 if(!doctor)return {title:"Verified doctor unavailable | CareGanga",
  robots:{index:false,follow:false}};
 return {title:doctor.doctorName+" | CareGanga Healthcare Network",
  description:"Verified doctor profile and current eligible centers. Contact the center to confirm services.",
  alternates:{canonical:"/health-network/doctors/"+encodeURIComponent(doctorRef)},
  robots:{index:true,follow:true}};
}
export default async function VerifiedDoctor({params}:Props){
 const {doctorRef}=await params,doctor=await publicDoctor(doctorRef);
 if(!doctor)notFound();
 return <main className="cg-public-shell">
  <header className="cg-public-header">
   <nav aria-label="Breadcrumb"><Link href="/">CareGanga</Link>{" / "}
    <Link href="/health-network?tab=doctors">Doctors</Link></nav>
  </header>
  <section className="cg-public-section">
   <p className="cg-eyebrow">Currently verified healthcare professional</p>
   <h1>{doctor.doctorName}</h1>
   {doctor.qualifications.length>0&&<p>Qualifications: {doctor.qualifications.join(", ")}</p>}
   {doctor.specialties.length>0&&<p>Specialties: {doctor.specialties.join(", ")}</p>}
   <p>Experience: {doctor.experienceYears} {doctor.experienceYears===1?"year":"years"}</p>
   {doctor.bio&&<p>{doctor.bio}</p>}
   <p>{doctor.notice}</p>
  </section>
  <section className="cg-public-section">
   <h2>Currently approved centers</h2>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:16}}>
    {doctor.centers.map(c=><article key={c.centerSlug}
      style={{border:"1px solid #d7dfdb",borderRadius:12,padding:18}}>
     <h3><Link href={"/healthcare/centers/"+encodeURIComponent(c.centerSlug)}>
      {c.centerName}</Link></h3>
     <p>{c.address}, {c.pinCode}</p>
     <p>{c.fee?("Current approved in-person consultation: "+money(c.fee.amountMinor)):
       "No current approved consultation fee displayed. Ask the center."}</p>
     <Link href={"/healthcare/centers/"+encodeURIComponent(c.centerSlug)}>
      View location and contact details</Link>
    </article>)}
   </div>
  </section>
  <section className="cg-public-section">
   <h2>Doctor working hours</h2>
   <p><Link href={"/health-network/doctors/"+encodeURIComponent(doctorRef)+"/schedule"}>
    Preview verified doctor-center consultation schedules</Link></p>
   <p>Working hours are not confirmed free appointments.
    Online booking and payments are not enabled; contact the center directly.</p>
  </section>
 </main>;
}
