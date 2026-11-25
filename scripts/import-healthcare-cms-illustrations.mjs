// First-install only: attach generated editorial images through original CG19.
// Extract the CareGanga Library asset pack into a local directory.
// Never treat these images as evidence of real Foundation projects or people.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {origin} from "./verify-cms-first-publication.mjs";
const assets=[
  [
    "healthcare-hero.webp",
    "77fa0461f0c739a4eafceda22f3fb4c27a45f0765f2ca15f2272f40e3808276c",
    "HERO",
    0,
    "AI-generated illustration of community healthcare; not a photograph of an actual Foundation medical camp."
  ],
  [
    "poly-clinic.webp",
    "d74d0618520a1f3c619aeb1985f75ef5fff3ae298eeb9e6c5f62257e307608ee",
    "FEATURE",
    0,
    "Illustrative symbol of Poly Clinic; not a photograph of a CareGanga center."
  ],
  [
    "diagnostic-centre.webp",
    "1f613e83a309cf35886c770c32d7087070aa5e097f21392672f55492ad4fb5e4",
    "FEATURE",
    1,
    "Illustrative symbol of Diagnostic Centre; not a photograph of a CareGanga center."
  ],
  [
    "dental-clinic.webp",
    "742cfa28ddc43baacb6eeab5e8e380d16d4767213b73de790b61b423306a7845",
    "FEATURE",
    2,
    "Illustrative symbol of Dental Clinic; not a photograph of a CareGanga center."
  ],
  [
    "medical-laboratory.webp",
    "6eb6a36a4bef0db847ed806eb78610723e72debe93ef5caf07e36f7099f1e43b",
    "FEATURE",
    3,
    "Illustrative symbol of Medical Laboratory; not a photograph of a CareGanga center."
  ],
  [
    "hospital-nursing-home.webp",
    "0ccbec6799ab0ac9ea7fbb535eb9a18bdb23c9e13a38a91867750dbec60948d5",
    "FEATURE",
    4,
    "Illustrative symbol of Hospital & Nursing Healthcare; not a photograph of a CareGanga center."
  ],
  [
    "retail-pharmacy.webp",
    "95cf2ff73ee482c88098ba52415921af45cf303242606df16d485bb4ab83f1aa",
    "FEATURE",
    5,
    "Illustrative symbol of Retail Pharmacy; not a photograph of a CareGanga center."
  ],
  [
    "orthopedic-centre.webp",
    "ba42493363c9993ca2877f755afcd5086e5a045f5262f897f09e9f199d2ce734",
    "FEATURE",
    6,
    "Illustrative symbol of Orthopedic Centre; not a photograph of a CareGanga center."
  ],
  [
    "homoeopathy-centre.webp",
    "2f5cdba695e4a40b849aaccc655b14b9d0d61c0cecb4fde304e4a60301431834",
    "FEATURE",
    7,
    "Illustrative symbol of Homoeopathy Centre; not a photograph of a CareGanga center."
  ],
  [
    "ayurvedic-centre.webp",
    "1e0bf40a83cd36159057896f6545cea33f3dcc9720d28133ff4b137e072a8c1f",
    "FEATURE",
    8,
    "Illustrative symbol of Ayurvedic Centre; not a photograph of a CareGanga center."
  ]
];
const titles=["Poly Clinic","Diagnostic Centre","Dental Clinic","Medical Laboratory","Hospital & Nursing Healthcare","Retail Pharmacy","Orthopedic Centre","Homoeopathy Centre","Ayurvedic Centre"];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=v=>createHash("sha256").update(v).digest("hex");
const stableKey=value=>{
 const h=hash(JSON.stringify(value));
 return h.slice(0,8)+"-"+h.slice(8,12)+"-5"+h.slice(13,16)+"-a"+h.slice(17,20)+"-"+h.slice(20,32);
};
async function run(){
 const args=process.argv.slice(2),apply=args.at(-1)==="--apply";
 if((args.length!==(apply?5:4))||args[0]!=="--asset-dir"||args[2]!=="--page-manifest")
  throw Error("Usage: node scripts/import-healthcare-cms-illustrations.mjs --asset-dir directory --page-manifest private.json [--apply]");
 const manifest=JSON.parse(await readFile(args[3],"utf8"));
 if(!manifest||!uuid.test(manifest.pageRef)||!uuid.test(manifest.revisionRef)||!Number.isSafeInteger(manifest.expectedVersion)||manifest.expectedVersion<1)
  throw Error("Invalid private Healthcare revision manifest.");
 const files=await Promise.all(assets.map(async([file,digest,role,order,altText])=>{
  const bytes=await readFile(resolve(args[1],file));
  if(bytes.length<12||bytes.length>10485760||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP"||hash(bytes)!==digest)
   throw Error("Asset checksum/type mismatch: "+file);
  return {file,digest,role,order,altText,bytes};
 }));
 if(!apply){console.log("Dry run: "+files.length+" healthcare editorial assets verified. No network or writes.");return;}
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
  d.slug!=="healthcare"||d.kind!=="HEALTHCARE"||d.status!=="DRAFT"||d.publicationStatus!=="NOT_PUBLISHED"||
  d.hasPublicationHistory!==false||d.scheduledAt||!Array.isArray(d.assets)||d.assets.length!==0||
  !Array.isArray(d.sections))
  throw Error("Healthcare is not the exact unpublished empty-media draft. No overwrite attempted.");
 const hero=d.sections.find(s=>s.kind==="HERO"&&s.order===0),categories=d.sections.find(s=>s.kind==="HEALTHCARE_CATEGORIES"&&s.order===10);
 if(hero?.fields?.textOnly!==true||hero?.fields?.heading!=="Integrated Healthcare Assistance"||
  JSON.stringify(categories?.fields?.categories?.map(c=>c.title))!==JSON.stringify(titles))
  throw Error("Healthcare draft does not match the expected nine category titles. No overwrite attempted.");
 const placements=[];
 for(const file of files){
  const requestKey=stableKey(["CG18_HEALTHCARE_FIRST_ILLUSTRATION",d.pageRef,d.revisionRef,file.digest]);
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
 const sections=d.sections.map(s=>s.kind==="HERO"&&s.order===0?{...s,fields:{...s.fields,textOnly:false}}:s);
 const content={kind:d.kind,slug:d.slug,title:d.title,seoTitle:d.seoTitle,seoDescription:d.seoDescription,canonicalPath:d.canonicalPath,sections,assets:placements};
 const result=await request(pagePath+"/draft",{expectedVersion:manifest.expectedVersion,requestKey:stableKey(["CG18_HEALTHCARE_FIRST_ILLUSTRATION_SAVE",d.pageRef,d.revisionRef,manifest.expectedVersion,files.map(f=>f.digest)]),content},"PUT");
 if(result.confirmed!==true||result.status!=="DRAFT_SAVED")throw Error("Draft save unconfirmed. Inspect original CMS record.");
 console.log("Ten validated illustrations attached to unpublished Healthcare. Obtain exact independent approval before publication.");
}
run().catch(e=>{console.error(e instanceof Error&&/^(Usage:|Invalid private|Asset checksum|Set private|Original CMS request|Healthcare |Original media |Invalid private upload|Private upload|Draft save)/.test(e.message)?e.message:"CMS illustration import stopped; check the original draft and media intent before retry.");process.exitCode=1;});
