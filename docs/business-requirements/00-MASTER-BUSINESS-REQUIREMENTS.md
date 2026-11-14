# CareGanga Foundation — Master Business Requirements (BR)

**Document ID:** CG-BR-000  
**Version:** 1.0 (consolidated baseline for PRD elaboration)  
**Date:** 14 November 2026  
**Status:** Internal business-analysis draft — not yet client-signed  
**Prepared by:** JASIQ Labs  
**Repository/branch:** \`jasiqlabs/careganga\` · \`feature/careganga-master-business-requirements-20261114\`

## 1. Purpose and document hierarchy

This is the **single master business-requirements baseline** for the integrated CareGanga Foundation platform. It consolidates the client's final functional-requirements document, the prior Foundation workflow walkthrough, and the additional healthcare UI references. It is organized by **business capability and ownership**, not by existing sidebar, screenshot, or proposed screen count. Modules and requirement IDs are intended to become independently reviewable PRDs under the JASIQ Harness planning workflow.

The following are companion parts of this *one BR package*:

| Document | Scope |
| --- | --- |
| **CG-BR-000 (this document)** | Overall vision, module register, ownership boundaries, governing requirements, process map, acceptance, PRD decomposition |
| [CG-BR-100 — Foundation and Operations](01-FOUNDATION-OPERATIONS-BR.md) | Organization, people, membership, projects, CSR, finance, HR/payroll, inventory, rewards, governance |
| [CG-BR-200 — Integrated Healthcare](02-INTEGRATED-HEALTHCARE-BR.md) | Provider network, doctor/center model, patient, booking, diagnostics, contributions, payments, center operations |
| [CG-BR-300 — Experience, CMS and Channels](03-CMS-CHANNELS-BR.md) | Public website, CMS, Foundation Admin, center portal, Android apps, publication ownership and reusable user journeys |
| [CG-BR-900 — Traceability and Decisions](04-TRACEABILITY-DECISIONS.md) | Source-to-module mapping, ambiguities, open decisions, PRD handoff and scope guardrails |

**Authoritative client scope:** \`SAM-CAREGANGA-121126-113332.pdf\` (61 pages, section numbers as supplied), the healthcare screens supplied in November 2026, and the CareGanga client meeting of 19 October 2026 (transcript: \`Project discussion with CareGanga foundation (1).docx\`). The meeting helps interpret workflows; the consolidated written requirements and the latest UI references govern current scope. Original earlier admin-screen recordings are not presently accessible for a new screen-level inspection; do **not** mark their detailed coverage as verified.

**Scope principle:** Healthcare Assistance is an **intrinsic business domain of the whole CareGanga platform**. It uses the same Foundation-wide configuration, access controls, payment/accounting, communication, document and reporting capabilities, with appropriate restrictions for clinical information. Do not model it as an externally bolted-on system.

## 2. Business vision and goals

CareGanga Foundation needs a digital operating platform enabling centralized Foundation governance with delegated operation across geographic branches and healthcare partner centers. Authorized workers should manage activities from web and Android; public beneficiaries, members, volunteers, donors and patients should discover services and complete permitted self-service workflows.

**Business outcomes (BO):**

- **BO-01 Centralized governance:** Foundation leadership can see work and approvals across organization, finance, projects, HR, partners and healthcare in one management environment.
- **BO-02 Distributed responsibility:** Permissioned state/district/block/branch and healthcare-center staff can work only within assigned roles and records.
- **BO-03 Public services:** Citizens can explore published information, join, volunteer, donate, access rewards, discover healthcare, and book eligible doctor appointments.
- **BO-04 Traceable decisions:** Registrations, verification, approvals, disbursements, financial transactions and published content have accountable statuses and histories.
- **BO-05 Financial integrity:** Donations, membership fees, CSR funds, expenses, payroll and healthcare patient/Foundation contributions can be reconciled and reported without duplicate transactions.
- **BO-06 Operational evidence:** Projects, beneficiaries, field visits, inventories, healthcare services and employee work have verifiable records and supporting documents.
- **BO-07 Admin-managed content:** Public content and applicable operational display rules are controlled by authorized users, not duplicated or hardcoded in public channels.
- **BO-08 Reuse:** Common identity, roles, approvals, records, payments, receipts, notifications, reporting and media services are defined **once** and used in multiple business modules.

## 3. Delivered interfaces and audiences

| Interface | Primary users | Intended responsibilities |
| --- | --- | --- |
| **Public website** | Visitors, donors, applicants, members, volunteers, patients | Public content, discovery, campaign donations, member/volunteer application, eligible healthcare booking, login and personalized self-service |
| **Foundation Web Admin** | Super Admin, authorized administrators, coordinators, HR, finance, project and healthcare supervisors | Central governance, all permitted configuration, business operations, approvals, accounting, CMS, analytics |
| **Healthcare Center Portal** | Center administrators, reception/booking staff, doctors and diagnostic staff where authorized | Own-center and authorized-branch doctors, schedules, patients, bookings, tests, collections, due amounts and reports |
| **Public Android app** | Visitors, members, volunteers, donors, patients | Approved public and account-specific workflows matching the business capability of the public site |
| **Internal Android app** | Employees, coordinators, operational volunteers, managers | Assigned operational tasks, approvals, field visits, attendance, claims, selected admin and reporting workflows as granted |
| **Central backend and database** | All authorized channels | Shared source of truth, validations, authorization, policy, workflows, payment records, documents, notifications, audit and reporting |

A role's access **must be checked on backend operations**, not inferred from which screens are displayed. The Center Portal is a separate authorized interface, **not** a separate business database.

**Role families:** Super Admin; delegated Foundation administrators; state/district/sub-division/block coordinators; branch/department/project staff; finance/HR/payroll officers; members/volunteers; CSR partner representatives if approved for access; healthcare network administrators; center staff; public applicants, donors and patients. A person can have more than one eligible relationship, without creating contradictory copies of their contact identity.

## 4. Single-owner modular business register

The module register is the proposed **PRD boundary**. A dashboard, configuration page, approval queue or mobile screen is *not automatically a second business module*.

| ID | Business module | Exclusive responsibility | Primary dependents |
| --- | --- | --- | --- |
| **CG-01** | Identity, Accounts & Authorization | Authentication, accounts, roles, permissions, geographic/center access | Every restricted module |
| **CG-02** | Foundation Structure & Governance | Foundation profile, branch hierarchy, departments, committees, governance masters | HR, projects, reports, CMS |
| **CG-03** | Registration, Verification & Approvals | Reusable applications, document checks, approval routing, status and decisions | Member, volunteer, branch, CSR, providers, expenses, payroll |
| **CG-04** | Members, Membership & Volunteers | Member and volunteer records, tiers, fees, ID/certificates, assignments | Public joins, referrals, projects |
| **CG-05** | Projects, Tasks & Field Operations | Projects, tasks, activities/events, geotagged field visits, operational progress | Beneficiaries, budgets, impact |
| **CG-06** | Beneficiaries & Assistance Distribution | Beneficiary records, aid issued, quantities, values and support history | Projects, inventory, impact |
| **CG-07** | Campaigns, Donations & Fundraising | Campaigns, donor transactions, donation receipts, public fundraising | Finance, CMS |
| **CG-08** | CSR Partners, Funding & Fund Allocation | CSR registration, proposals, contributions, shared funding, agreements | Project budgets, finance |
| **CG-09** | Finance, Accounting & Budgets | Chart of accounts, funds, ledgers, cash/bank, vouchers, invoices, claims, budgets, posting | All monetary business events |
| **CG-10** | Human Resources & Employee Lifecycle | Employees, attendance, leave, assignments, performance, letters, exits | Payroll, work assignments |
| **CG-11** | Payroll & Staff Compensation | Salary configurations, payroll runs, deductions, verification, payment batches, slips | HR and finance |
| **CG-12** | Inventory, Material Requests & Vendors | Stock catalog, supplier records, receipt/issue, adjustment, approvals | Projects, assistance distribution |
| **CG-13** | Referrals, Points & Rewards | Referral attribution, qualifying points, ranks, catalog, redemption and fulfilment | Members, volunteers, public app |
| **CG-14** | Healthcare Network & Provider Directory | Center/branch, doctor, specialization, facilities, service catalog and verification | Public discovery, booking, diagnostics |
| **CG-15** | Healthcare Schedules, Patients & Appointments | Center-wise doctor availability, patient identity, bookings, queue, patient documents | Website/app, center portal |
| **CG-16** | Healthcare Diagnostics & Center Services | Test master, pricing, packages, lab orders, samples, reports; non-consultation service operations | Center portal, patient history, finance |
| **CG-17** | Healthcare Assistance, Billing & Settlements | Eligibility, contribution rules, patient/provider amounts, dues, settlement/reconciliation | Booking, lab, finance, providers |
| **CG-18** | CMS, Publication & Public Content | Editorial pages, banners, media, stories, impact, compliance, notices; publication controls | Website and public app |
| **CG-19** | Communications, Documents & Notifications | Templates, files, receipts/ID/letters as shared generation services, messages, delivery history | All applicable modules |
| **CG-20** | MIS, Analytics & Reporting | Reports, exports, dashboards, saved/custom/scheduled reporting over owner data | Leadership and authorized users |
| **CG-21** | Platform Configuration, Audit & Integrations | General controls, integration settings, audit logs, backup/restore administration | All modules |

**Ownership rule:** Each module owns its business state and validation; shared infrastructure serves it without inventing a competing record. A doctor profile may appear on the public site, a center page and a booking receipt, but it is maintained in **CG-14**, not copied into three CMS databases. An approved voucher creates linked accounting entries in **CG-09**; individual source modules do not maintain private general ledgers.

## 5. Cross-module records: define one source of truth

| Entity / concern | System of record | Reused by / boundary |
| --- | --- | --- |
| **Login account and permission grants** | CG-01 | All channels, including center scoping |
| **Foundation branch, department, committee** | CG-02 | HR, projects, finance, reporting; **not automatically public** |
| **Application decision and approval trail** | CG-03 | All application/review workflows; no independent duplicate approval logic |
| **Member or volunteer relationship** | CG-04 | Public account, referrals, assignments; references account identity when available |
| **Employee relationship** | CG-10 | Internal authorization, payroll, tasks; separate from login itself |
| **Beneficiary aid record** | CG-06 | Projects/impact; public shows only suitably approved/aggregated information |
| **Financial posting / cash bank balance** | CG-09 | All transactions, including healthcare and payroll; source document remains linked |
| **Healthcare center and doctor professional profile** | CG-14 | Public directory, center operations, booking |
| **Patient profile, virtual patient ID and appointments** | CG-15 | Center operations, patient portal; stricter medical privacy boundary |
| **Diagnostic service order and report** | CG-16 | Center operations, authorized patient history |
| **Healthcare contribution and settlement obligations** | CG-17 | Invoices, finance postings, provider settlement; distinguish subsidy from patient payment |
| **Published editorial content and publish status** | CG-18 | Public website and mobile displays; references approved business records |
| **Shared file and communication history** | CG-19 | Module-specific documents/events; access follows owner context |
| **Analytic views / MIS outputs** | CG-20 | Read authorized owner data; no independent data-entry copies |

A patient may also be a member or beneficiary; the business system may associate them when consent and policy allow, but must not expose clinical details merely because they share contact information.

## 6. Foundation-wide business rules

- **BR-X01** Each restricted operation is governed by role **and record scope** (organization, geography, Foundation branch or healthcare center as applicable). Authorized configuration and self-service must not grant wider data access.
- **BR-X02** The Super Admin has protected organization-wide oversight. Multi-level approval routes and which final actions need Super Admin approval are **configurable by business process**, reflecting the client's central final-approval expectation without hardcoding the same chain for every event.
- **BR-X03** Application/transaction statuses must be visible to the submitter or authorized reviewer, with reviewer identity, decision, remarks and timestamps.
- **BR-X04** Successful approval, payment and finalization must generate the right business outcome once only: member ID, provider approval, receipt, payable, ledger posting, points or reward redemption as applicable.
- **BR-X05** Financial records must distinguish **gross charge / entitlement / Foundation-funded amount / customer or patient liability / collected / unsettled / refunded**. Contribution is not the same as incoming payment.
- **BR-X06** Published information has an explicit **draft / pending review where applicable / approved / published / unpublished** lifecycle; internal existence does not make a record public.
- **BR-X07** Public account data, employee files, donor details, beneficiary records and clinical records have different visibility needs. Public browsing must never reveal restricted records.
- **BR-X08** Every uploaded document, generated artifact and notification must stay linked to its actual subject/source record and authorized users.
- **BR-X09** Operational mobile and web actions work against the same current records and decisions. Platform-specific user interfaces may differ but business results must be consistent.
- **BR-X10** Organization-wide dashboards report scope-filtered, consistent counts and financial totals based on authoritative sources. No manually duplicated statistics unless the requirement explicitly permits editorial values.
- **BR-X11** Forms, currencies, geographic data, statutory/document fields and reports must follow approved India-specific business configurations where required; legal/compliance rules are to be validated during PRD, not invented in BR.
- **BR-X12** Record changes that affect finances, roles, healthcare eligibility, center verification or approvals must have an accessible, appropriately restricted audit trail.
- **BR-X13** Administration should be simple: a single setting should control its intended behaviour across all relevant channels; avoid maintaining separate web/mobile copies.
- **BR-X14** Lists, searches, filters, record detail views, exports and dashboards are **shared interaction patterns**; ownership of business fields and data stays with the respective module.

## 7. Mandatory connected business journeys

These journeys must be traced across interfaces, actors, approvals, data and reporting when PRDs are written.

| Journey | End-to-end outcome | Modules |
| --- | --- | --- |
| **J-01 Join as member** | Public registration → tier/fee and payment → documents → checks → configured approvals → member ID, certificate/ID and profile → reporting | CG-01/03/04/09/19 |
| **J-02 Become volunteer** | Registration → profile/preferences/documents → verification/approval → role-appropriate access/assignment → activity evidence | CG-01/03/04/05 |
| **J-03 Open Foundation branch** | Seven-step draft/setup → supporting documents → checks → approval → unique code → scoped assignments | CG-02/03/01/19 |
| **J-04 Publish a project/campaign** | Create operational record → internal approval as applicable → select publishable fields/content → publish → collect funds or show impact → report | CG-05/07/18/09/20 |
| **J-05 Provide beneficiary assistance** | Identify beneficiary → connect project → record assistance/items/monetary value → authorize → reconcile inventory/finance where appropriate → impact evidence | CG-06/05/12/09 |
| **J-06 Field work and expense reimbursement** | Assign task → capture GPS/photo and evidence → submit expense and proof → approve → voucher/payment → posting → status | CG-05/10/03/09/19 |
| **J-07 CSR-funded initiative** | Register partner → verify → proposal/agreements → approvals → partner/Foundation allocations → project budget and utilization → reports | CG-08/03/05/09/20 |
| **J-08 Payroll** | Employee/salary setup → attendance and leave inputs → run → verify/approve → payment batch → financial record → payslip | CG-10/11/03/09/19 |
| **J-09 Referral to reward** | Referral link → approved qualified join → points → rank evaluation → select reward → redeem → stock/fulfilment → history | CG-04/13/12/19 |
| **J-10 Healthcare provider onboarding** | Register center/doctor → document review → approved profile, locations, schedules, benefit and public visibility → search result | CG-14/03/01/18 |
| **J-11 Doctor appointment** | Find doctor/center → choose center and available slot (or auto-assign center from chosen slot) → patient verification → eligibility and fee → pay now/pay at center → booking ID → QR slip → check-in | CG-14/15/17/09/19 |
| **J-12 Healthcare center service** | Center patient visit → queue/consultation or internal diagnostic order → service/report → collection/dues → authorized patient access → reports | CG-15/16/17/09/20 |
| **J-13 Healthcare subsidy and settlement** | Configure approved contribution rule → eligibility → allocate Foundation portion → collect patient portion → reconcile → pay/settle provider → account/report | CG-17/09/03/20 |
| **J-14 Content publication** | Author/edit/associate owner records → preview → authorized approval → publish/unpublish → sync website and applicable public app | CG-18/owner modules/01/19 |
| **J-15 Shared reporting** | Select permitted source → filters/grouping → dashboard, export or schedule → authorized delivery, recorded history | CG-20/01/19 |

**No duplicated workflow rule:** A payment callback does not independently approve a membership, a patient check-in, and a finance entry. The relevant owner module evaluates its own transition using verified payment state and shared approval/finance services.

## 8. Admin control and publication boundaries

The Foundation Admin is the **governance and operational control plane** for the whole platform. Its controls have four distinct types:

1. **Master data controls:** branch/department masters, membership tiers, doctor specializations, provider types, lab tests, salary components, account heads, inventory items.
2. **Operational controls:** applications, assignments, projects, staffing, bookings, patient queue, payments, distributions, payroll, stock.
3. **Policy controls:** role permissions, approval hierarchy, eligibility, contribution rates/caps, pricing validity, membership fee/duration, referral earning/redeeming, provider verification.
4. **Editorial controls:** page sections, text/images, menus, SEO metadata, banners, stories, publication and public visibility.

**Public source policies:**

- **Never automatically publish:** Foundation staff/branches as internal records, accounting transactions, expense receipts, personnel information, patient medical records, raw beneficiary identities, approval notes.
- **Public only when selected/approved:** Team profiles, program/project details, impact figures/stories, annual reports, Foundation registrations/compliance information, campaigns, CSR partner information, notices.
- **Public from approved operational directory:** Healthcare centers, services/facilities, doctors, center-wise prices, consultation slots and disclosed benefit policies.
- **Self-service private:** One's own applications, membership, volunteer profile, patient bookings, receipts, medical records when authorized, referral points and reward redemption.

The details of each control and channel are in CG-BR-300.

## 9. Healthcare-specific scope boundary

Healthcare is **fully integrated** with Foundation operations, but its patient/clinical data remains permission-separated.

- The approved written baseline provides **public doctor consultation booking**. Other healthcare service information (diagnostics, checkups, camps and provider services) is publicly discoverable, while center-side diagnostic booking, test orders and report processing are operational requirements.
- Healthcare mockups additionally show **Book Lab Test, Order Medicine, Book Nursing/OT**, pharmacy, home delivery and service-percentage banners. These are recorded in **CG-BR-900 as design-to-scope decisions**, rather than automatically extending the first public transactional release.
- **Default consultation illustration:** eligible patient ₹500 / CareGanga ₹500 on a ₹1,000 fee (50% / 50%). Admin-controlled, eligible fixed/percentage support and limits must be possible. Receipt mockups also illustrate a **100% contribution** case; it is an example of potential configurable support, **not** a universal policy.
- Center-specific doctor scheduling, both **manual center choice** and **slot-driven auto center assignment**, should be specified as supported views of the **same** availability inventory. Do not implement competing schedulers.
- Provider settlement, patient payment, discounts and Foundation contribution must remain separate, attributable monetary records.

See CG-BR-200 for all requirements and CG-BR-900 for decisions.

## 10. Non-functional business expectations

These are business-level qualities; implementation specifics and numerical acceptance targets belong in HLD/DLD/NFR planning.

- **Security/privacy:** Authentication, permission and record-scope enforcement for every protected action; tightly restricted medical and payroll data, safe document access, safe verification response from QR codes.
- **Reliability:** No duplicate booking for the same available slot, no duplicate gateway credit or accounting posting, no lost approved state on retry, accurate outstanding balances.
- **Consistency:** Same business outcomes and current data across public site, Foundation Admin, center portal and Android.
- **Auditability:** Traceable actor, decision, document, monetary change, publication change, assistance approval and settlement.
- **Ease of use:** Responsive modern web and straightforward, context-specific Android flows; role-sensitive dashboards; limited navigation clutter; useful validation and actionable error messages.
- **Performance:** Practical search, filtering and multi-center availability at expected operating volume; measurable targets during design.
- **Resilience:** Provider failures, payment retries, interrupted mobile upload, late notifications and recovery operations have known states and safe retry.
- **Accessibility/localization:** User-friendly language, readable forms and responsive interaction; confirm exact additional languages and accessibility acceptance criteria during PRD.
- **Observability and operations:** Business event logs, support diagnostics, backups/restores with controlled access and verifiable restore process.

Do **not** claim statutory compliance or medical accreditation purely because documents or logos are displayed; validation obligations require client confirmation.

## 11. Proposed PRD breakdown and dependency order

The BR preserves whole-project scope. The sequence below is **development dependency order**, not a unilateral reduction in contracted scope or release commitment.

| Wave | PRD set | Why first |
| --- | --- | --- |
| **A. Shared foundations** | CG-01 identity/access; CG-02 structure; CG-03 approvals; CG-19 files/comms primitives; CG-21 audit/config | Common permission, entity and workflow foundations |
| **B. NGO core** | CG-04 people/membership; CG-05 projects/field work; CG-06 beneficiaries; CG-07 campaigns/donations; CG-08 CSR | Operational source records before derived public views |
| **C. Accounting/HR and rewards** | CG-09 finance and budgets; CG-10 HR; CG-11 payroll; CG-12 inventory; CG-13 referrals/rewards | Financial and personnel transactions sharing common controls |
| **D. Integrated healthcare** | CG-14 centers/doctors; CG-15 patients/booking; CG-16 diagnostics; CG-17 assistance/settlements | Provider and pricing masters before reservations and settlement |
| **E. Public experience** | CG-18 CMS; CG-300 website/Android/center portal journeys; CG-20 MIS and analytics | Publish operational records and aggregate reporting once owners exist |

Cross-wave implementation can occur where dependencies are already available. Each PRD must include **actors; use cases; module-owned rules; statuses; required configuration; role/scope; web/public/Android applicability; API/backend consequences; cross-module references; errors and manual QA scenarios**.

## 12. Business acceptance definition

This BR package is ready for client review when:

1. Each contractual requirement or demonstrated client workflow has an owning CG module and traceability entry.
2. Foundation Admin can configure all relevant business policies and public controls described in the source; no CMS or portal maintains shadow master data.
3. The Foundation, healthcare center, public site and two Android audiences have explicit responsibilities and data visibility.
4. Membership, volunteer, branch, donation, CSR, project, expense, voucher, payroll, referral/rewards and healthcare workflows can be traced end to end in PRDs.
5. Medical/private information, finance posting, verification and approval access remain correctly restricted.
6. Unresolved screenshot-versus-written-scope differences are recorded as explicit client decisions, not silently assumed.
7. The BR remains business-focused; technical design, implementation tasks and exact screen acceptance criteria are deferred to subsequent approved PRDs/HLD/DLD.
8. No source file, reference recording or screen is claimed as freshly verified unless it was actually accessible.

## 13. Client decisions required before locking PRDs

See [CG-BR-900](04-TRACEABILITY-DECISIONS.md). The priority decisions are:

- Public booking of lab tests, medicines, nursing/OT vs initial doctor-only online appointment scope.
- How to reconcile center-first vs slot-first booking paths and the exact auto-assignment selection rules.
- Approval hierarchy per process and the precise final Super Admin decision policy.
- Financial flow of Center "pay at center" and whether patient payment is received by Foundation or provider, and settlement/account ownership.
- Scope of 100% Foundation coverage, diagnostics support percentage, eligibility caps and authorization.
- Whether member, patient and beneficiary relationships may be linked and under what explicit consent/verification.
- Extent of public Android healthcare functionality and internal Android heavy back-office actions.
- Public availability and governance of reviews/ratings, prescriptions, family profiles, QR verification, and non-doctor service buttons.
- Publication behaviour for internal Foundation branches vs publicly listed provider centers.

**Document status:** Consolidated internal BR. Do not interpret unresolved items as automatically approved features, omissions or launch-phase changes.
