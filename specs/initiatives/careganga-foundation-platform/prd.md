# CareGanga Foundation — Integrated Platform Product Requirements Document

**Document version:** 1.1 — DRAFT / REVIEW_REQUIRED; preceding owner-delegated approved baseline is preserved as version 1.0 by its prior Git commit and SHA-256 in `approvals.json`. This current file replaces the working draft **at the same canonical path**; no v2 folder or parallel document. Changes after renewed approval require another explicit version increment and review.  
**Initiative:** careganga-foundation-platform  
**Project:** CareGanga Foundation  
**Mode:** GREENFIELD (new integrated platform; no implemented product assumed)  
**Harness:** JASIQ Harness v2, verified GitHub main HEAD on 15 Nov 2026: `ec7c0b81fb2e1e7845ea1b0a46df1114022cd0b1` (current HLD/bootstrap pin). Authenticated local stage resolver/checkout NOT_RUN; recheck before the next stage, source comparison is not resolver PASS.  
**Document status:** DRAFT / RE-REVIEW REQUIRED (one canonical pre-approval working revision; no duplicate version). Previous delegated approval applies only to its prior file SHA; this revised PRD requires renewed artifact-hash-bound owner-delegated design approval after local Harness preflight. Resolver, runtime and rendered visual comparison: NOT_RUN.  
**Baseline:** CareGanga main at the start of this initiative (documentation and repository configuration only)  
**Product owner:** CareGanga Foundation (client business sign-off required)  
**Prepared for review:** 14 November 2026  
**Document authority:** This is the single product-wide PRD under the Harness initiative. It does not replace the approved-source BR or create 21 competing product PRDs.

## 1. Decision, evidence and scope integrity

This PRD expresses **what the whole CareGanga Foundation product must do**, based on the consolidated client requirements. Healthcare Assistance is an **original, integral Foundation capability**: it shares identity, approvals, configuration, money handling, documents, communications, analytics and governance, while retaining stricter patient/center access controls.

**Authoritative business sources (CareGanga repository, main):**

- docs/business-requirements/00-MASTER-BUSINESS-REQUIREMENTS.md — CG-BR-000, all 21 module owners, connected journeys and priorities.
- docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md — CG-01 through CG-13 and CG-19 through CG-21.
- docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md — CG-14 through CG-17.
- docs/business-requirements/03-CMS-CHANNELS-BR.md — CG-18, CG-300 and each user-facing channel.
- docs/business-requirements/06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md — CG-BR-600, cross-platform quality requirements.
- docs/business-requirements/04-TRACEABILITY-DECISIONS.md — CG-BR-900, all 24 delegated business-policy defaults and release prerequisites.
- docs/business-requirements/05-SOURCE-TO-BR-COVERAGE-AUDIT.md — mapping of the 61-page client PDF, the 75 healthcare requirements and the October client transcript.
- docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md — A01–A19, B01–B51, C01–C55 and U01–U42: all 167 supplied Admin Panel screenshots, including 26 reconciled UI observations.
- Original client evidence referenced by those indexes: SAM-CAREGANGA-121126-113332.pdf (61 pages), 19 October CareGanga meeting, healthcare UI mockups, and the uploaded Admin Panel ZIP.

**Source interpretation:** The PDF gives required operational behaviour; the current healthcare images show additional user journeys and layout intent; Admin screenshots establish visible controls, not functioning endpoints or a final technical implementation. Where references differ, the adopted delegated decision policy in CG-BR-900 resolves the initial release behaviour. Screenshot sample doctors, amounts, ratings, payment IDs, certificate numbers and images must not become production defaults.

**Current state:** The repository contains business documentation and an agent setup. It is **not a brownfield software implementation**. No product screens, databases, live flows, integrations, deployed apps, runtime performance or compliance certification have been verified.

## 2. Business problem and desired outcomes

CareGanga needs one accountable system for Foundation administration, distributed field and branch operations, fundraising/CSR, finance, HR/payroll, inventories and integrated healthcare assistance. Without a common source of truth, staff may repeat registration, approvals, financial entries and medical/provider updates across channels, and leadership cannot confidently explain who approved, paid, received, attended, published or delivered each action.

**Outcomes and product measures:**

| Outcome | Measurable product result | Measurement / acceptance |
| --- | --- | --- |
| O-01 Foundation governance | Each restricted action is authorized and attributable | Permission and scope-negative acceptance for each applicable workflow; zero cross-scope disclosures |
| O-02 Registration and approvals | Every application can be submitted, reviewed, returned/rejected, finalized and tracked | Completed/returned decision path leaves one authoritative status, reviewer history and final ID/outcome only when eligible |
| O-03 Accurate finance | Income, spending, budgets, payroll, donor money and healthcare liabilities reconcile | One accepted posting per source event; balanced financial transactions; no double-counting or invented paid status |
| O-04 Field/service delivery | Staff can record projects, visits, beneficiary support and stock with evidence | Each outcome connects to relevant project, actor, document and authoritative inventory/finance effects |
| O-05 Healthcare access | Eligible users can locate verified providers and book available doctor consultations | Real doctor-center schedule, explicit center/fee/benefit, no slot over-capacity and correctly protected patient data |
| O-06 Content and transparency | Admin can control published public information without duplicating operational records | Draft/review/publish/unpublish reflected in web/app; private records never public |
| O-07 Cross-channel usability | Public, Admin, center and both Android audiences see consistent business state | Acceptance journeys work through their applicable channels with truthful failure/permission states |
| O-08 Sustainable operation | Critical business failures can be identified, recovered and audited | Applicable P0 CG-NFR gates passed; P1 targets agreed/verified against actual sizing |

Baseline volumes, expected adoption/conversion and operational targets beyond stated quality gates require client sizing; **no usage or revenue forecast is assumed**.

## 3. Audiences, roles and channel responsibilities

| Actor | Main jobs | Authorized interface(s) | Access boundary |
| --- | --- | --- | --- |
| Public visitor/donor/applicant | Discover Foundation and healthcare, register, give, enquire | Public website; Public Android | Published information plus only their own verified transactions |
| Member/volunteer | Apply, see status, approved documents, events/rewards/assigned work | Public website/app; Internal Android if specifically authorized | Relationship-specific access, no implicit staff privileges |
| Foundation Super Admin | Configure authorized settings, govern approvals, finance, CMS and reports | Foundation Web Admin; specifically permitted Internal Android functions | Protected central role, sensitive actions audited |
| Delegated state/district/block/branch officer | Process records, coordinate staff, projects, field work, approvals | Foundation Web Admin; Internal Android | Action permission **and** actual geography/branch/resource scope |
| HR/finance/payroll administrator | Employees, compensation, journals, vouchers, budgets, settlement | Foundation Web Admin; approved Internal Android tasks | Need-to-know protected salary, bank, ID and financial fields |
| Project/field staff | Tasks, visits, beneficiary assistance, requests, evidence | Foundation Web Admin; Internal Android | Assigned work and geographically authorized records |
| CSR representative | Apply/propose/communicate as approved | Applicable public/authorized self-service | Never automatically receives internal finance/Admin access |
| Healthcare network administrator | Onboard/verify providers and doctors, monitor quality, schedules, healthcare assistance | Foundation Web Admin | Authorized network and protected record scopes |
| Center administrator/receptionist | Own-center doctor links, slots, bookings, queue, diagnostics, collections, support | Healthcare Center Portal; any explicitly assigned internal flow | Center/location-specific; cannot access unrelated center or unrestricted medical files |
| Doctor/diagnostic professional | Permitted schedule, patient visit, ordered tests, reporting | Center Portal/role-approved interface | Care relationship and professional assignment restrict access |
| Patient | Search, register, book, pay or retain due status, retrieve authorized receipts/reports | Public website; Public Android | Verified own patient/booking identity; dependent/family access needs D-08 decision |

**All channels use one authoritative backend business state and permissions.** UI layouts may differ. No assumption that desktop-only complex settings must be duplicated into both Android apps; any explicit source-required mobile action must be supported, while detailed feature mapping is resolved by D-17.

## 4. Product scope and prioritization

**MUST / contractual baseline:** All source-backed CG-01–CG-21 business capabilities, applicable Foundation Web Admin, public website, Center Portal, Public Android, Internal Android and common backend behaviour shown in the module requirements below. The dependency sequence is **not** a unilateral reduction of scope or a promise to ship only the first module wave.

