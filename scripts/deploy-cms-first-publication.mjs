// Mandatory FIRST-release promotion step, after target database migration and
// authorized preparation/review, before public traffic is enabled.
// Never run this on routine redeploy. No approval bypass, no content overwrite.
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";
import {baseline,origin} from "./verify-cms-first-publication.mjs";
export function requireCompleteManifest(entries){
 if(!Array.isArray(entries)||entries.length!==baseline.length||
  new Set(entries.map(e=>e?.slug)).size!==baseline.length||
  baseline.some(([slug])=>!entries.some(e=>e?.slug===slug)))
  throw Error("First release requires the complete eight-page approval manifest.");
 return entries;
}
export async function deployFirstPublication({manifest,apply=false,env=process.env,run=spawnSync}){
 requireCompleteManifest(JSON.parse(await readFile(manifest,"utf8")));
 const publisher=fileURLToPath(new URL("./publish-cms-baseline.mjs",import.meta.url));
 // The original publisher validates each manifest entry even in dry run.
 const invoke=args=>{
  const result=run(process.execPath,[publisher,...args],{stdio:"inherit",env});
  if(result.error||result.status!==0)throw Error("First release blocked: CMS publication or readiness verification failed.");
 };
 invoke(["--manifest",manifest]);
 if(!apply)return;
 if(!env.CG_CMS_BACKEND_ORIGIN||!env.CG_CMS_STAFF_TOKEN)throw Error("First release requires the authorized publisher token and target backend origin.");
 origin(env.CG_CMS_BACKEND_ORIGIN);
 // publish-cms-baseline performs exact revision approval checks, publishes through
 // CG18, preserves already effective pages, and runs the anonymous readiness gate.
 invoke(["--manifest",manifest,"--apply"]);
 console.log("First CMS publication gate passed. Enable public traffic only after browser and device acceptance on this target.");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),apply=args.length===3&&args[2]==="--apply";
 try{
  if((args.length!==2&&!apply)||args[0]!=="--manifest"||!args[1])
   throw Error("Usage: npm run deploy:cms:first -- --manifest private.json [--apply]");
  await deployFirstPublication({manifest:args[1],apply});
 }catch(e){console.error(e instanceof Error&&/^(Usage:|First release)/.test(e.message)?e.message:"First CMS release blocked. Verify the target and private manifest.");process.exitCode=1;}
}
