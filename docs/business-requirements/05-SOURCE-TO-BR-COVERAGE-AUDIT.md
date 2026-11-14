# CG-BR-500 — Independent Source-to-BR Coverage Audit

**Source baseline:** CareGanga Foundation final requirements and provided reference material  
**Review scope:** 61-page client requirements PDF, October Foundation meeting transcript, healthcare UI references, and the supplied 167-image Foundation Admin ZIP.  
**Review method:** Map each client PDF section and healthcare feature to owning CG module; reconcile meeting and screenshot context; link detailed Admin-screen evidence in the separate UI/UX audit.  
**Outcome:** All 75 healthcare feature IDs and the available numbered Foundation requirement sections are mapped; Admin screenshot-specific controls are covered in the current owner BR or flagged for PRD-level implementation detail. This is evidence and traceability, not a separate BR revision.

## 1. Audit status conventions

- **Covered (C):** Explicit in previously created BR.
- **Refined (R):** Originally high level, partially missing or underspecified; a targeted correction is now included in the indicated BR.
- **Decision (D):** Actual scope or business rule cannot be determined from current sources; recorded in [CG-BR-900](04-TRACEABILITY-DECISIONS.md).
- **Visual evidence (V):** The supplied screenshots are inspectable and mapped; actual click-through/API behaviour is unverified.
- **Recommended NFR (N):** Industry-quality proposal, not stated as client requirement; tagged accordingly in CG-BR-600.

**A row marked C/R means coverage as a business requirement, not that code has been implemented or tested.** The source PDF's 49 numbered sections and healthcare features 1–75 are checked below. Section numbers §30–31 do not exist in the supplied numbered list; no additional modules have been invented to fill the gap.

## 2. Main Foundation PDF — section-by-section coverage