**MUST / platform-wide:** Backend-enforced authorization, center/branch isolation, documented status transitions and audit, single accounting source, safe repeated submissions, true appointment availability, clinical privacy, controlled content publication and applicable P0 NFRs.

**MUST / CareGanga UI/UX and motion fidelity:** All applicable CG-01–CG-21 module journeys and all five user-facing channels must **preserve the existing CareGanga design identity** evidenced by the original Admin screenshot/video ZIP and the [167-screen indexed UI audit](../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md): same brand color palette, typography hierarchy, spacing/density, icon family, card/table/form/drawer/modal patterns, sidebar/header, badges and semantic states, plus verified animations/transitions (navigation, drawer/modal, tab/expand, loading and action feedback). No replacement theme or inconsistent per-module styling. Public/center and Android screens share the brand and visual/motion language while adapting structure for their actual role, device, accessibility and healthcare privacy. **Exact colors, fonts, sizes and animation duration/easing must be extracted from original image/video/design assets, not guessed from this text audit.** Where motion cannot be verified from original video/interaction evidence, no arbitrary decoration may be called a match. Honor reduced-motion and accessibility expectations without changing identity. Screenshot content is not proof of functional implementation or approved business rules. This is an acceptance condition, not another business module or separate design system product.

**SHOULD / experience refinements:** A simple, role-based navigation model; progressive disclosure of advanced options; readable mobile detail views; contextual summaries; professional, accessible forms and helpful guidance, insofar as they preserve documented business capabilities. These are design expectations rather than extra business modules.

**LATER / not authorized as separate implementation:** Any new e-pharmacy checkout, medicine home-delivery engine, hospital/OT theatre management, insurance claims adjudication, general EMR, extra financial engines, a speculative fully offline sync system or event ticketing service **unless an approved future scope change expressly requires it**. Their visible search badges/cards remain valid directory or informational requirements. Existing written **internal lab order and report** functionality is not deferred by this clarification.

**Explicit out of scope for this initiative:** Recreating an unrelated historical application or legacy module; copying mockup people/percentages as fixed policy; fabricating legal validity, clinical accreditation or performance results; duplicate CRM, payment, CMS, approval, patient or ledger databases.

## 5. Functional product requirements

The tables use stable **FR** IDs, priority MUST unless otherwise stated, client business-owner references, an acceptance-family reference (A-01–A-21), and user-visible or observable outcomes. They group closely connected actions rather than producing one requirement for each screenshot button. The cited CG-BR IDs remain the definitive detailed field and rule references.

### 5A. Shared Foundation controls and organization

| ID | Owner | Actor / trigger | Required behaviour and observable outcome | Acceptance | Source |
| --- | --- | --- | --- | --- | --- |
| FR-001 | CG-01 | Authorized administrator manages identity and session security | Create/invite/activate accounts, recover credentials, suspend/revoke access and link valid owner relationships. CG-01 alone configures and enforces secure password/session limits and required privileged MFA with guarded Super Admin edits, versioned policy audit and correct Web/Internal Android session outcomes; no CG-21 shadow policy or future employee/center master | A-01 | CG-01-BR01,08–11 |
| FR-002 | CG-01 | Super Admin configures duties | Define protected and custom roles, edit grouped action permissions, copy a role's grants without copying its assigned people; see assignment/audit history | A-01 | CG-01-BR02–04,08 |
| FR-003 | CG-01 | Scoped user accesses a feature | Apply permitted action and organization/state/district/sub-division/block/branch/center record scope to menus, linked selectors, search, exports and every protected operation; deny unauthorized access | A-01 | CG-01-BR05–07 |
| FR-004 | CG-02 | Admin configures Foundation | **US-001:** one Foundation legal/contact master, real geography and Foundation-only departments/committees/eligible CG-01 officeholders **without any branch or CG-03/19 service**. **US-002:** after real branch activation maintain current verified branch operating profile (contacts/geo/GPS/manager/CG-19 media with revision history preserving the original approved case) and manage branch-scoped departments/committees and Foundation-branch links. CG-10/04/05/09 later own actual employee/volunteer/member/project/budget branch relations; CG-18 alone publishes approved public projections | A-02 | CG-02-BR01–02,06–10 |
| FR-005 | CG-02 | Authorized branch applicant or manager starts branch setup | Save/resume a seven-stage branch registration across permitted Web/Internal Android channels, using a real eligible CG-01 manager and genuine CG-19 evidence; CG-03 review must target the exact submitted revision, with Super Admin final approval for new branches; after verified owner finalization issue exactly one unique code and active branch, never on draft, return or rejection; current authorized branch profile updates are versioned and preserve the immutable approved submission and case | A-02 | CG-02-BR03–05; D-05 |
| FR-006 | CG-03 | Approval-worthy source owner submits a frozen case | **Initial independently deliverable source: real CG-01 protected assignment of a non-root custom role containing `roles.manage`**, with CG-03-owned intent/digest, observed CG-01 source account/role versions, one readable case number and pinned actual reviewer/process version. Later CG-02/04/08/10/14 owners introduce genuine branch/member/CSR/employee/provider submissions, while CG-19 introduces real file evidence; none is an initial CG-03 data, UI or startup prerequisite | A-03 | CG-03-BR01–04,06 |
| FR-007 | CG-03 | Authorized reviewer decides | Approve, reject, return for correction or forward; show pending and prior steps, reviewer, remarks and time; prevent action by unrelated or revoked reviewer | A-03 | CG-03-BR05–08 |
| FR-008 | CG-03 | Final authorized approval requests one original owner effect | CG-03 records one version-pinned final decision and idempotent PENDING_OWNER effect; its initial **CG-01-owned guarded finalizer** rechecks real account/access and role versions plus trusted decision, applies at most one allowed custom-role grant/access audit and only then marks OWNER_COMPLETED. Later member/employee/branch/provider/financial source effects belong to the actual introducing owner, not CG-03's own writable tables; pending/unknown/blocked never imply success | A-03 | CG-03-BR09 |

### 5B. People, community delivery and fundraising

| ID | Owner | Actor / trigger | Required behaviour and observable outcome | Acceptance | Source |
| --- | --- | --- | --- | --- | --- |
| FR-009 | CG-04 | Person applies as member | Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions** | A-04 | CG-04-BR01–05 |
| FR-010 | CG-04 | Admin manages membership | Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes | A-04 | CG-04-BR02,04,06 |
| FR-011 | CG-04 | Person volunteers | Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments | A-04 | CG-04-BR07–11 |
| FR-012 | CG-05 | Project owner sets up work | Create/maintain projects, responsible staff, locations, dates, budgets, funding links, status and work progress; expose scoped project dashboards | A-05 | CG-05-BR01–03,08 |
| FR-013 | CG-05 | Coordinator assigns work | **CG-05 US-002** owns original project/task, real CG-10 approved employee assignee selector and current CG-01/02 branch-scoped task status, with native **Internal Android My Assigned Tasks**. Transferred/exited/revoked employee cannot update stale assigned task. CG-05 US-003 owns genuine field visit/check-in/CG-19 proof. Neither task owner nor native task UI is a CG-10 HR table, and only approved event/project public-safe views may be published | A-05 | CG-05-BR04–05,09–10; CG-10-BR11 mobile integration |
| FR-014 | CG-05 | Field worker visits project | Record geotag/GPS/location, check-in/out, photos/video, notes, documents, team and beneficiary references; supervisor sees review/history and linked expense requests | A-05 | CG-05-BR06–07,11 |
| FR-015 | CG-06 | Staff registers beneficiary | Maintain restricted beneficiary profile/geography and project associations, including verification/status and useful filtered history | A-06 | CG-06-BR01,03,05 |
| FR-016 | CG-06 | Approved aid is delivered | Record aid category, money/item, quantity/value, date and responsible person; link stock issue or finance posting, preserving assistance and public-impact privacy | A-06 | CG-06-BR02–05 |
| FR-017 | CG-07 | Campaign owner proposes fundraiser | Create six-step editable campaign with project/cause, team, target, dates and media; submit for review and separately authorize public publication | A-07 | CG-07-BR01,06–08 |
| FR-018 | CG-07 | Donor makes contribution | Support applicable general/campaign-linked gateway, authorized cash/bank/manual and payment-link paths, with separate pending/verified/failed/refunded states | A-07 | CG-07-BR02–03,09 |
| FR-019 | CG-07 | Donation completes/reverses | Issue correct authorized receipt, donation history and donor self-service; post/reverse money through shared finance once and report actual campaign progress | A-07 | CG-07-BR04–07 |
| FR-020 | CG-08 | CSR partner submits application | Capture organization, contact, proposed support, proof/agreement; review/approve/reject/return via the common approval process | A-08 | CG-08-BR01–03,05,08 |
| FR-021 | CG-08 | Foundation funds a project | Record funding proposals, documented CSR/Foundation commitments, received funds, permitted split allocations and supporting agreements, linked to budget and finance | A-08 | CG-08-BR03–04,06–07 |
| FR-022 | CG-08 | Finance or partner manager examines funding | Report approved, pending, committed, received and utilized contributions without confusing pledge with cash or public partner marketing with financial approval | A-08 | CG-08-BR05–07 |

