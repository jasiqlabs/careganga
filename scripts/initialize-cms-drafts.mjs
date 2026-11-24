// Operator-only, explicitly invoked. Never run from a server start or migration.
// Creates missing editorial DRAFTS via the original CG18 API, never submits/publishes.
// All original source approval, media rights and publication validation stay enforced.
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
const args=process.argv.slice(2);
const apply=args.includes("--apply");
const manifestIndex=args.indexOf("--manifest");
const external=manifestIndex>=0?args[manifestIndex+1]:null;
if(args.filter(a=>a==="--manifest").length>1||args.filter(a=>a==="--apply").length>1){console.error("Specify each option at most once.");process.exit(1);}
if((manifestIndex>=0&&(!external||external.startsWith("--")))||args.some((a,i)=>a!=="--apply"&&a!=="--manifest"&&!(manifestIndex>=0&&i===manifestIndex+1))){
 console.error("Usage: node scripts/initialize-cms-drafts.mjs [--manifest <private-json>] [--apply]");process.exit(1);
}
const section=(kind,order,fields)=>({kind,order,fields});
const rich=(heading,body="")=>section("RICH_TEXT",20,{heading,body,eyebrow:"",variant:"STANDARD",highlights:[]});
const hero=(heading)=>section("HERO",0,{heading,visible:true,tags:[]});
const page=(kind,slug,title,sections,canonicalPath="/"+slug)=>({kind,slug,title,seoTitle:title+" | CareGanga Foundation",seoDescription:"",canonicalPath,sections,assets:[]});
const policies=[["terms-and-conditions","Terms & Conditions"],["privacy-policy","Privacy Policy"],["cookie-policy","Cookie Policy"],["disclaimer","Disclaimer"],["refund-and-cancellation","Refund & Cancellation"],["grievance-redressal","Grievance Redressal"],["copyright-and-intellectual-property","Copyright & Intellectual Property"]];
const day=new Date().toISOString().slice(0,10);
const mission="We believe every person deserves access to healthcare, quality education, basic necessities, and the opportunity to live with dignity.";
// Text-only editorial scaffolds: reference-derived headings, no original photos,
// legal wording, asserted registration, sample statistics, actual people or prices.
const defaults=[
 {...page("HOME","home","CareGanga Foundation",[
  hero("CareGanga Foundation"),rich("Standing With Communities. Building Brighter Futures.",mission),
  section("JOIN_CARDS",50,{volunteerTitle:"Join as Volunteer",volunteerBody:"Make a difference in your community by volunteering with us.",volunteerBenefits:[],memberTitle:"Become a Member",memberBody:"Join our community as a member.",memberBenefits:[]}),
  section("SITE_FOOTER",90,{mission,address:"",phone:"",email:"",whatsappNumber:"",newsletterText:""})
 ],"/"),navigation:{loginDesired:true,memberJoinDesired:true,volunteerJoinDesired:true}},
 page("ABOUT","about","About Us",[rich("About CareGanga Foundation",mission)]),
 page("HEALTHCARE","healthcare","Healthcare Assistance",[hero("Healthcare Assistance"),section("HEALTHCARE_CATEGORIES",10,{heading:"Healthcare Assistance",intro:"Explore healthcare information and contact the Foundation for guidance.",categories:[{title:"Consultation",description:"Contact the Foundation for information about healthcare services."}],ctaLabel:"Contact Us",ctaPath:"/contact"})]),
 page("CONTACT","contact","Contact Us",[rich("Contact the Foundation","Send a private message to CareGanga Foundation for general information.")]),
 page("PARTNERS","collaboration","Corporate Partners",[hero("Corporate Partners"),section("PARTNER_CARDS",1,{heading:"Meet Our Partners",intro:"Only currently verified partnerships are listed.",partners:[]}),section("CTA",2,{heading:"Let's Collaborate",body:"Share your organization's interest with the Foundation.",label:"Get in Touch",path:"/contact"})]),
 page("IMPACT","our-impact","Our Impact",["HERO","PILLARS","STATS","GROWTH","GEOGRAPHY","BREAKDOWN","FOCUS","STORIES","UPDATES","CTA"].map((group,i)=>section("IMPACT_GROUP",i,{group,heading:"",intro:"",source:"",asOfDate:day,items:[]}))),
 page("COMPLIANCE","80g","NGO Information",[section("COMPLIANCE_FACTS",0,{heading:"NGO Information",source:"",verifiedAsOf:day,verification:"NOT_VERIFIED",documents:[]})],"/ngo-information"),
 page("GALLERY","gallery","Media Gallery",[section("GALLERY_GRID",0,{heading:"Gallery",videosHeading:"Videos",publicationsHeading:"Publications",items:[]})]),
 ...policies.map(([slug,title])=>page("POLICY",slug,title,[rich(title)],"/policies/"+slug))
];
async function run(){
 const entries=external?JSON.parse(await readFile(external,"utf8")):defaults;
 if(!Array.isArray(entries)||entries.length<1||entries.length>30)throw Error("Provide 1–30 editorial page objects.");
 const canonical=new Set(defaults.map(p=>p.kind+":"+p.slug+":"+p.canonicalPath));
 const seen=new Set();
 for(const p of entries){
  if(!p||typeof p!=="object"||!canonical.has(p.kind+":"+p.slug+":"+p.canonicalPath)||seen.has(p.slug)||
   !Array.isArray(p.sections)||!Array.isArray(p.assets)||Buffer.byteLength(JSON.stringify(p))>60000)
   throw Error("Manifest has a duplicate, unsupported page or invalid content shape.");
  seen.add(p.slug);
 }
 if(!apply){console.log("Dry run: "+entries.length+" editorial drafts requested. No network or data writes.");for(const p of entries)console.log(p.slug);return;}
 const origin=process.env.CG_CMS_BACKEND_ORIGIN,token=process.env.CG_CMS_STAFF_TOKEN;
 if(!origin||!token)throw Error("Set CG_CMS_BACKEND_ORIGIN and CG_CMS_STAFF_TOKEN privately.");
 const url=new URL(origin);
 if(url.username||url.password||url.search||url.hash||url.pathname!=="/"||
  !(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))
  throw Error("Use an HTTPS backend origin or local loopback HTTP origin.");
 const request=(method,body)=>fetch(new URL(method==="GET"?"/api/cms/pages?scope=baseline":"/api/cms/pages",url),{
  method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const read=async()=>{
  const r=await request("GET");if(!r.ok)throw Error("Cannot verify current CMS page list. No further writes.");
  const data=await r.json();if(!Array.isArray(data.pages)||data.pages.some(p=>typeof p?.slug!=="string"))throw Error("Invalid CMS page list.");
  return new Set(data.pages.map(p=>p.slug));
 };
 let existing=await read(),created=0,skipped=0;
 for(const content of entries){
  if(existing.has(content.slug)){console.log("Preserved existing page: "+content.slug);skipped++;continue;}
  const r=await request("POST",{requestKey:randomUUID(),content});
  if(r.status===409){
   existing=await read();
   if(existing.has(content.slug)){console.log("Preserved concurrently created page: "+content.slug);skipped++;continue;}
   throw Error("A conflicting or archived page exists. Resolve in CMS; no replacement attempted: "+content.slug);
  }
  if(!r.ok)throw Error("Draft could not be created (HTTP "+r.status+"). Check current record before rerunning: "+content.slug);
  const result=await r.json();
  if(result.confirmed!==true||result.status!=="DRAFT")throw Error("Draft outcome not confirmed. Read current page before rerunning: "+content.slug);
  existing.add(content.slug);created++;console.log("Created draft: "+content.slug);
 }
 console.log("Drafts created: "+created+"; preserved: "+skipped+". Review actual copy, rights-cleared assets and original approval before publishing.");
}
run().catch(error=>{console.error(error instanceof Error&&/^(Draft|A conflicting|Cannot verify|Invalid CMS|Manifest|Provide|Set CG_|Use an HTTPS)/.test(error.message)?error.message:"CMS initialization stopped; verify current records before rerunning.");process.exitCode=1;});
