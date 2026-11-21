/** CG17 US006 original monthly claim + CG09 source preflight.
 * Run locally with 'node scripts/verify-cg17-us006-source.mjs'.
 * Static parse/source contract only, NOT PostgreSQL, real payout, Web,
 * Android device, CG14 bank proof, independent financial QA or runtime PASS.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const cg17="apps/backend/src/modules/cg-17-healthcare-assistance-settlements/";
const cg09="apps/backend/src/modules/cg-09-finance-accounting/";
const files={
 monthlySql:"apps/backend/db/migrations/1707_cg17_monthly_provider_settlement.sql",
 payoutSql:"apps/backend/db/migrations/1708_cg17_verified_provider_payout_allocation.sql",
 correctionSql:"apps/backend/db/migrations/1709_cg17_original_unpaid_liability_reversal.sql",
 liability:cg17+"application/completed-consultation-liability.service.ts",
 webLiability:"apps/web/src/features/healthcare-assistance/completed-consultation-liability-workspace.tsx",
 nativeLiability:"apps/android-internal/src/features/healthcare-assistance/native-completed-consultation-liabilities.tsx",
 payout:cg17+"application/verified-provider-payout.service.ts",
 correction:cg17+"application/foundation-liability-correction.service.ts",
 correctionApi:cg17+"http/foundation-journal-reconciliation.controller.ts",
 webCorrection:"apps/web/src/features/healthcare-assistance/foundation-journal-correction-panel.tsx",
 nativeCorrection:"apps/android-internal/src/features/healthcare-assistance/native-foundation-journal-correction.tsx",
 webJournal:"apps/web/src/features/healthcare-assistance/foundation-journal-posting-panel.tsx",
 nativeJournal:"apps/android-internal/src/features/healthcare-assistance/native-foundation-journal-panel.tsx",
 webJournalBff:"apps/web/src/app/api/healthcare-assistance/foundation-journals/[...parts]/route.ts",
 bank:cg09+"application/healthcare-provider-payout-proof.facade.ts",
 cg09Module:cg09+"finance-source.module.ts",
 webPayout:"apps/web/src/features/healthcare-assistance/verified-provider-payout-panel.tsx",
 nativePayout:"apps/android-internal/src/features/healthcare-assistance/native-verified-provider-payout.tsx",
 accrualSql:"apps/backend/db/migrations/1706_cg17_completed_consultation_liability.sql",
 monthly:cg17+"application/monthly-provider-settlement.service.ts",
 monthlyApi:cg17+"http/monthly-provider-settlement.controller.ts",
 cg09:cg09+"application/healthcare-foundation-posting.facade.ts",
 journal:cg09+"application/finance-journal-posting.service.ts",
 accrual:cg17+"application/foundation-journal-reconciliation.service.ts",
 cg14:"apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts",
 capability:"apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts",
 module:cg17+"healthcare-assistance.module.ts",
 webBff:"apps/web/src/app/api/healthcare-assistance/provider-settlements/[...parts]/route.ts",
 web:"apps/web/src/features/healthcare-assistance/monthly-provider-settlement-workspace.tsx",
 webPage:"apps/web/src/app/(admin)/admin/health-network/settlements/page.tsx",
 nav:"apps/web/src/shared/foundation-admin-nav.tsx",
 native:"apps/android-internal/src/features/healthcare-assistance/native-monthly-provider-settlement.tsx",
 staff:"apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
 dashboard:"apps/android-internal/src/features/dashboard/dashboard-modules.ts"
};
for(const file of Object.values(files)){
 const s=read(file);
 if(/\.tsx?$/.test(file)){
  const tree=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,
   file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(tree.parseDiagnostics.length,0,file+": "+
   tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
 }
 assert.doesNotMatch(s,/^(<{7}|={7}|>{7})/m,file+": merge conflict");
}
// Guard the actual PostgreSQL PL/pgSQL dollar delimiters, not just keywords.
// A previous plain JS String.replace("$$") silently wrote one literal dollar.
const payoutMigration=read(files.payoutSql);
assert.doesNotMatch(payoutMigration,/END \$;/,
 "Every CG17 PL/pgSQL function must close using the original $$ delimiter");
assert.equal((payoutMigration.match(/\$\$/g)??[]).length,4,
 "CG17 SQL must have exactly two matching function dollar-quote pairs");
assert.match(payoutMigration,/CREATE FUNCTION cg17_verified_payout_guard\(\)[\s\S]*?END \$\$;/,
 "Verified payout guard must be a complete PL/pgSQL function");
assert.match(payoutMigration,/CREATE OR REPLACE FUNCTION cg17_settlement_claim_guard\(\)[\s\S]*?END \$\$;/,
 "Settlement claim guard must be a complete PL/pgSQL function");
const must=(file,pattern,reason)=>assert.match(read(files[file]),pattern,reason);
must("accrualSql",/uq_cg17_patient_charge_realm_id_center/,
 "Postgres accrual foreign keys require exact parent unique constraint");
must("monthly",/this\.identity\.assertCurrent\(c,a,"health\.providers\.finance\.view"\)/,
 "Foundation-wide settlement reads require independent finance right");
must("monthly",/async ownCenterStatement\(/,
 "Partner statement uses separate current CG14 own-center authorization");
must("monthlyApi",/my-centers\/eligible/,
 "Partner Android has own-assigned-center options, not Foundation list");
must("webPage",/!actions\.has\("health\.providers\.finance\.view"\)/,
 "Foundation Web route rejects own-center-only representative");
must("accrualSql",/CREATE TABLE cg17_financial_effect/,"CG17 original accrual effect");
must("cg09",/this\.posting\.postBalanced/,"CG09 owns original balanced journal");
must("journal",/INSERT INTO journal\(/,"Original journal ownership");
must("accrual",/this\.cg09\.postAccrual/,"Accrual must use original CG09");
must("accrual",/j\.reversal_of_id IS NULL/,
 "A reversal journal cannot satisfy the original CG17 accrual replay");
must("accrual",/SELECT count\(\*\) FROM journal_line exact/,
 "Original accrual replay must inspect every actual CG09 journal line");
must("accrual",/exact\.journal_id=j\.id\)=2/,
 "Replay must reject extra balanced legs rather than a matching debit/credit pair");
must("monthlySql",/CREATE TABLE provider_settlement\(/,"Original provider settlement schema");
must("monthlySql",/CREATE TABLE provider_settlement_line\(/,"Immutable source lines");
must("monthlySql",/UNIQUE\(root_realm_id,liability_ref\)/,"No double inclusion");
must("monthlySql",/OLD\.state<>'PROPOSED' OR NEW\.state<>'APPROVED'/,
 "One approved proposal transition only; no invented provider payout");
must("monthlySql",/NEW\.reviewed_by=OLD\.proposed_by/,
 "Independent claim reviewer");
must("monthlySql",/j\.immutable_source_event_key=effect\.idempotency_key/,
 "DB claim must require original CG09 immutable event key");
must("monthlySql",/j\.immutable_payload_digest=effect\.source_digest/,
 "DB claim must require CG09 source digest");
must("monthly",/this\.centers\.verifiedFoundationSettlementDestination/,
 "CG14 actual provider bank proof, not generated in CG17");
must("cg14",/intent\.classification='HEALTH_BANK_PROOF'/,
 "CG14 bank proof must be original CG19 scanner validated");
must("cg14",/file\.scan_status='CLEAN_VERIFIED'/,
 "CG19 original scanner source required");
must("monthly",/e\.posting_state='POSTED'/,"Only posted Foundation liabilities");
must("monthly",/j\.source_ref=e\.id/,
 "Application source must use exact CG09 journal effect");
must("monthly",/pg_advisory_xact_lock/,
 "Concurrent period proposal must be serialized");
must("monthly",/this\.identity\.assertCurrent\(c,a,"approvals\.review"\)/,
 "Independent privileged review is required");
must("monthly",/saved\.proposed_by===a\.accountId/,
 "Approver cannot be proposer");
must("monthly",/actualPaidMinor:c\.paid_minor/,
 "No invented settled amount");
must("monthly",/if\(saved\.state==="PROPOSED"\)return/,
 "Foundation Admin must handle proposed claim separately from approved settlement");
must("monthly",/proposedClaimMinor:view\.approvedFoundationMinor/,
 "Proposal amount has its own source field");
must("monthly",/approvedFoundationMinor:"0",outstandingMinor:"0"/,
 "No unapproved claim may be presented as approved or money due");
must("web",/data\.state==="PROPOSED"\?data\.proposedClaimMinor/,
 "Web Admin must show the pending proposal, not an approved amount");
must("native",/source\.state==="PROPOSED"\?source\.proposedClaimMinor/,
 "Internal Android must show the same original proposed amount");
must("native",/\["APPROVED","PARTIALLY_SETTLED","SETTLED"\]\.includes\(source\.state\)/,
 "Internal Android must never show money due before an approved claim");
must("monthly",/patientCollectionNotFoundationIncome:true/,
 "Center patient collections must stay outside Foundation books");
must("monthly",/patientCollectedVerifiedMinor/,
 "H17 actual verified own-center receipts must be separate");
must("monthly",/patientRefundedMinor/,
 "H17 center refunds/corrections must not become Foundation revenue");
must("monthly",/foundationApprovedLiabilityMinor/,
 "H17 original Foundation liability must remain independent from cash");
must("web",/centerGrossServicesMinor/,
 "Web month breakdown must show real completed service gross");
must("native",/centerGrossServicesMinor/,
 "Internal Android must show same source financial breakdown");

must("webBff",/cg_staff_session/,"No public mutation");
must("webPage",/healthcare\.assistance\.settlements\.view/,
 "Current CG01 Web role must gate source access");
must("nav",/healthSettlements/,"UI route is discoverable on original Admin");
must("native",/provider-settlements/,"Native must use same original API");
must("staff",/NativeMonthlyProviderSettlement token=\{token\}/,
 "Internal Android actual staff route required");
must("dashboard",/healthcare\.assistance\.settlements\.view/,
 "Native menu remains CG01 guarded");
must("payoutSql",/CREATE TABLE provider_settlement_payment\(/,
 "Original verified bank link must be CG17-owned, not a duplicate journal");
must("payoutSql",/UNIQUE\(root_realm_id,bank_reconciliation_ref\)/,
 "One original CG09 bank item may never pay two provider claims");
must("payoutSql",/bank\.status='VERIFIED' AND bank\.variance_minor=0/,
 "Independently verified CG09 statement required");
must("payoutSql",/count_lines<>2 OR bank_count<>1 OR liability_count<>1/,
 "Exactly one bank credit and one payable debit");
must("payoutSql",/file\.scan_status='CLEAN_VERIFIED'/,
 "Payout must recheck original CG14 bank proof at DB level");
must("payoutSql",/v_paid<>NEW\.paid_minor/,
 "Payout status must equal immutable verified allocation sum");
must("payoutSql",/NEW\.verified_by_account=rec\.proposed_by/,
 "Payout confirmer may not self-certify proposed provider claim");
must("payoutSql",/source_line_count<1 OR matched_line_count<>source_line_count/,
 "Database rechecks every original claim liability's correct payable credit");
must("payoutSql",/credit.account_id=NEW.liability_account_ref/,
 "Original CG09 accrual account must match payout journal liability debit");
must("payout",/this\.payableAccount\(c,claim\)/,
 "Provider payout checks every original claim source, not only any bank item");
must("payout",/proof\.liabilityAccountRef!==payable/,
 "Provider payout rejects a valid bank item for a different accrued payable account");
must("bank",/liabilityAccountRef\?:string/,
 "CG09 bank options support same original payable-account restriction");
must("bank",/pay.account_id=\$3::uuid/,
 "Unrelated bank debits are not offered to the CG17 payout operator");
must("payout",/this\.cg09\.verify\(c,a,bankMatch\)/,
 "Must use existing CG09 bank owner facade");
must("bank",/finance_bank_reconciliation bank/,
 "CG09 owns real original independently reviewed statement");
must("bank",/bank\.statement_amount_minor<0/,
 "Bank must have actually paid OUT, not received Foundation cash");
must("bank",/finance\.reconciliation\.manage/,
 "Reuse existing CG09 protected permission");
must("payout",/this\.centers\.verifiedFoundationSettlementDestination/,
 "Payment recipient must use CG14 prior protected owner");
must("payout",/source_digest,request_key,verified_by_account/,
 "Every verified payout needs original immutable request and actor");
must("payout",/claim\.state==="SETTLED"/,
 "Already settled provider claim cannot be overpaid");
must("payout",/updatedPaid===BigInt\(claim\.approved_total_minor\)/,
 "Partial versus fully settled status must use exact amount");
must("webPayout",/payout-options/,
 "Web staff must read actual original payout source");
must("webPayout",/payeeMatched:true/,
 "Authorized human must attest real beneficiary match");
must("webPage",/canPay=\{actions\.has\("healthcare\.assistance\.settlements\.pay"\)/,
 "Actual Web staff payout controls must require current sensitive action");
must("nativePayout",/payout-options/,
 "Native staff must read the SAME original CG09 payout source");
must("nativePayout",/Crypto\.randomUUID\(\)/,
 "Native unknown-outcome retry uses stable original request key");
must("staff",/canPay=\{roleActions\.includes\("healthcare\.assistance\.settlements\.pay"\)/,
 "Native payout action must be hidden without current CG01 grant");
// A posted original journal stays POSTED after an offsetting REVERSAL journal.
// Never claim, allocate payout, or acknowledge a stale accrued source on its
// old row alone; check for a linked actual posted offset journal.
must("monthly",/offset_j\.reversal_of_id=j\.id/,"A reversed CG09 accrual cannot enter a month claim");
must("payout",/offset_j\.reversal_of_id=j\.id/,"A reversed CG09 accrual cannot be paid");
must("accrual",/offset_j\.reversal_of_id=j\.id/,"A reversed CG09 accrual cannot replay as outstanding");
// Original CG17 US006 correction is one audited CG09 journal, never a
// second ledger, fictitious bank return or write to an immutable old entry.
must("correctionSql",/CREATE TABLE cg17_liability_correction\(/,
 "Source-backed original correction evidence must be real PostgreSQL");
must("correctionSql",/CREATE OR REPLACE FUNCTION cg09_require_manual_reversal_proof\(/,
 "CG09 deferred journal reversal must require original immutable proof");
must("correctionSql",/EXISTS\(SELECT 1 FROM provider_settlement_line/,
 "Original claimed/paid liability cannot be silently reversed");
must("correction",/requireFreshFoundationRootProof\(c,a,currentPassword\)/,
 "Fresh CG01 current password is mandatory on actual protected correction");
must("correction",/this\.protectedOwner\.verifyReviewer\(c,a,"approvals\.review",true\)/,
 "Only independently authorized Foundation protected reviewer may correct");
must("correction",/this\.claimed\(c,a\.realmId,liability\)/,
 "Correction must check existing immutable provider claim");
must("correction",/this\.cg09\.reverseAccrual\(c,a,/,
 "Only original CG09 posting owner can reverse accrual");
must("cg09",/async reverseAccrual\(/,
 "CG09 existing posting facade must own exact balanced opposite journal");
must("correctionApi",/correction-options/,
 "Original CG17 controller exposes protected original status");
must("correctionApi",/liabilityRef\/reverse/,
 "Original CG17 controller exposes protected reversal");
must("webJournalBff",/\["post","reverse"\]/,
 "Staff Web BFF allows only protected explicit correction commands");
must("webCorrection",/currentPassword:password/,
 "Web reviewer must confirm fresh password");
must("nativeCorrection",/currentPassword:password/,
 "Internal Android must have the same protected correction action");
must("webJournal",/FoundationJournalCorrectionPanel/,
 "Correction must be reachable from existing Web accounting flow");
must("nativeJournal",/NativeFoundationJournalCorrection/,
 "Correction must be reachable in the original native staff accounting flow");
must("monthly",/cg17_liability_correction corrected/,
 "Corrected liabilities cannot inflate active provider economics");
must("correctionSql",/cg17_liability_correction_immutable/,
 "Correction proof and reviewer history must be append-only");
const correctionMigration=read(files.correctionSql);
assert.equal((correctionMigration.match(/\$cg17\$/g)??[]).length,4,
 "Both CG17 protected evidence and claim-safety triggers require balanced dollar delimiters");
assert.equal((correctionMigration.match(/\$cg09\$/g)??[]).length,2,
 "CG09 original reverse-proof guard must use matching dollar delimiters");
must("liability",/claim\.state AS settlement_state/,"Original CG17 liability must source real claim status");
must("liability",/providerSettled:liability\.settlement_state==="SETTLED"/,"Do not always report provider unpaid");
must("webLiability",/status\.providerSettlementState==="PARTIALLY_SETTLED"/,"Web must show actual partial claim");
must("nativeLiability",/status\.providerSettlementState==="PARTIALLY_SETTLED"/,"Internal Android must show actual partial claim");

const escapeChar=String.fromCharCode(92);
const correctDatePattern="/^"+escapeChar+"d{4}-"+escapeChar+"d{2}-"+
 escapeChar+"d{2}$/";
const doubleEscapedDatePattern=correctDatePattern.replaceAll(
 escapeChar,escapeChar+escapeChar);
for(const file of [files.cg09,files.webJournalBff]){
 const source=read(file);
 assert.ok(source.includes(correctDatePattern),
  file+": CG09/Web date parser must accept actual ISO dates");
 assert.ok(!source.includes(doubleEscapedDatePattern),
  file+": rejection of legitimate ISO correction dates is prohibited");
}
console.log("CG17 US006 month and verified-payout source parse/contract preflight PASS. "+
 "CG09 bank/PG races, reversal, Web/Android device and independent QA NOT_RUN.");
