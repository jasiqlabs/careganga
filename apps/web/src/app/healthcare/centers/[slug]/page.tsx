import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {directory,type PublicDoctor} from "../../../../features/health-network/public-directory-source";
export const dynamic="force-dynamic";
type Params={params:Promise<{slug:string}>};
type Center={
 centerName:string;providerName:string;type:string;
 address:string;pinCode:string;publicPhone:string|null;
 timeZone:string;latitude:number|null;longitude:number|null;
 hours:{weekday:number;opens:string;closes:string;service:string}[];
 declaredServices:string[];notice:string;
};
const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const format=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
async function current(slug:string):Promise<Center|null>{
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug))return null;
 const backend=process.env.BACKEND_URL;
 if(!backend)return null;
 try{
  const r=await fetch(new URL("/api/v1/public/health-network/centers/"+
    encodeURIComponent(slug),backend),{
    cache:"no-store",signal:AbortSignal.timeout(9000)
  });
  if(!r.ok)return null;
  const value:unknown=await r.json();
  if(!value||typeof value!=="object"||
    !("centerName" in value)||typeof value.centerName!=="string"||
    !("providerName" in value)||typeof value.providerName!=="string"||
    !("address" in value)||typeof value.address!=="string"||
    !("hours" in value)||!Array.isArray(value.hours)||
    !("declaredServices" in value)||!Array.isArray(value.declaredServices))
    return null;
  return value as Center;
 }catch{return null;}
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {slug}=await params,c=await current(slug);
 if(!c)return {title:"Healthcare center unavailable | CareGanga",
   robots:{index:false,follow:false}};
 const title=c.centerName+" | CareGanga Healthcare";
 return {title,description:c.providerName+" — verified healthcare center in CareGanga.",
  alternates:{canonical:"/healthcare/centers/"+encodeURIComponent(slug)},
  robots:{index:true,follow:true}};
}
export default async function VerifiedCenterPage({params}:Params){
 const {slug}=await params;
 const c=await current(slug);
 if(!c)notFound();
 const serviceNames=c.declaredServices.map(format);
 const doctors=await directory<PublicDoctor>("doctors",new URLSearchParams({center:slug}));
 return <main className="cg-public-shell">
   <header className="cg-public-header">
     <nav aria-label="Healthcare navigation">
       <Link href="/">CareGanga</Link><span aria-hidden="true"> / </span>
       <Link href="/healthcare">Healthcare Assistance</Link>
     </nav>
   </header>
   <section className="cg-public-section" aria-labelledby="center-title">
     <p className="cg-eyebrow">Verified healthcare center</p>
     <h1 id="center-title">{c.centerName}</h1>
     <p className="cg-lead">{c.providerName}</p>
     <p>{format(c.type)} · {c.address}, {c.pinCode}</p>
     <p>{c.notice}</p>
     {c.publicPhone&&<p>Contact: <a href={"tel:"+c.publicPhone}>{c.publicPhone}</a></p>}
     {c.latitude!==null&&c.longitude!==null&&
       <p><a href={"https://www.google.com/maps/search/?api=1&query="+
          encodeURIComponent(c.latitude+","+c.longitude)}
         target="_blank" rel="noopener noreferrer">View location on maps</a></p>}
   </section>
   {doctors.state==="READY"&&doctors.items.length>0&&<section className="cg-public-section">
     <h2>Currently verified doctors at this center</h2>
     <ul>{doctors.items.map(d=><li key={d.doctorRef}>
       <Link href={"/health-network/doctors/"+encodeURIComponent(d.doctorRef)}>{d.doctorName}</Link>
       {d.specialties.length>0?" · "+d.specialties.join(", "):""}
       {d.fee?" · Current in-person consultation ₹"+(d.fee.amountMinor/100).toLocaleString("en-IN"):" · Fee not currently approved"}
     </li>)}</ul>
   </section>}
   {serviceNames.length>0&&<section className="cg-public-section">
     <h2>Services declared by the center</h2>
     <p>Service information does not confirm individual appointment availability.</p>
     <ul>{serviceNames.map(s=><li key={s}>{s}</li>)}</ul>
   </section>}
   {c.hours.length>0&&<section className="cg-public-section">
     <h2>Operating hours</h2>
     <ul>{c.hours.map((h,i)=><li key={i}>{days[h.weekday]??"Day"} — {h.opens} to {h.closes}
       {h.service!=="GENERAL"?" · "+format(h.service):""}</li>)}</ul>
     <p>Times are shown in the center’s local time zone ({c.timeZone}). Confirm before visiting.</p>
   </section>}
   <section className="cg-public-section">
     <p>Online booking, clinical advice and online payment are not offered on this page.</p>
     <Link href="/health-network">Browse verified centers and doctors</Link>
     <p><Link href="/contact">Contact CareGanga</Link></p>
   </section>
 </main>;
}
