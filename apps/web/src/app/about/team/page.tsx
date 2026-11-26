import Link from "next/link";
import type {Metadata} from "next";
import {HealthcarePublicChrome} from "../../../shared/healthcare-public-chrome";
import {publishedCmsPage,selectPublicIntro} from "../../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Team Directory | CareGanga Foundation",robots:{index:false,follow:true}};
type Person={name:string;designation:string};
export default async function TeamPage({searchParams}:{searchParams:Promise<{name?:string;designation?:string}>}){
 const params=await searchParams;
 const clean=(v:unknown)=>typeof v==="string"?v.trim().slice(0,120):"";
 const name=clean(params.name),designation=clean(params.designation);
 const results=await Promise.all([publishedCmsPage("about"),publishedCmsPage("home")]);
 const intro=selectPublicIntro(results[0],"TEAM");
 const people:Person[]=[];
 for(const result of results)if(result.state==="PUBLISHED")
  for(const section of result.page.sections)if(section.kind==="TEAM"&&Array.isArray(section.fields.members))
   for(const p of section.fields.members){
    if(!p||p.consentConfirmed!==true||typeof p.name!=="string"||typeof p.designation!=="string"||!p.name.trim()||!p.designation.trim())continue;
    const person={name:p.name.trim(),designation:p.designation.trim()};
    if(!people.some(x=>x.name===person.name&&x.designation===person.designation))people.push(person);
   }
 const options=[...new Set(people.map(p=>p.designation))].sort();
 const incomplete=results.some(r=>r.state==="UNAVAILABLE");
 const filtered=people.filter(p=>(!name||p.name.toLocaleLowerCase().includes(name.toLocaleLowerCase()))&&(!designation||p.designation===designation));
 return <HealthcarePublicChrome><main id="main-content" className="cg-site-content cg-site-team">
  <header className="cg-site-team-hero">
   {intro?.eyebrow&&<p className="cg-site-eyebrow">{intro.eyebrow}</p>}
   <h1>{intro?.heading??"Team Directory"}</h1>
   {intro?.body&&<p>{intro.body}</p>}
   {intro?.highlights.length?<ul>{intro.highlights.map((v,i)=><li key={i}>{v}</li>)}</ul>:null}
  </header>
  <section className="cg-site-team-search" aria-label="Search published team profiles">
   <h2>Team Directory</h2><p>Only independently published, currently consented public names and designations are displayed.</p>
   <form method="get" action="/about/team" className="cg-site-directory-filter"><label>Search by name <input name="name" maxLength={120} defaultValue={name}/></label>
    <label>Designation <select name="designation" defaultValue={designation}><option value="">All designations</option>{designation&&!options.includes(designation)&&<option value={designation}>Requested designation (not available)</option>}{options.map(v=><option key={v}>{v}</option>)}</select></label>
    <button type="submit">Search</button><Link href="/about/team">Reset</Link></form>
  </section>
  {incomplete&&<p role="status">Some approved team information could not be verified. Only currently available approved profiles are shown.</p>}
  {!filtered.length?<div className="cg-site-empty" role="status"><strong>{incomplete?"No current matching profiles could be confirmed":name||designation?"No matching profiles":"No public profiles yet"}</strong><p>{incomplete?"Try again later before relying on the directory.":name||designation?"Try another name or designation.":"Consented team profiles will appear here once published."}</p>{(name||designation)&&<Link href="/about/team">Clear filters</Link>}</div>:<div className="cg-site-team-grid">{filtered.map((p,i)=><article key={i} className="cg-site-person"><h2>{p.name}</h2><strong>{p.designation}</strong></article>)}</div>}
 </main></HealthcarePublicChrome>;
}
