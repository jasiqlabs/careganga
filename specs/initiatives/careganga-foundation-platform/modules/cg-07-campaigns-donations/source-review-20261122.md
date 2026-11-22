# CG-07 — Original 60-case source QA matrix (22 November 2026)

**Authoritative branch:** `feature/careganga-cg07-campaigns-donations-dev-20261122`. This is a source-only worklist, **not** a passed manual QA report, independent expert approval, provider sandbox run or merged delivery. The exact original case definitions and accepted scope remain in [tasks.md](tasks.md). No new user stories or requirements are introduced.

**Current scope:** US-001 six-step campaigns/CG03+CG18 is source-authored, awaiting final review; US-002 cash and Razorpay donor/finance Web/native is partially source-authored but bank/NEFT/cheque needs original evidence; US-003 CG19 neutral PDF/CG09 physical-cash refund and actual net source is partially source-authored but provider refund, corrected documents, donor history, export and notifications remain.

**Disposition totals (23 November checkpoint):** 31 source surfaces present but not fully reviewed; 16 known requirements incomplete; 10 require independent/runtime evidence; 3 previous gaps have focused source fixes reviewed pending independent/runtime verification. **0/60 original cases are certified RUNTIME_PASS; 0/3 stories certified SOURCE_COMPLETE.** A single row may require more than a single test.

| Original QA ID | Source QA disposition | Current original-owner source | Open proof or implementation |
|---|---|---|---|
| US-001-QA01 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-drafts.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA02 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-drafts.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA03 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-drafts.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA04 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-draft-input.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA05 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-public-source.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA06 | RUNTIME_NOT_VERIFIED | campaign-drafts-workspace.tsx | Requires actual DB/provider/browser/device/qualified review evidence |
| US-001-QA07 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-public-source.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA08 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-review.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA09 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-link-source.facade.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA10 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-link-source.facade.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA11 | SOURCE_PRESENT_NEEDS_REVIEW | cg03/campaign-review.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA12 | SOURCE_PRESENT_NEEDS_REVIEW | cg18/cms-editorial.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA13 | SOURCE_PRESENT_NEEDS_REVIEW | cg19/campaign-media-evidence.service.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA14 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-drafts-workspace.tsx | Source located; independent file:function and scenario review not signed |
| US-001-QA15 | SOURCE_PRESENT_NEEDS_REVIEW | cg04 volunteer source | Source located; independent file:function and scenario review not signed |
| US-001-QA16 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-draft-input.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA17 | SOURCE_PRESENT_NEEDS_REVIEW | cg05/campaign-link-source.facade.ts | Source located; independent file:function and scenario review not signed |
| US-001-QA18 | RUNTIME_NOT_VERIFIED | UI audit + native/Web | Requires actual DB/provider/browser/device/qualified review evidence |
| US-001-QA19 | RUNTIME_NOT_VERIFIED | 3301–3305 DB | Requires actual DB/provider/browser/device/qualified review evidence |
| US-001-QA20 | RUNTIME_NOT_VERIFIED | CG01/03/18/19 + Web/native | Requires actual DB/provider/browser/device/qualified review evidence |
| US-002-QA01 | SOURCE_PRESENT_NEEDS_REVIEW | donation-intents.service.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA02 | SOURCE_PRESENT_NEEDS_REVIEW | donation-manual.service.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA03 | SOURCE_PRESENT_NEEDS_REVIEW | donation-online.service.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA04 | SOURCE_FIX_REVIEWED_RUNTIME_PENDING | donation-input.ts, donation-online.service.ts:refreshDonorStatus/webhook/recover, donation-intents.service.ts:status | Donor-requested status rechecks exact merchant and classifies expired/cancelled or paid-but-not-signed as reconciliation pending; lost link response surfaced as unknown. Source reviewed; Razorpay sandbox, actual SQL and fault-injection still NOT_RUN; independent reviewer NOT_RUN |
| US-002-QA05 | SOURCE_PRESENT_NEEDS_REVIEW | donation-admin.service.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA06 | RUNTIME_NOT_VERIFIED | A16/A17 screenshot audit | Requires actual DB/provider/browser/device/qualified review evidence |
| US-002-QA07 | SOURCE_PRESENT_NEEDS_REVIEW | 3308 SQL + webhook | Source located; independent file:function and scenario review not signed |
| US-002-QA08 | SOURCE_PRESENT_NEEDS_REVIEW | donation-online-finance.service.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA09 | SOURCE_FIX_REVIEWED_RUNTIME_PENDING | 3311 DB trigger, donation-manual.service.ts:options/prepare/confirm, donation-online.service.ts:link/webhook | Parent-donation lock makes cash/link initiation mutually exclusive across instances; webhook and cash confirmation now lock donation first, then attempt/evidence. Signed evidence preserved. Actual DB race/provider sandbox/independent review NOT_RUN |
| US-002-QA10 | SOURCE_PRESENT_NEEDS_REVIEW | donation-online.service.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA11 | SOURCE_GAP | CG09 cash+Razorpay / bank gap | BANK/CHEQUE/NEFT need authentic CG09+CG19 evidence; Cash/Razorpay only |
| US-002-QA12 | SOURCE_GAP | donation-input.ts + public Web/native | Recurring, remarks, proof/history fields not fully implemented |
| US-002-QA13 | SOURCE_FIX_REVIEWED_RUNTIME_PENDING | public-donation-ingress.ts, donation-intents.service.ts:limit/status, public donation/online/CG19 own-receipt controllers | Explicit trusted Host allowlist and same-origin browser check; native no-Origin supported; signed optional proxy client IP proof, default socket IP and expiring HMAC donor proof. Host-spoof/pentesting and ingress setup NOT_RUN; independent reviewer NOT_RUN |
| US-002-QA14 | SOURCE_GAP | donation-manual.service.ts | No authenticated BANK/NEFT/CHEQUE evidence and independent verification |
| US-002-QA15 | SOURCE_PRESENT_NEEDS_REVIEW | 3306/3308 SQL | Source located; independent file:function and scenario review not signed |
| US-002-QA16 | SOURCE_GAP | donation-online.service.ts / recover | Signed-success outage reconciliation queue still requires completion |
| US-002-QA17 | SOURCE_PRESENT_NEEDS_REVIEW | campaign-public-source.ts | Source located; independent file:function and scenario review not signed |
| US-002-QA18 | SOURCE_GAP | donation-admin.service.ts | Amount/date/method filters, authorized export incomplete |
| US-002-QA19 | RUNTIME_NOT_VERIFIED | 3306–3308 SQL | Requires actual DB/provider/browser/device/qualified review evidence |
| US-002-QA20 | RUNTIME_NOT_VERIFIED | CG07/09/21 Web/native | Requires actual DB/provider/browser/device/qualified review evidence |
| US-003-QA01 | SOURCE_GAP | donation-receipt-document.service.ts | Single own receipt proof only; consolidated donor history incomplete |
| US-003-QA02 | SOURCE_GAP | donation-receipt-document.service.ts | Private export/role revocation needs independent security review |
| US-003-QA03 | SOURCE_PRESENT_NEEDS_REVIEW | 3309/3310 SQL | Source located; independent file:function and scenario review not signed |
| US-003-QA04 | SOURCE_GAP | donation-receipt-document.service.ts | Verified provider refund and lawful 80G proof unavailable; neutral fail-closed |
| US-003-QA05 | SOURCE_GAP | donation-admin.service.ts | Monthly trend/export/receipt correction missing |
| US-003-QA06 | RUNTIME_NOT_VERIFIED | A16/A18 screenshot audit | Requires actual DB/provider/browser/device/qualified review evidence |
| US-003-QA07 | SOURCE_PRESENT_NEEDS_REVIEW | 3309 DB guard | Source located; independent file:function and scenario review not signed |
| US-003-QA08 | SOURCE_GAP | donation-refund.service.ts | CG19 correction/credit note after refunded receipt missing |
| US-003-QA09 | SOURCE_PRESENT_NEEDS_REVIEW | CG19 private PDF issuer | Source located; independent file:function and scenario review not signed |
| US-003-QA10 | SOURCE_PRESENT_NEEDS_REVIEW | CG19 neutral 80G PDF | Source located; independent file:function and scenario review not signed |
| US-003-QA11 | SOURCE_GAP | donation-intents.service.ts / own status | Cross-transaction donor history missing (single token supported) |
| US-003-QA12 | SOURCE_PRESENT_NEEDS_REVIEW | 3310 DB cap | Source located; independent file:function and scenario review not signed |
| US-003-QA13 | SOURCE_GAP | CG07 cash refund; provider gap | Real merchant refund confirmation/reconciliation not developed |
| US-003-QA14 | SOURCE_GAP | CG19 original receipt, correction gap | Separate CG19 correction PDF/credit note not developed |
| US-003-QA15 | SOURCE_GAP | donation-admin.service.ts | Authorized export and monthly trends missing |
| US-003-QA16 | SOURCE_GAP | Web/native donor UI | Screen/device accessibility/offline evidence missing |
| US-003-QA17 | SOURCE_PRESENT_NEEDS_REVIEW | CG07/09/18/19 owners | Source located; independent file:function and scenario review not signed |
| US-003-QA18 | SOURCE_GAP | CG19 notification owner | Optional email/WhatsApp delivery status not integrated |
| US-003-QA19 | RUNTIME_NOT_VERIFIED | 3309–3310 SQL | Requires actual DB/provider/browser/device/qualified review evidence |
| US-003-QA20 | RUNTIME_NOT_VERIFIED | CG09/CG19 + Web/native | Requires actual DB/provider/browser/device/qualified review evidence |

