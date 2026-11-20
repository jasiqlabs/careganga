# CG-04 — Members, Membership Programs & Volunteers

### 2026-11-18 original client public website receiving-owner acceptance

**Binding evidence:** [original 47-screenshot public page/content/admin parity](../../../../../docs/research/CAREGANGA-CLIENT-PUBLIC-WEBSITE-FULL-PAGE-PARITY-20261118.md). 47 client public captures (10 previous, 12+18+7 new), plus the client's pre-existing Admin reference pack. This is a **design/QA receiving-owner handoff, not implementation approval, a new story, or runtime QA**.

**Required original public page scope:** Actual original `/membership` and `/volunteer` public pages, approved member/volunteer verification, and public Team Directory participation where consented.

**Domain/technical source contract:** One existing CG-04 member/volunteer master: published tier version/fee/benefit source, application/approval/identity-document handling, public member/volunteer verification, volunteer four-step submission, PIN/state/district/availability/interests and optional referral. Never invent prices, acceptance, payment proof or a duplicate CMS registration table. CG-09 handles actual fee; CG-19 files and CG-03 approvals stay in their respective owners.

**Screen and Admin UI acceptance:** Original Membership hero, Membership Cards/Verify Membership tabs, search/Annual/Lifetime/Honorary/Student filters, plan cards, benefit list, View Details/Apply Now; Volunteer dark hero/How It Works, Application Form/Verify Volunteer tabs, four-step progress, personal/contact/address/referral fields. Preserve screenshot composition and CG-21 field-specific editable errors; narrow layout and Android per owned channel.

**QA and independent review:** Existing CG-04 QA must trace original /membership and /volunteer flow with tier selection/real price, apply/verify ID, scoped applicant PII, optional referral, PIN locality mapping and location fallbacks, unique approval/issuance, sensitive proof only through CG-19, responsiveness and original screenshot comparison. Add source trace to **existing** story QA and owner-to-CG-18 receiving integration tests; do not mark them passed, do not create duplicate data masters. Independent review + executable Web/Android/DB/manual visual QA remain pending.


**Canonical order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) · **Requirements:** [Foundation BR CG-04-BR01–11](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md), [PRD FR-009–011](../../prd.md), [HLD](../../hld.md), [original 167-screen Admin audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) B09–B10, U11–U17, U42, B41–B42, C50, A04/A09, UI-G04. **Working designs:** [DLD](dld.md) · [UI/UX](uiux.md) · [60 detailed QA](tasks.md).
**Status:** DELEGATED_APPROVED — DESIGN ONLY (15 Nov 2026), after self-disclosed source review/fix/re-review of all three full-stack stories, original screenshot controls, current PRD/HLD and receiving-owner integration; 60 unique planned manual QA (20 per story). No source code, SQL, device, live, PNG/video/motion, performance or Play QA executed. Current global PRD/HLD REVIEW_REQUIRED; Harness authenticated stage resolver NOT_RUN. Implementation remains BLOCKED pending formal gates and actual preceding source delivery.

uiux_decision: REQUIRED
uiux_reason: The original CareGanga branded Admin B09/B10 and U11–U17 plus existing common ID-card and public-Join treatments require exact current responsive Web/native channel contracts.
dld_decision: REQUIRED
dld_reason: Member term/version snapshots, CG-03 case/effect, CG-09 verified fee/refund, CG-19 pre-case proof/issued PDF, private volunteer identity and CG-02 affiliation require true concrete transaction and schema ownership.
database_impact: CRITICAL
database_reason: Paid member approval/refund/renewal, one irreversible generated membership number, medical-adjacent optional profile data and cross-root/branch/private identity scope require independently qualified database/security review, actual replay/recovery and migration verification.
mobile_store_impact: ANDROID
mobile_store_reason: Real Public Android registration/self-service and authorized Internal Android volunteer assignment, not a website wrapper.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: Use latest mutually compatible stable Expo/React Native/React, matching Android build tools and maintained SDKs; HLD architecture currently references Expo SDK 58/RN 0.88/React 19.3/API36 but these are NOT an executed lockfile or device/store compatibility matrix. Recheck official stable matrix, target API/16KB native packages and Google Play status before development/QA.
mobile_policy_checked_on: 2026-11-15
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: DESIGN_REFERENCE_ONLY; actual AAB/SDK Index/16KB/signing/Play tests NOT_RUN.