### 5C. Money, employees, payroll, stock and rewards

| ID | Owner | Actor / trigger | Required behaviour and observable outcome | Acceptance | Source |
| --- | --- | --- | --- | --- | --- |
| FR-023 | CG-09 | Finance Admin opens accounts | Configure real CG-01 Foundation root/CG-02 branch account groups, financial years, actual cash/bank chart and one balanced opening entry; no fake future CG-05 project/employee/vendor | A-09 | CG-09-BR01–03 |
| FR-024 | CG-09 | Finance user posts a transaction | One immutable source-keyed balanced journal and original multi-line voucher, genuine CG-09-introduced CG-03 finance approval/CG-19 evidence, independent posted versus PAID_VERIFIED state, original audit/reversal | A-09 | CG-09-BR02,04,06–08,17 |
| FR-025 | CG-09 | Foundation reimbursement and later genuine employee/volunteer requester | CG-09 owns one original expense_claim/payable/voucher/verified payment/ledger first usable by actual eligible CG-01 Foundation actor, with CG-03 review/CG-19 evidence. CG-10 real employee and CG-04 volunteer modules later introduce their own eligibility/request UI into the **same** CG-09 claim; no duplicate HR/volunteer claim master | A-09 | CG-09-BR09–10 |
| FR-026 | CG-09 | Authorized user invoices or receipts | One original CG-09 source invoice/receipt with genuine counterparty snapshot, items/amounts/tax and separate issued/approved/paid state; CG-09 introduces its CG-19 document-template/issued-PDF/optional-share integration without future member/supplier/donor masters | A-09 | CG-09-BR11–12 |
| FR-027 | CG-09 | Finance allocates budget | Original Foundation/real ACTIVE CG-02 branch/category/period budget and distinct immutable approved/committed/allocated/utilized/released/available/over-budget events, with project/funder linkage only when later actual owner introduces it | A-09 | CG-09-BR13–16 |
| FR-028 | CG-09 | Reviewer checks statements | Original root/branch-scoped GL, cash/bank/day book/trial balance, bank reconciliation/variance/payables/corrections/permissioned export only from real CG-09 ledger; later owners introduce actual supplier/CSR/project dimensions, CG-20 broader MIS | A-09 | CG-09-BR03,05,14–17 |
| FR-029 | CG-10 | HR enrolls employee | Create real PENDING application (with/without existing CG-01 account), verified active CG-02 branch/department/eligible manager, restricted KYC/bank/salary *proposal* and CG-19 secure draft evidence. **CG-10 US-001 introduces its actual EMPLOYEE_ENROLLMENT source/process inside CG-03** and original HR-precase file/role-affiliation adapters into CG-19/01. Only matching final CG-03 decision and CG-10 guarded single-effect finalizer create employee ID/assignment; CG-01 alone grants permitted staff access; no CG-11 salary or CG-18 biography prerequisite | A-10 | CG-10-BR01–03,12 |
| FR-030 | CG-10 | Employee reports work | **US-002** owns effective shift/weekly-off/grace policy, source-pinned attendance matrix, approved carryover adjustment/leave and true Internal Android own attendance/leave/correction; apply real CG-03 source approval and date/overlap guards without CG-11 payroll. **CG-05 US-002/003 later implements native assigned work tasks/field visit UI using real eligible CG-10 employee scope** (CG-10 BR11), not CG-10 project-task records. All Web/native HR reads/writes check actual CG-01+CG-10 root/branch | A-10 | CG-10-BR04–06,11 |
| FR-031 | CG-10 | HR manages employment | **US-003** records genuine appraisal, exact-revision CG-03-reviewed transfer/promotion/resignation/exit, active historical CG-02 branch/department assignments and CG-01 effective scoped access revocation. Confidential proposed salary is **HR proposal only**: actual effective salary components/calculation are introduced and QA-tested in **CG-11 US-001/002**, and verified final dues/settlement in **CG-11 US-003/CG-09**. Exit clearance never claims PAID/SETTLED from HR approval alone. Native Internal Android uses own permitted status, no public HR data | A-10 | CG-10-BR07–08,14 |
| FR-032 | CG-10 | HR issues official record | **US-004** owns only source-bound employee/application document intent and introduces real HR_DOCUMENT_REVIEW in CG-03 and employee/offer/card template-source adapter in **CG-19 original** PDF/issue/dispatch/receipt/QR authority. A separately approved **Offer can target a pending application without creating staff ID/access**; appointment/joining/ID need genuine eligible approved employee, relieving needs real approved US-003 exit. Issued/reissued/deactivated file/history/private Internal Android view come from CG-19, never second HR PDF or member-card master | A-10 | CG-10-BR09,13,15 |
| FR-033 | CG-10 | Employee requests allowance | **US-005 only after actually delivered CG-09 US-003 claim** introduces real employee/current CG-01/CG-02 eligibility and B49–B51 Admin Web plus native Internal Android request/status into the **one original CG-09 expense_claim**. CG-09 owns proof/review/payable/posted journal and bank/cash PAID_VERIFIED; CG-10 never creates an HR claim/payment table. US-001–004 remain independent without CG-09/CG-11 | A-10 | CG-10-BR10–11 |
| FR-034 | CG-11 | Payroll Admin configures compensation | Own approved effective salary structure/bank adjustments and payroll policy independently of CG-10 HR *proposed* salary. CG-11 US-001 optionally consumes real approved CG-10 US-003 source change under its **own** salary approval and historical nonoverlap guards; US-002 freezes CG-10 attendance source for calculated period and uses explicit adjustment/arrears after late correction, US-003 verifies actual final salary dues/settlement through CG-09. Do not duplicate an HR salary/payable or silently change frozen payroll | A-11 | CG-11-BR01–02,09,11 |
| FR-035 | CG-11 | Payroll officer runs period | Produce draft payroll from approved eligible employee/attendance data; calculate, validate, adjust, review and obtain required approvals | A-11 | CG-11-BR03–04,10 |
| FR-036 | CG-11 | Authorized payroll payment occurs | Track reserves/batches/payment outcomes, generate private payslips, record history/audit and reconcile exactly one expense/payment outcome in CG-09 | A-11 | CG-11-BR05–08,10 |
| FR-037 | CG-12 | Inventory officer manages stock | Maintain item/supplier master, receipts, issuance, authorized adjustment, availability, low-stock alerts and transaction history | A-12 | CG-12-BR01–03,05 |
| FR-038 | CG-12 | Staff requests material | Submit and track request through approval/rejection and fulfilled quantity, with project, beneficiary and reward consumption linked to one stock inventory | A-12 | CG-12-BR04,06 |
| FR-039 | CG-13 | Eligible member/volunteer refers new applicant | Record attributed referral, qualify only after defined approved event, maintain points transaction/reversal history and current rank | A-13 | CG-13-BR01–04 |
| FR-040 | CG-13 | Admin configures loyalty program | Manage rank thresholds and benefits, point conversion/redemption rules, reward item catalog with availability and stock linkage | A-13 | CG-13-BR03–05 |
| FR-041 | CG-13 | Member/volunteer redeems | Confirm eligibility/points, register one redemption, manage approval/fulfillment/reversal and report results without double deduction or stock issue | A-13 | CG-13-BR06–08 |

### 5D. Integrated healthcare network, patient services and assistance

