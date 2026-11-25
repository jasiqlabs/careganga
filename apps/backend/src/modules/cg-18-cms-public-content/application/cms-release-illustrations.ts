import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

// Source-controlled generated editorial artwork, never user uploads or evidence.
// Exact release files and digests are approved as part of the installation pack.
export const releaseIllustrations=[
 {pageSlug:"home",key:"community-illustration-hero",role:"HERO",order:0,sha256:"08d621a9134113243c97c4cf4a8a8f522d5b4028b9f36c2d1f549db9187325b5",size:330146,altText:"AI-generated illustration of community education, healthcare, environmental care and relief. Not a photograph of actual Foundation activities."},
 {pageSlug:"home",key:"riverbank-community",role:"ABOUT",order:20,sha256:"8cc86c7999d977b2cab9ec61c7689dae44b5a92b0d00dceb975f788a41ad0198",size:80986,altText:"AI-generated illustration of volunteers caring for a riverbank; not a photograph of an actual Foundation activity."},
 {pageSlug:"home",key:"community-planning",role:"PROMO",order:30,sha256:"36646c73e1b3fef9ec15a9d7c4359303fadc08855cba0ef10e7f875fcef122e0",size:59458,altText:"AI-generated illustration of community planning; not a photograph of actual Foundation staff or beneficiaries."},
 {pageSlug:"home",key:"flood-relief",role:"FEATURE",order:0,sha256:"9b352baebb8e1acbd19ea5a0646fc04a3cff9b343f276ba0b1f7435db79170e5",size:74110,altText:"AI-generated illustration of flood relief; not a photograph of an actual Foundation operation."},
 {pageSlug:"home",key:"community-education",role:"FEATURE",order:1,sha256:"c966c9326bb9d2f4e1354b8a68a58c8c186fcf1674bcc6fb59f91d83f60f9c46",size:53068,altText:"AI-generated illustration of a teacher with children; not a photograph of actual Foundation beneficiaries."},
 {pageSlug:"home",key:"community-healthcare",role:"FEATURE",order:2,sha256:"77fa0461f0c739a4eafceda22f3fb4c27a45f0765f2ca15f2272f40e3808276c",size:52266,altText:"AI-generated illustration of community healthcare; not a photograph of an actual medical camp."},
 {pageSlug:"healthcare",key:"healthcare-hero",role:"HERO",order:0,sha256:"e7e4199e0cb3cbfc2196e1bbf67e8667c3ebb4eabe2f58fa8cd0b91a567ddede",size:9392,altText:"Editorial illustration of healthcare consultation with clinical equipment. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-poly-clinic",role:"FEATURE",order:0,sha256:"ca373c94a48581a2e0efc8a1d47a2a115b63f4d90740e15d7c9230e293c757a8",size:9064,altText:"Editorial illustration of polyclinic outpatient consultation. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-diagnostic-centre",role:"FEATURE",order:1,sha256:"622cfce817dda5495bf63184fbdd4ebaf3dd2137f3dc6b41a3e22918b65725a4",size:10736,altText:"Editorial illustration of diagnostic imaging equipment. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-dental-clinic",role:"FEATURE",order:2,sha256:"e16a9c2c0cbaadac3e3a75d9571a75027d832a22fd23e55f50338aed9af767a5",size:7416,altText:"Editorial illustration of dental treatment room. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-medical-laboratory",role:"FEATURE",order:3,sha256:"0ed46a5df0cbfc1597978f27d0e5807c13d4c7c77b1f56f4ac29041d8ba3d81f",size:8172,altText:"Editorial illustration of laboratory equipment and specimen tubes. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-hospital-nursing",role:"FEATURE",order:4,sha256:"130fae1358ef85040c0b1b4620bd751d026a184b963ccbf629cdfaefaa7be9b1",size:7734,altText:"Editorial illustration of hospital and nursing care equipment. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-retail-pharmacy",role:"FEATURE",order:5,sha256:"516e9be7425d24644696339cc9e134433b9efcf771f91fac1a798f6631a7e060",size:10420,altText:"Editorial illustration of pharmacy shelves and dispensing counter. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-orthopedic-centre",role:"FEATURE",order:6,sha256:"37e5cba6afea58d1287bdc07b36f6f645f2f7cd1f6df8576696b81989dcd0b83",size:7260,altText:"Editorial illustration of orthopedic assessment and a knee image. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-homoeopathy-centre",role:"FEATURE",order:7,sha256:"f97d5f848207cb9ca84b952ba6e23f5c17bf37e717fb034db3a856b3863f6bd9",size:6906,altText:"Editorial illustration of homoeopathy consultation materials. Not a photograph of an actual Foundation facility or service."},
 {pageSlug:"healthcare",key:"healthcare-ayurvedic-centre",role:"FEATURE",order:8,sha256:"963454f7521d646e151f34093c6295a757d5b90f59adb38eb8b86fb0e8df9cc6",size:8104,altText:"Editorial illustration of traditional Ayurvedic preparation materials. Not a photograph of an actual Foundation facility or service."}
] as const;
export type ReleaseIllustration=(typeof releaseIllustrations)[number];
export function releaseIllustration(key:string){return releaseIllustrations.find(x=>x.key===key);}
export async function releaseIllustrationBytes(key:string):Promise<Buffer>{
 const asset=releaseIllustration(key);
 if(!asset)throw Error("Unknown CMS release illustration");
 // Support normal workspace start, root monorepo and compiled distribution.
 for(const folder of [resolve(__dirname,"../../../../assets/cms-release"),resolve(__dirname,"../../../../../assets/cms-release")]){
  let bytes:Buffer;
  try{bytes=await readFile(resolve(folder,asset.key+".webp"));}catch{continue;}
  if(bytes.length!==asset.size||bytes.subarray(0,4).toString()!=="RIFF"||
   bytes.subarray(8,12).toString()!=="WEBP"||createHash("sha256").update(bytes).digest("hex")!==asset.sha256)
    throw Error("CMS release illustration integrity mismatch: "+asset.key);
  return bytes;
 }
 throw Error("Missing bundled CMS release illustration: "+asset.key);
}
export async function verifyReleaseIllustrations(){
 for(const a of releaseIllustrations)await releaseIllustrationBytes(a.key);
}
