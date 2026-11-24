import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

// Source-controlled generated editorial artwork, never user uploads or evidence.
// Exact release files and digests are approved as part of the installation pack.
export const releaseIllustrations=[
 {key:"community-illustration-hero",role:"HERO",order:0,sha256:"08d621a9134113243c97c4cf4a8a8f522d5b4028b9f36c2d1f549db9187325b5",size:330146,altText:"AI-generated illustration of community education, healthcare, environmental care and relief. Not a photograph of actual Foundation activities."},
 {key:"riverbank-community",role:"ABOUT",order:20,sha256:"8cc86c7999d977b2cab9ec61c7689dae44b5a92b0d00dceb975f788a41ad0198",size:80986,altText:"AI-generated illustration of volunteers caring for a riverbank; not a photograph of an actual Foundation activity."},
 {key:"community-planning",role:"PROMO",order:30,sha256:"36646c73e1b3fef9ec15a9d7c4359303fadc08855cba0ef10e7f875fcef122e0",size:59458,altText:"AI-generated illustration of community planning; not a photograph of actual Foundation staff or beneficiaries."},
 {key:"flood-relief",role:"FEATURE",order:0,sha256:"9b352baebb8e1acbd19ea5a0646fc04a3cff9b343f276ba0b1f7435db79170e5",size:74110,altText:"AI-generated illustration of flood relief; not a photograph of an actual Foundation operation."},
 {key:"community-education",role:"FEATURE",order:1,sha256:"c966c9326bb9d2f4e1354b8a68a58c8c186fcf1674bcc6fb59f91d83f60f9c46",size:53068,altText:"AI-generated illustration of a teacher with children; not a photograph of actual Foundation beneficiaries."},
 {key:"community-healthcare",role:"FEATURE",order:2,sha256:"77fa0461f0c739a4eafceda22f3fb4c27a45f0765f2ca15f2272f40e3808276c",size:52266,altText:"AI-generated illustration of community healthcare; not a photograph of an actual medical camp."}
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