| ID | Owner | Actor / trigger | Required behaviour and observable outcome | Acceptance | Source |
| --- | --- | --- | --- | --- | --- |
| FR-042 | CG-14 | Foundation or center submits provider | Register center organization and own operating locations with type/code, contacts, location/map, service/facility listing, hours, documents and restricted settlement details | A-14 | CG-14-BR01–03,06–08 |
| FR-043 | CG-14 | Foundation verifies provider | Review center identity/documents/facilities, approve/reject/return and activate/suspend/deactivate both account and applicable public eligibility with history | A-14 | CG-14-BR04–05,18 |
| FR-044 | CG-14 | Foundation or center registers doctor | Maintain verified professional identity, licenses/qualifications, specialties, biography, approved center associations and center-specific consultation/follow-up fees | A-14 | CG-14-BR09–13 |
| FR-045 | CG-14 | Public discovers verified healthcare | **CG-14 US-004 owns a standalone real public Next.js/Public Android center/doctor directory** (no CG-18 dependency): current approved category/geo/specialty/facility/fee filters, true center/doctor registration status, public contact/map/directions, secure published-field allowlist and immediate suspension exclusion. **CG-15** later owns real slot availability/Book CTA, **CG-16** real test/package prices and **CG-17** eligible support amount/percentage; before delivery never claim these function or fabricate ratings, availability or benefits. CG-18 later optionally places the already working CG-14 source under editorial copy | A-14 | CG-14-BR14–18,20 |
| FR-046 | CG-14 | Center maintains permitted presentation | Submit provider photos, services, published information/FAQs and own-center profile updates for Foundation-controlled review and publication | A-14 | CG-14-BR19 |
| FR-047 | CG-15 | Doctor/center schedules availability | Configure doctor-center working days, time windows, capacity, consultation type, holidays, blocks and approved leave while preserving already confirmed bookings | A-15 | CG-15-BR01–02 |
| FR-048 | CG-15 | Patient chooses doctor/visit | Support center-first or doctor/date/slot-first journey using one doctor-aware center-specific schedule that prevents overlapping in-person appointments across centers; show the requested center and available slot before payment; when multiple centers match the same time, present an explicit center choice rather than silently selecting one | A-15 | CG-15-BR03–08; D-02 |
| FR-049 | CG-15 | New/existing patient identifies self | Register or securely locate patient with verified mobile, appropriate profile and consent, optional uploaded reports/identity; assign a unique patient ID without duplicates or unverified cross-linking | A-15 | CG-15-BR09–16 |
| FR-050 | CG-15 | Patient/staff confirms appointment | Capture patient, doctor, center, slot, consultation type and reason; show editable summary, payment choice and current booking status without exceeding center capacity or overlapping the same doctor's in-person appointments at different centers | A-15 | CG-15-BR17–18; CG-15-BR06 |
| FR-051 | CG-15 | Booking is validly confirmed | Issue authentic reference/Booking ID, download/print/share and guarded QR/barcode verification and calendar export; protect identifiers and symptoms | A-15 | CG-15-BR19–21,24; D-07 |
| FR-052 | CG-15 | Center serves patient | Manage reception check-in, queue/token, waiting/consultation/completed/canceled/no-show state with authorized updates and patient/center appointment history | A-15 | CG-15-BR22,25 |
| FR-053 | CG-15 | Patient or authorized center changes booking | Reschedule/cancel when permitted; restore appropriate capacity, preserve history, update true due/refund and notify relevant parties | A-15 | CG-15-BR23–24; CG-17-BR09–13 |
| FR-054 | CG-15 | Patient opens account | See authorized own appointments, receipts, patient ID and permitted reports; patient and professionally uploaded report access are included; general dependent/family booking and electronic prescription authoring are not active initial-launch functions | A-15 | CG-15-BR14–16,20 |
| FR-055 | CG-16 | Center/central Admin configures lab | Manage diagnostic test master, codes/category/sample type, center-specific price/discount, active status, test package components, periods and history | A-16 | CG-16-BR01–03 |
| FR-056 | CG-16 | Center books lab service internally | Create authorized patient test/package order and track collection, processing, report upload and controlled release; link payment/assistance state | A-16 | CG-16-BR04–07 |
| FR-057 | CG-16 | Patient/provider views service | View published lab/service menus, real price and discounts where authorized; private report only to permitted patient/clinician | A-16 | CG-16-BR06–10 |
| FR-058 | CG-16 | Additional service CTA appears publicly | Show approved center/service information with enquiry/contact actions; no public lab, medicine, nursing/OT or pharmacy checkout is included in the initial launch | A-16 | CG-16-BR08–10; D-01,23 |
| FR-059 | CG-17 | Foundation configures benefit | Configure eligible provider/doctor/service, fixed/percentage contribution, caps, expiry, optional approval and patient eligibility with historical policy | A-17 | CG-17-BR01–04 |
| FR-060 | CG-17 | Patient sees appointment price | Display gross fee, actually approved/eligible Foundation support and patient payable separately; eligible consultation benchmark is documented **50%/50%**, not unconditional or automatically 100% | A-17 | CG-17-BR02,05–07 |
| FR-061 | CG-17 | Patient selects online or center payment | Provide online payment only through the verified healthcare center's own enabled merchant method, or pay-at-center when approved; show initiated/pending/failed/confirmed/due truthfully and never use an unverified Foundation gateway for center collections | A-17 | CG-17-BR08–10 |
| FR-062 | CG-17 | Center receives payment or encounters due | Record authorized on-site payment, part-pay, overdue follow-up, receipts, correction and refund without equating booking confirmation to settlement | A-17 | CG-17-BR11–14 |
| FR-063 | CG-17 | Foundation owes provider | Keep the center's patient collections, the Foundation's approved liability, monthly provider dues and settled amounts distinct; support scoped reconciliation, settlement and adjustments | A-17 | CG-17-BR15–19 |
| FR-064 | CG-17 | Money has to be accounted for | Reconcile verified patient receipts (center-owned), refunds and monthly Foundation assistance/settlement exactly once into CG-09 with a distinct owner and payment reference; center-collected patient money is *not* Foundation cash/bank income. Unverified merchant accounts block live online collection, not design completion | A-17 | CG-17-BR18–20 |
| FR-065 | CG-17 | CMS presents discount claim | Publish only approved current rates; mockup lab/medicine/nursing percentages never become entitlements. Standard eligible consultation is 50% Foundation support, while exceptionally approved full support is permitted with recorded amount/cap | A-17 | CG-17-BR06–07; D-03 |

### 5E. Content, documents, reporting, operations and public channels

