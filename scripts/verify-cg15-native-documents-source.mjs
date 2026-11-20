/**
 * Original US-005-QA05/Q10 native print/share V1 source preflight.
 * This checks literal source wiring only; NOT npm ci, Android native build,
 * real print/share dialog, OS cache cleanup, or security/IDOR QA PASS.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,".."),read=p=>
 readFileSync(resolve(root,p),"utf8");
const s={
 public:read("apps/android-public/src/features/appointments/native-appointment-documents.tsx"),
 staff:read("apps/android-internal/src/features/appointments/native-center-consultation-slip.tsx"),
 pubPkg:JSON.parse(read("apps/android-public/package.json")),
 staffPkg:JSON.parse(read("apps/android-internal/package.json")),
 lock:JSON.parse(read("package-lock.json")),
 original:read("apps/backend/src/modules/cg-19-documents-notifications/application/appointment-slip-document.service.ts"),
 source:read("apps/backend/src/modules/cg-15-patients-appointments/application/consultation-slip-source.facade.ts"),
 rootPkg:read("package.json"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["same Expo SDK 58 compatible packages pinned in BOTH existing Android apps",
  ["apps/android-public","apps/android-internal"].every(a=>
   s.lock.packages[a].dependencies["expo-sharing"]==="58.0.23"&&
   s.lock.packages[a].dependencies["expo-print"]==="58.0.9")&&
  [s.pubPkg,s.staffPkg].every(p=>
   p.dependencies["expo-sharing"]==="58.0.23"&&
   p.dependencies["expo-print"]==="58.0.9")],
 ["lock entries match actual packages (npm registry SRI must be verified locally)",
  s.lock.packages["node_modules/expo-sharing"].version==="58.0.23"&&
  s.lock.packages["node_modules/expo-print"].version==="58.0.9"],
 ["public share and native print use real SDK, not text URL substitution",
  s.public.includes('from "expo-sharing"')&&
  s.public.includes('from "expo-print"')&&
  s.public.includes("Sharing.shareAsync(transient.uri")&&
  s.public.includes("Print.printAsync({uri:transient.uri})")],
 ["center share and native print use original private CG19 staff file",
  s.staff.includes("Sharing.shareAsync(temporary.uri")&&
  s.staff.includes("Print.printAsync({uri:temporary.uri})")&&
  s.staff.includes("call(path+\"/file\")")],
 ["both reacquire original currently issued grant before a sensitive OS action",
  s.public.includes('statusReply=await authorized("/api/v1/appointments/slips/me/"')&&
  s.public.includes('original.status!=="ISSUED"||!original.canDownload')&&
  s.staff.includes('const statusReply=await call(path+"/status")')&&
  s.staff.includes('record.status!=="ISSUED"||!record.canDownload')],
 ["both verify PDF MIME, magic and 10MB size before external action",
  s.public.includes('includes("application/pdf")')&&
  s.public.includes("bytes.length>10485760")&&
  s.staff.includes("data.length>10485760")&&
  s.staff.includes("data[0]!==37")],
 ["both use cache-only unique temporary file and release it after share/print",
  s.public.includes("new File(Paths.cache,")&&
  s.staff.includes("new File(Paths.cache,")&&
  s.public.includes("transient?.delete()")&&
  s.staff.includes("temporary?.delete()")],
 ["public and center never assert delivery or completed print after OS dialog",
  s.public.includes("cannot confirm where a copy was sent")&&
  s.staff.includes("cannot verify which recipient received a copy")&&
  s.public.includes("A printed copy cannot be revoked")],
 ["PDF sharing cannot use a remote link, unprotected Web route or public file store",
  !s.public.includes('https://careganga.com/private')&&
  s.public.includes('"/api/v1/appointments/slips/me/"+bookingRef+"/file"')&&
  s.staff.includes('const path="/api/v1/appointments/slips/staff/"+bookingRef')],
 ["original patient/center source check, revocation, and native ICS remain",
  s.original.includes("async download(")&&
  s.original.includes("revoked_at IS NULL")&&
  s.source.includes("originalForCenter(")&&
  s.public.includes('async function calendar()')&&
  s.public.includes('previewFile("calendar")')],
 ["manual source verifier and every original QA ID remain",
  s.rootPkg.includes("verify:cg15-native-documents-source")&&
  Array.from({length:8},(_,n)=>n+1).every(n=>
   Array.from({length:16},(_,i)=>
    "US-"+String(n).padStart(3,"0")+"-QA"+String(i+1).padStart(2,"0"))
    .every(k=>s.tracker.includes(k)))]
];
let gaps=0;
for(const [label,ok] of checks){
 process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" "+label+"\n");
 if(!ok)gaps++;
}
process.stdout.write("CG15 native document SOURCE "+(checks.length-gaps)+"/"+checks.length+
 "; npm registry integrity, actual Android build, native dialogs, privacy/device review NOT_RUN.\n");
if(gaps)process.exitCode=1;
