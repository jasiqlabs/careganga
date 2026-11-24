// Explicit first-install release of EXACT independently approved revisions.
// No implicit approval, no scheduled publication, no automatic deployment invocation.
// Private manifest entries: {slug,pageRef,revisionRef,expectedVersion,caseRef,requestKey}.
import {readFile} from "node:fs/promises";
import {baseline,origin,readiness} from "./verify-cms-first-publication.mjs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugs=new Set(baseline.map(([slug])=>slug));
async function run(){
 const args=process.argv.slice(2),apply=args.length===3&&args[2]==="--apply";
 if((args.length!==2&&!apply)||args[0]!=="--manifest"||!args[1])throw Error("Usage: node scripts/publish-cms-baseline.mjs --manifest private.json [--apply]");
 const entries=JSON.parse(await readFile(args[1],"utf8"));
 if(!Array.isArray(entries)||!entries.length||entries.length>baseline.length||new Set(entries.map(e=>e?.slug)).size!==entries.length||
 new Set(entries.map(e=>e?.pageRef)).size!==entries.length||new Set(entries.map(e=>e?.requestKey)).size!==entries.length||
 entries.some(e=>!e||!slugs.has(e.slug)||!Number.isSafeInteger(e.expectedVersion)||e.expectedVersion<1||
  ![e.pageRef,e.revisionRef,e.caseRef,e.requestKey].every(v=>typeof v==="string"&&uuid.test(v))))throw Error("Invalid release manifest.");
 if(!apply){console.log("Dry run: "+entries.map(e=>e.slug).join(", ")+". No network or writes.");return;}
 const token=process.env.CG_CMS_STAFF_TOKEN;
 if(!token||!process.env.CG_CMS_BACKEND_ORIGIN)throw Error("Set private CMS publisher token and backend origin.");
 const base=origin(process.env.CG_CMS_BACKEND_ORIGIN);
 const request=(path,body)=>fetch(new URL(path,base),{method:body?"POST":"GET",redirect:"error",cache:"no-store",
  signal:AbortSignal.timeout(15000),headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 // Preflight every exact revision before initiating any writes. A rerun after
 // partial progress preserves already public pages; the anonymous gate checks them.
 const pending=[];
 for(const e of entries){
  const response=await request("/api/cms/pages/"+e.pageRef);
  if(!response.ok)throw Error("Cannot verify current page: "+e.slug);
  const d=await response.json();
  if(d.slug!==e.slug||d.pageRef!==e.pageRef)throw Error("Page identity changed: "+e.slug);
  if(d.publicationStatus==="EFFECTIVE"){console.log("Preserved existing publication: "+e.slug);continue;}
  if(d.hasPublicationHistory!==false||d.publicationStatus!=="NOT_PUBLISHED"||d.scheduledAt||d.status!=="SUBMITTED"||
   d.revisionRef!==e.revisionRef||d.version!==e.expectedVersion||d.approvalCaseRef!==e.caseRef)
   throw Error("Current submitted revision differs from release manifest: "+e.slug);
  pending.push(e);
 }
 for(const e of pending){
  // CG18 rechecks exact CG03 final decision, current roles, content digest,
  // validated media and consumed decision under its existing transaction.
  const response=await request("/api/cms/pages/"+e.pageRef+"/publish",{
   expectedVersion:e.expectedVersion,caseRef:e.caseRef,requestKey:e.requestKey,firstPublicationOnly:true});
  if(!response.ok)throw Error("Publication refused (HTTP "+response.status+"): "+e.slug+". Inspect exact current revision before retry.");
  const result=await response.json();
  if(result.confirmed!==true||result.status!=="PUBLISHED")throw Error("Publication not confirmed: "+e.slug);
  console.log("Published approved revision: "+e.slug);
 }
 const failures=await readiness(base.href);
 if(failures.length){console.error("First publication still NOT READY: "+failures.join(", "));process.exitCode=1;}
 else console.log("First publication API READY. Verify public Web and native devices before go-live.");
}
run().catch(e=>{console.error(e instanceof Error&&/^(Usage:|Invalid release|Set private|Cannot verify|Page identity|Current submitted|Publication refused|Publication not confirmed)/.test(e.message)?e.message:"Publication stopped. Inspect current CMS records before retry.");process.exitCode=1;});
