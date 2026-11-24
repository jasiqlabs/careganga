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
 const clean=content.replace(/origin=CG-\d+\/US-\d{3}-QA\d{2}/g,"");
 const actual=new Set(clean.match(/\bUS-\d{3}-QA\d{2}\b/g)??[]);
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
// Risk-based source regression for the formal Finance branch-isolation finding.
// These confirm expected guards exist; they do NOT execute RBAC/DB scenarios.
const financeGuards={
 branch:"apps/backend/src/modules/cg-02-foundation-structure/application/branch-source.facade.ts",
 accounts:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-accounts.service.ts",
 voucherList:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-voucher-draft.service.ts",
 voucherDashboard:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-voucher-dashboard.service.ts",
 voucherSource:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-voucher-source.facade.ts",
 budget:"apps/backend/src/modules/cg-09-finance-accounting/application/finance-budget.service.ts",
 webFinance:"apps/web/src/features/finance-accounting/finance-accounts-workspace.tsx",
 nativeFinance:"apps/android-internal/src/features/finance-accounting/finance-accounts-screen.tsx",
 nativeEditor:"apps/android-internal/src/features/finance-accounting/finance-setup-editor.tsx"
};
for(const [key,path] of Object.entries(financeGuards))
 check("Finance branch owner source exists: "+key,present(path));
if(Object.values(financeGuards).every(path=>present(path))){
 const src=Object.fromEntries(Object.entries(financeGuards)
  .map(([key,path])=>[key,read(path)]));
 check("CG02 scope rejects unauthorized account and voucher branch writes",
  src.branch.includes("async requireFinanceActorBranch(")&&
  src.branch.includes("await this.requireFinanceActorBranch(client,actor,branchRef,action)")&&
  src.branch.includes("async requireFinanceRootScope("));
 check("CG02 never returns every branch to an ordinary Finance reader",
  src.branch.includes("const scope=await this.financeReportScope(bearer,capability)")&&
  src.branch.includes("id=ANY($3::uuid[])"));
 check("CG09 accounts restrict list balances/labels and Foundation writes",
  src.accounts.includes('financeReportScope(bearer,"finance.accounts.view")')&&
  src.accounts.includes("a.branch_id=ANY($10::uuid[])")&&
  src.accounts.includes('THEN cb.masked_details ELSE NULL END AS "maskedDetails"')&&
  src.accounts.includes('requireFinanceRootScope(client,actor,"finance.accounts.manage")')&&
  src.accounts.includes('requireFinanceRootScope(client,actor,"finance.journals.post")'));
 check("CG09 voucher dashboard summary/month/categories respect CG02",
  src.voucherDashboard.includes('financeReportScope(bearer,"finance.vouchers.view")')&&
  src.voucherDashboard.includes("v.branch_id=ANY($3::uuid[])")&&
  src.voucherDashboard.includes("branch_id=ANY($3::uuid[])"));
 check("CG09 voucher lists/details and drafts deny foreign and root records",
  src.voucherList.includes('financeReportScope(bearer,"finance.vouchers.view")')&&
  src.voucherList.includes("v.branch_id=ANY($4::uuid[])")&&
  src.voucherList.includes("v.branch_id=ANY($5::uuid[])")&&
  src.voucherList.includes('requireFinanceRootScope(client,actor,"finance.vouchers.manage")')&&
  src.voucherList.includes("old.rows[0].branch_id"));
 check("CG09 source facade prevents historic/current cross-branch voucher reads",
  src.voucherSource.includes("await this.branches.requireFinanceActorBranch(client,actor,v.branch_id,capability)")&&
  src.voucherSource.includes("await this.branches.requireFinanceRootScope(client,actor,capability)")&&
  src.voucherSource.includes('requireFinanceRootScope(client,actor,"finance.vouchers.view")'));
 check("CG09 budget CRUD/list/dashboard respects original CG02 scope",
  src.budget.includes('requireFinanceRootScope(tx,actor,"finance.budgets.manage")')&&
  src.budget.includes('financeReportScope(bearer,"finance.budgets.view")')&&
  src.budget.includes("b.branch_id=ANY($3::uuid[])"));
 check("Finance staff Web and native actions hide Foundation-wide access",
  src.webFinance.includes("canManageFoundationFinance")&&
  src.webFinance.includes("canManage&&canFoundation")&&
  src.nativeFinance.includes("canManage&&canFoundation")&&
  src.nativeEditor.includes('scopeKind:data.canManageFoundationFinance?"FOUNDATION":"BRANCH"'));
}

