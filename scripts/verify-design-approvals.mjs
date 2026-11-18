import {createHash} from "node:crypto";
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const base="specs/initiatives/careganga-foundation-platform";
const ledger=JSON.parse(readFileSync(join(root,base,"approvals.json"),"utf8"));
const digest=s=>createHash("sha256").update(s,"utf8").digest("hex");
const failures=[];
let verified=0;
for(const [key,record] of Object.entries(ledger.records)){
  if(record.status!=="DELEGATED_APPROVED"){
    failures.push(key+": current design status is "+record.status);
    continue;
  }
  if(key==="br/package")continue;
  const relative=record.artifact?.startsWith("docs/")
    ?record.artifact:join(base,record.artifact??"");
  const path=join(root,relative);
  if(!existsSync(path)){failures.push(key+": document missing");continue;}
  const hash=digest(readFileSync(path,"utf8"));
  if(record.sha256!==hash || (record.current_artifact_sha256 &&
      record.current_artifact_sha256!==hash))
    failures.push(key+": SHA-256 mismatch, review and refresh approval");
  else verified++;
}
const pkg=ledger.records["br/package"];
if(!pkg?.artifacts || !Array.isArray(pkg.artifacts) || pkg.artifacts.length!==8){
  failures.push("br/package: expected eight source documents");
}else{
  for(const entry of pkg.artifacts){
    const path=join(root,entry.path);
    if(!existsSync(path)||digest(readFileSync(path,"utf8"))!==entry.sha256)
      failures.push("br/package: stale source file "+entry.path);
  }
  const manifest=digest(pkg.artifacts.map(a=>a.path+"\n"+a.sha256+"\n").join(""));
  if(manifest!==pkg.sha256||(pkg.current_artifact_sha256 &&
    manifest!==pkg.current_artifact_sha256))
    failures.push("br/package: stale manifest SHA-256");
  else verified++;
}
const modules=["identity-access","foundation-structure","registration-approvals",
  "membership-volunteers","projects-field-operations","beneficiaries-assistance",
  "campaigns-donations","csr-funding","finance-accounting","human-resources",
  "payroll-compensation","inventory-suppliers","referrals-rewards",
  "healthcare-network","patients-appointments","healthcare-diagnostics",
  "healthcare-assistance-settlements","cms-public-content","documents-notifications",
  "mis-reporting","platform-configuration-audit","pharmacy-operations",
  "nursing-operations","ot-procedures"];
const paths=["prd.md","hld.md"].map(f=>join(base,f));
for(let i=0;i<modules.length;i++)for(const doc of ["module.md","dld.md","uiux.md","tasks.md"])
  paths.push(join(base,"modules","cg-"+String(i+1).padStart(2,"0")+"-"+modules[i],doc));
// Require an approval record for every canonical design artifact, not just
// correctness of records already present. Missing QA task approvals must fail.
const requiredApprovalKeys = ["prd", "hld"];
for (let i = 0; i < modules.length; i++) {
  const moduleKey = "cg-" + String(i + 1).padStart(2, "0") + "-" + modules[i];
  for (const kind of ["planning", "dld", "uiux", "tasks"])
    requiredApprovalKeys.push(kind + "/" + moduleKey);
}
for (const key of requiredApprovalKeys) {
  if (!Object.prototype.hasOwnProperty.call(ledger.records, key))
    failures.push(key + ": missing canonical design approval record");
}
const legacy=/accounts\.invite\b|\/api\/access\/invitations\b|\binviteOnly\b|\brootMfaRequired\b|\brequiresFreshAuthenticator\b|magic.?link|passwordless|otp[- ]?only login|login[- ]?otp\b|(?:login|sign.?in).{0,60}\bTOTP\b|\bTOTP\b.{0,60}(?:login|sign.?in)/i;
for(const relative of paths){
  const path=join(root,relative);
  if(!existsSync(path)){failures.push("Missing module document "+relative);continue;}
  if(legacy.test(readFileSync(path,"utf8")))failures.push("Outdated identity requirement in "+relative);
}
console.log("CareGanga design integrity:",verified+"/"+Object.keys(ledger.records).length+
  " exact SHA-256 approvals checked; "+modules.length+" modules, "+paths.length+" canonical planning files scanned.");
console.log("Design check only: PostgreSQL, Web/Android builds, provider delivery, UI/device QA and independent specialist review are NOT_RUN.");
if(failures.length){for(const f of failures)console.error("FAIL:",f);process.exitCode=1;}
else console.log("SOURCE_CONSISTENT: no design-hash or retired-login pattern mismatch detected.");
