# CG-17 — Healthcare Assistance Settlements

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-059, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-17-BR01–CG-17-BR20, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs.  
**Stage:** Harness Planning / GREENFIELD · **State:** current source design reviewed for SHA-bound owner-delegated approval (see initiative approval ledger). Local authenticated Harness resolver, independent CRITICAL finance/DB/privacy review and actual runtime/device/pixel/motion QA remain NOT_RUN. Design approval is not development completion.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Versioned subsidy policy, eligibility, center collection, Foundation liability, provider settlement state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Optional ERP source events and partner money separation (FR-087, H16/H17)

CG-17 alone owns versioned approved healthcare benefit policies, actual patient dues, Foundation liabilities, verified provider settlement and reconciliation; original CG-09 alone posts Foundation journal, and verified CG-14 centers collect patient service money under adopted D-04 until client confirms a different commercial contract. Center Gross Service Value on H17 is a reporting/service basis, **not Foundation turnover**. Optional service records from CG-16 Lab ERP, CG-23 Nursing ERP and CG-24 OT ERP can become eligible financial source adapters only after the relevant independently enabled/approved module actually emits a verified service source event and a current CG-17 policy explicitly permits the category. CG-22 pharmacy catalog/stock is not a healthcare sale or financial voucher: medicine purchasing is a partner-owned activity, not an automatic Foundation expenditure. No future CG-22/23/24 code, modules or ERP activation is needed for original CG-17 consultation benefit/settlement.

**Financial readiness:** US-003 online center gateway is optional; authorized pay-at-center US-004 works from US-002 gross/benefit/patient-due even without a live merchant or US-003 gateway. Thus US-004 must not be blocked by US-003. **US-005 Foundation liability depends on US-002 accepted fee/benefit plus actual eligible CG-15 completed service and approved support; it does NOT depend on US-003 online checkout or US-004 patient cash collection.** Patient DUE and Foundation DUE remain separate. US-006 performs only verified real reconciliation; no sample/stock fake fees or screenshot-driven paid status. All four ERP flags OFF leave genuine doctor consultation and Foundation assistance running. Expert review strengthened the original scope to **7 independently owned stories / 68 distinct QA scenarios**, including source/amount uniqueness, center-owned merchant verification, disconnected completion-versus-collection, refunds and replay, CG-09 idempotent posting and safe public communication.

## Business owner and isolation

**Owns:** Versioned subsidy policy, eligibility, center collection, Foundation liability, provider settlement. **Required prior-owner contracts (not claims of code already delivered on the planning branch):** CG-14 actual center fees, doctor/center and protected settlement destination; CG-15 accepted booking and genuine service completion; CG-09 authoritative Foundation journal; CG-19 approved receipts/documents; CG-03 original protected exceptional approval where needed. **Later integration owners, not blockers for the first self-contained feature:** CG-18 CMS/CG-20 reports consume only real approved support statistics; no later module needed to invent collection capability. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

**State and invariant:** Support requested/approved; patient due/paid/refunded; Foundation due/settled. Eligible consult 50% Foundation/50% patient, protected full exception; center cash is not Foundation cash. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-059/A-17:** Foundation configures benefit — Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy
- **FR-060/A-17:** Patient sees appointment price — Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100%
- **FR-061/A-17:** Patient selects online or center payment — Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections
- **FR-062/A-17:** Center receives payment or encounters due — Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement
- **FR-063/A-17:** Foundation owes provider — Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments
- **FR-064/A-17:** Money has to be accounted for — Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion
- **FR-065/A-17:** CMS presents discount claim — Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap

Detailed authoritative clauses:
- **CG-17-BR01:** Foundation defines assistance policies by eligible service type, provider/center and optionally doctor, with fixed amount or percentage, limits, effective period and eligibility criteria.
- **CG-17-BR02:** **Standard documented consultation model:** Foundation contributes **50%** for *eligible* appointments, patient pays remaining **50%**, subject to approved support policy. It is not blanket entitlement without eligibility.
- **CG-17-BR03:** Allow authorized modifications to applicable percentages, fixed amount, maximum support, center/doctor-specific policy and patient eligibility/validity limits with historical visibility.
- **CG-17-BR04:** Record requested and approved healthcare assistance; eligible patient/doctor/center/service, reviewed amount, reviewer and approval state are traceable where approvals apply.
- **CG-17-BR05:** When a patient views or confirms a service, show **gross fee, approved contribution, patient payable** separately. Record relevant monetary policy snapshot on confirmation.
- **CG-17-BR06:** Screen examples of up to **40% diagnostic discount**, **20% medicine contribution**, and **30% nursing/OT discount** are **illustrative marketing/service rules** until client confirms enablement, eligibility, operating model and settlement. A sample slip also shows **100% CareGanga contribution**; full coverage must be permitted only through an explicitly approved policy.
- **CG-17-BR07:** Show accurate public contribution messaging. Avoid advertising discounts that are not configured or applicable to the selected provider/service/patient.
- **CG-17-BR08:** Doctor booking supports **online payment through configured Razorpay** (UPI, cards, net banking and supported wallets) and **pay at healthcare center**, according to provider/policy configuration.
- **CG-17-BR09:** Track payment initiated/pending/succeeded/failed/refunded/partially paid or due states relevant to the actual service, with verified transaction references and reconciliation evidence.
- **CG-17-BR10:** Booking confirmation must correctly distinguish **booking state** from **payment state**; for pay-at-center, an appointment may be confirmed but the patient amount remains due.
- **CG-17-BR11:** Center staff can record in-person collections by cash/UPI/card/bank/configured payment methods, issue receipts and update outstanding status under controlled permissions.
- **CG-17-BR12:** Support payable/part-paid/due, overdue aging and payment follow-up records, permitted corrections and refunds/adjustments with audit and approval where required.
- **CG-17-BR13:** Produce patient payment receipts and booking documents from the same authoritative booking + collected/assistance amount, never from independently edited totals.
- **CG-17-BR14:** Maintain appropriate provider/center invoice/receipt and financial history, referring to shared CG-09 financial records.
- **CG-17-BR15:** Distinguish the patient's payment, the Foundation's committed or approved assistance, and what is owed or has been paid to doctor/center/lab.
- **CG-17-BR16:** Maintain provider/doctor/lab settlement records and due, approved, settled, refunded and adjusted balances with traceable service references.
- **CG-17-BR17:** Foundation Admin has network-wide settlement oversight; Center Portal has restricted own-center collection, assistance, outstanding and reconciliation views.
- **CG-17-BR18:** Post final money/accounting events to CG-09 exactly once using linked source transactions; no duplicate per-center general ledger.
- **CG-17-BR19:** Generate center/doctor/period/service reports on gross charges, patient collections, Foundation support, unresolved dues and settlement outcomes.
- **CG-17-BR20:** The authorized initial money flow is center collection of patient payable (verified own merchant channel, or pay at center), plus a separate Foundation contribution payable to the center after completed/eligible services, reconciled monthly. Center-collected patient money is tracked operationally, **not counted as Foundation cash/bank income**. Only the Foundation's own approved contribution liability and actual settlement affect its financial books. No real online payment until the responsible center's merchant credentials are verified.

## CG-17 original benefit eligibility and public copy (transferred CG-18 BR20/28)

CG-17 US-007 owns effective-dated Foundation contribution, eligibility, amount/cap/current validity and a **typed public-safe benefit projection**. Its approved-source values can appear in real CG-14/15 views and in **CG-18-owned** published healthcare editorial placement once that receiving owner is genuinely available. CG-18 retains its original editorial review, publication, withdrawal and cache ownership; CG-17 does not write CMS records or require CMS for independent consultation pricing. CG-18 US-004 beforehand publishes only general nonnumeric information; neither CMS nor a prototype mockup may claim 40% lab/20% medicine or unconditional 50% patient eligibility. CG-17 owns all amount computations and policy revision, not CMS. Revoke/expire policy or disqualify provider and CG-17 invalidates public Web/Public Android copy before it can mislead; no CMS subsidy table, cached promise or fake paid flag. CG-17-owned US-007 QA validates source policy/cap/fee truth, current eligibility, provider scope, permitted disclaimer and publication withdrawal. These narrow receiving-owner additions do not approve the CG-17 module.


## First usable vertical contract and regression

**Concrete acceptance:** Calculate effective-dated Foundation share and patient payable against actual accepted fee; a genuine eligible completed service may yield one approved Foundation liability even while patient money is still DUE. Record verified own-center patient collections separately and reconcile genuine Foundation settlement/refund with source-bound deduplication. Booking, patient payment and screen sample values alone must not create the Foundation liability. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) with 7 stories / 68 source QA cases; no duplicate stories or CI. The source-design approval is SHA-bound in initiative `approvals.json`; authenticated local Harness gate, independent specialist review and actual runtime/device proof remain pending.