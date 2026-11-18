/** CareGanga six-source-owner preflight. Static code and QA-ID integrity only.
 * Never substitutes for JASIQ Harness, independent review, migrations, builds
 * or positive/negative/error runtime/manual QA. No CI/GH Actions.
 */
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const present=path=>existsSync(resolve(root,path));
const errors=[],findings=[];
const check=(label,condition)=>{
 findings.push({label,passed:Boolean(condition)});
 if(!condition)errors.push(label);
};
const base="specs/initiatives/careganga-foundation-platform/modules";
const expected={
 "cg-01-identity-access":[18,11,14,8],
 "cg-02-foundation-structure":[9,16],
 "cg-03-registration-approvals":[10,10,11],
 "cg-09-finance-accounting":[10,13,11,13,12,12],
 "cg-18-cms-public-content":[20,18,20,18],
 "cg-19-documents-notifications":[13,15,14]
};
let totalQA=0;
for(const [module,stories] of Object.entries(expected)){
 const prefix=`${base}/${module}`;
 for(const name of ["module.md","dld.md","uiux.md","tasks.md"])
  check(`${module}: ${name} exists`,present(prefix+"/"+name));
 if(!present(prefix+"/tasks.md"))continue;
 const content=read(prefix+"/tasks.md");
 const actual=new Set(content.match(/\bUS-\d{3}-QA\d{2}\b/g)??[]);
 const required=new Set();
 for(let i=0;i<stories.length;i++){
  for(let n=1;n<=stories[i];n++)
   required.add(`US-${String(i+1).padStart(3,"0")}-QA${String(n).padStart(2,"0")}`);
 }
 totalQA+=required.size;
 check(`${module}: exactly ${required.size} original unique QA IDs`,
  actual.size===required.size&&[...required].every(x=>actual.has(x)));
 check(`${module}: source and runtime status distinguished`,
  /NOT_RUN|NOT_EXECUTED|runtime QA/i.test(content));
}
check("Six original source owners have exactly 296 canonical QA cases",totalQA===296);
const sources={
 auth: "apps/backend/src/modules/cg-01-identity-access/application/session.service.ts",
 foundation:"apps/backend/src/modules/cg-02-foundation-structure/application",
 finance:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-journal-posting.service.ts",
 reports:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-reports.service.ts",
 cms:"apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts",
 media:"apps/backend/src/modules/cg-19-documents-notifications/application/cms-draft-media.service.ts",
 publicMedia:"apps/backend/src/modules/cg-19-documents-notifications/http/cms-draft-media.controller.ts",
 videoProxy:"apps/web/src/app/api/public/content/media/[fileRef]/route.ts",
 native:"apps/android-public/src/features/cms/public-cms-screen.tsx",
 web:"apps/web/src/features/cms-public-content/cms-public-page.tsx",
 ngo:"apps/web/src/features/cms-public-content/cms-ngo-pages.tsx",
 reference:"docs/research/CAREGANGA-ORIGINAL-PUBLIC-SCREENSHOT-QA-TRACE-20261118.md"
};
for(const [key,path] of Object.entries(sources))
 check(`Core source exists: ${key}`,present(path));
if(Object.values(sources).every(p=>present(p))){
 const cms=read(sources.cms),media=read(sources.media),http=read(sources.publicMedia);
 const video=read(sources.videoProxy),native=read(sources.native),ngo=read(sources.ngo);
 check("Public notices require current original CG19 and explicit release",
  cms.includes("n.audience_kind='ALL_ACTIVE'")&&
  cms.includes("publicReleaseConfirmed'='true'")&&
  cms.includes("a.public_rights_status<>'VALIDATED'"));
 check("Public article and navigation deny revoked placement rights",
  (cms.match(/a.public_rights_status<>'VALIDATED'/g)??[]).length>=3);
 check("CG19 public media verifies rights before AND after private file read",
  (media.match(/PUBLIC_MEDIA_SECTION_ALLOWED\+/g)??[]).length>=2&&
  media.includes("f.public_rights_confirmed=true")&&
  media.includes("createHash(\"sha256\")"));
 check("Original Videos keeps protected byte ranges across both servers",
  http.includes("await this.media.publicBytes(ref)")&&http.includes("response.status(206)")&&
  http.includes("response.status(416)")&&video.includes("headers:range?{Range:range}:undefined")&&
  video.includes("status:partial?206:200"));
 check("No second NGO records or unverified document URLs",
  ngo.includes('publishedCmsPage("80g")')&&ngo.includes("safeMediaPath(a.src)")&&
  !ngo.includes("financialReportMaster"));
 check("Android media/NGO/Notices reuse approved original sources",
  native.includes("publishedNotices()")&&native.includes('setNgoScope("80g")')&&
  native.includes('contact:"CONTACT"'));
}
const positives=findings.filter(x=>x.passed).length;
console.log(`CareGanga static core preflight: ${positives}/${findings.length}; ${totalQA} original QA IDs checked.`);
for(const x of findings)if(!x.passed)console.error("SOURCE_FAIL: "+x.label);
console.log("Source presence is NOT a runtime or visual PASS. Run design approvals, backend/Web/Android builds, disposable PostgreSQL migrations, scanners and original manual positive/negative/error cases separately.");
if(errors.length)process.exitCode=1;
