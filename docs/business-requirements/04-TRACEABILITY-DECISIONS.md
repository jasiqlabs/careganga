# CG-BR-900 — Source Traceability, Scope Decisions and PRD Handoff

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Status:** Internal consolidated BR · 14 November 2026  
**Purpose:** Preserve complete client requirements while avoiding accidental scope expansion, duplicated implementation and unsupported screen-level assumptions.

## 1. Source and precedence register

| Source ID | Material inspected | Coverage and limitations |
| --- | --- | --- |
| **S-01** | \`SAM-CAREGANGA-121126-113332.pdf\` — 61 pages, final functional requirements prepared for CareGanga Foundation | Primary detailed written inventory of Foundation, employee, program, finance, CMS, Android and healthcare requirements. Page references below are printed/PDF page numbers, **1-based**. |
| **S-02** | CareGanga October 19, 2026 client meeting transcript, \`Project discussion with CareGanga foundation (1).docx\` | Context for how Admin controls public content, branch visibility, role/approval expectations, member ID generation, field-work evidence, expense reimbursement and two Android audiences. The transcript has noisy auto-transcription and is not a substitute for signed requirements. |
| **S-03** | 16 supplied healthcare UI images across the November 14 conversation, with some repeated screen concepts | Verified screenshots in this conversation: public healthcare landing/categories, center discovery/details, doctor search/profile, center-first/auto-center date/slot selection, patient details, booking summary/payment, Razorpay, appointment slip/copies/QR/verification and patient account. **Illustrative screens, not proof of functioning software.** |
| **S-04** | Original CareGanga admin recordings and extracted screenshot archives previously discussed | **Not accessible for fresh inspection in this session.** Their detailed screen/field/action audit remains **unverified**. No statement in this BR claims a complete recheck of those original recordings. |

**Use of sources:** S-01 is the contractual working inventory, as supplied. Newer S-03 screens inform behavior, presentation and a controlled **decision queue** where they appear wider/different than the written transactions. S-02 clarifies user intent where consistent. Never replace source-backed requirements with unsupported platform assumptions.

**Implementation starting point:** S-01 calls for development of the full platform **from scratch**. Existing CareGanga screenshots are functional/design references, not an assertion that the current demonstration code must be adopted or its old UX copied as-is.

## 2. Complete source-to-owner mapping

Each row explicitly points to the **business owner**; a requirement may also be displayed or acted upon through other portals. The source section numbering is preserved even where it skips numbers.

| S-01 page(s) and sections | Client requirement group | CG owner and BR section | Public/channel treatment |
| --- | --- | --- | --- |
| 1; §1 | Project, five core deliverables, shared data | CG-BR-000 §3–6 | Website, Foundation Admin, public/internal Android, backend; dedicated center portal from healthcare scope |
| 1–3; §2 | Central dashboard, approvals dashboard, quick actions and website visibility | CG-20, CG-03, CG-18 | Administrative dashboard; explicit public login/join toggles |
| 3–4; §3 | User directory/search/staff login creation | CG-01; employee records CG-10 | Internal scoped access |
| 4–6; §4 | Dynamic roles, permission actions/copy, geographic scope, matrix | CG-01 | Admin and Internal Android permission rules |
| 6–7; §5 | Applications, verification, statuses, approval steps | CG-03 | Public submissions and own status |
| 8–9; §6 | Membership, fees, approval, profiles, approved IDs | CG-04, CG-03, CG-09, CG-19 | Join, pay, track, profile/download |
| 9–10; §7 | Volunteer registration, preferred department, availability, assignments | CG-04, CG-03, CG-05 | Join, status and permitted volunteer services |
| 10–12; §8 | Foundation branches, seven-step wizard, verification | CG-02, CG-03 | Internal by default |
| 12; §9 | Departments and committees | CG-02 | Published work/team only by editorial selection |
| 12–13; §10 | 80G, PAN, registration/financial reports, compliance pages | CG-18 with CG-09/20 references | Approved public information and files |
| 13–15; §11 | Our Impact ten sections | CG-18/20 with CG-05/06 source references | Published Impact experience |
| 15–16; §12 | Projects, budget/progress, listing and filters | CG-05/09 | Approved selected projects |
| 16; §13 | GPS/geotagged field visits, monitoring | CG-05, CG-19 | Restricted operational evidence |
| 16–17; §14 | Beneficiary registration, distributions and dashboard | CG-06, CG-05, CG-12/09 | Published anonymized/approved impact |
| 17; §15 | Tasks, assignments, activities | CG-05 | Internal mobile and admin |
| 17–18; §16 | Fundraising campaigns | CG-07, CG-18 | Published campaign details |
| 18–19; §17 | Online donations, links, refunds, admin management | CG-07, CG-09, CG-19 | Donate/receipt |
| 19–20; §18 | Payment, expense, journal and contra vouchers | CG-09, CG-03 | Internal only |
| 20–21; §19 | Finance dashboard | CG-09/20 | Permissioned internal views |
| 21–22; §20 | Chart of accounts, accounting, cash/bank | CG-09 | Internal finance |
| 22–23; §21 | General/project/CSR ledgers, transactions, manual entries | CG-09 | Internal finance |
| 23–24; §22 | Invoices/receipts, approval, PDF/share and allowances | CG-09, CG-19; employee request CG-10 | Own authorized receipts only |
| 24–25; §23 | Expense submission, approval, posting, dashboard | CG-09, CG-03 | Staff self-service |
| 25–26; §24 | Branch/project budgets and utilization | CG-09; linked to CG-05/02 | Internal |
| 26; §25 | CSR partner registration, verification, records | CG-08, CG-03 | Approved partner info/registration |
| 26–27; §26 | Funding proposal/shared contributions/approvals | CG-08, CG-09, CG-03 | Select published CSR information |
| 27–28; §27 | Membership tier configuration and public display | CG-04, CG-18 | Active plan choice |
| 28–29; §28 | Referrals, points, ranks, benefits, dashboard | CG-13 | Eligible personal referral/rank services |
| 29–30; §29 | Reward catalog, redemption, fulfillment and stock | CG-13, CG-12 | Eligible rewards store |
| 30–31; §32 | Inventory, material requests, stock, vendors | CG-12, CG-03, CG-09 | Staff operations |
| 31–32; §33 | Employee HR dashboard, registration, verification, directory, role | CG-10, CG-01, CG-03 | Restricted employee access |
| 32; §34 | Attendance and shift rules | CG-10 | Staff/internal mobile |
| 33; §35 | Leave management | CG-10, CG-03 | Staff/internal mobile |
| 33; §36 | Performance management | CG-10 | Restricted HR |
| 33–34; §37 | Employment letters, memos and ID cards | CG-10, CG-19 | Authorized staff downloads |
| 34; §38 | Transfer, promotion, resignation and employee files | CG-10, CG-03 | Restricted HR |
| 34–35; §39 | Allowance requests and approval | CG-10/09, CG-03 | Authorized staff self-service |
| 35–36; §40 | Payroll settings, processing, verification, payments and slips | CG-11, CG-10, CG-09, CG-03 | Private payroll |
| 36–37; §41 | Notices, notifications, email/SMS | CG-19, CG-18 | Published and personal channels |
| 37–39; §42 | Admin-controlled web CMS, banners, team, projects, media, blog, contact/support | CG-18 | Published public content |
| 39–40; §43 | Standard/custom/MIS, export, scheduled reports | CG-20 | Authored access-limited reporting |
| 40–41; §44 | Governance, audit, integration, backup/restore | CG-21, CG-01 | Admin only |
| 41; §45 | Public Android app | CG-BR-300 §7, domain-owner PRDs | Public account, member/volunteer/donor/patient functions |
| 41–42; §46 | Internal Android app | CG-BR-300 §8, domain-owner PRDs | Role-scoped Foundation operations |
| 42–43; §47 | Shared backend, approvals, records, GPS, payments, audit | CG-BR-000 §5–10, CG-19/21 | Common services without duplicated data |
| 43–44; §48 | Mandatory connected workflows | CG-BR-000 §7 | Each is PRD QA trace |
| 44–48; Healthcare A, items 1–21 | Public healthcare site, doctor/center search, booking, patient, support/payment and slips | CG-14, CG-15, CG-17, CG-18/19 | Doctor public booking confirmed |
| 48–52; Healthcare B, items 22–46 | Center portal, doctors, schedule, patients, lab/tests, collections, dues, settlement | CG-14, CG-15, CG-16, CG-17 | Center-scope operations |
| 52–58; Healthcare C, items 47–75 | Central healthcare governance, doctors, labs, patient, benefit, finance, CMS, staffing, security | CG-14–17 and shared modules | Foundation network oversight |
| 58–59; Healthcare D/E | Common backend, synchronized data, responsive web; provider types; booking and benefit scope | CG-BR-000/200/300 | Scope control and shared permissions |
| 59–61; §49 / summary | From-scratch, reference screens, connected finance, role security and application views | All CG modules | Confirmation and PRD validation baseline |

**Original numbering note:** Source jumps from §29 to §32. This does not authorize inventing two missing modules; they remain unmapped unless evidenced by an actual client requirement.

## 3. Consolidated screenshot-to-business requirement mapping

| Screenshot concept | Owner | Expected decision/reconciliation |
| --- | --- | --- |
| Healthcare landing with nine types and benefit banners | CG-14/16/17/18 | Categories may be published; percent text depends on eligibility/config and business scope |
| Center search/list/grid/map, facilities and verified labels | CG-14, CG-18 | Only approved public records; source of review/rating requires validation |
| Center profile, doctor availability and price table | CG-14/15/17 | Real center/doctor price, published services, schedule from one live source |
| Doctor directory/profile with center-wise sessions | CG-14/15/17 | One doctor, multiple centers and fee/time associations |
| Choose center → date → time | CG-15 | Center-first booking variant |
| Choose doctor/date/time → automatically assigned center | CG-15 | Slot-first booking variant over same real inventory |
| Patient personal/address/symptom/optional report and consent | CG-15 | Verified patient identity, medical privacy and optional uploads |
| Booking review + online or pay-at-center | CG-15/17/09 | Separate confirmed booking vs due/paid state |
| Razorpay payment UI | CG-17/09/19 | Verified gateway transaction state; no decorative QR success |
| Patient/center copies, patient virtual ID, barcode/QR | CG-15/17/19 | Generated truthful slip, privacy-minimal verification; final print template |
| Self-service My Appointments, Reports, Prescriptions, Family Members | CG-15/16/19 | Some navigational features need workflow/permission confirmation |

Screenshots illustrate **information architecture and user journey**, not live provider data. Their sample names, ratings, badge counts, PINs, dates, registration numbers and payment transaction strings are **mock data** unless independently supplied as real Foundation records.

## 4. Open decision register (blockers to specific PRDs, not the whole BR)

Status of all below: **Decision required**. Do not silently implement either side.

| Decision ID | Priority | Question / source conflict | Required owner decision and dependent PRD |
| --- | --- | --- | --- |
| **D-01** | Critical | New UI shows public **Book Lab Test / Order Medicine / Book Nursing/OT** but the written functional scope specifies initially only public doctor booking; other healthcare services are managed through center admin | Confirm which non-consultation services have actual public ordering/booking, payment, fulfilment, cancellation and refund in **this release**; impacts CG-15/16/17/300 |
| **D-02** | High | One screen selects center before date; another auto-selects center from doctor/date/slot | Confirm both variants are desired, preference order, tie-break for simultaneous center options, and how to inform patient of assigned location; CG-15 |
| **D-03** | Critical | The standard doctor model is eligible 50% support; one slip shows 100% and banners show lab/medicine/OT percentages | Confirm which support rates can be 100%, eligibility/approval, caps, who funds an apparent “discount,” and whether example percentages are enforceable policies; CG-17 |
| **D-04** | Critical | Where does Razorpay patient money actually settle? Is pay-at-center collected by center or Foundation? | Document payer/collecting merchant, ledger ownership, receivable flow and when/how Foundation pays provider for subsidy; CG-17/09 |
| **D-05** | High | The meeting emphasizes Super Admin final control; written document says configurable hierarchy | Confirm processes/actions requiring mandatory final Super Admin sign-off vs delegable final approval; CG-03/01 |
| **D-06** | High | Center Portal has its own staff/roles and Center Admin can manage them | Confirm center user onboarding, who approves privileges, branch-vs-center scoping, clinician access to patient files; CG-01/14/15 |
| **D-07** | High | UI shows patient ID of 12 digits, QR verification, online two-copy A4 and pay-at-center one-copy layout | Confirm exact patient ID format, booking ID composition, slip layouts, scan verification payload and duplicate/reprint behavior; CG-15/19 |
| **D-08** | High | UI shows Family Members, Prescriptions, Patient ID Card | Confirm family/dependent booking authorization, prescription authoring/sign-off, report access, consent and whether these are required transactional features; CG-15/16/300 |
| **D-09** | Medium | UI shows verified marks, rating/review counts and favorites | Confirm review-submission/moderation and source of real ratings, and whether favorites are required; CG-14/18/300 |
| **D-10** | High | Internal Foundation branches are not automatically publicly shown; healthcare centers should be public after approval | Confirm whether any Foundation-owned branch should ever have a separate public location page; preserve distinct data models; CG-02/14/18 |
| **D-11** | High | Membership tiers, ID, certificates, renewals and payments shown; late-payment/refund policy unspecified | Confirm tier catalogue, renewal/lapse/grace policy, rejection/refund handling and editable member fields needing approval; CG-04/09 |
| **D-12** | High | Source specifies flexible role/permission matrix and regional hierarchy | Confirm org chart, role defaults, record-scope combination rules, protected approvals and who can delegate roles; CG-01/02/03 |
| **D-13** | Medium | Financial operations include different voucher types and payroll, CSR, donation and subsidy | Confirm accounting practices, fund/project allocation, fiscal year, GST/80G documents and reports required for statutory sign-off; CG-09/11/17 |
| **D-14** | Medium | Field GPS/photos and attendance rules mentioned but precise mobile scenarios not fully specified | Confirm online/offline expectations, geo proof tolerance, visit review and attendance source; CG-05/10/300 |
| **D-15** | Medium | Referral points, conversion, ranks, stock and reward redemption | Confirm qualification conditions, point expiry, reversal/fraud policies, physical fulfillment, stock linkage; CG-13/12 |
| **D-16** | Medium | Source has CMS manual impact statistics and projects/beneficiaries data | Confirm which Impact figures are derived vs editorial and evidence/approval responsibility; CG-18/20 |
| **D-17** | High | Public Android, Internal Android, Foundation Admin and Center Portal have wide feature sets | Approve per-role feature matrix for each interface, especially advanced configuration in mobile and portal roles; CG-300 |
| **D-18** | Medium | Generic notifications through SMS/email/WhatsApp; integrations depend on provider | Confirm channels, message templates, DLT/provider arrangements, required consent and sending costs; CG-19/21 |
| **D-19** | Medium | CSR, funding, project/budget and NGO reporting have linked status models | Confirm formal budget/commitment vs actual-receipt transitions and supported funding sources; CG-08/09 |
| **D-20** | Medium | Patient may have member/beneficiary relationship; multiple files contain identity/contact | Confirm if verified relationships are linked and exactly who may see/use health information; CG-01/04/06/15 |
| **D-21** | Medium | Source §36 performance is described only at high level; committee workflow details are likewise sparse | Obtain detailed accepted reference workflow or minimum fields/approvers for performance/committee management; CG-02/10 |
| **D-22** | Medium | Center-side laboratory management includes orders/reports, but scope of actual diagnostic data capture is not described | Confirm report-upload-only vs structured test results, professional sign-off and release controls; CG-16 |
| **D-23** | Medium | Public health provider types include pharmacy and alternative medicine in screenshots | Confirm whether provider directory only or pharmacy stock/order/fulfillment and non-doctor appointment models; CG-14/16/300 |
| **D-24** | Medium | Original admin panel recordings exist from earlier project discussions but cannot currently be reopened | Reattach videos or screenshot archives for exact screen/field/action cross-check; no invented conclusions; all affected PRDs |

**Decision policy:** An open decision is not permission to exclude a committed written requirement; nor to invent workflows beyond it. Document client outcome, affected BR ID, reason, date and downstream PRDs when resolved. Core BR authoring may continue while individual PRD locking waits for decisions that materially affect its workflow.

## 5. Duplicate-feature prevention checklist

| Potential duplication | One owner and reuse rule |
| --- | --- |
| Employee vs internal login vs user directory | CG-10 holds employment; CG-01 holds accounts/roles |
| Member vs volunteer vs patient vs beneficiary profiles | Separate relationship and privacy domains; common verified identity only where approved |
| Membership/CSR/branch/doctor approval implementations | All use CG-03 for decision process; source record remains with domain owner |
| Doctor profile for each healthcare center | CG-14 one doctor, many doctor-center associations |
| Center-specific booking vs auto-center scheduling | CG-15 one capacity/slot ledger and booking lifecycle |
| Healthcare center vs Foundation organization branch | CG-14 vs CG-02; never collapse as same entity by default |
| Membership fees, donations, expenses, payroll, healthcare financial entries | CG-09 shared accounting; owner module retains source transaction |
| Voucher vs expense claim vs allowance request | Related stages of authorized payment; no duplicated payment/expense posting |
| Center CMS vs Foundation CMS vs public website content | CG-18 one publication authority, center can propose/edit only permitted local content |
| Project/campaign public pages vs operational records | CG-05/07 master; CG-18 publication/marketing presentation |
| Reward store inventory vs general inventory | CG-13 reward/redemption logic, CG-12 physical stock where applicable |
| Multiple reports/dashboards | CG-20 shared reporting over owner records with actor permissions |
| Separate PDF/email/SMS generator per module | CG-19 shared document/communications capability, owner-specific templates |

## 6. Source requirement inclusion gate (before PRD work)

For every proposed PRD, perform:

1. Locate exact source section, screenshot(s) and relevant client discussion.
2. Map each expected business function to one **CG module and requirement ID**.
3. List dependent upstream business owners and consume their records, not replicas.
4. Identify admin-configurable policy, responsible user, approval, public visibility and scoped roles.
5. Specify exact public website, Foundation Admin, Center Portal, Public Android, Internal Android usage.
6. Document the **happy path plus failure/correction/rejection/refund/duplicate/concurrent** business outcomes where relevant.
7. Trace documents (photo, identity, medical report, PDF, certificate), notifications and financial posting.
8. Verify access boundaries for public, internal geography, center users and sensitive information.
9. Identify open D-decisions that must be closed before that PRD is approved.
10. Ensure the PRD translates to manual QA test scenarios; record the trace in the harness tracker before implementation.

**No invented screen count:** Page totals in S-01 and feature-count labels for Healthcare A/B/C are source organization, not independent application component counts. No extra “module” should be created merely because an item has its own menu/dashboard.

## 7. Suggested handoff statuses

- **Master BR:** Draft complete; comprehensive *document-based* business coverage.
- **Original video screenshot replay:** Not done because source files were unavailable.
- **Cross-screenshot scope conflicts:** Recorded, pending designated client decisions.
- **PRD preparation:** Can proceed in dependency order for confirmed capabilities, with marked decisions for affected workflows.
- **HLD/DLD and implementation:** Not authorized by BR alone; follow approved JASIQ Harness workflow and source-backed PRDs.

**Versioning:** If a client clarification changes actual scope, update the owning module BR, master cross-domain table, decision status and PRD references together. Avoid competing “final v2/v3/v4” documents or contradictory revisions.