// 18 Nov independent risk-review regression guards. These intentionally check
// source wiring only; developer must still test 401/403, DB, Web and native.
const securityPaths={
 session:"apps/backend/src/modules/cg-01-identity-access/application/session.service.ts",
 safeCopy:"apps/backend/src/core/http/safe-error-copy.ts",
 safeFilter:"apps/backend/src/core/http/safe-errors.filter.ts",
 loginProxy:"apps/web/src/app/api/session/login/route.ts",
 loginForm:"apps/web/src/features/identity-access/login-form.tsx",
 loginNative:"apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
 cmsEditor:"apps/web/src/features/cms-public-content/cms-admin-workspace.tsx",
 cmsBackend:"apps/backend/src/modules/cg-18-cms-public-content/application/cms-editorial.service.ts",
 cmsMedia:"apps/backend/src/modules/cg-19-documents-notifications/application/cms-draft-media.service.ts",
 cmsMigration:"apps/backend/db/migrations/0937_cg18_same_page_verified_media_reuse.sql",
 financeMigration:"apps/backend/db/migrations/0908_cg09_balanced_voucher_effect.sql"
};
for(const [key,file] of Object.entries(securityPaths))
 check("Independent review source exists: "+key,present(file));
if(Object.values(securityPaths).every(present)){
 const s=Object.fromEntries(Object.entries(securityPaths).map(([key,file])=>[key,read(file)]));
 check("Invalid login has one non-enumerating Admin-editable backend code",
  s.session.includes('code:"IDENTITY_LOGIN_INVALID"')&&
  s.session.includes("new UnauthorizedException(INVALID_LOGIN)")&&
  s.safeCopy.includes("IDENTITY_LOGIN_INVALID:")&&
  s.safeFilter.includes("await this.editableCopy(code)"));
 check("Web and native show only safe server-owned invalid-login wording",
  s.loginProxy.includes('payload.code==="IDENTITY_LOGIN_INVALID"')&&
  s.loginForm.includes('safe.code==="IDENTITY_LOGIN_INVALID"')&&
  s.loginNative.includes('data.code==="IDENTITY_LOGIN_INVALID"'));
 check("CG18 rejects self-attested team publication and strips historic public PII",
  s.cmsBackend.includes('code:"CMS_TEAM_SOURCE_NOT_READY"')&&
  (s.cmsBackend.includes('v.section_kind==="TEAM"?{heading:v.structured_fields.heading,members:[]}')||
   s.cmsBackend.includes('v.section_kind==="TEAM"?(teamCards.get(v.order_no)??{heading:v.structured_fields.heading,members:[]}'))&&
  s.cmsBackend.includes('visibleAssets.filter(v=>v.role!=="TEAM")'));
 check("CG19 blocks direct public TEAM image URLs even if previously shared",
  !s.cmsMedia.includes("(a.role='TEAM' AND sec.section_kind='TEAM'")&&
  !s.cmsMedia.includes("'MOBILE_HERO','TEAM','ABOUT'")&&
  s.cmsMedia.split("PUBLIC_MEDIA_SECTION_ALLOWED+PUBLIC_MEDIA_MIME_ALLOWED+").length>=3);
 check("CMS editor does not offer unverified new people or false public consent success",
  (s.cmsEditor.includes("pending verified people source")||s.cmsEditor.includes("Public team directory"))&&
  !s.cmsEditor.includes("Add team member</button>")&&
  (s.cmsEditor.includes("draft.team.length===0")||s.cmsEditor.includes("draft.team.every(")));
 check("Finance and media reuse migration preserve Foundation-root composite FKs",
  s.cmsMigration.includes("fk_cg18_cg19_same_page_media")&&
  s.cmsMigration.includes("FOREIGN KEY(cg19_file_ref,foundation_root_id,page_id)")&&
  s.financeMigration.includes("fk_cg09_voucher_debit")&&
  s.financeMigration.includes("fk_cg09_voucher_credit"));
}
const positives=findings.filter(x=>x.passed).length;
console.log(`CareGanga static core preflight: ${positives}/${findings.length}; ${totalQA} original QA IDs checked.`);
for(const x of findings)if(!x.passed)console.error("SOURCE_FAIL: "+x.label);
console.log("Source presence is NOT a runtime or visual PASS. Run design approvals, backend/Web/Android builds, disposable PostgreSQL migrations, scanners and original manual positive/negative/error cases separately.");
if(errors.length)process.exitCode=1;
