import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseDonationIntent} from "../src/modules/cg-07-campaigns-donations/domain/donation-input";

/** Source-only tests. These do NOT substitute for real DB, webhook,
 * phone, PDF or client-screenshot QA. See the 60 original QA case tracker. */
const root=(path:string)=>readFileSync(new URL("../../../"+path,import.meta.url),"utf8");
const id="11111111-1111-4111-8111-111111111111";
const raw=()=>({requestKey:id,campaignSlug:null,amount:"250.50",consent:true,
 donor:{name:"",mobile:"",email:"",pan:"",address:""}});
const source=(path:string)=>root("apps/backend/src/modules/cg-07-campaigns-donations/"+path);
const migration=(n:string)=>root("apps/backend/db/migrations/"+n);
test("US002-QA01/12/13: anonymous general donation accepts exact paise and original consent",()=>{
 const d=parseDonationIntent(raw());
 assert.equal(d.amountMinor,"25050");assert.equal(d.campaignSlug,null);
 assert.equal(d.consent,true);assert.equal(d.donor.name,"");
 assert.equal(parseDonationIntent({...raw(),amount:"1"}).amountMinor,"100");
});
test("US002-QA02/04/12: cannot smuggle private scope, status, XSS, overflow or unconsented donor",()=>{
 for(const value of [
  {...raw(),rootRealmId:id},{...raw(),source_status:"RECEIVED_POSTED"},
  {...raw(),consent:false},{...raw(),amount:"0"},{...raw(),amount:"0.99"},
  {...raw(),amount:"1e5"},{...raw(),amount:"-10"},
  {...raw(),amount:"9999999999999"},{...raw(),amount:"1.001"},
  {...raw(),campaignSlug:"<script>"},
  {...raw(),donor:{...raw().donor,name:"<script>"}},
  {...raw(),donor:{...raw().donor,pan:"12345ABCDE"}}
 ])assert.throws(()=>parseDonationIntent(value));
});
test("US002-QA03/07/15/19: original root-scoped idempotency and immutable signed events",()=>{
 const sql=migration("3306_cg07_donation_source.sql");
 assert.match(sql,/UNIQUE\(root_realm_id,request_key\)/);
 assert.match(sql,/UNIQUE\(root_realm_id,provider,merchant_reference,external_event_id\)/);
 assert.match(sql,/cg07_payment_event_immutable/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,attempt_id,donation_id\)/);
 assert.match(sql,/AFTER INSERT OR UPDATE ON donation DEFERRABLE INITIALLY DEFERRED/);
 assert.match(sql,/NEW\.source_status<>'REQUESTED'/);
 assert.match(sql,/j\.source_ref=NEW\.id/);
 assert.match(sql,/j\.immutable_payload_digest=e\.immutable_digest/);
});
test("US002-QA01/08/16/20: no CG07 shadow ledger, only original posted CG09 journal",()=>{
 const sql=migration("3306_cg07_donation_source.sql");
 const money=root("apps/backend/src/modules/cg-09-finance-accounting/application/donation-finance-posting.facade.ts");
 const cash=source("application/donation-manual.service.ts");
 const online=source("application/donation-online-finance.service.ts");
 assert.doesNotMatch(sql,/CREATE TABLE (journal|finance_account)\(/);
 assert.match(money,/this\.journal\.postBalanced/);
 assert.match(cash,/donation_finance_effect/);
 assert.match(online,/donation_finance_effect/);
 assert.match(online,/requireFreshFoundationRootProof/);
});
test("US002-QA09/10/15: HMAC raw webhook + merchant readback, never browser paid assertion",()=>{
 const online=source("application/donation-online.service.ts");
 assert.match(online,/timingSafeEqual/);
 assert.match(online,/x-razorpay-signature/);
 assert.match(online,/x-razorpay-event-id/);
 assert.match(online,/req\.rawBody|x\.rawBody/);
 assert.match(online,/remote\.amount_paid/);
 assert.match(online,/remote\.reference_id/);
 assert.match(online,/donation_payment_event/);
 assert.doesNotMatch(online,/body\.paid===true/);
});
test("US002-QA03/16: uncertain link retries read merchant reference, no second request",()=>{
 const online=source("application/donation-online.service.ts");
 assert.match(online,/private async recover\(/);
 assert.match(online,/reference_id="\+encodeURIComponent\(ref\)/);
 assert.match(online,/return this\.recover\(attempt,donation\)/);
 assert.match(online,/private async throttleLink\(/);
 assert.match(online,/RECONCILIATION_PENDING/);
});
test("US002-QA11/14: CASH requires independent real voucher, not a UTR or fabricated link",()=>{
 const sql=migration("3307_cg07_cash_collection.sql");
 const cash=source("application/donation-manual.service.ts");
 assert.match(sql,/reviewed_by<>recorded_by/);
 assert.match(sql,/FOREIGN KEY\(cash_account_ref,root_realm_id\)/);
 assert.match(cash,/source_status!=="REQUESTED"/);
 assert.match(cash,/this\.protectedOwner\.verifyReviewer/);
 assert.match(cash,/requireFreshFoundationRootProof/);
 assert.match(cash,/this\.finance\.postCash/);
});
test("US002-QA04/10/17: CG21 actual merchant and current CG18 publication gate",()=>{
 const verify=root("apps/backend/src/modules/cg-21-platform-configuration-audit/infrastructure/communication-readiness.ts");
 const publicSource=source("application/campaign-public-source.ts");
 const online=source("application/donation-online.service.ts");
 assert.match(verify,/https:\/\/api\.razorpay\.com\/v1\/payment_links/);
 assert.match(publicSource,/onlineDonationReady/);
 assert.match(online,/publicCampaignSources\(tx,valid.slug\)/);
 assert.match(online,/merchant\(tx,d\.root_realm_id\)/);
});
test("US002-QA05/06/18/20: public Web/native use proof POST and no false paid UI",()=>{
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const android=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 const bff=root("apps/web/src/app/api/public/donations/[[...parts]]/route.ts");
 const admin=source("application/donation-admin.service.ts");
 assert.match(web,/statusToken:proof/);assert.match(android,/statusToken:token/);
 assert.match(bff,/req\.headers\.get\("origin"\)!==req\.nextUrl\.origin/);
 assert.match(admin,/source_status='RECEIVED_POSTED'/);
 assert.match(admin,/refundMinor/);
 assert.doesNotMatch(web,/Paid successfully!/);
});
test("US003-QA01/04/07/09/10/19: CG19 can only issue a private non-80G PDF after posted CG09",()=>{
 const sql=migration("3309_cg19_donation_receipt_document.sql");
 const receipt=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-document.service.ts");
 assert.match(sql,/cg19_donation_receipt_proof/);
 assert.match(sql,/j\.status='POSTED'/);
 assert.match(sql,/UNIQUE\(root_realm_id,donation_id\)/);
 assert.match(receipt,/writeVerifiedPrivateDocument/);
 assert.match(receipt,/NOT a tax deduction or 80G certificate/);
 assert.match(receipt,/PDFDocument\.load/);
});
test("US003-QA02/11/18: donor private original PDF only by expiring proof POST",()=>{
 const document=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-document.service.ts");
 const web=root("apps/web/src/app/api/public/donations/[[...parts]]/route.ts");
 const android=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 assert.match(document,/status_token_digest/);
 assert.match(document,/status_token_expires_at>now\(\)/);
 assert.match(document,/readVerifiedPrivateObject/);
 assert.match(web,/receipt\/download/);assert.match(android,/receipt\/download/);
});
test("US003-QA03/08/12/13/19: refund source caps concurrent requests and exact proof",()=>{
 const sql=migration("3310_cg07_donation_refund_source.sql");
 assert.match(sql,/FOR UPDATE OF d/);
 assert.match(sql,/reserved\+NEW\.amount_minor>received/);
 assert.match(sql,/approved_by<>requested_by/);
 assert.match(sql,/cg07_refund_requires_posted_finance/);
 assert.match(sql,/l\.account_id=NEW\.cash_account_ref|ln\.account_id=NEW\.cash_account_ref/);
 const refund=source("application/donation-refund.service.ts");
 assert.match(refund,/this\.finance\.post/);
 assert.match(refund,/requireFreshFoundationRootProof/);
 assert.match(refund,/payoutConfirmed!==true/);
});
test("US003-QA05/15/16/17/20: only source-backed confirmed net goes to CMS/Web/native",()=>{
 const sourceSql=source("application/campaign-public-source.ts");
 const web=root("apps/web/src/features/campaigns/campaign-public-source.ts");
 const android=root("apps/android-public/src/features/cms/native-public-campaigns.tsx");
 assert.match(sourceSql,/raisedMinor/);
 assert.match(sourceSql,/FINANCE_REVERSED/);
 assert.match(web,/raisedMinor/);assert.match(android,/raisedMinor/);
 assert.match(root("apps/backend/src/modules/cg-07-campaigns-donations/application/donation-intents.service.ts"),/refundedMinor/);
});
test("US003-QA06/14/18/20: A18 original protected actions and no private entity ID in table",()=>{
 const web=root("apps/web/src/features/campaigns/donation-finance-actions.tsx");
 const admin=root("apps/web/src/features/campaigns/donation-admin-workspace.tsx");
 assert.match(web,/\/refunds\/request/);
 assert.match(web,/\/online\/post/);
 assert.match(web,/\/issue/);
 assert.match(web,/payoutConfirmed:true/);
 assert.match(admin,/canIssue=\{canIssue\}/);
 assert.doesNotMatch(admin,/<td[^>]*>\{x\.donationRef\}/);
});

test("US002-QA04: provider terminal/unknown state reconciles only on donor proof refresh",()=>{
 const online=source("application/donation-online.service.ts");
 const intent=source("application/donation-intents.service.ts");
 assert.match(online,/async refreshDonorStatus\(proof:string\)/);
 assert.match(online,/this\.throttleLink\(proof\)/);
 assert.match(online,/remote\.status==="expired"/);
 assert.match(online,/remote\.status==="cancelled"/);
 assert.match(online,/remote\.status==="paid"/);
 assert.match(online,/next="RECONCILIATION_PENDING"/);
 assert.doesNotMatch(online,/refreshDonorStatus[\s\S]*?next="RECEIVED_POSTED"/);
 assert.match(online,/status_token_expires_at>now\(\) FOR UPDATE/);
 assert.match(online,/const merchant=await this\.merchant\(tx,d\.root_realm_id\)/);
 assert.match(intent,/await this\.online\.refreshDonorStatus\(token\)/);
 assert.match(intent,/row\.attempt_status==="OUTCOME_UNKNOWN"/);
 assert.match(intent,/uncertain\?"RECONCILIATION_PENDING"/);
 assert.match(intent,/Do not pay again/);
});

test("US002-QA09: parent lock serializes concurrent cash and online payment initiation",()=>{
 const sql=migration("3311_cg07_payment_channel_guard.sql");
 const cash=source("application/donation-manual.service.ts");
 const online=source("application/donation-online.service.ts");
 assert.match(sql,/CREATE TRIGGER cg07_one_active_payment_path_before_insert/);
 assert.match(sql,/d\.id=NEW\.donation_id FOR UPDATE/);
 assert.match(sql,/a\.status NOT IN\('FAILED','EXPIRED'\)/);
 assert.match(cash,/method='ONLINE' AND status NOT IN\('FAILED','EXPIRED'\)/);
 assert.match(online,/otherMethod\.rowCount/);
 assert.match(online,/method<>'ONLINE' AND status NOT IN\('FAILED','EXPIRED'\)/);
 const confirm=cash.split("async confirm(bearer:string")[1];
 assert.ok(confirm.indexOf("const d=await this.donation(tx,actor,source.donation_id)")<
  confirm.indexOf("FROM donation_manual_evidence WHERE root_realm_id=$1 AND id=$2 FOR UPDATE"));
 const webhook=online.split("async webhook(req:object)")[1];
 assert.ok(webhook.indexOf("FROM donation ")<webhook.indexOf("FOR UPDATE OF a"));
 assert.match(webhook,/donation_payment_event/);
});

test("US002-QA13: public API host, browser origin and privacy proof are not client-switched",()=>{
 const ingress=source("domain/public-donation-ingress.ts");
 const intent=source("application/donation-intents.service.ts");
 const donation=source("http/public-donation-intents.controller.ts");
 const online=source("http/donation-online.controller.ts");
 const cg19=root("apps/backend/src/modules/cg-19-documents-notifications/http/donation-receipt-document.controller.ts");
 assert.match(ingress,/CG07_PUBLIC_API_HOSTS/);
 assert.match(ingress,/headers\.host/);
 assert.match(ingress,/kind==="donor"/);
 assert.match(ingress,/process\.env\.WEB_ORIGIN/);
 assert.match(ingress,/timingSafeEqual/);
 assert.match(ingress,/CG07_PUBLIC_PROXY_KEY/);
 assert.doesNotMatch(ingress,/headers\["x-forwarded-(?:for|host)"\]/i);
 assert.match(intent,/verifiedDonationPeer\(req,scope\)/);
 assert.match(donation,/assertDonationPublicIngress\(req,"donor"\)/);
 assert.match(online,/assertDonationPublicIngress\(req,"webhook"\)/);
 assert.match(cg19,/assertDonationPublicIngress\(req,"donor"\)/);
 assert.match(intent,/status_token_digest=\$1 AND d\.status_token_expires_at>now\(\)/);
});

test("US002-QA18 A16 scoped filters, bounded CSV and masked donor details",()=>{
 const admin=source("application/donation-admin.service.ts");
 const controller=source("http/donation-admin.controller.ts");
 const decoder=source("application/donation-receipt-source.facade.ts");
 const web=root("apps/web/src/features/campaigns/donation-admin-workspace.tsx");
 const bff=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 assert.match(admin,/minAmount/);assert.match(admin,/maxAmount/);
 assert.match(admin,/dateFrom/);assert.match(admin,/dateTo/);
 assert.match(admin,/method/);assert.match(admin,/campaign/);
 assert.match(admin,/async exportCsv/);assert.match(admin,/LIMIT 501/);
 assert.match(admin,/async donorDetail/);assert.match(admin,/mobileMasked/);
 assert.match(admin,/panMasked/);assert.match(admin,/financeReportScope/);
 assert.match(admin,/documents\.files\.view/);
 assert.match(decoder,/aes-256-gcm/);
 assert.match(controller,/@Post\("donor-detail"\)/);
 assert.match(web,/View donor/);assert.match(web,/Export protected CSV/);
 assert.match(bff,/route==="export"/);
 assert.match(bff,/donor-detail/);
});

test("US002-QA12: optional donor preferences are encrypted private input, not proof or recurring billing",()=>{
 const data={...raw(),donor:{...raw().donor,geography:"Pune",remarks:"For education",
  recurringIntent:true,paymentReferenceNote:"BANK REF 123456"}};
 const result=parseDonationIntent(data);
 assert.equal(result.donor.geography,"Pune");
 assert.equal(result.donor.recurringIntent,true);
 assert.equal(result.donor.paymentReferenceNote,"BANK REF 123456");
 for(const wrong of [
  {...data,donor:{...data.donor,geography:"<script>"}},
  {...data,donor:{...data.donor,recurringIntent:"true"}},
  {...data,donor:{...data.donor,remarks:"r".repeat(301)}},
  {...data,donor:{...data.donor,paymentReferenceNote:"Not paid\nOK"}},
  {...data,donor:{...data.donor,pan:"ABCDE1234Z!".slice(0,11)}}
 ])assert.throws(()=>parseDonationIntent(wrong));
 const service=source("application/donation-intents.service.ts");
 assert.match(service,/privateDonor\(v\.donor\)/);
 assert.doesNotMatch(service,/recurringIntent.*postBalanced/);
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 for(const client of [web,native]){
  assert.match(client,/geography,remarks,recurringIntent,paymentReferenceNote/);
  assert.match(client,/no automatic|does not enable automatic/i);
 }
 assert.match(web,/\[receiptStatus,setReceiptStatus\]/);
});

test("US002-QA16: signed payment outage stays queued until original protected CG09 post",()=>{
 const finance=source("application/donation-online-finance.service.ts");
 const status=source("application/donation-intents.service.ts");
 const controller=source("http/donation-online-finance.controller.ts");
 const web=root("apps/web/src/features/campaigns/donation-finance-actions.tsx");
 const proxy=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 assert.match(finance,/async reconciliationQueue\(token:string\)/);
 assert.match(finance,/financeReportScope/);
 assert.match(finance,/p\.outcome='SUCCESS'/);
 assert.match(finance,/NOT EXISTS\(SELECT 1 FROM donation_finance_effect/);
 assert.match(finance,/this\.verified\(tx,a,d\.id\)/);
 assert.match(finance,/requireFreshFoundationRootProof/);
 assert.match(finance,/this\.finance\.postProvider/);
 assert.match(finance,/donation_finance_effect/);
 assert.match(status,/awaitingFinance/);
 assert.match(status,/RECONCILIATION_PENDING/);
 assert.match(controller,/@Get\("reconcile-queue"\)/);
 assert.match(web,/refreshReconciliations/);
 assert.match(web,/No signed provider success/);
 assert.match(proxy,/online\/reconcile-queue/);
});

test("US003-QA01/11: donor history contains only individually proven, unexpired source transactions",()=>{
 const backend=source("application/donation-intents.service.ts");
 const controller=source("http/public-donation-intents.controller.ts");
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 const bff=root("apps/web/src/app/api/public/donations/[[...parts]]/route.ts");
 assert.match(backend,/async ownHistory\(req:object,raw:unknown\)/);
 assert.match(backend,/statusTokens/);
 assert.match(backend,/submitted\.length>20/);
 assert.match(backend,/status_token_digest=ANY/);
 assert.match(backend,/status_token_expires_at>now\(\)/);
 assert.match(backend,/proofIndex:hashes\.indexOf/);
 assert.match(backend,/donation_refund_request/);
 assert.match(backend,/receiptStatus/);
 assert.doesNotMatch(backend,/WHERE d\.donor_email=/);
 assert.match(controller,/@Post\("history"\)/);
 assert.match(web,/View my proven donation history/);
 assert.match(web,/download\(historyTokens\[item\.proofIndex\]\)/);
 assert.match(native,/View proven donation history/);
 assert.match(native,/download\(historyTokens\[item\.proofIndex\]\)/);
 assert.match(bff,/\["status","history","payment-link"\]/);
});

test("US003-QA02: private receipt/reversal access remains permission, branch, token and rate bound",()=>{
 const receipt=root("apps/backend/src/modules/cg-19-documents-notifications/http/donation-receipt-document.controller.ts");
 const document=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-document.service.ts");
 const intents=source("application/donation-intents.service.ts");
 const admin=source("application/donation-admin.service.ts");
 const refund=source("application/donation-refund.service.ts");
 const module=source("campaigns-donations.module.ts");
 assert.match(receipt,/assertDonationPublicIngress\(req,"donor"\)/);
 assert.match(receipt,/throttlePrivateDocumentRead\(req\)/);
 assert.match(intents,/async throttlePrivateDocumentRead/);
 assert.match(intents,/await this\.limit\(req,"status"\)/);
 assert.match(document,/status_token_expires_at>now\(\)/);
 assert.match(document,/readVerifiedPrivateObject/);
 assert.match(document,/content_sha256/);
 assert.match(admin,/documents\.files\.view/);
 assert.match(admin,/financeReportScope/);
 assert.match(refund,/requireFinanceActiveBranch|requireFinanceRootScope/);
 assert.match(module,/CampaignDraftsService/);
 assert.match(module,/DonationReceiptSourceFacade/);
 assert.match(module,/DonationIntentsService/);
});

test("US003-QA16: separate pending refund from verified net and native foreground refresh",()=>{
 const service=source("application/donation-intents.service.ts");
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 assert.match(service,/pending_refund_minor/);
 assert.match(service,/refundPendingMinor:pendingRefund\.toString\(\)/);
 assert.match(service,/refundPending:pendingRefund>0n/);
 assert.match(service,/netReceivedMinor:net\.toString\(\)/);
 assert.match(web,/Refund requested/);
 assert.match(web,/refundPending/);
 assert.match(native,/Refund requested/);
 assert.match(native,/AppState\.addEventListener\("change"/);
 assert.match(native,/state==="active"&&token/);
 assert.doesNotMatch(native,/setInterval\(/);
});

test("US003-QA05/15: verified CG09 monthly report, net export, scoped keyset and protected donor details",()=>{
 const admin=source("application/donation-admin.service.ts");
 const web=root("apps/web/src/features/campaigns/donation-admin-workspace.tsx");
 const proxy=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 assert.match(admin,/async exportCsv/);
 assert.match(admin,/documents\.files\.view/);
 assert.match(admin,/financeReportScope/);
 assert.match(admin,/monthlyTrend:(?:summary\.requiresReview\?\[\]:)?trends\.rows/);
 assert.match(admin,/j\.posting_date>=date_trunc/);
 assert.match(admin,/r\.status='FINANCE_REVERSED'/);
 assert.match(admin,/verifiedRefundMinor/);
 assert.match(admin,/netReceivedMinor/);
 assert.match(admin,/refund_minor/);
 assert.match(admin,/Verified net INR/);
 assert.match(admin,/cursorTime/);
 assert.match(admin,/cursorId/);
 assert.match(admin,/d\.created_at,d\.id/);
 assert.match(admin,/nextCursor/);
 assert.match(admin,/panMasked/);
 assert.match(web,/Verified monthly donation trend/);
 assert.match(web,/setCursorTrail/);
 assert.match(web,/data\.nextCursor/);
 assert.match(proxy,/campaign","cursor"/);
});

test("US003-QA08/14: true posted refund gets separate immutable CG19 correction and proof-only donor PDF",()=>{
 const sql=migration("3312_cg19_donation_refund_correction.sql");
 const service=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-document.service.ts");
 const controller=root("apps/backend/src/modules/cg-19-documents-notifications/http/donation-receipt-document.controller.ts");
 const admin=root("apps/web/src/features/campaigns/donation-finance-actions.tsx");
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 const proxy=root("apps/web/src/app/api/public/donations/[[...parts]]/route.ts");
 const staff=root("apps/web/src/app/api/donation-receipts/[[...parts]]/route.ts");
 assert.match(sql,/CREATE TABLE cg19_donation_receipt_correction/);
 assert.match(sql,/UNIQUE\(root_realm_id,refund_request_id\)/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,original_receipt_id\)/);
 assert.match(sql,/FOREIGN KEY\(root_realm_id,refund_request_id\)/);
 assert.match(sql,/cg19_correction_history_guard/);
 assert.match(sql,/OLD\.status='ISSUED'/);
 assert.match(sql,/r\.status='FINANCE_REVERSED'/);
 assert.match(sql,/j\.immutable_payload_digest=NEW\.source_digest/);
 assert.match(sql,/o\.status='ISSUED'/);
 assert.match(service,/async issueCorrection/);
 assert.match(service,/CG19:CORRECTION:/);
 assert.match(service,/parsed\.getSubject\(\)!=="CG19-REFUND:"/);
 assert.match(service,/async ownCorrections/);
 assert.match(service,/async downloadCorrection/);
 assert.match(service,/content_sha256/);
 assert.match(service,/status_token_expires_at>now\(\)/);
 const correctionOnly=service.split("async issueCorrection(")[1].split("async downloadWithProof(")[0];
 assert.doesNotMatch(correctionOnly,/UPDATE cg19_donation_receipt_document SET/);
 assert.match(controller,/@Post\("corrections"\)/);
 assert.match(controller,/@Post\("correction-download"\)/);
 assert.match(controller,/throttlePrivateDocumentRead\(req\)/);
 assert.match(admin,/issueCorrection/);
 assert.match(web,/listCorrections/);
 assert.match(web,/downloadCorrection/);
 assert.match(native,/listCorrections/);
 assert.match(native,/downloadCorrection/);
 assert.match(native,/file\.delete\(\)/);
 assert.match(proxy,/correction-download/);
 assert.match(staff,/\["issue","correction"\]/);
});

test("US003-QA05: original verified gross/net, correction numbers and scoped report match donor channels",()=>{
 const backend=source("application/donation-admin.service.ts");
 const cg18=source("application/campaign-public-source.ts");
 const cg19=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-document.service.ts");
 const ui=root("apps/web/src/features/campaigns/donation-admin-workspace.tsx");
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 assert.match(backend,/monthlyTrend:(?:summary\.requiresReview\?\[\]:)?trends\.rows/);
 assert.match(backend,/j\.posting_date>=date_trunc/);
 assert.match(backend,/j\.source_ref=r\.id/);
 assert.match(backend,/latestCorrectionNumber/);
 assert.match(backend,/AS correction_number/);
 assert.match(backend,/Original receipt","Latest correction/);
 assert.match(backend,/financeReportScope/);
 assert.match(backend,/documents\.files\.view/);
 assert.match(cg18,/donation_finance_effect/);
 assert.match(cg18,/donation_refund_request/);
 assert.match(cg19,/downloadCorrection/);
 assert.match(ui,/Latest correction:/);
 assert.match(web,/View issued refund corrections/);
 assert.match(native,/View my issued refund corrections/);
});

test("US003-QA18: genuine CG19 receipt sends no false delivered message on missing provider",()=>{
 const sql=migration("3313_cg19_donation_receipt_message.sql");
 const sourceFile=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-message.service.ts");
 const controller=root("apps/backend/src/modules/cg-19-documents-notifications/http/donation-receipt-document.controller.ts");
 const provider=root("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/channel-providers.ts");
 const bff=root("apps/web/src/app/api/public/donations/[[...parts]]/route.ts");
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 assert.match(sql,/CREATE TABLE cg19_donation_receipt_message/);
 assert.match(sql,/UNIQUE\(root_realm_id,donation_id,channel\)/);
 assert.match(sql,/cg19_donation_message_guard/);
 assert.match(sql,/r\.status='ISSUED'/);
 assert.match(sql,/j\.status='POSTED'/);
 assert.match(sourceFile,/async request\(raw:unknown\)/);
 assert.match(sourceFile,/async current\(raw:unknown\)/);
 assert.match(sourceFile,/verifiedEmailReady/);
 assert.match(sourceFile,/last_result_class='CHECK_ACCEPTED'/);
 assert.match(sourceFile,/this\.providers\.configured\("EMAIL","TRANSACTIONAL"\)/);
 assert.match(sourceFile,/this\.providers\.send/);
 assert.match(sourceFile,/if\(channel==="WHATSAPP"\)return format\("MESSAGE_PENDING"\)/);
 assert.match(sourceFile,/delivered:false/);
 assert.match(sourceFile,/receiptStatus:"ISSUED",downloadAvailable:true/);
 assert.match(sourceFile,/providerAccepted:state==="PROVIDER_ACCEPTED"/);
 assert.match(provider,/response\.status===202/);
 assert.match(controller,/@Post\("message"\)/);
 assert.match(controller,/@Post\("message\/status"\)/);
 assert.match(controller,/throttlePrivateDocumentRead\(req\)/);
 assert.match(bff,/receiptMessage/);
 assert.match(web,/requestReceiptMessage/);
 assert.match(web,/refreshReceiptMessage/);
 assert.match(native,/requestReceiptMessage/);
 assert.match(native,/checkReceiptMessage/);
});

test("US003-QA13 prerequisite: signed merchant captured payment ID is unique and refund-targetable",()=>{
 const online=source("application/donation-online.service.ts");
 const migrationSql=migration("3314_cg07_signed_captured_payment.sql");
 assert.match(migrationSql,/ADD COLUMN provider_payment_id text/);
 assert.match(migrationSql,/outcome<>'SUCCESS'/);
 assert.match(migrationSql,/uq_cg07_signed_captured_payment_id/);
 assert.match(online,/paymentEntity=\(payload\?\.payment/);
 assert.match(online,/verifiedCapturedPayment\(signedPaymentId/);
 assert.match(online,/p\.status!=="captured"/);
 assert.match(online,/p\.captured!==true/);
 assert.match(online,/provider_payment_id=\$2/);
 assert.match(online,/provider_payment_id\) VALUES/);
 assert.doesNotMatch(online,/raw\.paymentId/);
});

test("US002-QA12: A17 strict donor metadata and CG19 scanner-only confidential uploaded evidence",()=>{
 const parser=source("domain/donation-input.ts");
 const cg19=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-private-proof.service.ts");
 const ctl=root("apps/backend/src/modules/cg-19-documents-notifications/http/donation-private-proof.controller.ts");
 const sql=migration("3315_cg19_donation_private_proof.sql");
 const ui=root("apps/web/src/features/campaigns/donation-admin-workspace.tsx");
 const bff=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 const native=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 assert.match(parser,/recurringIntent:boolean/);
 assert.match(parser,/paymentReferenceNote/);
 assert.match(parser,/geography/);
 assert.match(parser,/remarks/);
 assert.match(parser,/pan/);
 assert.match(cg19,/reservePrivateUpload/);
 assert.match(cg19,/verifyPrivateObject/);
 assert.match(cg19,/CLEAN_VERIFIED/);
 assert.match(cg19,/verification\.scanProofRef/);
 assert.match(cg19,/readVerifiedPrivateObject/);
 assert.match(cg19,/createHash\("sha256"\)\.update\(bytes\)/);
 assert.match(cg19,/pg_advisory_xact_lock/);
 assert.match(cg19,/finance\.journals\.post/);
 assert.match(cg19,/documents\.files\.manage/);
 assert.match(cg19,/documents\.files\.view/);
 assert.match(cg19,/requireFinanceActiveBranch/);
 assert.match(sql,/CREATE TABLE cg19_donation_private_proof/);
 assert.match(sql,/cg19_donation_proof_guard/);
 assert.match(sql,/state='VALIDATED'/);
 assert.match(sql,/reserved_until/);
 assert.match(ctl,/@Post\("initiate"\)/);
 assert.match(ctl,/@Post\(":proofRef\/confirm"\)/);
 assert.match(ctl,/@Post\(":proofRef\/download"\)/);
 assert.match(bff,/proofs\/initiate/);
 assert.match(bff,/proofs\/donation/);
 assert.match(ui,/uploadDonorProof/);
 assert.match(ui,/downloadDonorProof/);
 assert.match(ui,/privateFileKey\.current=null/);
 assert.match(native,/paymentReferenceNote/);
});

test("US002-QA11/14: bank/NEFT/cheque remains suspense until real CG09+CG19 reviewed statement",()=>{
 const sql=migration("3316_cg07_donation_bank_reconciliation.sql");
 const bank=source("application/donation-bank.service.ts");
 const cg09=root("apps/backend/src/modules/cg-09-finance-accounting/application/donation-bank-collection.facade.ts");
 const originalReview=root("apps/backend/src/modules/cg-09-finance-accounting/application/finance-reports.service.ts");
 const page=root("apps/web/src/features/campaigns/donation-bank-panel.tsx");
 const staff=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 const donorWeb=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const donorAndroid=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 assert.match(sql,/CREATE TABLE donation_bank_collection/);
 assert.match(sql,/UNIQUE\(root_realm_id,donation_id\)/);
 assert.match(sql,/FOREIGN KEY\(reconciliation_id,root_realm_id\)/);
 assert.match(sql,/FOREIGN KEY\(initial_journal_id,root_realm_id\)/);
 assert.match(sql,/cg07_bank_collection_immutable/);
 assert.match(sql,/cg07_bank_collection_posted_proof/);
 assert.match(sql,/DECISION|finance_reconciliation_decision/);
 assert.match(sql,/statement_file_version IS NOT NULL/);
 assert.match(sql,/r\.status='VERIFIED'/);
 assert.match(sql,/r\.status='REJECTED'/);
 assert.match(sql,/j\.immutable_source_event_key=e\.source_event_key/);
 assert.match(cg09,/this\.posting\.postBalanced/);
 assert.match(cg09,/accountRef:x\.bankAccountRef.*debitMinor:x\.amountMinor/);
 assert.match(cg09,/accountRef:x\.suspenseAccountRef.*creditMinor:x\.amountMinor/);
 assert.match(cg09,/accountRef:row\.suspense_account_ref/);
 assert.match(cg09,/accountRef:row\.income_account_ref/);
 assert.match(cg09,/accountRef:row\.bank_account_ref/);
 assert.match(cg09,/await this\.identity\.assertCurrent\(tx,a,"finance\.journals\.post"\)/);
 assert.match(originalReview,/await this\.bankDonations\.onReconciliation\(tx,actor,ref/);
 assert.match(originalReview,/this\.statementProof\.guardForReviewer/);
 assert.match(bank,/status_token_digest=\$2/);
 assert.match(bank,/this\.finance\.stage\(tx,a,form\)/);
 assert.match(bank,/source_status='PAYMENT_PENDING'/);
 assert.match(bank,/finance\.reconciliation\.manage/);
 assert.match(bank,/documents\.files\.manage/);
 assert.match(page,/admin\/finance\/reports/);
 assert.match(page,/suspense liability account/i);
 assert.match(staff,/bank\/options/);
 assert.match(staff,/bank\/prepare/);
 assert.match(donorWeb,/\["REQUESTED","LINK_READY"\]\.includes\(status\)/);
 assert.match(donorAndroid,/\["REQUESTED","LINK_READY"\]\.includes\(status\)/);
});


test("US003-QA13: original one-time merchant refund uses signed Razorpay event and real CG09 source",()=>{
 const provider=source("application/donation-provider-refund.service.ts");
 const refund=source("application/donation-refund.service.ts");
 const finance=root("apps/backend/src/modules/cg-09-finance-accounting/application/donation-refund-posting.facade.ts");
 const online=source("application/donation-online.service.ts");
 const controller=root("apps/backend/src/modules/cg-07-campaigns-donations/http/donation-provider-refund.controller.ts");
 const staff=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 const web=root("apps/web/src/features/campaigns/donation-finance-actions.tsx");
 const sql=migration("3317_cg07_verified_provider_refund.sql");
 const lock=migration("3318_cg07_refund_channel_lock.sql");
 assert.match(provider,/async initiate\(/);
 assert.match(provider,/async reconcile\(/);
 assert.match(provider,/async webhook\(/);
 assert.match(provider,/async finalize\(/);
 assert.match(provider,/state='OUTCOME_UNKNOWN'/);
 assert.match(provider,/provider\("payments\/"\+reserved\.p\.captured_payment_id\+"\/refund","POST"/);
 assert.match(provider,/provider\("payments\/"\+p\.captured_payment_id\+"\/refunds\?count=100&skip=0","GET"/);
 assert.match(provider,/this\.credentials\(\)\.webhook/);
 assert.match(provider,/timingSafeEqual\(/);
 assert.match(provider,/provider\("refunds\/"\+refundId,"GET"\)/);
 assert.match(provider,/entity\.status!==remote\.status/);
 assert.match(provider,/this\.owner\.verifyReviewer/);
 assert.match(provider,/requireFreshFoundationRootProof/);
 assert.match(provider,/r\.requested_by===a\.accountId/);
 assert.match(provider,/this\.finance\.postProvider/);
 assert.match(provider,/state='FINANCE_POSTED'/);
 assert.match(provider,/root_realm_id=\$1 AND refund_request_id=\$2 AND request_key=\$3/);
 assert.match(provider,/const original=\(await tx\.query/);
 assert.match(provider,/FOR UPDATE/);
 assert.match(provider,/state='PROVIDER_PENDING'/);
 assert.match(provider,/remote\.status!==\(event\.event/);
 assert.match(provider,/Number\.MAX_SAFE_INTEGER/);
 assert.match(refund,/r\.settlement_method!=="CASH"/);
 assert.match(refund,/method=online\?"ONLINE":"CASH"/);
 assert.match(refund,/AND d\.id=r\.donation_id LEFT JOIN/);
 assert.match(finance,/providerAccounts/);
 assert.match(finance,/original\.clearingAccountRef/);
 assert.match(finance,/this\.journal\.postBalanced/);
 assert.match(online,/refund\.processed/);
 assert.match(online,/this\.refunds\.webhook\(req\)/);
 assert.match(controller,/@Post\(":ref\/authorize-provider"\)/);
 assert.match(controller,/@Get\(":ref\/reconcile-provider"\)/);
 assert.match(controller,/@Post\(":ref\/post-provider"\)/);
 assert.doesNotMatch(controller,/api\/public\/donations/);
 assert.match(online,/this\.refunds\.webhook\(req\)/);
 assert.match(staff,/authorize-provider/);
 assert.match(staff,/reconcile-provider/);
 assert.match(web,/Initiate one Razorpay refund/);
 assert.match(web,/Check original merchant outcome/);
 assert.match(web,/Post signed processed gateway refund to CG09/);
 assert.match(sql,/CREATE TABLE donation_provider_refund/);
 assert.match(sql,/UNIQUE\(root_realm_id,provider_receipt\)/);
 assert.match(sql,/UNIQUE\(root_realm_id,signed_event_id\)/);
 assert.match(sql,/cg07_provider_refund_integrity/);
 assert.match(sql,/cg07_refund_finance_proof/);
 assert.match(sql,/settlement_method='ONLINE'/);
 assert.match(lock,/cg07_refund_channel_no_retarget/);
 assert.match(lock,/cg07_provider_refund_requires_channel/);
});
test("US003-QA04: donor Web and Android expose refund uncertainty without fake net or 80G",()=>{
 const donor=source("application/donation-intents.service.ts");
 const web=root("apps/web/src/features/campaigns/public-donation-form.tsx");
 const android=root("apps/android-public/src/features/cms/native-public-donation.tsx");
 const cg19=root("apps/backend/src/modules/cg-19-documents-notifications/application/donation-receipt-document.service.ts");
 assert.match(donor,/provider_refund_state/);
 assert.match(donor,/REFUND_RECONCILIATION_PENDING/);
 assert.match(donor,/REFUND_FAILED_REVIEW_REQUIRED/);
 assert.match(donor,/net=posted\?gross-refunded:0n/);
 assert.match(donor,/r\.status='FINANCE_REVERSED' AND j\.status='POSTED'/);
 assert.match(web,/refundStatus==="REFUND_RECONCILIATION_PENDING"/);
 assert.match(android,/refundStatus==="REFUND_RECONCILIATION_PENDING"/);
 assert.match(cg19,/This document is NOT a tax deduction or 80G certificate/);
 assert.match(cg19,/separate neutral correction/);
});


test("CG07 multi-branch scope: Foundation, assigned manager, branch-bound donation and safe reporting",()=>{
 const owner=root("apps/backend/src/modules/cg-02-foundation-structure/application/branch-source.facade.ts");
 const admin=source("application/donation-admin.service.ts");
 const intents=source("application/donation-intents.service.ts");
 const campaigns=source("application/campaign-drafts.service.ts");
 const bff=root("apps/web/src/app/api/donations/[[...parts]]/route.ts");
 const web=root("apps/web/src/features/campaigns/donation-admin-workspace.tsx");
 const origin=migration("3306_cg07_donation_source.sql");
 const sql=migration("3319_cg07_donation_branch_provenance.sql");
 assert.match(owner,/financeReportScope/);
 assert.match(owner,/manager_account_ref=\$2/);
 assert.match(owner,/requireFinanceActiveBranch/);
 assert.match(owner,/requireFinanceRootScope/);
 assert.match(campaigns,/projectBranchScope/);
 assert.match(campaigns,/projectBranch\(tx,a,p\.branchRef\)/);
 assert.match(origin,/FOREIGN KEY\(branch_ref,root_realm_id\) REFERENCES branch/);
 assert.match(intents,/branchId=campaign\.branch_ref/);
 assert.match(sql,/CREATE TRIGGER cg07_donation_branch_no_retarget/);
 assert.match(sql,/NEW\.branch_ref IS DISTINCT FROM OLD\.branch_ref/);
 assert.match(sql,/c\.root_realm_id=NEW\.root_realm_id AND c\.id=NEW\.campaign_id/);
 assert.match(sql,/NEW\.branch_ref IS DISTINCT FROM original_campaign_branch/);
 assert.match(admin,/financeReportScope/);
 assert.match(admin,/financeBranches/);
 assert.match(admin,/branchRef==="FOUNDATION"&&!scope\.all/);
 assert.match(admin,/!active\.some\(x=>x\.branchRef===branchRef\)/);
 assert.match(admin,/branchSql\(15\)/);
 assert.match(admin,/branchSql\(13\)/);
 assert.match(admin,/branchSelection:f\.branchRef/);
 assert.match(admin,/branchOptions/);
 assert.match(admin,/branch_name\?\?"Foundation-wide"/);
 assert.match(admin,/AND \(\$"\+n\+"::text='ALL' OR \(\$"\+n\+"::text='FOUNDATION' AND (?:d\.)?branch_ref IS NULL\)/);
 assert.match(bff,/"campaign","cursor","branchRef"/);
 assert.match(web,/Foundation \/ branch reporting scope/);
 assert.match(web,/branchRef\}\)\):Promise\.resolve\(null\)/);
 assert.match(web,/setCursorTrail\(\[\]\)/);
 assert.match(web,/x\.branchName\?\?"Foundation-wide"/);
});


test("US003-QA13 source reviewer: Razorpay UNKNOWN recovery stores verified refund ID, not request UUID",()=>{
 const provider=source("application/donation-provider-refund.service.ts");
 const refundSql=migration("3317_cg07_verified_provider_refund.sql");
 const original=migration("3319_cg07_donation_branch_provenance.sql");
 const report=source("application/donation-admin.service.ts");
 assert.match(provider,/X-Refund-Idempotency/);
 assert.match(provider,/reserved\.p\.request_key\)/);
 assert.match(provider,/UPDATE donation_provider_refund SET provider_refund_id=\$4/);
 assert.doesNotMatch(provider,/UPDATE donation_provider_refund SET provider_refund_id=\$3/);
 assert.match(provider,/row\.provider_refund_id&&row\.provider_refund_id!==found\.id/);
 assert.match(provider,/PROVIDER_PROCESSED","PROVIDER_FAILED","FINANCE_POSTED/);
 assert.match(refundSql,/provider_refund_id text CHECK\(provider_refund_id/);
 assert.match(original,/NEW\.donation_kind IS DISTINCT FROM OLD\.donation_kind/);
 assert.match(original,/NEW\.campaign_id IS DISTINCT FROM OLD\.campaign_id/);
 assert.match(report,/ensureReportScopeStillCurrent/);
 assert.match(report,/this\.sessions\.requireAction\(bearer,"documents\.files\.view"\)/);
});
