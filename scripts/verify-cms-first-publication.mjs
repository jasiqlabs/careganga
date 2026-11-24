// One-time first-install readiness gate. Read only; do not run on routine redeploy
// because intentional editorial withdrawal is legitimate. No credentials required.
import {pathToFileURL} from "node:url";
export const baseline=[
 ["home","HOME","/"],["about","ABOUT","/about"],["healthcare","HEALTHCARE","/healthcare"],
 ["contact","CONTACT","/contact"],["collaboration","PARTNERS","/collaboration"],
 ["our-impact","IMPACT","/our-impact"],["gallery","GALLERY","/gallery"],["80g","COMPLIANCE","/ngo-information"]
];
export function origin(value){
 const u=new URL(value);
 if(u.username||u.password||u.search||u.hash||u.pathname!=="/"||
  !(u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname))))throw Error("Invalid backend origin");
 return u;
}
export async function readiness(base,request=fetch){
 const u=origin(base);
 const read=async(path)=>{
  const response=await request(new URL(path,u),{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(!response.ok)return null;
  return response.json();
 };
 const failures=[];
 const requiredIntroPlacements=["TEAM","MEMBERSHIP","VOLUNTEER","NOTICES","UPCOMING_PROJECTS","ANNUAL_REPORTS","FINANCIAL_REPORTS"];
 const requiredRoutes=[...baseline,["our-work","PROJECTS","/our-work"],["upcoming-projects","PROJECTS","/upcoming-projects"]];
 for(const [slug,kind,path] of requiredRoutes){
  try{
   const p=await read("/api/public/content/pages/"+slug);
   if(!p||p.schemaVersion!==1||p.slug!==slug||p.kind!==kind||p.canonicalPath!==path||
    typeof p.effectiveGeneration!=="string"||!p.effectiveGeneration||
    typeof p.title!=="string"||!p.title.trim()||!Array.isArray(p.sections)||!p.sections.length||
    !Array.isArray(p.assets)){failures.push(slug);continue;}
   if(slug==="about"&&requiredIntroPlacements.some(placement=>!p.sections.some(s=>s.kind==="RICH_TEXT"&&s.fields?.placement===placement&&typeof s.fields.heading==="string"&&s.fields.heading.trim()&&typeof s.fields.body==="string"&&s.fields.body.trim())))failures.push("about-editorial-intros");
   if(slug==="home"&&(!["HERO","RICH_TEXT","CTA","FEATURE_CARDS","JOIN_CARDS","PROJECT_TEASER","SITE_FOOTER"].every(kind=>p.sections.some(s=>s.kind===kind))||!p.sections.some(s=>s.kind==="HERO"&&s.fields?.visible!==false)))failures.push("home-editorial-sections");
   if(slug==="home"&&[["HERO",0],["ABOUT",20],["PROMO",30],["FEATURE",0],["FEATURE",1],["FEATURE",2]].some(([role,order])=>!p.assets.some(a=>a.role===role&&a.order===order&&typeof a.altText==="string"&&a.altText.trim()&&typeof a.src==="string"&&/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(a.src))))failures.push("home-editorial-media");
   if(slug==="healthcare"){
    const category=p.sections.find(s=>s.kind==="HEALTHCARE_CATEGORIES");
    if(!p.sections.some(s=>s.kind==="HERO"&&s.fields?.visible!==false&&typeof s.fields?.heading==="string"&&s.fields.heading.trim())||JSON.stringify(category?.fields?.categories?.map(v=>v.title))!==JSON.stringify(["Poly Clinic","Diagnostic Centre","Dental Clinic","Medical Laboratory","Hospital & Nursing Home","Retail Pharmacy","Orthopedic Centre","Homoeopathy Centre","Ayurvedic Centre"])||!category.fields.categories.every(v=>typeof v.description==="string"&&v.description.trim()))failures.push("healthcare-editorial-sections");
    if([["HERO",0],...Array.from({length:9},(_,i)=>["FEATURE",i])].some(([role,order])=>!p.assets.some(a=>a.role===role&&a.order===order&&typeof a.altText==="string"&&a.altText.trim()&&typeof a.src==="string"&&/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(a.src))))failures.push("healthcare-editorial-media");
   }
   if(slug==="contact"&&!p.sections.some(s=>s.kind==="CONTACT_INFO"&&Array.isArray(s.fields?.faqs)&&s.fields.faqs.length>=4))failures.push("contact-faqs");
  }catch{failures.push(slug);}
 }
 try{
  const n=await read("/api/public/content/navigation");
  if(!n||n.schemaVersion!==1||typeof n.effectiveGeneration!=="string"||!n.effectiveGeneration||
   !Array.isArray(n.publishedRoutes)||
   requiredRoutes.filter(([slug])=>slug!=="home").some(([slug,kind,path])=>!n.publishedRoutes.some(p=>p.slug===slug&&p.kind===kind&&p.path===path)))
   failures.push("navigation");
 }catch{failures.push("navigation");}
 return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==2||!process.env.CG_CMS_BACKEND_ORIGIN)throw Error("Set CG_CMS_BACKEND_ORIGIN and invoke without arguments.");
  const failures=await readiness(process.env.CG_CMS_BACKEND_ORIGIN);
  if(failures.length){console.error("First publication NOT READY: "+failures.join(", "));process.exitCode=1;}
  else console.log("First publication API READY: eight editorial pages, project directories, six Home and ten healthcare media placements and navigation. Browser/native QA still required.");
 }catch{console.error("First publication verification could not run. Check backend origin and availability.");process.exitCode=1;}
}