| Source section / PDF page | Requirement domain | BR owner | Audit finding / action |
| --- | --- | --- | --- |
| §1 / p1 | Project from scratch, public site, Web Admin, 2 Android apps, shared backend | CG-BR-000 §1–3 | **C**: all platform channels identified, plus healthcare center portal |
| §2 / pp1–3 | Super Admin KPI, workflow dashboard, quick actions, website visibility | CG-20, CG-03, CG-18 | **C** dashboard/approvals/visibility; donor-related counters treated only under current fundraising and healthcare scope |
| §3 / pp3–4 | User directory and advanced employee/account search; staff login creation | CG-01, CG-10 | **R**: added exact filter classes, status counts and first-credential controls |
| §4 / pp4–6 | Dynamic roles, role colors, copy permissions, expandable permission matrix, geographic scopes | CG-01 | **R**: role visual identifiers, matrix expand/collapse and counts made explicit |
| §5 / pp6–7 | Application dashboard, document-by-document verification, approval history and chain | CG-03 | **R**: added average approval time, application type/payment/status filters, recent cases |
| §6 / pp8–9 | Public membership registration/fee, verification, member ID, documents, renewal | CG-04, CG-03, CG-09, CG-19 | **C**; pricing, expiry/refund/renewal edge rules **D-11** |
| §7 / pp9–10 | Volunteer full registration, departments, availability, approvals, activities | CG-04, CG-05 | **R**: exact full-/part-time, weekend and on-call choices; departments preserved |
| §8 / pp10–12 | Branch dashboard, search and seven-step setup, geography, approvals, code | CG-02, CG-03 | **R**: each of seven stages now has source-specific fields; public visibility remains gated |
| §9 / p12 | Departments and committees | CG-02 | **C**, committee-specific detail requires **D-21** |
| §10 / pp12–13 | 80G/PAN/registration/annual/financial/transparency pages | CG-18, CG-09/20 | **C**: distinct editable/publishable public compliance information |
| §11 / pp13–15 | Our Impact **ten** editable sections | CG-18, CG-20 | **C** all ten, including maps/charts/stories; source-derived vs manual figures **D-16** |
| §12 / pp15–16 | Project creation/status, staff/budgets, reporting/search | CG-05/09 | **C** |
| §13 / p16 | Geotagged field visits, photos, staff/project link | CG-05/19 | **C**; field offline/location expectations **D-14 / NDEC-08** |
| §14 / pp16–17 | Beneficiary registration, project and material/financial support | CG-06/05/12/09 | **C**; confidentiality is now a P0 NFR |
| §15 / p17 | Tasks, assignments and activities | CG-05 | **C** |
| §16 / p18 | Campaign configuration, target, progress, public publishing | CG-07/18 | **C** |
| §17 / pp18–19 | Donations, provider payment states, payment links, refund corrections, receipts | CG-07/09/19 | **C**, with idempotency/reconciliation **NFR P0** |
| §18 / pp19–20 | Payment/expense/journal/contra vouchers, items, GST, amounts and trends | CG-09 | **R**: amount in words, ITPA/project reference, totals and source-specific fields explicit |
| §19 / p20–21 | Financial-year Finance Dashboard and financial KPIs | CG-09/20 | **C** |
| §20 / pp21–22 | Accounts, account classifications, opening/current balances, cash/bank | CG-09 | **C** |
| §21 / pp22–23 | Debit/credit ledgers and guided manual posting, searches, audit | CG-09 | **C**, server-side accounting correctness reinforced as NFR |
| §22 / pp23–24 | Multi-stage invoice and receipt, docs, responsible verifier, sharing | CG-09/19 | **R**: explicit full invoice-stage field groups, note/tag and verification assignment |
| §23 / pp24–25 | Expense claims/proof/review/payment state and dashboard | CG-09/03 | **C** |
| §24 / pp25–26 | Project/branch budget create/approval/utilization | CG-09/03 | **C** |
| §25 / p26 | CSR partner applications and verification | CG-08/03 | **C** |
| §26 / pp26–27 | Funding proposals/shared CSR/Foundation allocations | CG-08/09 | **C**, accounting state rule **D-19** |
| §27 / pp27–28 | Membership tier fees, validity, icon/color, benefits, active and public display | CG-04/18 | **C**, application of rules at renewal **D-11** |
| §28 / pp28–29 | Referral codes, qualification, points, rank progression, benefits | CG-13 | **R**: explicit badges/certificates/digital gifts and rank privileges |
| §29 / pp29–30 | Reward catalog/stock/points redemption/fulfillment | CG-13/12 | **C**, fraud/expiry policy **D-15** |
| §32 / pp30–31 | Inventory catalog, requests, receipt/issue/adjustments and vendors | CG-12/03 | **C**, no double issue/negative stock **NFR P0** |
| §33 / pp31–32 | Employee registration, verification, directory, ID and account-role association | CG-10/01/03 | **C** |
| §34 / p32 | Attendance matrix, corrections, shift, breaks, grace and weekly off | CG-10 | **C**, location policy **D-14** |
| §35 / p33 | Employee leave request, HR review and history | CG-10/03 | **C** |
| §36 / p33 | Performance management/dashboard | CG-10 | **C** at source's stated level; exact screen fields **D-21** |
| §37 / pp33–34 | Employee letters, appointment/relieving, memo and ID card | CG-10/19 | **C** |
| §38 / p34 | Transfers, promotions, resignation, employee files | CG-10/03 | **C** |
| §39 / pp34–35 | Allowance claim, purpose/amount/status/finance approval | CG-10/09/03 | **C**, not a second finance engine |
| §40 / pp35–36 | Salary configuration, reserve, verification, batch, deduction and payslip | CG-11/10/09/03 | **C** as one payroll process, no unrelated seven engines |
| §41 / pp36–37 | Notices, communications, SMS/email and message history | CG-19/18 | **C** |
| §42 / pp37–38 | CMS dashboards, banners, team, projects, gallery, blog, contact/support | CG-18/19 | **R**: shared ticket/FAQ owner and controlled publication clarified |
| §43 / pp38–40 | MIS, charts, custom/grouped/pivot reports, export and schedule | CG-20 | **C**, restricted exports/scheduling **NFR P0** |
| §44 / pp40–41 | Settings, audit, integrations, backups and restore | CG-21 | **R**: explicit password/session, 2FA and protected restore controls |
| §45 / p41 | Public Android app audience and services | CG-BR-300 §7 | **C** current integrated public/member/volunteer/healthcare scope |
| §46 / pp41–42 | Internal Android app permission-based operational modules | CG-BR-300 §8 | **C**; exact role-screen matrix **D-17** |
| §47 / pp42–43 | Central backend, docs, gateway, SMS/push/maps, logging, recovery | CG-BR-000, CG-19/21/600 | **R**: explicit measurable NFR and evidence requirements added |
| §48 / pp43–44 | Required end-to-end registration, finance, payroll, CMS and report journeys | CG-BR-000 §7 | **C**, protected cross-channel source-tracing **NFR P0** |
| §49 / p59 | Full source functionality, configurable admin, linked finance, backend authorization | All | **C** with **V** for previous raw screenshot recordings; exact field/case mapping occurs in PRDs |