## 1. Single record owner and real independence

**CG-04 owns:** Versioned membership tiers and approved-public selection; member and volunteer intake/business profiles; applicant-specific contact/consent and branch/department relations; member numbers and immutable membership terms/renewals; volunteer skill/availability/verification/eligibility and assignment history; actual source-owned protected changes, roster counts and bounded exports. One CG-01 account may legitimately be a member, volunteer and employee, but never equate these relationships or automatically add any permissions.

**Other authoritative owners:** CG-01 password-authenticated accounts, roles and grants; CG-02 existing active branches and departments; CG-03 one configurable approval process/case/decision (CG-04 introduces MEMBER_APPLICATION, MEMBER_PROFILE_CHANGE, MEMBER_RENEWAL when policy needs review, and VOLUNTEER_APPLICATION adapters in original CG-03, not a second engine); CG-09 verified membership fee receipts, refund/payment outcomes, one original expense claim/journal; CG-19 pre-approval protected ID evidence, issued template/card/certificate/welcome letter and notification delivery; CG-05 project tasks/field visits; CG-18 editorial publication/navigation desired flags; CG-13 referral points/ranks and reward entitlements; CG-20 overall MIS. CG-04 stores minimal immutable references and safe current projections, never shadow approval/payment/file/CMS/points/work masters.

**Independence test:** US-001 creates and safely publishes real CG-04 membership tier choices with CG-01/02 root scope, no CG-18 CMS/page, CG-13 referral, CG-05 project or volunteer records. US-002 takes a genuine applicant through its own standalone public Web/Public Android form and verified CG-09 fee + CG-03 approval into one member with CG-19 card, even if CG-18 editorial site or CG-13 rewards do not yet exist. US-003 accepts, reviews and activates an independent volunteer without CG-05 work assignment or CG-18 Join CTA; it uses actual CG-01/02/03/19 and optional already delivered CG-09 claim for a real expense, not future data.

**Same-wave CG-18 constraint:** CG-04 and CG-18 share parallel planning wave P3; NEVER assume their unmerged peer modules exist. CG-04 public join and status operate directly in its genuine standalone Web/Public Android routes. If CG-18 is already integrated, CG-04 US-002/003 delivers and tests source-backed Join destination readiness + current published CTA in CG-18's owned revision. If CG-04 is delivered first, CG-18 US-001 integrates the already delivered source during its own implementation and QA. No cross-branch import or speculative stub may gate either module's first story.

## 2. Three complete full-stack stories

