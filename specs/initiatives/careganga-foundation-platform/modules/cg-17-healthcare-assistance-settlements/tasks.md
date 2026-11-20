# CG-17 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning SOURCE_DESIGN_REVIEWED / current SHA-bound delegated design approval; [module](module.md), [PRD](../../prd.md) FR-059, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** Current PRD/HLD and CG-17 module/UIUX/DLD/tasks have owner-delegated design approval at their SHA-256; authenticated local Harness resolver, independent CRITICAL finance/database/privacy review, predecessor code integration, migration/payment sandbox/webhook/restore/race, Web/native source and runtime/device/pixel/motion QA NOT_RUN. Implement each real dependency-ready vertical task with manual expert source review/fix/re-review and each case trace; no CI/GH Actions.

## Approved task definitions — OWNER-DELEGATED SOURCE DESIGN (7 US / 68 QA); runtime NOT_RUN

### US-001 — Configure eligible provider/doctor/service, fixed/percentage contribution…

Outcome: Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy.
Requirements: FR-059, CG-17-BR01, CG-17-BR02, CG-17-BR03, CG-17-BR04; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** Persist bounded versioned approved center/doctor/service support and explicit full-exception actual CG-03 approval reference in CG-17 database; implement current CG-01 service permission and protected authorizer, Foundation Admin Web policy drawer and allowed native Internal Android view/review. No CG-14 provider duplicate.
Acceptance: Version eligible center/service support policy with effective date, cap, percent/fixed value, override review and actual actor permission. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-001-QA01:** Starting from actual authorized actor and implemented owner record: version eligible center/service support policy with effective date, cap, percent/fixed value, override review and actual actor permission. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner-specific regression:** Policy revision cannot rewrite accepted fee/benefit snapshot on past appointment. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-001-QA08 — Healthcare source-specific boundary:** Configure 50% consultation support at an approved center with maximum cap; eligible fee quote respects cap and effective date, while an exceptional 100% grant remains PENDING until protected approval.
- **US-001-QA09 — protected exception and nonoverlap:** Two overlapping doctor/center effective policies at the same precedence must not both become active. A full 100% exception needs genuine authorized CG-03 approval and CG-17 guarded finalizer, not direct client switch; expired reviewer, duplicate callback, stale revision and revoked actor leave PENDING/denied and preserve previously accepted fees.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Display gross fee, actually approved/eligible Foundation support and patient…

Outcome: Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100%.
Requirements: FR-060, CG-17-BR02, CG-17-BR05, CG-17-BR06, CG-17-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** Use actual CG-14 fee/CG-15 appointment via typed owner facade; quote and accept one immutable CG-17 charge/source snapshot (root/center/patient/service/policy/currency), with gross=share+patient payable. Public Web/native show active/repriced/expired/due states without implying completion, patient payment or Foundation liability.
Acceptance: Show gross fee, verified eligible Foundation share, patient amount and correct tax/rounding before consent. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-002-QA01:** Starting from actual authorized actor and implemented owner record: show gross fee, verified eligible Foundation share, patient amount and correct tax/rounding before consent. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-002-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Healthcare source-specific boundary:** At booking summary show gross ₹1,000 with an applicable approved 50% contribution of ₹500 and patient payable ₹500; a changed fee/policy after acceptance does not rewrite that historical split.
- **US-002-QA08 — exact source amount / patient DUE:** Verify real CG-14 fee revision, actual CG-15 patient/center, currency, smallest-unit rounding/cap and immutable accepted amount. A confirmed pay-at-center consultation can remain patient DUE; quote/booking alone must NOT create Foundation liability. Wrong-center/stale quote or later price change cannot mutate accepted totals.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Provide online payment only through the verified healthcare center's own…