**Public event coverage:** Source Quick Actions and Public Android include events (pp2/41). CG-05 owns event records and CG-18 owns authorized public display; an additional event-ticketing engine is not inferred.

## 3. Healthcare — public site features 1–21

| Feature / source pages | Actual business capability | BR owner | Audit |
| --- | --- | --- | --- |
| 1 / 45 | Healthcare landing, featured centers/doctors/camps/support | CG-18/14/17 | **C** |
| 2 / 45 | Doctor, diagnostics, checkups, camp service information | CG-14/16/18 | **C**, transactions beyond doctor **D-01** |
| 3 / 45 | Doctor search name/specialty/qualification | CG-14 | **C** |
| 4 / 45 | Search experience, fee, availability; filter apply/reset | CG-14 | **R** explicit apply/reset |
| 5 / 45 | Result photo/credentials/fee/center, list/grid/sort/pagination | CG-14/15 | **R** detailed list controls |
| 6 / 45–46 | Doctor professional detail, registration, reviews if available | CG-14 | **C**, ratings source **D-09** |
| 7 / 46 | Doctor at multiple centers, center-specific fee and schedule | CG-14/15/17 | **C** |
| 8 / 46 | Center search by name/district/block/PIN | CG-14 | **R** exact geographic fields |
| 9 / 46 | Center grid/list/map and directions | CG-14 | **C** |
| 10 / 46 | Center profile, operating/OPD times, facilities, maps | CG-14/18 | **C** |
| 11 / 46 | Doctors available at a center, find/book | CG-14/15 | **C** |
| 12 / 46 | Doctor and preferred center/fee/support selection | CG-15/17 | **C** |
| 13 / 46–47 | Calendar, available and blocked slot/duplicate protection | CG-15/600 | **C** with explicit concurrency P0 |
| 14 / 47 | Patient registration and OTP | CG-15/01 | **C** |
| 15 / 47 | Optional identity/medical-report/photo upload | CG-15/19 | **C** with private-file security P0 |
| 16 / 47 | Booking summary, editable information | CG-15/17 | **C** |
| 17 / 47 | Eligible 50% Foundation/50% patient fee | CG-17 | **C**; exceptions **D-03** |
| 18 / 47 | Online or pay-at-center selection/instructions | CG-17/15 | **C** |
| 19 / 47 | Razorpay and confirmed payment states/receipt | CG-17/09 | **C**; verified idempotency P0 |
| 20 / 48 | Booking ID/QR, email/WhatsApp confirmation | CG-15/19 | **C** |
| 21 / 48 | Secure retrieval, PDF print/share and add-to-calendar | CG-15/19 | **R** explicit calendar export |

## 4. Healthcare — center portal features 22–46