| ID | Owner | Actor / trigger | Required behaviour and observable outcome | Acceptance | Source |
| --- | --- | --- | --- | --- | --- |
| FR-066 | CG-18 | Admin edits Foundation site | Original homepage/About/hero/editorial public team/navigation/SEO and **three separate versioned Login/Profile, Membership Join, Volunteer Join visibility controls**. CG-18 US-001 introduces genuine CMS_PUBLICATION CG-03 case and CG-19 protected draft media adapter; public Web/Public Android share one approved revision. CG-04 US-002/003 later introduces actual Join destination and CG-05 US-001 real project teaser; no future master needed first | A-18 | CG-18-BR01–04,08–11,25–26 |
| FR-067 | CG-18 | Admin edits NGO impact/transparency | Publish editable Impact groups, geography/charts/stories with appropriate provenance; maintain 80G/PAN/registration, annual and financial disclosure pages/documents | A-18 | CG-18-BR12–17 |
| FR-068 | CG-18 | Admin publishes reusable content | Editorial gallery/videos/publications/blog/news/updates and CG-18 public Contact/notice *presentation/approved publication only*; CG-19 owns actual file bytes, Foundation enquiry, FAQ, operational notice/outbox/delivery. CG-05 US-002 later introduces source-backed operational events into CMS/public UI without duplicate event records | A-18 | CG-18-BR05–08,24,27 |
| FR-069 | CG-18 | Healthcare public editorial content is published | CG-18 US-004 independently publishes generic healthcare landing/hero/neutral service categories with original CareGanga theme before any provider exists. **CG-14 US-004/005** independently introduces actual verified doctor/center search/fees/center content and public-safe Web/Android directory (before CG-18 when scheduled); CG-18 integrates that existing owner source only when available, **CG-15 US-002/004** real Book Appointment CTA, **CG-17 US-007** true eligible support/percentage/cap messaging; CG-18 retains approved editorial placement only, no invented source or medical/financial edits | A-18 | CG-18-BR18–23,28 |
| FR-070 | CG-19 | Business issues actual source-backed protected files and documents | CG-19 owns one private file/upload/validated scan/authorized download and versioned document template/issue/reissue/revoke authority. **Initial true source is CG-01/03 verified access-change evidence and private approved-access PDF only after source grant completion**. Actual CG-04/10 member/staff ID, CG-09 financial receipt, CG-15/16 appointment/clinical document types are introduced and tested by those later owners with real source fields. Public QR never exposes private account/medical/finance evidence, and no future source master or business picker is seeded | A-19 | CG-19-BR01–02,05,08 |
| FR-071 | CG-19 | Real business event or Foundation sender communicates | CG-19 alone owns genuine source-event notification, recipient/audience scope, authored notice, scheduling, expiry, bounded provider outbox/attempts, status/history and optional delivery via actually configured channels; initial source is real CG-03 decision+CG-01 recipient. CG-21 only holds optional provider credential/readiness, CG-18 only publicly publishes an approved safe notice projection. Unconfigured provider or sent-to-provider never means confirmed delivery; zero eligible jobs produce no per-tenant polling | A-19 | CG-19-BR03–04,06,09 |
| FR-072 | CG-19 | Foundation visitor or verified center requests assistance | CG-19 owns **one** private Foundation contact/support case, safe public submit/opaque receipt, assigned CG-01 responder, append-only replies/status and bounded abuse controls, independently deliverable without CG-18 CMS or CG-14 centers. CG-18 later embeds the true public form, never duplicates a contact table. CG-14 later introduces verified own-center authentication/scope and center ticket UI over the existing CG-19 source, with explicit Center A/B negative QA; no future center record required for initial CG-19 | A-19 | CG-19-BR07 |
| FR-073 | CG-20 | Manager examines business | Show scope-filtered dashboards and quick actions for Foundation, modules, centers, finance and operations from verified owner records | A-20 | CG-20-BR01–03 |
| FR-074 | CG-20 | Authorized user produces reports | Use standard and custom/saved/grouped reports, filters, supported export formats and schedules; mask/restrict sensitive records by recipient and scope | A-20 | CG-20-BR03–07 |
| FR-075 | CG-21 | Super Admin manages platform operations | Configure **CG-21-owned versioned operational settings** and protected external provider credential references; present genuine on-demand integration readiness and safe error/status reporting. CG-02 owns legal Foundation information, CG-18 owns public Login/Join/Volunteer visibility, CG-19 owns message delivery, CG-09/17 own financial effects and CG-01 owns session/MFA policy | A-21 | CG-21-BR01,03,05 |
| FR-076 | CG-21 | Administrator views source audit or recovery | Present authorized redacted read-only CG-01/CG-21 events initially and later genuine source-owner audit projections as delivered; restrict backup/recovery status and request/operation controls using **CG-01's existing active Super Admin, fresh MFA and session policy**. Actual backup/restore success requires independent operational proof; no second audit ledger or CG-21-owned auth policy | A-21 | CG-21-BR02,04,06 |
| FR-077 | CG-300 | Public website/app user navigates | Experience coherent public Foundation pages, memberships, volunteering, donations, rewards and eligible doctor booking/receipts on responsive web and Public Android with identical current business outcomes | A-18, A-15 | CG-300-BR01–06,14–20 |
| FR-078 | CG-300 | Employee/volunteer uses Internal Android | Sign in to role-appropriate task list and complete applicable registrations, approvals, visits/photo/GPS, attendance, leave, claims, inventory and permitted coordination with current backend state | A-01, A-05, A-10 | CG-300-BR07–11 |
| FR-079 | CG-300 | Center worker uses Portal | Operate authorized own-center profile, doctors, schedules, patient registration, reception, labs, receipts, dues and reports without seeing unrelated center/private records | A-14–A-17 | CG-300-BR14–15; CG-14–17 |
| FR-080 | CG-300 | User completes a form, searches, confirms an action or encounters failure | Show business-language titles/labels, authorized name-based selectors and smart safe defaults; **never request/display technical database IDs or raw exception text**. Across web/Android/center/Admin, provide truthful, human-friendly success, submitted, pending, validation, forbidden, unavailable, conflict, payment-unknown and unexpected-error outcomes with useful next action. Keep only justified business reference numbers visible (member/patient/appointment/invoice/receipt etc.), while backend exception details remain restricted and correlated for support | A-01, A-21 | CG-300-BR12–13,15,21–23; CG-NFR-UI09–12, MSG01–06, LOG01–06 |

### Source-enumerated content and provider categories

These **named categories are part of the current approved-source requirements**. They are not a request for a separate module or automatic transactional checkout.

- **Healthcare directory (nine provider categories):** polyclinic, diagnostic center, dental clinic, medical laboratory, hospital/nursing home, retail pharmacy, orthopedic center, homeopathy center and Ayurvedic center. Each category is discoverable; bookability, current services and benefit eligibility are specific to the verified provider and approved service policy (CG-14-BR20; CG-16-BR08–10).
- **Our Impact (ten CMS groups):** Header, Foundation Pillars, Impact Statistics, Impact Growth Chart, Geographic Reach, Impact by Category, Key Impact Areas, Success Stories, Latest Updates and Call to Action (IMP-01–IMP-10 in CG-BR-300). Each is editable and previewable by authorized CMS staff, with safe publication and evidence/consent controls (CG-18-BR15–17).
- **Admin features are workflow views, not new business owners:** payroll reserve/batches/slips, employee letter templates, geotagged visit detail tabs, CMS hero presentation controls and accounting/report packs all remain within their recorded CG module and share its authoritative data (Admin screenshot references A/B/C/U).

## 6. Cross-cutting business rules

| Rule | Required business invariant | Owner source |
| --- | --- | --- |
| BR-001 | An authenticated person may have multiple member, volunteer, staff or patient relationships; each relationship remains protected and explicit | BR-X01, CG-01/04/10/15 |
| BR-002 | Roles require an action **and** permitted entity/area/center scope; hiding a button alone never grants or denies backend access | BR-X01, CG-01 |
| BR-003 | Each application has one authoritative, immutable approval history and decision tied to its exact submitted owner revision; returned/corrected/resubmitted content must not inherit authorization from an older revision. Only the designated final authority may approve; one verified final decision causes at most one actual owner-domain effect, with pending-owner status until confirmed | BR-X02–04, CG-03; D-05 |
| BR-004 | Approved Foundation branch code, member ID, employee ID, provider code, patient virtual ID, booking ID and financial receipt references are distinct, appropriately authorized business identifiers; branch code is not allocated or displayed as active before verified CG-03 final approval and CG-02 activation | CG-02/04/09/10/14/15 |
| BR-005 | Draft, verified, approved, active and published are separate statuses; a private operational record does not become a public listing automatically | BR-X06, CG-18 |
| BR-006 | Finance recognizes verified money events, not merely a donation link, gateway initiated state, promise, queued salary or uncollected healthcare due | BR-X04–05, CG-07/08/09/11/17 |
| BR-007 | Every approved payment, refund, voucher, payroll, stock issue, point redemption or appointment confirmation has one consequential effect across retries | CG-09/11/12/13/15/17; CG-NFR-DAT02–05 |
| BR-008 | Foundation contribution and patient paid amount are **separate monetary concepts**; changing a policy must not rewrite a previously accepted receipt or booking price | BR-X05, CG-15/17 |
| BR-009 | One verified professional can practice at multiple verified centers, but booked slot, consultation fee and location are specific to that doctor-center offering | CG-14/15 |
| BR-010 | Center-first and time-first appointment paths use **one doctor-aware schedule and center capacity**; conflicting in-person appointments at two centers cannot both be confirmed; any automatic center assignment is shown and accepted before payment | CG-15, D-02 |
| BR-011 | Patient reports, diagnoses, uploaded identity and confidential employment/finance data are not exposed by public search, QR lookup, CMS or unrelated staff roles | BR-X07–08, CG-14–19 |
| BR-012 | Reports and public Impact cards derive from owners or explicitly approved editorial sources; neither is a shadow transaction ledger | BR-X10, CG-18/20 |
| BR-013 | Provider suspension prevents ineligible new bookings; existing booking handling follows an approved visible correction and communication policy | CG-14/15 |
| BR-014 | A failed message, map or external payment/provider service cannot silently change a successful core business decision or claim success for an unconfirmed one | CG-19/21; CG-NFR-REL01–07 |
| BR-015 | A permissioned workflow must expose necessary **authorized** linked-selector options even if the user lacks separate management rights over that linked module | CG-01-BR07; CG-300-BR23 |
| BR-016 | Correction, cancellation, return, rejection, refund and reversal preserve source and reviewer/actor history rather than silently deleting finalized evidence | BR-X12; CG-03/09/15/17 |
| BR-017 | Implementation identifiers are internal by default; users work with understandable names/searchable selections and automatically generated references. Only necessary **business-facing numbers** (membership, patient, booking, employee, invoice, receipt, support reference) are shown with clear labels. No raw API/SQL/stack/provider errors are exposed in UI, API responses, PDFs or notifications; secure diagnostic logs remain correlated and redacted | Owner instruction 14 Nov 2026; CG-NFR-UI09–12, MSG01–06, LOG01–06 |