Outcome: Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections.
Requirements: FR-061, CG-17-BR08, CG-17-BR09, CG-17-BR10; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** CG-17 US-003 owns restricted per-center merchant binding verification and signed gateway adapter; only after verified source create actual center checkout/payment attempt and server-side callback/amount reconciliation. Public Web/native and Center Portal show PENDING/UNAVAILABLE/VERIFIED distinctly; no Foundation merchant fallback.
Acceptance: Route verified center-owned online payment through actual configured merchant, show gateway status pending until confirmed. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-003-QA01:** Starting from actual authorized actor and implemented owner record: route verified center-owned online payment through actual configured merchant, show gateway status pending until confirmed. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-003-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — owner-specific regression:** Provider failure or callback from wrong merchant cannot mark Foundation/center as paid. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-003-QA08 — Healthcare source-specific boundary:** Center has no verified own merchant credentials yet patient chooses online payment; checkout is unavailable and pay-at-center remains legitimate with DUE, not a silently used Foundation merchant key.
- **US-003-QA09 — verified own-center merchant:** Enroll Center A owned provider merchant credentials in protected CG-17 binding, not CG-14 settlement bank fields; while unverified, hide online checkout. Forged signature, wrong merchant/center, duplicate/late callback, invalid amount/currency, expired secret, refund callback or redirect-only success cannot mark patient or Foundation paid; reconcile only authentic original provider event.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002

### US-004 — Record authorized on-site payment, part-pay, overdue follow-up, receipts…

Outcome: Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement.
Requirements: FR-062, CG-17-BR11, CG-17-BR12, CG-17-BR13, CG-17-BR14; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** Keep manual Center Portal cash/UPI/card evidence and collection/partial/due/refund history source-owned in CG-17. A cashier can record attested real cash under role+center and stable idempotency; electronic payment needs verified owner proof. CG-19 issues genuine protected receipt; Foundation CG-09 receives no patient income.
Acceptance: Record center-authorized on-site collection, part-payment, outstanding and genuine receipt. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-004-QA01:** Starting from actual authorized actor and implemented owner record: record center-authorized on-site collection, part-payment, outstanding and genuine receipt. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-004-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-004-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-004-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-004-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-004-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-004-QA07 — owner-specific regression:** Unverified cash/UPI assertion does not become settled provider payment. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-004-QA08 — Healthcare source-specific boundary:** Center cashier records ₹300 of ₹500 payable in-person and later collects ₹200; partial/due/paid, receipt and overdue aging reconcile, and a duplicate cash-submit cannot collect twice.
- **US-004-QA09 — durable manual proof:** Own-center cashier attests actual ₹300 cash with unique durable receipt/evidence and authenticated role; second cashier replay cannot collect again. An unverified UPI screenshot, wrong-center account, removed role or absent original charge remains PENDING/denied; genuine CG-19 receipt issues once after verified center collection without touching Foundation cash.
Verification: On actual implementation source-trace US-004-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002 verified gross/due/policy + actual original CG-14 center cashier; **US-003 online center gateway is OPTIONAL, not required for independent authorized pay-at-center**.

### US-005 — Keep the center's patient collections, the Foundation's approved liability…

Outcome: Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments.
Requirements: FR-063, CG-17-BR15, CG-17-BR16, CG-17-BR17, CG-17-BR18, CG-17-BR19; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** Independently recognize approved Foundation liability from genuinely completed eligible CG-15 original service and effective accepted charge even when patient remains DUE; original CG-17 award/liability/settlement line indexed and idempotent, CG-09 original journal via durable posting effect. No prerequisite on US-003 or US-004.
Acceptance: Separate patient collections from Foundation booked liability and provider-settlement ledger reference. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-005-QA01:** Starting from actual authorized actor and implemented owner record: separate patient collections from Foundation booked liability and provider-settlement ledger reference. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-005-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-005-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-005-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-005-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-005-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-005-QA07 — owner-specific regression:** A patient receipt never automatically credits Foundation cash or settles its payable. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-005-QA08 — Healthcare source-specific boundary:** Monthly provider settlement combines approved Foundation obligations across several real appointments; one partial bank payment does not mark entire month settled, and returned/canceled services adjust dues auditably.
- **US-005-QA09 — All ERP OFF still settles genuine consultations:** No Lab/Pharmacy/Nursing/OT module installed or enabled; CG-15 consultation with genuine approved CG-17 policy creates true Foundation liability while center-collected patient cash never enters CG-09 Foundation income.
- **US-005-QA10 — Optional completed service proof not price promise:** With actually enabled CG-23 nursing or CG-24 OT and current patient consent, a source completion alone does not create payout until an independent existing CG-17 active policy and exact original amount/currency are verified. CG-22 stock movement cannot create CG-17 patient collection/settlement.
- **US-005-QA11 — liability despite unpaid patient:** A CG-15 eligible consultation is actually completed with approved ₹500 Foundation share from accepted ₹1,000 gross, while patient's ₹500 is still DUE and no US-003/004 collection exists. Exactly one original Foundation liability accrues independently; mere booked/canceled/no-show/policy-pending sources do not. Post-accrual reversal is a new linked effect, not a deleted record.
Verification: On actual implementation source-trace US-005-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-002 accepted valid charge and actual eligible CG-15 completed service + approved CG-17 award. **US-003 online checkout and US-004 patient collection are not prerequisites for Foundation liability.**