| Story | Actual source/acceptance | Admin Web original reference | Public Next.js + native Public Android | Native Internal Android |
| --- | --- | --- | --- | --- |
| **US-001 — Membership tiers** | Configure active/inactive versioned price, duration, benefits/description, icons, display order, one public-eligible revision, role and root policy; no member/applicant needed | B09 original cards, filters/status tabs, Create New Tier; B10 radio, validity, icon/color, editable benefits and live preview | CG-04 owned standalone safe tier list/comparison, only genuinely eligible prices/terms; no CG-18 required | No full tier editing; explicitly NOT_APPLICABLE unless separate authorized read; staff uses Admin Web |
| **US-002 — Membership lifecycle** | Application reference; guarded contact/CG-02 branch; real CG-19 evidence; CG-03 reviewed frozen version; CG-09 verified paid/free conditions; unique member number, term, renewal, profile correction, reject/refund, protected card/certificate | B09 member table/KPIs, U11–U13 shared CG-03 application view, B41/B42 CG-19 card preview | Real join, identity/fee state, own status/renewal/profile/download in Web and native app; CG-18 CTA only when its current owned publication exists | Current authorized scoped member lookup/read and review shortcuts where actually permitted, not a second approval engine |
| **US-003 — Volunteer lifecycle** | U15 full application, CG-02 actual eligible department, CG-04 skills/availability, CG-19 proof, CG-03 decision, no staff-role auto-grant, real volunteer status, branch history/communications; CG-09 expense original when eligible | U14 counters/status tabs/search/import/export, U15 form, U16 departments, U17 schedules; approval uses U11–U13 | Real volunteer join, own application/status/profile and eligible claim submission/status (CG-09); cannot see private field GPS by enrollment | Authorized volunteer roster/own assignments only after actual CG-05 task/visit and explicit CG-01 role/linked account; no private assignment without source |

**Only these three stories; one `tasks.md` tracker.** Their selected destination, API, backend, DB, privacy, failure feedback and per-story QA are mandatory; do not quietly skip the Public Android or source screens.

## 3. Status and business rules

- **Tier:** DRAFT → ACTIVE_PUBLIC or INACTIVE, with version-pinned price/period/benefits/display and current eligibility; past paid/application snapshots never repriced. A CG-04 tier's public listing is source-safe and independent of CG-18 editorial approval. The CG-18 *navigation CTA* is separately versioned/published.
- **Membership application:** DRAFT/SUBMITTED/RETURNED/REJECTED plus distinct fee state NOT_DUE/PENDING/VERIFIED/REFUND_PENDING/REFUNDED/FAILED and exact CG-03 case state. An approval and applicable VERIFIED fee (or valid zero-fee policy) both precede one irreversible member number/ACTIVE membership. Review approval alone is not proof of payment. Rejected verified joining fee requires one approved full refund; request/processing is not REFUNDED until CG-09 verifies. Application reference is never member ID.
- **Member:** ACTIVE / EXPIRED / SUSPENDED / CANCELLED; renewal is an immutable additional term/event, not a magic status replacing history. Preserve source tier version, paid amount, business-local start/expiry, branch affiliation and card issue/revoke versions. Authorized protected profile correction uses real CG-03 decision where policy requires, not silent field overwrite.
- **Volunteer:** Application DRAFT/SUBMITTED/RETURNED/REJECTED/APPROVED; current volunteer ACTIVE/INACTIVE/SUSPENDED with actual current branch/department and effective dated assignment, consent and availability. Volunteer approval is not employee creation, automatic CG-01 staff login/grant, CG-05 task completion or financial reimbursement.
- **Restricted fields:** Names/contacts, DOB/gender, optional self-provided blood-group field, KYC, photos, addresses and exact branch/identity attachments remain private; no public volunteer list, open QR personal data or cross-branch export. Personal data is not a clinical patient/healthcare record.

## 4. Original UI and downstream effects stay in their owner