## 7. End-to-end acceptance families

Each family defines a product acceptance *outcome* with representative normal and negative/alternative conditions. Planning and QA will later derive detailed manual scenarios; these are **not** developer tasks.

| Acceptance ref | Representative user journey and observable positive result | Required negative/exception evidence |
| --- | --- | --- |
| A-01 Identity & access | Create/assign role → authorized staff logs in → sees/uses correct branch/center and selectors | Other branch/center, unauthorized action/export, role revocation, expired session, hidden-selector dependency denied appropriately |
| A-02 Organization | Save/edit Foundation profile and real area/department/committee records without a branch; seven-step Web/Internal Android branch draft → genuine file verification → revision-bound CG-03 review → Super Admin final approval → idempotent CG-02 activation and unique branch code; later-owned staff/project/budget links are optional until delivered | Missing documents; returned/corrected or rejected registration; stale prior-revision approval; simultaneous finalization; invalid hierarchy/scope; no automatic publication |
| A-03 Shared approvals | Application/reference → reviewer checks individual files → forwards/returns/approves → valid final owner outcome | Stale/revoked reviewer, duplicate decision, rejected docs, scope mismatch, intermediate approval cannot activate |
| A-04 Membership & volunteers | Public application → valid tier/fees or volunteer preferences → approval → roster/ID/doc and assignment | Unpaid/pending, failed/duplicate payment, rejected/expired app, unauthorized document exposure |
| A-05 Projects & visits | Create project/task → authorized staff submits visit GPS/photo evidence → review → status and project report | Wrong geography, missing evidence, duplicate visit/expense, interrupted mobile upload |
| A-06 Beneficiary aid | Register beneficiary → project aid approved → stock/finance effect and private assistance history | Repeated issue, insufficient stock, duplicate recipient history confusion, unauthorized public identity |
| A-07 Donations & campaigns | Draft campaign → approval/publication → donor payment verified → receipt and financial/project reporting | Gateway pending/failure/replay, refund, manual payment link not mistaken for paid |
| A-08 CSR funding | Partner verifies → agreement/proposal → approved share/received funds → allocation and budget reporting | Unapproved pledge, returned agreement, overlapping allocations, financial mismatch |
| A-09 Accounting | Approved claim/voucher/invoice/budget → authorized posting and balanced ledger/trial balance → report/export | Duplicate/replayed action, wrong branch/payee, forbidden export, invalid financial entry, reversed payment |
| A-10 HR | Employee staged approval → ID/access → attendance/leave/transfer/exit and approved document records | Unapproved bank/salary change, privacy breach, stale permission, lost clearance |
| A-11 Payroll | Setup → run attendance calculation → verify/approve → payment/ledger/payslip → audit/history | Repeated run/payment, invalid allowance, blocked employee, unauthorized payslip |
| A-12 Inventory | Request → approve → issue/receive → current stock/distribution history | Concurrent last-stock issue, unapproved adjustment, double fulfillment |
| A-13 Referrals/rewards | Valid approved referral → points/rank → redemption/fulfillment → stock/history | Referral not yet qualified, double points, duplicate redemption, invalid reversal |
| A-14 Healthcare network | Register center/doctor with proof → approve → link center-specific offerings → publish verified searchable profile | Suspended/unverified center, unauthorized center edits, sample ratings shown as facts |
| A-15 Appointments | Search → center/time choose → verified patient → book → authentic slip/QR → scoped reception/queue | Last-slot race including simultaneous requests at different centers for the same doctor's time, conflicting two booking paths, duplicate patient, public ID guessing, cancellation/refund |
| A-16 Diagnostics | Center prices/packages → internal patient order → sample/processing/report → authorized patient access | Other patient's test/report, unapproved report release, unsupported public checkout CTA |
| A-17 Assistance & settlement | Confirm applicable policy → gross/contribution/patient due → online or pay-at-center → correct settlement/source-ledger state | Gateway callback repeat, pending payment misreported, 100% unauthorized coverage, cross-center settlement exposure |
| A-18 CMS & public | Draft approved page/banner/project/center info → preview → publish → public web/app reflect it | Private/draft content leak, stale public provider/benefit data, unauthorized publishing |
| A-19 Documents & communication | Valid business event → right document/notification recipient and status history; support case tracked | Wrong patient/member, guessed link, failed provider, duplicate notice/secret exposure |
| A-20 Analytics | Scope-filtered project/funding/HR/healthcare reports → valid export/schedule | Confidential export to other scope, mismatched finance totals, hidden source |
| A-21 Platform operation | Admin changes permitted policy → scoped audit record → controlled recovery/diagnostic status | Unauthorized restore, credentials exposed, stale sessions, backend error masked as a success |

**Additional representative user journeys (see CG-BR-000 J-01–J-12):** member join; volunteer join; branch opening; publication and fundraising; beneficiary assistance; visit/expense; CSR; payroll; referral/reward; healthcare provider verification; center-first/slot-first doctor booking; internal diagnostics and Foundation contribution/settlement. These remain **connected use cases**, not separate duplicate systems.

## 8. Business states and lifecycle constraints

- **Applications:** Draft → Submitted at an immutable source revision → Document Verification / Review → Returned / Rejected / Forwarded → Final Approved for that specific revision → Owner Record Activated or Issued. Corrections/resubmission create a new submitted revision and cannot reuse a previous final decision; CG-03 records the decision and the source owner separately confirms the real business effect. Exact step chains vary by approved process.
- **Projects and campaigns:** Draft/Planned → Submitted where applicable → Approved → Active/Published as separate axes → On-hold/Completed/Cancelled/Unpublished. Public visibility never makes finance approved.
- **Donations and payments:** Initiated/Link Created → Awaiting Provider Verification → Confirmed Received / Failed / Expired → Refund or Adjustment where authorized. A receipt states the verified collected amount.
- **Fund and budget:** Proposal / Commitment → Authorized Approval → Received → Allocated → Utilized / Released, each distinct from available remaining budget.
- **Payroll:** Configured → Draft Run → Calculated → Reviewed → Approved → Payment Pending/Released/Failed → Payslip Issued; the payslip is not the payment record.
- **Healthcare provider:** Submitted → Verification → Approved and Active/Published (independent flags) → Suspended/Deactivated with protected history.
- **Doctor slot:** Published Availability → Temporarily Held where applicable → Confirmed or Released/Blocked. Held/confirmed semantics and cancellation fairness belong in design after business policy approval; must not overbook.
- **Appointment:** Draft Selection → Patient Verified → Booking Confirmed or Failed/Expired → Checked In/Consulting/Completed or Rescheduled/Cancelled/No-show. Booking state and payment state are independent.
- **Healthcare assistance and settlement:** Eligibility Requested/Assessed → Authorized Support → Patient Due/Collected → Provider Due/Settlement Pending → Settled/Adjusted/Refunded; source monetary history preserved.
- **CMS:** Draft → Submitted for Review when required → Approved → Scheduled/Published → Unpublished/Archived; an unpublished page is not discoverable through a different public URL.

State labels may be simplified for end users; PRD acceptance requires their **business meaning**. HLD/DLD will formalize exact transitions without inventing additional approvals.

## 9. Cross-channel business coverage