### US-006 — Reconcile verified patient receipts (center-owned), refunds and monthly…

Outcome: Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion.
Requirements: FR-064, CG-17-BR18, CG-17-BR19, CG-17-BR20; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** Reconcile verified own-center receipts, correct approved Foundation payable, partial provider remittance and reversals through unique original effects and CG-09 verified journal. Admin Web, Center Portal and authorized Internal Android show separate source-true gross/collected/approved/settled/due; no guessed commission, double settlement or always-on scanning.
Acceptance: Reconcile one verified receipt, approved monthly provider claim, actual settlement and permitted refund/adjustment. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-006-QA01:** Starting from actual authorized actor and implemented owner record: reconcile one verified receipt, approved monthly provider claim, actual settlement and permitted refund/adjustment. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-006-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-006-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-006-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-006-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-006-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-006-QA07 — owner-specific regression:** Concurrent reconciliation/repeated webhook cannot double-settle or overpay center. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-006-QA08 — Healthcare source-specific boundary:** Verify Center A patient ₹500 payment and separate Foundation ₹500 obligation: the center receipt does not debit or credit Foundation cash; only authorized Foundation disbursement posts exactly once into CG-09 with linked source.
- **US-006-QA09 — Screenshot H17 figures are not finance law:** For center gross, patient collected, approved Foundation contribution, pending provider payable and actual settled amount, verify each distinct real original source/policy and CG-09 journal; no guessed commission percentage or Foundation revenue from partner patient collections.
- **US-006-QA10 — Replay, disable and refunds:** Race two completed nursing/OT source effects and disable global ERP while CG-17 owes legitimate settlement. One source key and one verified payout/reversal, correct past liability retained and no new optional service effect/tenant-wide poll. Unauthorized Center B cannot adjust Center A settlement.
- **US-006-QA11 — CG-09 unknown result and recovery:** Lose original CG-09 journal reply after CG-17 posts one completed-service source effect; retry/restore/replay lookup by original key yields at most one Foundation journal, honest PENDING until verified. Part settlement and correction produce distinct linked events; center patient collection never becomes Foundation revenue. Check cross-center, concurrent claim and ledger-to-source totals.
Verification: On actual implementation source-trace US-006-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-005

### US-007 — Publish only approved current rates