| Feature / source pages | Business function | BR owner | Audit |
| --- | --- | --- | --- |
| 22 / 48 | Center secure login, password recovery, role scoping | CG-01/14 | **C** |
| 23 / 48 | Center dashboard, queue, tests, collections, dues | CG-20/15/17 | **C** |
| 24 / 48 | Provider profile/type/contact/photos/schedules | CG-14 | **C** |
| 25 / 49 | Service/facility/docs/bank/verification | CG-14 | **C** |
| 26 / 49 | Center-initiated doctor registration and credentials | CG-14/03 | **C** |
| 27 / 49 | Doctor directory/status/leave | CG-14/15 | **C** |
| 28 / 49 | Center-wise doctor slot configuration | CG-15 | **C** |
| 29 / 49 | Doctor leave *request approval/rejection*, holiday and blocking | CG-15/03 | **R** clarified leave decision path |
| 30 / 49–50 | Doctor consultation fee/mode/adjustments | CG-14/17 | **C** |
| 31 / 50 | Applicable Foundation test/consultation assistance | CG-17 | **C** |
| 32 / 50 | Patient registration/lookup and duplicate identification | CG-15 | **C** |
| 33 / 50 | Patient consultation, reports and medical history | CG-15/16 | **C**, confidentiality P0 |
| 34 / 50 | Center walk-in/site appointment/status | CG-15 | **C** |
| 35 / 50 | Token/queue/visit/cancel | CG-15 | **C** |
| 36 / 50 | Center internal lab test/package booking | CG-16 | **C** |
| 37 / 51 | Test master, codes, sample, cost, active state | CG-16 | **C** |
| 38 / 51 | Lab-specific price and Foundation discount | CG-16/17 | **C** |
| 39 / 51 | Test package, components, price, validity | CG-16 | **C** |
| 40 / 51 | Sample/process/report upload and release | CG-16 | **C**, report sign-off detail **D-22** |
| 41 / 51 | Center collections, methods, invoices and reconciliation | CG-17/09 | **C** |
| 42 / 51–52 | Part-paid/due, overdue aging and follow-up/refunds | CG-17 | **R** overdue follow-up explicit |
| 43 / 52 | Center support paid/pending and provider settlement | CG-17/09 | **C**, merchant/fund flow **D-04** |
| 44 / 52 | Center reports/export | CG-20 | **C** |
| 45 / 52 | Center staff roles, website content, support tickets, FAQs and settings | CG-01/14/18/19/21 | **R** shared tickets/service requests/FAQ and content submission clarified |
| 46 / 52 | Center access logs, password/session rules, restricted recovery | CG-01/21/600 | **R** two-factor/security baseline added; restore authority **D-25** |

## 5. Healthcare — central Foundation administration features 47–75

| Feature / source pages | Business capability | BR owner | Audit |
| --- | --- | --- | --- |
| 47 / 52–53 | Central healthcare KPI, patients, income/support/dues | CG-20 | **C** |
| 48 / 53 | Register/manage provider centers, ID, geography | CG-14 | **C** |
| 49 / 53 | Parent centers and operating branches | CG-14 | **C** (distinct from Foundation branch) |
| 50 / 53 | Center document/facility verification/approval | CG-14/03 | **C** |
| 51 / 53 | Center admin/staff accounts and access | CG-01/14 | **C** |
| 52 / 53 | Center activate/suspend/deactivate/login/audit | CG-14/01/21 | **C** |
| 53 / 53–54 | Foundation-register doctors and multi-center association | CG-14 | **C** |
| 54 / 54 | Doctor certificates, qualification and ID verification | CG-14/03 | **C** |
| 55 / 54 | Central doctor directory and status | CG-14 | **C** |
| 56 / 54 | Network center-specific schedules/leave/history | CG-15 | **C** |
| 57 / 54 | Doctor fees and follow-up changes/history | CG-14/17 | **C** |
| 58 / 54 | Doctor-specific support, fixed/percent/caps | CG-17 | **C** |
| 59 / 55 | Doctor performance, consultations, revenue, support | CG-20/15/17 | **R** named specific output metrics |
| 60 / 55 | Register/approve diagnostic centers and labs | CG-14/16 | **C** |
| 61 / 55 | Lab investigation master, sample/test parameters | CG-16 | **C** |
| 62 / 55 | Center-specific MRP/final lab cost/discount validity | CG-16/17 | **C** |
| 63 / 55 | Test packages, MRP/final price/validity | CG-16 | **C** |
| 64 / 55–56 | Central orders/samples/reports and lab metrics | CG-16/20 | **C** |
| 65 / 56 | Central patient search and authorized history | CG-15 | **C** |
| 66 / 56 | Network online/offline bookings and visit history | CG-15 | **C** |
| 67 / 56 | Assistance requests, pending/approved/rejected | CG-17/03 | **C** |
| 68 / 56 | Eligible fixed/percent/cap/validity/center policy | CG-17 | **C** |
| 69 / 56 | Center collections, assistance distinct from cash, invoices | CG-17/09 | **C**, source of cash flow **D-04** |
| 70 / 56–57 | Doctor/center/lab settlements/refunds/adjustments | CG-17/09 | **C** |
| 71 / 57 | Central approvals, forward/return, responsible staff | CG-03/14/17 | **C** |
| 72 / 57 | Doctor, lab, bookings, finance/assistance MIS and exports | CG-20 | **C** |
| 73 / 57 | Website/healthcare CMS, scheduling, SEO and menu | CG-18 | **R** explicit scheduled publishing and publication gate |
| 74 / 57 | Healthcare center staff, roles, HR/leave | CG-01/10/14 | **C** shared HR/account governance |
| 75 / 57–58 | Messaging, 2FA, audit, payment integrations, backups | CG-19/21/600 | **R** explicit secure-session/2FA and operational NFR |