- **B09/B10:** Reuse original blue active sidebar/header, membership plan card and membership table, current plan status tabs, keyword/status/plan/date/location filters, B10 modal/drawer density, live icon/benefit preview and tier price/validity exactly as indexed audit. No CMS-controlled duplicate fee.
- **U11–U13/U14–U17:** Registration workflow and per-document verification remain CG-03/CG-19; U14 volunteer admin source, U15 full modal, U16 chosen real permitted department, U17 documented availability. U14 Import creates scoped draft/source validation only; never grants a volunteer ID or staff login without review. Export only authorized current scope and redacted PII.
- **B41/B42:** One CG-19 versioned front/back template/issued file; real CG-04 member or eligible volunteer source, visible card fields explicitly allowed, PDF/QR/reissue/revocation truth. No fake sample card or public KYC.
- **CG-05:** On genuine ACTIVE approved volunteer + optional explicit CG-01 account assignment, CG-04 US-003 exposes minimal current eligible assignee options to real existing CG-05 A09 tasks/A04 visits, and extends original CG-05 Web/native guards and source QA when CG-05 exists. If CG-05 is not delivered, enrollment works and no private My Assigned Tasks link is shown.
- **CG-09 / original U42:** Volunteer-specific *Submit Volunteer Expense Claim* form is CG-04 US-003 presentation/eligibility into the original CG-09 expense_claim. U42 applicant, amount/date, category, method, optional real UTR/project reference, purpose/remarks and CG-19 receipt are validated; its 'Submit for Invoice Creation' action means actual submitted financial review, NOT a created/approved invoice or PAID. Fee/refund uses existing CG-09 finance authority or a narrowly introduced original owner adapter. Unconfigured payment method yields truthful unavailable/pending and never activates a paid member.
- **CG-13/CG-20/CG-18:** CG-13 later credits real eligible referral events, CG-20 later reads scoped source reports, and CG-18 alone governs editorial placements/toggles. These are not initial CG-04 dependencies.

## 5. Quality and gate truth

Read [DLD](dld.md) for exact table/index/transaction/facade, [UI/UX](uiux.md) for every channel and [tasks](tasks.md) for **60 unique designed manual QA cases**. Source trace, actual PostgreSQL constraints/concurrency/recovery, GET option safety, document/fee idempotency, permission denial, snapshot audit, stale-cache revocation, protected exports, accessible responsive native and consistent original brand must all be checked before claiming a working module. Independently qualified CRITICAL database/privacy review, real migration/backups/restore, Web/API/native/Play runtime, screenshot pixel/motion and p95 measurements are **NOT_RUN**. No CI/GitHub Actions. Global PRD/HLD current-hash review and authenticated Harness resolver remain mandatory formal gates; design approval is not development approval.

## 18 November 2026 — original website receiving acceptance
**Original visitor routes:** /membership; /volunteer; consented Team Directory. **Evidence:** Batch02 021604–021739 and Batch01 020435–020504. **Owned source:** actual CG-04 plans/fees/benefits/application/verification and private CG-19 documents; CG-09 verified payment; no CMS member master. This [original 47-screen acceptance contract](../../../../../docs/research/CAREGANGA-ORIGINAL-PUBLIC-SCREENSHOT-QA-TRACE-20261118.md) is mandatory for existing US-001/002/003, without changing business owners, adding phantom records or accepting screenshot values as verified production facts.


## 20-Nov-2026 client five-document / email-v2 acceptance (source mapped; not yet executed)

**New client authority:** [Five source designs](../../../../../docs/research/CAREGANGA-CLIENT-DOCUMENTS-REFERENCE-20261120.md); [52 client email templates](../../../../../docs/research/CAREGANGA-CLIENT-MASTER-EMAIL-V2-COVERAGE-20261120.md). This is acceptance refinement of existing stories, **not** an extra module or completed code/QA. Re-check approval hashes before formal stage promotion.

CG-04 owns genuine, unique member/volunteer numbers, membership tier/version, status, fee, term, consent, approved geographic role and final source events. The client's member certificate, welcome letter and volunteer two-sided ID designs require CG-19 generated approved three-document packs (Member ID Card + Welcome Letter + Membership Certificate; Volunteer ID Card + Welcome Letter + Volunteer Certificate). CG-MEM-007 / CG-VOL-005 send only after final approval and all three PDFs exist. Volunteer registration is free. Keep membership type versus ACTIVE status versus Lifetime duration distinct. Original sample ₹ fee and personal/contact details are **never** default rules. Public QR displays only policy-approved verification status, not optional phone/blood-group.

**Status:** Owner integration and PDF/provider/runtime checks remain PENDING/NOT_RUN where absent; historical source-review evidence is unchanged.