Outcome: Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap.
Requirements: FR-065, CG-17-BR06, CG-17-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-17 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
**Specific implementation and owner cross-stack contract:** Provide only current public-safe source policy projection from CG-17; CG-18 itself owns publication and cache/withdrawal and the public page works without CG-17. Real CG-14/15 views and Public Next.js/Android consume approved current policy/fee, never mock lab/medicine/OT percentages or patient-private eligibility.
Acceptance: Publish only current approved provider rates, eligibility/discount terms and safe projections after genuine policy publication. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-007-QA01:** Starting from actual authorized actor and implemented owner record: publish only current approved provider rates, eligibility/discount terms and safe projections after genuine policy publication. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-007-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-007-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-007-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-007-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-007-QA06:** Original CareGanga screenshot refs Healthcare BR/UI references; not Admin screenshot IDs, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-007-QA07 — Healthcare source-specific boundary:** CMS tries to publish a mockup 40% lab or 20% medicine support badge without CG-17 approved policy; prohibit unsupported percentage, while standard eligible consultation benefit and approved exceptional full aid use actual policy source.
- **US-007-QA08 — transferred public CG-18 benefit banner owner QA:** After a true active CG-17 support policy with current real CG-14 approved center/doctor/service and CG-15 fee, introduce source-backed effective percentage/cap/eligibility text into CG-18's CMS-approved healthcare placement and real provider/booking screens. CG-18 original neutral page works with zero CG-17 policies; deny a mockup unsupported lab/medicine percentage, expired/superseded support policy, wrong center, client-edited up-to text, stale cached public Android copy and private patient eligibility leakage. CG-17 alone owns rule/amount, CG-18 only page publication.
- **US-007-QA09 — Public pricing with ERP disabled:** H16/H17 approved consultation policy is truthful in public Web/native even if Lab/Pharmacy/Nursing/OT ERP flags all OFF. Display service-provider price but no clinically unsupported 50% rule for lab, pharmacy medicine, OT or nurse without own approved effective policy.
- **US-007-QA10 — Approval and historical revision:** Expired or withdrawn center discount, source-driven nursing/OT policy revocation and stale CMS cache cannot advertise guaranteed Foundation assistance; original historical booked benefit records are still traceable with current source/version and patient authorization.
- **US-007-QA11 — public policy versus CMS:** CG-17 exposes safe current source-backed contribution/cap/validity and eligibility disclaimer, while original CG-18 retains separate editorial publication/cache state and works without any CG-17 policy. Stale Next.js/native public cache, mock H16/H17 percentages or private patient eligibility cannot publish after policy withdraw/expiry; independently verified accepted historical booking stays correct.
Verification: On actual implementation source-trace US-007-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

## Execution progress

- **US-001–007: CURRENT_SHA_BOUND DELEGATED_DESIGN_APPROVED; IMPLEMENTATION_NOT_STARTED on the active CG16/CG17 development feature branch.** Seven source-owned story definitions and 68 unique QA cases; no false implementation or test certification.
- **US-003 optional:** checkout requires independently verified real center merchant, but must not block US-004 pay-at-center or US-005 Foundation liability. **US-005:** depends on US-002 accepted amount plus real completed/approved CG-15 source, not patient collection.
- **Formal/runtime gates:** authenticated Harness resolver, independent CRITICAL finance/DB/privacy review, real code and predecessor API integration, migrations/restore, actual payment sandbox/webhook/races/CG-09 reconciliation, Web/Center Portal/Public Android/Internal Android, full-resolution H16/H17 visual and motion parity, NFR measurements remain NOT_RUN.
- **Implementation handoff:** follow `DEVELOPMENT_ORDER.md`; execute US one-by-one with backend/Postgres, responsive Web/applicable native Android, independent source review→fix→re-review→every inline QA trace then update this existing progress section. No CI/GH Actions.

- **Owner-required cross-channel acceptance (20 November 2026):** Apply the single `AGENTS.md` mandatory Web↔Android parity rule at **each** existing CG17 US-001–US-007 execution checkpoint. Public Web ↔ Public Android for eligible patient/applicant self-service and real approved disclosure; Foundation/Center staff Web ↔ Internal Android for authorized private assistance case, benefit and settlement operations. Implement same source-owned validation, navigation, roles, status/filter/forms/actions, restricted data, unknown-outcome/error and notifications. **Every story must record each applicable channel's source trace in its original QA disposition; missing Android = SOURCE_GAP**, never SOURCE_COMPLETE. Staff financial settlements do NOT become public Android screens just for symmetry. All seven stories STILL NOT_STARTED; no Web/Android/SQL/runtime QA PASS. See `docs/qa/CAREGANGA-CG16-CG17-CHANNEL-PARITY-READBACK-20261120.md` (evidence only, not a new task tracker).
