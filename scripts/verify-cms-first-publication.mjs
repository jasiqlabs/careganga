// One-time first-install readiness gate. Read only; do not run on routine redeploy
// because intentional editorial withdrawal is legitimate. No credentials required.
import {pathToFileURL} from "node:url";
export const baseline=[
 ["home","HOME","/"],["about","ABOUT","/about"],["healthcare","HEALTHCARE","/healthcare"],
 ["contact","CONTACT","/contact"],["collaboration","PARTNERS","/collaboration"],
 ["our-impact","IMPACT","/our-impact"],["gallery","GALLERY","/gallery"]
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
 for(const [slug,kind,path] of baseline){
  try{
   const p=await read("/api/public/content/pages/"+slug);
   if(!p||p.schemaVersion!==1||p.slug!==slug||p.kind!==kind||p.canonicalPath!==path||
    typeof p.effectiveGeneration!=="string"||!p.effectiveGeneration||
    typeof p.title!=="string"||!p.title.trim()||!Array.isArray(p.sections)||!p.sections.length||
    !Array.isArray(p.assets))failures.push(slug);
  }catch{failures.push(slug);}
 }
 try{
  const n=await read("/api/public/content/navigation");
  if(!n||n.schemaVersion!==1||typeof n.effectiveGeneration!=="string"||!n.effectiveGeneration||
   !Array.isArray(n.publishedRoutes)||
   baseline.filter(([slug])=>slug!=="home").some(([slug,kind,path])=>!n.publishedRoutes.some(p=>p.slug===slug&&p.kind===kind&&p.path===path)))
   failures.push("navigation");
 }catch{failures.push("navigation");}
 return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==2||!process.env.CG_CMS_BACKEND_ORIGIN)throw Error("Set CG_CMS_BACKEND_ORIGIN and invoke without arguments.");
  const failures=await readiness(process.env.CG_CMS_BACKEND_ORIGIN);
  if(failures.length){console.error("First publication NOT READY: "+failures.join(", "));process.exitCode=1;}
  else console.log("First publication API READY: seven editorial pages and navigation. Browser/native QA still required.");
 }catch{console.error("First publication verification could not run. Check backend origin and availability.");process.exitCode=1;}
}