| Business capability | Foundation Admin Web | Public Website | Center Portal | Public Android | Internal Android | Shared backend outcome |
| --- | --- | --- | --- | --- | --- | --- |
| Governance/accounts/approvals | Configure/manage | Own login/application/status | Own authorized staff/settings | Own verified access | Permitted review/assignment | One authorization and approval state |
| Foundation structure/branches/departments (CG-02) | Manage Foundation profile, geography, department/committee records, branch directory and seven-stage registration | Only expressly published Foundation material | Not a healthcare center/branch administration portal | No branch Admin capability | Permitted branch-manager seven-stage draft/evidence/submission/status; no geography master editor | One CG-02 source, revision-bound CG-03 approval and protected CG-19 documents; no future-owned staffing records required |
| Foundation membership, volunteering, campaigns | Configure/review/report | Join, volunteer, donate, self-service | Not applicable unless authorized | Public journeys, receipts, rewards | Assigned field/approval actions | One member/volunteer/donor/master |
| Project/beneficiary/field work | Manage/approve/report | Approved content/impact | Only linked approved collaboration | Published information | Task/GPS/photo/aid/expense | One project/visit/aid/source |
| Finance/CSR/payroll/inventory | Full authorized operations | Own donation/fee receipts only | Restricted own collections/dues | Only personal eligible payment/receipts | Role-approved claims/stock/selected approvals | One finance, inventory and payroll owner |
| Provider/doctor/diagnostics | Network setup/approval/report | Verified listing/booking | Own providers, scheduling, internal lab/report | Discovery, patient booking and results as authorized | Only explicitly approved coordination | One professional, slot, patient, order |
| Healthcare assistance, payments, settlement | Policy and network oversight | Accurate gross/contribution/due and payment | Own collections/dues/settlement view | Accurate booked/paid/due receipts | Only assigned processing | One payment/support/ledger trail |
| CMS, communications and reporting | Editorial Admin, audits, reports | Published content, permitted support | Scoped content submission and help | Published updates/notifications | Assigned notifications/reporting | One publication and messaging history |

**Adopted mobile policy D-17:** Foundation Web Admin owns complex settings/CMS/payroll/finance; responsive Center Portal handles center operations; Public Android mirrors approved public service/self-service journeys; Internal Android supports permissioned field/leave/attendance/claims/stock/approval work. Do not replicate the entire Admin suite on mobile.

## 10. Product-level non-functional acceptance

**All applicable P0 CG-BR-600 controls are mandatory**; HLD and DLD allocate the actual methods. Numeric values below are **proposed service targets**, not client-confirmed contracts. Do not substitute a benchmark on empty data or a mock endpoint for realistic evidence.

| Quality gate | Minimum product outcome and evidence | Source |
| --- | --- | --- |
| N-01 Authorization / clinical privacy | No unrelated geography/branch/center/patient/employee/finance read, write, linked-selector or export access; independent negative tests on all relevant interfaces | CG-NFR-SEC01–04,09–12 |
| N-02 Payment and financial integrity | One verified business money effect, correct gross/support/patient split, balanced accounting and accurate pending/failed/refund state after replay/timeout | CG-NFR-DAT01–03,06–10 |
| N-03 Booking integrity | Capacity never exceeded by simultaneous website/Android/reception requests, including conflicting in-person appointments for the same doctor at different centers; no stale center/fee | CG-NFR-DAT04–05 |
| N-04 Reliable state and recovery | Network/provider interruption creates an honest pending/unknown/failure state; no lost approved action; protected backup restore tested before go-live | CG-NFR-REL01–02,04–08 |
| N-05 Security and confidential records | Secure sessions, privileged MFA support, restricted medical/identity/bank uploads, minimal public verification, abuse throttling and secure integration credentials | CG-NFR-SEC04–11, INT01–03 |
| N-06 Performance/scale (proposed P1) | Common API p95 ≤1s, scoped search p95 ≤1.5s, initial 100-user representative scenario; agree actual load before target is binding | CG-NFR-PER01–02,05–07 |
| N-07 Public web performance (proposed P1) | Field web vitals LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at defined representative percentile/conditions | CG-NFR-PER03 |
| N-08 Availability/recovery (proposed P1) | Monthly 99.9% availability; critical data recovery RPO ≤1 hour/RTO ≤4 hours only if confirmed feasible in hosting/SLA | CG-NFR-REL03–05 |
| N-09 Accessibility and mobile usability | Task-first UI, **no unnecessary technical IDs**, safe defaults/prefill, name-based linked selectors, plain-language labels, accurate positive/negative messages, readable PDFs and appropriate Indian localization; aim WCAG 2.2 AA for web | CG-NFR-UX01–08, UI09–12, MSG01–06, MOB01–04 |
| N-10 Public publishing and SEO | Approved public pages indexable/discoverable; private patient/account/admin/receipt URLs not publicly indexed; no fake stats, prices or ratings | CG-NFR-WEB01–05 |
| N-11 Audit, support and maintenance | Trace actor/time/scope/records without secrets; central exception handling, correlated secure technical logs with redaction and severity, support reference lookup, bounded log volume, monitoring/alerts and safe migrations | CG-NFR-OPS01–06, LOG01–06, MNT01–06 |
| N-12 Manual QA acceptance | For each owner scenario, validate user-friendly success/pending/error states, no raw IDs/technical messages, authorized business references and secure correlated developer diagnostics, plus UI → backend → persistence → channels, negative/retry/concurrency and honest evidence | CG-BR-600 §§8A,13; CG-NFR-UI09–12, MSG01–06, LOG01–06 |
| **N-13 Mandatory existing-theme and motion parity** | For each UI-bearing owner module, map relevant original screenshot IDs and approved shared theme tokens; preserve current CareGanga colors/typography/icons/spacing/forms/cards/drawers/navigation/status styling and evidence-supported animation/easing/feedback, across applicable Web/Android/public/center surfaces. No unauthorized visual redesign. Module user stories include visual/interaction acceptance and actual QA comparison against original PNG/video; without original assets or rendering, mark exact parity **NOT_VERIFIED**, not PASS. Account for responsive/native and reduced-motion adaptations without theme drift. | CG-REF-ADMIN-001 A01–A19, B01–B51, C01–C55, U01–U42; CG-NFR-UX01–08, UI09–12, MOB01–04 |

English is the initial product language. Performance/availability/load figures are proposed until measured against realistic hosting and workload. Consent, provider credentials, genuine merchant ownership and statutory evidence must be verified before live operation, without adding an unrelated questionnaire or offline-sync engine.

## 11. Dependencies, adopted policies and operational gates

**Dependencies:** CG-01/02 identify actors and scope; CG-03 controls approvals; CG-09 owns accounting; CG-19 owns documents/notifications; CG-21 owns audit/configuration. CG-04/05/10/12/14 hold business masters. CG-06/07/08/11/13/15/16/17 reuse those services. CG-18 publishes owner-approved content; CG-20 reports real owner records. Channel experiences should be designed alongside their business domain rather than invented independently.

**Forward-owner independence:** A planned module must produce a real, independently verifiable business result from its own records and already-delivered owner contracts. The first bootstrap and CG-01 may establish shared primitives; later modules must not rely on records available only in a future module. Reorder an essential prerequisite or assign the genuine cross-owner integration and QA to the later introducing owner; do not use placeholder masters, mock payments or fake published metrics. Preserve all source requirements for eventual end-to-end verification.

**Mandatory module-level delivery gate:** Every UI-bearing module must identify its exact applicable screenshot references and channel differences in `module.md`, decide `uiux_decision: REQUIRED` for a new/changed journey or `EXISTING` with a verified existing product file for an unchanged approved pattern, and put theme/motion consistency and interaction states into that module's **single `tasks.md` QA acceptance**. No redundant standalone UI tracker or design system document. Non-UI modules may justify `NOT_REQUIRED` but still comply with message/privacy contracts. The one shared frontend token/motion implementation is established in technical bootstrap and reused—not reconstructed independently by 21 modules. Full visual fidelity requires comparing actual rendered screens to source images/video in authorized QA; source-only review is not visual verification.

**All 24 D-decisions have delegated default answers.** The authoritative compact register is [CG-BR-900](../../../docs/business-requirements/04-TRACEABILITY-DECISIONS.md). The following initial-launch rules affect the product most:

