# CG-17 — Healthcare Assistance Settlements

**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-059, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-17-BR01–CG-17-BR20, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

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

## Business owner and isolation

**Owns:** Versioned subsidy policy, eligibility, center collection, Foundation liability, provider settlement. **Delivery-critical, already-delivered owners:** CG-14 actual center fees, CG-15 real appointment/service, CG-09 authoritative Foundation journal and CG-19 approved receipts/documents. **Later integration owners, not blockers for the first self-contained feature:** CG-18 CMS/CG-20 reports consume only real approved support statistics; no later module needed to invent collection capability. Missing actual owner source must never be represented by a fake master or fake successful outcome; the later owner carries its own cross-module QA.

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

CG-17 US-007 owns real effective-dated Foundation contribution, eligible provider/doctor/service, support percentage/fixed amount/cap/current validity and the public-safe benefit text/eligibility projection. It **introduces** source-bounded approved benefit banners, appropriate 'up to' and allowed percentage into existing CG-18 editorial healthcare slots and real CG-14/15 verified fee/booking views only after actual CG-17 policy exists. CG-18 US-004 beforehand publishes only general nonnumeric information; neither CMS nor a prototype mockup may claim 40% lab/20% medicine or unconditional 50% patient eligibility. CG-17 owns all amount computations and policy revision, not CMS. Revoke/expire policy or disqualify provider and CG-17 invalidates public Web/Public Android copy before it can mislead; no CMS subsidy table, cached promise or fake paid flag. CG-17-owned US-007 QA validates source policy/cap/fee truth, current eligibility, provider scope, permitted disclaimer and publication withdrawal. These narrow receiving-owner additions do not approve the CG-17 module.


## First usable vertical contract and regression

**Concrete acceptance:** Calculate effective-dated Foundation share and patient payable against an accepted service fee, verify center collection separately, recognize one true Foundation liability, reconcile settlement/refund without duplicate posting. A module with absent future-owner data can still complete and source-verify its own real owner operation; later provider integration must preserve existing permissions, prices, reports and recorded states.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.