## 6. Screenshot-to-BR visual check

**References verified:** 13 unique JPEG files mounted in this session (some images duplicate concepts across the two upload batches). Screen samples carry hypothetical names, amounts, ratings and transaction references. They are **UI/process references, not real production records**.

| Visible reference file(s) | Screen and checked elements | BR outcome |
| --- | --- | --- |
| \`1000016865.jpg\` | Nine healthcare categories, filters, location/PIN, contribution banners, center search | CG-14/16/17/18; non-consultation booking CTAs **D-01**, contribution marketing **D-03** |
| \`1000016901.jpg\` | Filterable partner/verified/foundation network, online booking, sample collection, medicine delivery, 24×7/cashless, map/list/grid | **R** CG-14-BR16 explicitly models visible facility flags, not assumed insurance/delivery systems |
| \`1000016898.jpg\` | Center details, doctor/facility/service tabs, fee table, contact/map, CTAs | CG-14/15/17; non-doctor CTA scope **D-01** |
| \`1000016895.jpg\` | Doctor search by specialty, approved profile, multiple center-wise sessions/fee/slots | CG-14/15/17; **one doctor and many center links** |
| \`1000016868.jpg\` | Preferred center → calendar → time, fee and contribution | CG-15/17 center-first booking |
| \`1000016892.jpg\` | Doctor-first → date/slot → automatic center allocation | CG-15 same slot inventory; auto-selection/tie-break **D-02** |
| \`1000016889.jpg\` | Patient details, OTP/login, address, symptoms, optional report, consent | CG-15/01/19; consent/security **NFR P0** |
| \`1000016886.jpg\` | Booking review, online vs pay-at-center, gross/support/patient due | CG-15/17/09; booking vs paid/due distinct |
| \`1000016883.jpg\` | UPI/card/bank/wallet via Razorpay and pending verification | CG-17/09; confirmed verified callback/idempotency **NFR P0** |
| \`1000016871.jpg\`, \`1000016877.jpg\`, \`1000016880.jpg\` | Paid online two patient/center copies and unpaid cash single copy, QR/barcode, patient virtual ID, 100% illustrative case | CG-15/17/19; exact ID/doc layouts **D-07**, full coverage **D-03** |
| \`1000016874.jpg\` | Patient account, appointment lookup, PDF download/print/share, patient virtual ID, reports/prescriptions/family navigation | CG-15/16/19; protected status/QR, calendar **R**, family/prescription **D-08** |

**Not directly evidenced by these JPEGs:** Full Foundation Admin sidebar, finance ledger screens, HR/payroll screens, inventory screens or Center Portal admin pages; their business coverage above is based on the PDF and transcript, with former admin-video parity still **V**.

## 7. Client meeting transcript reconciliation (19 October 2026)

The transcription is partly noisy, so treat it as **corroborating context**, not field-level proof. Confirmed business intent:

| Approx. timestamp | Client intent | BR treatment |
| --- | --- | --- |
| 03:40–05:20 | Admin controls public projects, campaigns and donations; public donor receives applicable receipt | CG-07/18/19, public site visibility |
| 07:30–10:00 | Custom role permissions and multilevel/final Foundation oversight | CG-01/03, per-process final authorization **D-05** |
| 10:25–13:30 | Public member application with fees, post-approval member ID, certificates/welcome letter and profile/document history | CG-04/03/09/19 |
| 13:59–15:22 | Branch links staff/projects/budgets; **internal branches not automatically visible on website** | CG-02/18, source-publication boundary |
| 17:40–19:11 | Admin-owned NGO content, projects, geotagged field visits, assistance and campaigns | CG-05/06/07/18 |
| 20:00–23:10 | Internal app employee work, GPS/photos, expense proofs and approval/voucher payment | CG-05/09/10/300, failure/retry NFR |
| 23:15–25:10 | Membership tiers, qualifying referrals, inventory, employee and payroll operations | CG-04/12/13/10/11 |
| 27:45–29:30 | Admin-only expense records; limited team info can be published; protected finance approval | CG-18 controlled public pages, CG-09/03 internal |
| 31:25–36:00 | **Two distinct Android apps** (public service app and permissioned internal operations app) | CG-BR-000 and CG-BR-300 |
| 36:10–39:00 | Existing screens included incomplete forms; working functionality and verification more important than just UI polish | All owner PRDs must define real backend behaviour and manual QA, not replica mockups |

**Do not use the noisy transcript to authorize a new feature that is absent from the current integrated Foundation/Healthcare requirements.**

## 8. Final source coverage and interpretation

**Inputs directly available for verification:** the 61-page final requirements PDF; the CareGanga Foundation meeting transcript dated 19 October 2026; the current healthcare UI images; and the Admin Panel screenshot ZIP with **167 distinct PNG screenshots** (A01–A19, B01–B51, C01–C55, U01–U42). The complete screenshot-by-screenshot inventory and exact observed menu/form/action details are in [Admin Panel UI/UX Reference Audit](../research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md).

**Coverage position:** all numbered Foundation sections present in the supplied PDF and **all 75 healthcare features** are mapped above. All 167 Admin PNGs are individually indexed in the reference audit. The 26 screenshot-to-BR candidates have been reconciled to an owning business requirement or intentionally kept as PRD/UI detail (see screenshot audit). The operating platform includes public website, Foundation Admin, center portal, both Android applications and shared backend.

**Current BR baseline:** The normative business scope lives in the [Master BR](00-MASTER-BUSINESS-REQUIREMENTS.md), [Foundation BR](01-FOUNDATION-OPERATIONS-BR.md), [Healthcare BR](02-INTEGRATED-HEALTHCARE-BR.md), [CMS and channels BR](03-CMS-CHANNELS-BR.md) and [shared NFR baseline](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md). This file is **traceability evidence**, not an alternative BR version or new feature list.

**Evidence boundary:** Screenshots establish visible content and interaction affordances, but not successful API behaviour, persistence, accounting accuracy, permission enforcement, publication, deployment, payment delivery or clinical correctness. Test those during PRD/manual QA. The original moving videos do not need to be replayed to establish that all **167 submitted screenshot files were inventoried**, but unrecorded video interactions cannot be verified.

**Client decisions:** Reconcile the genuinely unresolved scope and policy questions in the [single decision register](04-TRACEABILITY-DECISIONS.md). Do not silently add checkout/delivery/services or obscure confirmed requirements because the visual UI differs from prose.

**Business-module boundary:** Every source-backed function belongs to an existing CG module. UI pages, payroll links, receipt templates, dashboards, content tabs, report packs and approval queues are **presentations and workflows** of those modules—not permission to create competing data stores or independent engines.
