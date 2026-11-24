// First-install only: attach generated editorial images through original CG19.
// Extract the CareGanga Library asset pack into a local directory.
// Never treat these images as evidence of real Foundation projects or people.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {origin} from "./verify-cms-first-publication.mjs";
const assets=[
 ["community-illustration-hero.webp","08d621a9134113243c97c4cf4a8a8f522d5b4028b9f36c2d1f549db9187325b5","HERO",0,"AI-generated illustration of community education, healthcare, environmental care and relief. Not a photograph of actual Foundation activities."],
 ["riverbank-community.webp","8cc86c7999d977b2cab9ec61c7689dae44b5a92b0d00dceb975f788a41ad0198","ABOUT",20,"AI-generated illustration of volunteers caring for a riverbank; not a photograph of an actual Foundation activity."],
 ["community-planning.webp","36646c73e1b3fef9ec15a9d7c4359303fadc08855cba0ef10e7f875fcef122e0","PROMO",30,"AI-generated illustration of community planning; not a photograph of actual Foundation staff or beneficiaries."],
 ["flood-relief.webp","9b352baebb8e1acbd19ea5a0646fc04a3cff9b343f276ba0b1f7435db79170e5","FEATURE",0,"AI-generated illustration of flood relief; not a photograph of an actual Foundation operation."],
 ["community-education.webp","c966c9326bb9d2f4e1354b8a68a58c8c186fcf1674bcc6fb59f91d83f60f9c46","FEATURE",1,"AI-generated illustration of a teacher with children; not a photograph of actual Foundation beneficiaries."],
 ["community-healthcare.webp","77fa0461f0c739a4eafceda22f3fb4c27a45f0765f2ca15f2272f40e3808276c","FEATURE",2,"AI-generated illustration of community healthcare; not a photograph of an actual medical camp."]
];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=v=>createHash("sha256").update(v).digest("hex");
const stableKey=value=>{
 const h=hash(JSON.stringify(value));
 return h.slice(0,8)+"-"+h.slice(8,12)+"-5"+h.slice(13,16)+"-a"+h.slice(17,20)+"-"+h.slice(20,32);
};
async function run(){
 const args=process.argv.slice(2),apply=args.at(-1)==="--apply";
 if((args.length!==(apply?5:4))||args[0]!=="--asset-dir"||args[2]!=="--page-manifest")
  throw Error("Usage: node scripts/import-cms-baseline-illustrations.mjs --asset-dir directory --page-manifest private.json [--apply]");
 const manifest=JSON.parse(await readFile(args[3],"utf8"));
 if(!manifest||!uuid.test(manifest.pageRef)||!uuid.test(manifest.revisionRef)||!Number.isSafeInteger(manifest.expectedVersion)||manifest.expectedVersion<1)
  throw Error("Invalid private Home revision manifest.");
 const files=await Promise.all(assets.map(async([file,digest,role,order,altText])=>{
  const bytes=await readFile(resolve(args[1],file));
  if(bytes.length<12||bytes.length>10485760||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP"||hash(bytes)!==digest)
   throw Error("Asset checksum/type mismatch: "+file);
  return {file,digest,role,order,altText,bytes};
 }));
 if(!apply){console.log("Dry run: "+files.length+" original generated assets verified. No network or writes.");return;}
 const token=process.env.CG_CMS_STAFF_TOKEN;
 if(!token||!process.env.CG_CMS_BACKEND_ORIGIN)throw Error("Set private CMS author token and backend origin.");
 const base=origin(process.env.CG_CMS_BACKEND_ORIGIN);
 const request=async(path,body,method=body?"POST":"GET")=>{
  const res=await fetch(new URL(path,base),{method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(30000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok)throw Error("Original CMS request refused (HTTP "+res.status+"). Inspect current state before retry.");
  return res.json();
 };
 const pagePath="/api/cms/pages/"+manifest.pageRef, d=await request(pagePath);
 if(d.pageRef!==manifest.pageRef||d.revisionRef!==manifest.revisionRef||d.version!==manifest.expectedVersion||
  d.slug!=="home"||d.kind!=="HOME"||d.status!=="DRAFT"||d.publicationStatus!=="NOT_PUBLISHED"||
  d.hasPublicationHistory!==false||d.scheduledAt||!Array.isArray(d.assets)||d.assets.length!==0||
  !Array.isArray(d.sections)||!d.navigation)
  throw Error("Home is not the exact unpublished empty-media draft. No overwrite attempted.");
 const hero=d.sections.find(s=>s.kind==="HERO"&&s.order===0),story=d.sections.find(s=>s.kind==="RICH_TEXT"&&s.order===20);
 const promo=d.sections.find(s=>s.kind==="CTA"&&s.order===30),features=d.sections.find(s=>s.kind==="FEATURE_CARDS"&&s.order===40);
 if(hero?.fields?.textOnly!==true||hero?.fields?.heading!=="CareGanga Foundation"||
  story?.fields?.heading!=="Standing With Communities. Building Brighter Futures."||
  promo?.fields?.heading!=="Join your hand with us for a better life and future"||
  JSON.stringify(features?.fields?.cards?.map(c=>c.title))!==JSON.stringify(["Flood Relief & Disaster Response","Education for River-Belt Children","Community Health & Sanitation"]))
  throw Error("Home draft does not match the expected editorial sections. No overwrite attempted.");
 const placements=[];
 for(const file of files){
  const requestKey=stableKey(["CG18_FIRST_ILLUSTRATION",d.pageRef,d.revisionRef,file.digest]);
  const media=await request("/api/cms/media/initiate",{pageRef:d.pageRef,revisionRef:d.revisionRef,requestKey,mime:"image/webp",sizeBytes:file.bytes.length,sha256:file.digest,rightsConfirmed:true});
  if(!uuid.test(media.uploadRef))throw Error("Original media intent unconfirmed: "+file.file);
  const statusPath="/api/cms/media/"+media.uploadRef;
  let proof=media;
  if(media.status!=="VALIDATED"){
   if(media.status!=="UPLOAD_READY"||!media.uploadUrl||!media.uploadHeaders)throw Error("Original media unavailable or expired: "+file.file+". Resolve the original intent in CMS.");
   const target=new URL(media.uploadUrl);
   if(target.protocol!=="https:"||target.username||target.password||target.hash||media.uploadHeaders["Content-Type"]!=="image/webp"||
    Object.keys(media.uploadHeaders).some(k=>/^(authorization|cookie|proxy-authorization)$/i.test(k)))
    throw Error("Invalid private upload permission.");
   const put=await fetch(target,{method:"PUT",headers:media.uploadHeaders,body:file.bytes,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(30000)});
   if(!put.ok)throw Error("Private upload unconfirmed: "+file.file);
   proof=await request(statusPath+"/confirm",{});
  }
  if(!proof.cleanVerified||!uuid.test(proof.fileRef)||!Number.isSafeInteger(proof.validatedVersion)||proof.validatedVersion<1)
   throw Error("Original media scan not confirmed: "+file.file+". Retry only the same manifest.");
  placements.push({fileRef:proof.fileRef,version:proof.validatedVersion,role:file.role,order:file.order,altText:file.altText});
  console.log("Verified editorial asset: "+file.file);
 }
 const sections=d.sections.map(s=>s.kind==="HERO"&&s.order===0?{...s,fields:{...s.fields,textOnly:false}}:
  s.kind==="RICH_TEXT"&&s.order===20?{...s,fields:{...s.fields,variant:"SPLIT"}}:s);
 const content={kind:d.kind,slug:d.slug,title:d.title,seoTitle:d.seoTitle,seoDescription:d.seoDescription,canonicalPath:d.canonicalPath,sections,assets:placements,navigation:d.navigation};
 const result=await request(pagePath+"/draft",{expectedVersion:manifest.expectedVersion,requestKey:stableKey(["CG18_FIRST_ILLUSTRATION_SAVE",d.pageRef,d.revisionRef,manifest.expectedVersion,files.map(f=>f.digest)]),content},"PUT");
 if(result.confirmed!==true||result.status!=="DRAFT_SAVED")throw Error("Draft save unconfirmed. Inspect original CMS record.");
 console.log("Six validated illustrations attached to unpublished Home. Obtain exact independent approval before publication.");
}
run().catch(e=>{console.error(e instanceof Error&&/^(Usage:|Invalid private|Asset checksum|Set private|Original CMS request|Home |Original media |Invalid private upload|Private upload|Draft save)/.test(e.message)?e.message:"CMS illustration import stopped; check the original draft and media intent before retry.");process.exitCode=1;});