## Next JASIQ-dev gates

Review and fix remaining **US-002 original SOURCE_GAP cases** before accepting the story; inspect the full path `Public Next/Android or A16/A17 → NestJS CG07 with CG01/CG02 → CG21 signed merchant or independently reviewed physical proof → original CG09 journal → public status`. Do not create a shadow bank ledger, auto-charge again after unknown payment or mistake a provider callback for received money.

Then close **US-003 original SOURCE_GAP cases** using genuine original CG09 payout, CG19 document/correction, CG18 published net and verified private donor history/export. Do not issue 80G certification without authoritative statutory evidence or send unsupported communications.

**Local developer, manual, no CI/GitHub Actions:** `npm run test:cg07-campaign -w apps/backend`, `npm run test:cg07-donation -w apps/backend`, `npm run test:cg07-db-integrity -w apps/backend`, `npm run test:cg07-donation-db -w apps/backend` on disposable migrated DB, `npm run verify:local-build`. Then record original CareGanga screenshots/browser Android accessibility, actual Razorpay test-merchant webhook/replay, CG19 private PDF, Postgres backup/restore/EXPLAIN/races and p95 evidence. These are prescribed commands and tests, **not executed results**.

**Hold:** no branch merge, no SOURCE_COMPLETE/RUNTIME_PASS claim, no new module until original source and review gaps are closed.
