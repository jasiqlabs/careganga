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