| Policy area | Adopted business behaviour |
| --- | --- |
| Public healthcare | Doctor consultation booking online; additional center/lab/pharmacy/nursing/OT directory information and enquiry; center staff can record internal test orders and reports |
| Doctor scheduling | Both center-first and date/time-first paths use one center-specific capacity. When multiple centers fit, present a choice and require the patient to see the center before confirmation |
| Consultation support | Foundation verifies eligibility; standard eligible case is 50% support/50% patient; exceptional full support requires protected explicit approval. Mockup percentages are not active offers |
| Patient collection | Healthcare center collects the patient payable directly via verified own online merchant or at the center. If no verified online account exists, only pay-at-center may be offered where available |
| Foundation settlement | Approved contribution is a separate Foundation obligation; reconcile against eligible completed service and settle approved provider dues monthly, with audit and authorizations |
| Approvals and access | Routine work to authorized managers; protected branch/provider/doctor, policy, payroll-payment and privileged role decisions to Super Admin; patient and center medical access are restricted |
| Self-service scope | Public patient ID, own booking/receipts and authorized reports included; no unapproved family-booking or electronic prescription workflow, fake rating count or unrelated health-record access |
| Foundation, Android and CMS | Public web/app show approved Foundation content and doctor booking; Internal Android handles assigned work; complex settings in Foundation Admin; centers operate from own responsive Portal |
| Membership and finance | Rejected paid membership application receives an authorized full joining-fee refund; all other received money, commitments, expenses, contributions and payments remain separately classified and reconciled |

**Other adopted defaults:** verified-only review badges, Foundation branches private by default, role/area default-deny, INR and April–March accounting period, online-first field work, auditable referral points/fulfilment, source-backed Impact statistics, configured/consented messaging, restricted cross-person health linking, lightweight committee/performance management, authorized lab-report release, and Foundation-only backup/restore.

**Prerequisites before enabling real operations:** verify actual center/merchant/bank account details, authorized provider/doctor credentials, clinical consent and professional sign-off, statutory/tax/80G data, chosen payment/messaging vendors and hosting/resilience feasibility. This is a launch checklist, **not** a new open product questionnaire. P0 privacy, finance correctness, concurrency and security remain unconditional.

## 12. Acceptance, quality review and sign-off state

**Product-level completeness criteria:**

1. All 21 owner modules in CG-BR-000 map to stable FR rows, at least one acceptance family and applicable quality gates; no independent copy of source records is authorized.
2. Every original client Foundation requirement section and all 75 healthcare feature IDs remain traceable through the authoritative CG-BR package; Admin UI reference includes 167 captured images.
3. Public/center/Admin/Android flows have coherent actor and source-data ownership, including negative authorization and monetary/clinical privacy cases; each UI-bearing module preserves the exact verified existing CareGanga brand/component/motion baseline with screenshot-ID traceability (N-13), subject to documented accessibility/native adaptation.
4. No proposed numerical NFR is falsely represented as an approved SLA; no screenshot is presented as evidence of implemented functionality.
5. All 24 prior business-policy questions are answered in the delegated CG-BR-900 baseline; operational go-live prerequisites are separate from product-scope decisions.
6. No architecture, API/schema, component/wireframe, epic/story/task or implementation claim has been inserted into this product PRD.

**Draft and approval versioning:** The earlier version 1.0 owner-delegated approval remains preserved only for its historical file hash/commit. This file is the current **1.1 re-review draft** at the same canonical path; when the current content receives a valid exact-hash delegated decision and required resolver verification, version 1.1 becomes the approved baseline. Subsequent material changes increment the version in this same location (e.g., 1.2), preserve the prior approved commit/hash, reopen impacted approvals and re-review dependent module/task definitions. Execution progress alone does not change approved task definitions.

**Authoring review:** Product-owner/BA self-review against all CG module owners, 278 source BR clauses, 75 healthcare feature IDs, the 167-image Admin index, key cross-module journeys and CG-BR-600 NFR outcomes; independent specialist review has **not** been performed. The default business policies have been adopted under the owner's delegated instruction and reviewed for source alignment. **Formal Harness approval remains unrecorded pending valid artifact SHA-256 review and resolver preflight.** The currently pinned Harness permits the owner's expressly opted-in, accurately attributed **DELEGATED_APPROVED** design decision (as configured in `initiative.json`) or genuinely verified human approval. Neither is client business sign-off or authorization for production release/merge. Corrective edits invalidate stale review evidence; never label the AI delegate as a human approver.

**Next Harness stage:** Run the pinned HLD resolver for this same initiative only after a truthful SHA-256-bound PRD **human or owner-delegated design approval** and final review record is present and validated. A chat instruction alone is not a resolver PASS. Module-level UIUX/DLD decisions, dependency-ready user stories/tasks and independent QA belong to Planning/Development/QA, not to a second product PRD.

**Repository delivery guardrails:** Work remains on the PRD feature branch pending separate merge authorization. **No CI, GitHub Actions, .github/workflows, application code, deployment, real payments or production data mutation.**

## 13. Complete BR-to-PRD ownership crosswalk

The product PRD groups detailed business clauses into observable journeys. **Every clause in each range below remains normative**, even when its per-field detail is not repeated in this PRD. The owner BR and screenshot/source evidence supply those details to later module Planning and QA. Counts from the consolidated BR: **278 individually identified CG-BR clauses**, mapped through 80 FR requirements, 21 owner domains plus CG-300 channel rules, and 21 acceptance families.

| Existing business owner | Source BR clauses retained | Product FRs | Acceptance |
| --- | --- | --- | --- |
| CG-01 Identity & RBAC | CG-01-BR01–11 | FR-001–003 | A-01 |
| CG-02 Foundation structure | CG-02-BR01–10 | FR-004–005 | A-02 |
| CG-03 Applications & approvals | CG-03-BR01–09 | FR-006–008 | A-03 |
| CG-04 Member & volunteer | CG-04-BR01–11 | FR-009–011 | A-04 |
| CG-05 Projects, visits, events | CG-05-BR01–11 | FR-012–014 | A-05 |
| CG-06 Beneficiary services | CG-06-BR01–05 | FR-015–016 | A-06 |
| CG-07 Campaigns & donations | CG-07-BR01–09 | FR-017–019 | A-07 |
| CG-08 CSR & fund commitments | CG-08-BR01–08 | FR-020–022 | A-08 |
| CG-09 Accounting & budget | CG-09-BR01–17 | FR-023–028 | A-09 |
| CG-10 Employee, attendance & lifecycle | CG-10-BR01–15 | FR-029–033 | A-10 |
| CG-11 Payroll | CG-11-BR01–11 | FR-034–036 | A-11 |
| CG-12 Stock & material requests | CG-12-BR01–06 | FR-037–038 | A-12 |
| CG-13 Referral points & rewards | CG-13-BR01–08 | FR-039–041 | A-13 |
| CG-14 Provider & professional network | CG-14-BR01–20 | FR-042–046 | A-14 |
| CG-15 Patient, appointments & queue | CG-15-BR01–25 | FR-047–054 | A-15 |
| CG-16 Diagnostics/test operations | CG-16-BR01–10 | FR-055–058 | A-16 |
| CG-17 Assistance, billing & settlement | CG-17-BR01–20 | FR-059–065 | A-17 |
| CG-18 CMS and publication | CG-18-BR01–28 | FR-066–069 | A-18 |
| CG-19 Communication and documents | CG-19-BR01–09 | FR-070–072 | A-19 |
| CG-20 Reports, MIS and dashboards | CG-20-BR01–07 | FR-073–074 | A-20 |
| CG-21 Platform operations & audit | CG-21-BR01–06 | FR-075–076 | A-21 |
| CG-300 Cross-channel/web/Android | CG-300-BR01–23 | FR-077–080 and associated owner FRs | A-01–A-21 |

**Quality crosswalk:** CG-NFR-600 supplies 85 shared non-functional IDs (including 16 user-language, error-boundary and diagnostic safeguards), with applicability and P0/P1 distinctions specified in §10 of this PRD. Every later module contract must select only the relevant NFR IDs and give evidence, including negative authorization, idempotency, concurrency, mobile/web/backend consistency and safe recovery. The crosswalk is a **coverage control**, not a substitute for the owner BR or a separate set of requirements.

**Review result:** Source-to-owner and cross-module coherence reviewed, business defaults incorporated, no unapproved separate service scope or new module introduced. `initiative.json` records the permitted owner delegation; `approvals.json` is the only machine-readable source of a current design decision. This document by itself does **not** assert Harness resolver PASS, human/client sign-off or production authorization.
