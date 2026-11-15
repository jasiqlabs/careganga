# CG-BR-100 — Foundation Administration, Programs and Operations

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Status:** Consolidated business requirements · Client decisions identified separately  
**Scope:** CG-01 through CG-13, CG-19 through CG-21. Healthcare-specific requirements remain in [CG-BR-200](02-INTEGRATED-HEALTHCARE-BR.md). Public content controls are in [CG-BR-300](03-CMS-CHANNELS-BR.md).

## Reading convention

Each requirement is stated as a desired **business capability**, not as a dedicated screen or an instruction to build an extra engine. **Owner** means the module responsible for the truth of the data. **Admin controls** means authorized configuration and operational actions. **Public** means website and public Android app where relevant; **Internal mobile** means the permissioned staff/volunteer Android app. Where the original requirements specify a process but no detailed validation, keep the requirement and complete those details in the module PRD.

## CG-01 — Identity, Accounts, Roles and Permissions

**Purpose:** One identity and access capability serving Foundation employees/volunteers, public applicants and users, and healthcare center personnel. Business relationships (employee, member, volunteer, patient, donor) are not synonyms for a login account.

**Business requirements**

- **CG-01-BR01:** Allow authorized creation, activation, suspension and deactivation of internal accounts; manage permitted profile/contact details and secure credential recovery.
- **CG-01-BR02:** Permit configurable roles with names/descriptions, optional role colours/visual identifiers, protected built-in roles, custom roles, assignment to users, active status, role-assignment history and a view of assigned users.
- **CG-01-BR03:** Provide action-level permissions (view, create, edit, delete where applicable, approve, export, publish, sensitive administration) by module and applicable sub-function, with an expandable/collapsible permission matrix, on/off controls and visible permission totals.
- **CG-01-BR04:** Support starting a role with no permissions or copying permissions from an existing role, then editing the copy.
- **CG-01-BR05:** Enforce geographic authorization for organization-wide, state, district, sub-division and block scopes and relevant branch assignments.
- **CG-01-BR06:** Enforce center/center-branch-specific scope for healthcare portal personnel, independently of Foundation geography.
- **CG-01-BR07:** Ensure every list, search, record, report, export, linked-dropdown option and mutation respects the actor's access. Required supporting information must remain selectable for a permitted workflow without exposing unauthorized records.
- **CG-01-BR10:** Internal user directory supports role, department, designation, employee/employment type, state/district/branch, joining-date and account-status filters and counts of active, probationary, on-hold, resigned/inactive and newly registered people. Staff account creation supports full name, role, work email, phone and secure first-credential setup, linked to CG-10 employee records.
- **CG-01-BR08:** Preserve protected Super Admin authority, enforced privileged MFA/session security and audited changes to roles, permissions and assignments.
- **CG-01-BR09:** Provide public login/registration or verified account self-service wherever a particular public business workflow calls for it; not every public visitor must have an internal role.
- **CG-01-BR11:** Own and enforce password/session security configuration and privileged two-factor authentication: support a small allow-listed, securely defaulted Foundation-root policy for permitted password/session expiry, idle session limits and privileged MFA/attempt protections. Only a current Super Admin with fresh MFA may change permitted policy, with revision conflict checks, redacted audit, immediate correct backend enforcement and Web/Internal Android awareness. Never permit disabling the protected root's required MFA or creating a separate settings authority in CG-21.

**Admin controls:** Role matrix, assignments, geographic/branch/center scope, account statuses, access reports.  
**Cross-channel:** Foundation web, center portal, internal Android; public website/app for public accounts.  
**Not separate modules:** “User Directory,” “Role Manager,” “Role Copy,” “Permissions Matrix” are views of CG-01.  
**Delivery independence:** CG-01 works first after bootstrap, with real accounts, sign-in, roles, ordinary root-context assignment and revocation. **Later owner enhancements:** CG-02 supplies real geography/branch scopes; CG-03 introduces review and finalization of protected grants; CG-10 supplies employment links; CG-14 supplies healthcare center scope. These later requirements remain mandatory when those owners ship but do not block CG-01's own finished business flows.

## CG-02 — Foundation Organization, Branches, Departments and Committees

**Purpose:** Own the organizational and geographic structure of CareGanga, **distinct** from the healthcare provider network.

- **CG-02-BR01:** Maintain Foundation identity, official contact/address, registrations and appropriately authorized organization settings.
- **CG-02-BR02:** Maintain Foundation branch names/types/codes, status (active/inactive/closed), geographic location, contact, photos, opening date, registration and agreements.
- **CG-02-BR03:** Support seven-stage branch registration: (1) name/type/opening date/geography/address/PIN/GPS/photo; (2) location/contact; (3) official photo/registration records; (4) genuine protected agreement/evidence; (5) select a real eligible CG-01 manager/in-charge; (6) link **existing CG-02 Foundation departments/committees** upon branch activation; (7) revision-bound review/submit with required-document checks. Staff/coordinators (CG-10), volunteers/members (CG-04), projects (CG-05) and budgets (CG-09) are original business requirements fulfilled by **their later owner modules** after actual branch activation; CG-02 must not invent them or block the seven stages until they exist.
- **CG-02-BR04:** Save incomplete branch drafts; show setup completeness, missing documents, verification and approval status.
- **CG-02-BR05:** Generate branch code after applicable final approval; preserve change history.
- **CG-02-BR06:** CG-02 owns branch identity and its real **Foundation-department/committee relations**. Branch association for employees/coordinators is owned by CG-10, volunteers/members by CG-04, projects by CG-05 and budget allocations by CG-09. Each later owner must implement its actual branch selector, scoped relation/history and own QA after both source records exist; CG-02 never duplicates those domain masters or associations.
- **CG-02-BR07:** Maintain real Foundation-scoped departments and committees, eligible CG-01 account officeholder participation **with zero branches (CG-02 US-001)**, then after actual approved branch activation create/manage branch-scoped departments, link existing Foundation departments and retain historical committee/account associations **in CG-02 US-002**. CG-04 memberships and CG-10 employment are not created by department participation.
- **CG-02-BR08:** Provide branch directory, search/filter, authorized status changes and exports.
- **CG-02-BR09:** Internal Foundation branches must **not be automatically published**; only expressly approved organization information appears publicly.
- **CG-02-BR10:** Department and committee setup supports name, type, parent department where applicable, branch/location, assigned head/manager, opening date, description and active status. Reporting and staff assignment reuse the same department/committee record.

**Admin controls:** Branch wizard/approval, geography masters as agreed, department/committee setup, staff links, status and document verification.  
**Public:** Only published organizational content, not the internal branch master.  
**Cross-channel:** Foundation Admin and role-scoped Internal Android.

## CG-03 — Applications, Document Verification and Approvals

**Purpose:** A reusable lifecycle for applications and approvals. **Each domain owns the underlying business record; CG-03 owns submission, review routing and decision evidence.**

- **CG-03-BR01:** Support application intake for members, volunteers, CSR partners, Foundation branches, employees and healthcare providers/doctors where approval is required.
- **CG-03-BR02:** Assign an application/reference number at submission and expose permitted status tracking.
- **CG-03-BR03:** Provide filtered approval queues (applicant/contact, registration type, membership plan, payment/status/date), applicant detail, submission source, uploaded documents, payment references, notes, communications and decision history; registration dashboard includes pending/approved/rejected counts, type breakdown, recent submissions and average approval time.
- **CG-03-BR04:** Permit document preview and authorized download, verify/reject-by-document status and documented remarks.
- **CG-03-BR05:** Permit approve, reject, return for correction and appropriate forwarding/intermediate decisions. Bulk actions must only cover records for which the actor is authorized and where the business status permits.
- **CG-03-BR06:** Configure process-specific approval steps, reviewer roles and organization/area scopes. Illustrative membership chain: submission → district → state → HR/membership → Super Admin → finalization; the actual chain is a client-approved configuration.
- **CG-03-BR07:** Preserve reviewer, date/time, remarks, previous states and completed/pending approvals; show graphical queues/workflows and open pending records directly.
- **CG-03-BR08:** Make rejected/returned requests actionable to eligible submitters without converting an unapproved record to active status.
- **CG-03-BR09:** Create the final owner-module outcome only after final authorized approval, including IDs, accounts, budgets or authorized postings as applicable.

**Admin controls:** Approval definitions, pending-work dashboard, document verification, escalation and Super Admin oversight.  
**Public:** Applicant status/correction interface. **Internal mobile:** Assigned reviews, comments, approval actions as granted.  
**Single-engine rule:** No independent “membership approval app,” “branch approval engine,” “doctor approval engine,” or “voucher approval engine.”

## CG-04 — Members, Membership Programs and Volunteers

**Purpose:** Maintain participation relationships and policies, without creating duplicate application, payment, document or role engines.

### Membership

- **CG-04-BR01:** Public member registration captures contact, address, membership tier, referral attribution, document submissions and fee details; issue application reference and track status.
- **CG-04-BR02:** Admin configures active tiers, fees, validity/duration, benefits, descriptions and display order/appearance; public selection uses only active published tiers.
- **CG-04-BR03:** Verify required records and applicable fees, route approval through CG-03, then issue a unique approved member ID; do not confuse application number and member ID.
- **CG-04-BR04:** Maintain member roster, tier, join/expiry dates, renewal history, branch association, referrals, payments, documents, communications and status.
- **CG-04-BR05:** Generate approved member ID card, certificate and applicable welcome letter through common document templates; allow authorized download.
- **CG-04-BR06:** Support authorized member information changes and approval before protected changes are applied where configured; membership expiry/renewal records remain clear.

### Volunteers

- **CG-04-BR07:** Public volunteer application captures personal/contact/geography, date of birth, gender, optional blood-group data as a profile field where requested, skills, experience, availability, preferred department, referral and identity-document details.
- **CG-04-BR08:** Volunteer departments and availability choices are configurable by authorized administrators; illustrative departments include healthcare, education, child welfare/nutrition, disaster relief, environment/plantation, women empowerment, community development and general support. Available schedule choices from the written source: full-time, part-time, weekends-only and flexible/on-call.
- **CG-04-BR09:** Verify/approve volunteer applications, maintain volunteer roster/status/assignments and link actual work to CG-05.
- **CG-04-BR10:** Enable permitted volunteer access according to CG-01 roles; not all volunteers automatically become internal operational staff.
- **CG-04-BR11:** Provide authorized search, status filtering, activity summaries, exports and communication.

**Admin controls:** Tier price/duration/benefits, approved membership profiles, volunteer master/department choices, verification, publishing and permitted assignments.  
**Public:** Join, pay, status, approved ID documents, renewals/profile; volunteer signup, status and own assignments where public role permits.  
**Internal mobile:** Volunteer records/assignments for authorized field roles.

## CG-05 — Projects, Tasks, Activities and Field Operations

- **CG-05-BR01:** Create projects with code, category, descriptions, status, priority, location, funding source, planned budget, dates and project leadership.
- **CG-05-BR02:** Maintain project stages including planning, active, on-hold, completed and cancelled; track progress, responsible teams, allocated/utilized budgets and activity history.
- **CG-05-BR03:** Search projects by code, area, category, director, funding source, status, priority and dates; export where permitted.
- **CG-05-BR04:** Create/assign tasks with owner, due date, project link, priority, type, current status, overdue tracking and completion history.
- **CG-05-BR05:** Record project and organizational activities with responsible personnel and supporting evidence.
- **CG-05-BR06:** Field personnel record visits with date, location, GPS/geotagged evidence, descriptions, assigned employee and photos/documents; link to applicable project/task.
- **CG-05-BR07:** Authorized coordinators review and monitor field visits, activity and task completion within scope; evidence stays attached to source records.
- **CG-05-BR08:** Provide project performance summaries and operational reporting without manually recreating public project pages.
- **CG-05-BR09:** Make only expressly published projects, achievements and stories visible publicly via CG-18.
- **CG-05-BR10:** Allow authorized creation and management of Foundation events linked to programs/projects or campaigns where relevant, including event information and public publication through CG-18. The exact event registration/ticketing workflow, if any, requires a separate supported client requirement and must not be assumed from a menu label.
- **CG-05-BR11:** A field visit has one detailed record with contextual views for visit report, check-in/check-out, location/route/GPS, photographs/videos, documents, assigned team, beneficiary assistance, approval records, comments and activity history. These views reference their owning records; they are not independent visit modules.

**Admin controls:** Project masters, team assignment, status, budgets link, review, publish eligibility and activity oversight.  
**Internal mobile:** Task lists, visit capture/GPS/photos, status, applicable review.  
**Public:** Approved projects, causes and impact, not full internal case records.

## CG-06 — Beneficiaries and Assistance

- **CG-06-BR01:** Register beneficiary profile/contact/geographic details and associate with one or more permitted projects.
- **CG-06-BR02:** Record each assistance action with type/category, item or financial support, quantities, applicable monetary value, date, activity/project link and responsible staff.
- **CG-06-BR03:** Preserve the beneficiary's support/distribution history so repeat assistance and project utilization are traceable.
- **CG-06-BR04:** Reference inventory issue or financial expense/payment when the assistance consumes stock or money; do not maintain disconnected shadow balances.
- **CG-06-BR05:** Provide access-controlled beneficiary search, dashboard and impact reports; personal beneficiary details remain private unless an expressly authorized publication use case exists.

**Admin controls:** Assistance categories, beneficiary management, authorized distributions and reporting.  
**Internal mobile:** Beneficiary registration/assistance updates where permitted.  
**Public:** Aggregate/anonymized approved impact and approved stories through CMS.

## CG-07 — Campaigns, Donations and Fundraising

- **CG-07-BR01:** Create campaigns with purpose/category, linked cause/project, title/content, images, goal amount, fundraising period, status and public visibility.
- **CG-07-BR02:** Accept general and campaign-linked online donations through configured payment provider, recording donor, amount, transaction reference and payment status.
- **CG-07-BR03:** Allow authorized manual donation entries, payment links, verification and correction/refund actions within configured provider/payment rules.
- **CG-07-BR04:** Produce authorized receipts and donor transaction history and expose donor-facing receipts through appropriate self-service.
- **CG-07-BR05:** Link successful payments to financial accounting records exactly once, with refund/correction linkage; do not equate a pending gateway request to received funds.
- **CG-07-BR06:** Show approved public campaign details, goals/progress and donation CTAs; keep private donor/payment data restricted.
- **CG-07-BR07:** Provide donation lists, filters, dashboards, campaign progress, summaries and exports.
- **CG-07-BR08:** Campaign setup supports an editable draft and review flow across basic information, project/category and geography, team/assignment, budget/targets, documents/media and final review. Campaign launch/publication is separately authorized and may not be inferred from saving a draft.
- **CG-07-BR09:** A manual donation record, generated online payment link, payment request, verified payment, authorized receipt and any subsequent correction/refund have distinct statuses linked to the same donor/campaign transaction.

**Admin controls:** Campaign status/publishing, donor entries, payment references, provider-integrated corrections, donor communications.  
**Public:** Donate, payment state, receipt, campaigns, applicable donation history.

## CG-08 — CSR Partners, Funding and Fund Allocation

- **CG-08-BR01:** Receive CSR partner applications and records of organization name, contacts, documents and verification status.
- **CG-08-BR02:** Verify CSR partners through common approval workflow and maintain approved partner directory.
- **CG-08-BR03:** Create funding proposals associated with projects/partners, requested amount, purpose, attachments and responsible personnel.
- **CG-08-BR04:** Support shared funding showing CSR partner contribution, Foundation contribution and percentage allocations, with agreements and budget categories.
- **CG-08-BR05:** Route funding approvals and preserve approved/rejected/pending statuses and reviewer history.
- **CG-08-BR06:** Link approved funds to project allocations, utilization and reporting through CG-09; public partner publication is independent of partner verification.
- **CG-08-BR07:** Funding work distinguishes proposed/requested funding, documented commitments, received funds, approved allocations to projects/categories and actual utilization or release. Funder agreements and source references remain attached; no individual project or CSR screen creates a competing fund balance.
- **CG-08-BR08:** CSR partner reviews can result in approval, rejection or request for correction with reviewer remarks, partner-contact details and linked proposal/contribution history.

**Admin controls:** Partner records, agreements, proposals, shared funding arrangements, approvals and reporting.  
**Public:** CSR registration/approved content only where enabled.

## CG-09 — Financial Management, Accounting, Vouchers, Expenses, Invoices and Budgets

**Purpose:** One coherent accounting capability underlying Foundation revenue, expenditure, funding, payroll and healthcare settlements. Internal menus can separate operational views, but **one posting and ledger authority** must exist.

### Finance masters and ledger

- **CG-09-BR01:** Manage chart of accounts and groups (assets, liabilities, funds/equity, income, expense), account codes/status/opening balances, cash/bank accounts and financial years.
- **CG-09-BR02:** Preserve linked debit/credit postings by date, account, source reference, branch/project, amount, payment method and status with audit history.
- **CG-09-BR03:** Provide general ledger, cash book, bank book, day book, project and CSR ledgers; trial balance, transaction list, summaries and permissioned exports.
- **CG-09-BR04:** Provide authorized guided manual journal/ledger entries with required accounting allocations and references, without bypassing approval rules.
- **CG-09-BR05:** Dashboard shows account balances, cash flow, income vs expenses, available budget, outstanding payables, salary totals and scoped financial metrics.

### Voucher and expense processes

- **CG-09-BR06:** Support payment, expense, journal and contra vouchers with unique number, date, employee/department, project, payee/vendor, GST when applicable, payment mode/bank, invoice/ref, category and remarks.
- **CG-09-BR07:** Support multi-item vouchers with description, quantity, unit, rate, subtotal, applicable tax, other charges, calculated total, amount in words, remarks and attachment references. Display source-specific project/ITPA code, project/campaign, available budget, GST, bank, invoice reference/date, creator/department and category fields where applicable.
- **CG-09-BR08:** Submit vouchers for verification and multi-level approvals, with approved, rejected, pending and payment-released states.
- **CG-09-BR09:** Employees or eligible volunteers can claim expenses/allowances using purpose, date, category, project, amount, preferred payment method and bill/proof; track approval, payable and payment.
- **CG-09-BR10:** Keep original expense claim, approved voucher, payment and ledger posting linked. A reimbursement request does not create multiple separate expenses merely because it moves through screens.

### Invoices, receipts and budgets

- **CG-09-BR11:** Maintain internal invoices and receipts with a draftable, multi-stage entry flow: (1) person/organization/member/vendor, invoice type, linked campaign/project/program, date/due/currency/purpose; (2) item descriptions/categories/units/quantities/prices/discounts/totals; (3) invoice/proof attachments, number or manual reference, fiscal year, branch/department, template, payment method/terms, notes/tags; (4) responsible verifier/approver, submit/review and resulting ledger link. Generate authorized PDFs and communication records without shadow invoice masters.
- **CG-09-BR12:** Send/download/print invoices/receipts; email/WhatsApp sharing only through configured channels and permitted templates.
- **CG-09-BR13:** Create and approve project/branch/category budgets by period, with authorized allocation, utilized and remaining amounts.
- **CG-09-BR14:** Track vendor/payee information and outstanding/bank reconciliation consistently where financial transactions require it.
- **CG-09-BR15:** Provide finance search/filter/report/exports by branch, project, period, account, payment method, creator, approver, status and amount.
- **CG-09-BR16:** Budgets and fund summaries expose **approved, committed, allocated, utilized, released, remaining and over-budget** amounts as distinct concepts with authorized definitions and linked accounting sources; show supporting period, branch/project, funder and category drill-down rather than reconciling manually duplicated dashboard totals.
- **CG-09-BR17:** Guided manual ledger-entry screens may let an operator select debit or credit and account, but the accepted accounting transaction must be complete, balanced, approved where required, attributable to its source and traceable through general ledger, cash book, bank book, day book, project/CSR ledger and trial balance.

**Admin controls:** COA, fiscal periods, approved bank/cash accounts, budgets, voucher/accounting permissions, finance approval, provider configuration, exports and audit.  
**Internal mobile:** Claims, selected vouchers, approvals and permitted finance status/reporting.  
**Public:** Donation receipts and suitably approved financial/compliance reports; not underlying ledgers.  
**Important:** Healthcare patient collection and Foundation contribution are distinct economic events, reconciled under CG-17 with postings in CG-09.

## CG-10 — HR and Employee Lifecycle

- **CG-10-BR01:** Create/verify employees with personal/employment information, branch, department, designation, line manager, joining data and permitted documents.
- **CG-10-BR02:** Generate employee ID after applicable authorization; link access roles in CG-01 without duplicating an employee account manager.
- **CG-10-BR03:** Provide HR dashboard, employee directory, status (active, probation, hold, resigned/inactive) and authorized profile changes.
- **CG-10-BR04:** Record daily attendance, present/absent/late/leave/weekly-off status, monthly calendar, summaries and correction approval.
- **CG-10-BR05:** Configure working times, break, grace period and weekly-off rules where required.
- **CG-10-BR06:** Enable staff leave application, leave history, supervisor/HR review and approval.
- **CG-10-BR07:** Maintain defined staff performance assessments and role-scoped reporting; details to be completed against approved reference screens.
- **CG-10-BR08:** Process transfer/promotion requests, posting/designation changes, resignation and approved exits, retaining history.
- **CG-10-BR09:** Generate employee appointment/relieving and other permitted letters, memos and ID cards via shared document templates.
- **CG-10-BR10:** Track employee/volunteer allowance requests but hand approved financial liability and payment to CG-09.
- **CG-10-BR11:** Make role-scoped attendance, leave, tasks and employee self-service accessible from Internal Android.
- **CG-10-BR12:** Employee registration/activation supports stage-appropriate application and document reviews, for example initial submission, state verification, zonal review, HR verification and final authorized approval. Registration stores personal, employment/branch, reporting manager, secure identity/bank, compensation proposal and documents as separately permissioned information; employee ID and user access arise only from the applicable approved lifecycle.
- **CG-10-BR13:** Employee letter/memo records support draft, edit, preview, authorized approval, issuance/dispatch, acknowledgment or received-copy upload where applicable, reissue/history and PDF/print. Supported templates include appointment, offer, joining, experience, relieving and other approved official letters; the generator is shared under CG-19.
- **CG-10-BR14:** Transfer, promotion and exit workflows preserve current/proposed role, branch, reporting manager, salary and effective dates. Exit review can track handover, HR/finance/assets clearance and final dues/settlement without silently marking salary or reimbursements as paid.
- **CG-10-BR15:** Employee ID-card issuance, reissue, deactivation, print/download and authorized QR verification use shared document templates; authorized display fields and history derive from approved person/employment data, not a separate manual identity store.

**Admin controls:** Employee verification, department/posting, shift/attendance policy, leave decision, document templates, lifecycle actions.  
**Public:** No unrestricted HR directory or personal payroll content.

## CG-11 — Payroll and Staff Compensation

- **CG-11-BR01:** Configure salary structures and components, allowances, deductions, statutory/tax parameters as approved, payroll period and relevant employee-level adjustments.
- **CG-11-BR02:** Maintain payroll eligibility and employee salary information referenced to approved CG-10 employee records.
- **CG-11-BR03:** Generate payroll for a selected period, calculating salary components and applicable attendance/leave/hold/revision/arrears/overtime rules only where configured.
- **CG-11-BR04:** Review, verify and approve payroll before authorized payment; maintain run and revision history.
- **CG-11-BR05:** Support salary reserve, payment batches, deductions, salary payments and pending approval tracking as **sub-workflows** of payroll (not standalone payroll engines).
- **CG-11-BR06:** Generate payslips and authorized notifications; employee access must be private.
- **CG-11-BR07:** Reconcile approved salary payment with CG-09 finance posting and bank/cash settlement without duplicate expenses.
- **CG-11-BR08:** Maintain payroll audit trail and permitted payroll summaries/reports.
- **CG-11-BR09:** One controlled payroll configuration covers frequency/period, salary components, allowances, deductions, taxes and statutory settings where applicable, bank/payment instructions, overtime, late/leave adjustment, arrears, revisions, bonuses/holds, payslip templates and notifications; every configured rule must have defined eligibility/effective-date and effect on actual calculations.
- **CG-11-BR10:** Payroll processing explicitly separates salary structure, draft run/attendance fetch, calculation and validation, review/adjustment, verification/approval, reserve/payment batch, released salary, payslip issue and history. A dashboard link or a re-generated payslip does not create a second salary obligation.
- **CG-11-BR11:** Employee bank, compensation and salary adjustment requests are recorded as controlled changes to the existing employee/payroll relationship, with authorization and effective date. Sensitive bank and salary details remain restricted.

**Admin controls:** Payroll settings, compensation approval, run/lock/review, payment batch and document templates.  
**Internal mobile:** Own pay information and approvals where approved role/feature mapping permits.

## CG-12 — Inventory, Material Requests and Suppliers

- **CG-12-BR01:** Maintain item catalog with category, details and available stock.
- **CG-12-BR02:** Maintain supplier/vendor directory used by inventory and linked finance.
- **CG-12-BR03:** Record stock receipts, issues and permitted adjustments with quantity changes and transaction history.
- **CG-12-BR04:** Submit material requests, review/approve/reject them and track request/fulfilment status.
- **CG-12-BR05:** Record inventory distributions, low-stock alerts and stock reports.
- **CG-12-BR06:** Link relevant stock consumption to projects/beneficiary distribution/reward fulfillment without maintaining duplicate counters.

**Admin controls:** Item/category setup, receipts, supplier records, approvals, stock corrections and reporting.  
**Internal mobile:** Material requests, status and permitted stock transactions.

## CG-13 — Referrals, Points, Ranks and Rewards

- **CG-13-BR01:** Generate/referral-code and shareable-link association for eligible member and volunteer accounts.
- **CG-13-BR02:** Count an eligible referral only after the defined registration and qualification events; preserve source/qualification history.
- **CG-13-BR03:** Configure qualification, earned points, conversion/redemption rules and points transaction balances; display balances to eligible users.
- **CG-13-BR04:** Configure rank names, point/referral thresholds, benefits and progression history. Illustrative ranks: Bronze, Silver, Gold, Platinum, Diamond, Royal, Legend. Eligible configurable benefits can include recognition badges, certificates, digital gifts, reward points and rank-specific privileges.
- **CG-13-BR05:** Maintain reward product catalog (physical/digital), image, category, quantity/stock where applicable, points cost and availability.
- **CG-13-BR06:** Let eligible users submit point-redemption requests, view status/history and have fulfillment processed by authorized staff.
- **CG-13-BR07:** Points deducted and rewards issued must match completed qualifying/redemption transactions; fulfillment and stock movement must be traceable, including reversal/correction under defined rules.
- **CG-13-BR08:** Provide referral/leaderboard/rank/points and redemption reports with privacy-aware visibility.

**Admin controls:** Referral program settings, points/rank rules, reward catalog and redemption handling.  
**Public:** Self-service referral, points/ranks, rewards catalog/history for eligible logged-in users.

## CG-19 — Shared Documents, Certificates and Communications

**Supporting business capability, not another owner of applications or financial records.**

- **CG-19-BR01:** CG-19 owns versioned templates, secure source-confirmed PDF/letter/ID-card issuance, print/reissue/revoke and download service. Initial independently testable source is genuine CG-01/03 approved-access confirmation and restricted file. **CG-04/10/09/15/16 later introduce** their actual member/volunteer/staff identities, financial receipts, appointment/clinical records and required source-specific template/QA; no future business record/picker is a CG-19 startup prerequisite.
- **CG-19-BR02:** Store user-submitted and business-submitted photographs, document scans, medical reports and proof with owner association and restricted access.
- **CG-19-BR03:** Support common SMS/email/mobile-push communications and WhatsApp where configured, with business-triggered templates, audience, delivery history and error states.
- **CG-19-BR04:** CG-19 owns actual notices/bulletins, audience, draft/approval, sending/scheduling/expiry and delivery status. Public website publication of an approved safe notice is separately **CG-18-owned**, and never implies a notice was sent or copies the original CG-19 message row.
- **CG-19-BR05:** Expose appropriate records to correct audience (donor receipt to donor, appointment slip to patient/center, salary slip to employee).
- **CG-19-BR06:** Offer communication logs and template controls without adding independent message histories to every module.
- **CG-19-BR07:** CG-19 owns **one** Foundation public-contact request submission/opaque receipt, original support cases/replies/assignment/history/FAQs, anti-abuse and sensitive contact privacy. CG-19's initial public form/API and CG-01 Foundation responder are complete **without CG-18 website or CG-14 centers**. CG-18 later embeds the real form but stores no contact message. CG-14 later introduces authenticated own-center portal and A/B scope isolation against CG-19's same existing support source, not an independent ticket table.
- **CG-19-BR08:** Shared versioned document templates support genuine later CG-04/10 member/volunteer/employee front/back ID cards with approved source fields, issue/expiry, preview, barcode/QR, print/reissue/revoke and required official letters/seals/received-copy tracking. Initial CG-01/03 source is a **private approved-access letter only**, never a fabricated member/staff/financial card. Public QR verification is limited to explicitly source-approved public proof and must never expose private CG-01/03 account/role or medical/salary details.
- **CG-19-BR09:** Notifications distinguish direct transaction events, role/group broadcasts, individual messages and public notices. Authorized senders can configure recipient audience, category, priority, title, message, optional link, schedule/expiry and delivery status, without revealing contacts outside their permission scope.

## CG-20 — Dashboards, MIS, Reporting and Exports

- **CG-20-BR01:** Super Admin dashboard aggregates members, volunteers, projects, beneficiaries, fundraising, healthcare and financial statistics with recent activities and action navigation.
- **CG-20-BR02:** Each major owner module can present relevant lists, statistics, trends and workflow-status summaries without creating a competing stored record.
- **CG-20-BR03:** Provide standard financial, project, employee, volunteer, membership, health-provider, patient, donation and operations reports with organization/branch/center and date filters.
- **CG-20-BR04:** Provide authorized custom report building (choose data source/module, filter, group, sort, tabular/chart/summary/pivot where supported).
- **CG-20-BR05:** Save filters/reports, schedule reports with frequency/time, export PDF/Excel or applicable supported formats and share via authorized channels.
- **CG-20-BR06:** Honor data-scope restrictions and sensitive-information masking consistently in dashboard, export and scheduled delivery.
- **CG-20-BR07:** Standard report packages include donor and tax-receipt ledgers, finance/audit statements, volunteer roster/activity, beneficiary demographic/assistance reports, CSR contribution, project budget/utilization, healthcare center/doctor/appointment and employee/payroll reports. These are authorized views of module-owned records rather than separately maintained statements.

## CG-21 — Settings, Audit, Integrations and Recovery

- **CG-21-BR01:** Central authorized configuration of CG-21-owned nonsecret platform operational settings, effective revisions and supported external integration credential references; Foundation legal/organization identity belongs to CG-02 and password/session/MFA policy belongs to CG-01, not duplicated in CG-21.
- **CG-21-BR02:** Provide permissioned bounded central **read-only** audit projections from genuinely implemented original owners (first CG-01 access-audit and CG-21 platform-operation events). Original login/role, approval, money, publishing and protected-access audit records remain with the actual source owner and appear only after that owner delivers them; never copy events into another master.
- **CG-21-BR03:** Provide authorized nonsecret integration configuration references and truthful on-demand provider readiness for payment, messaging, push, GPS/maps and similar providers. CG-19 owns message sending/outbox/receipts; CG-09/17 own financial transactions/center collections. A configured or verified connection is not proof a message or payment succeeded.
- **CG-21-BR04:** Provide controlled backup/restore access and a recovery operation model; restoration must not be available to routine staff.
- **CG-21-BR05:** Provide human-readable errors, status and operational controls that avoid silently swallowing backend failures.
- **CG-21-BR06:** Restrict backup/recovery visibility, requests and authorized recovery-operation status to **current privileged CG-01 accounts with freshly verified MFA**, with durable access audit and independent proof before restoration is reported successful. CG-01-BR11 owns password/session/MFA configuration and enforcement; CG-21 does not implement a shadow authentication policy.

## Cross-domain dependency guardrails

1. **Member fees, donations, CSR funds, expense reimbursement, payroll and healthcare money → CG-09 accounting**, each from one traceable owner transaction.
2. **Every business approval → CG-03**, applied only when the owner module has a valid pending decision.
3. **Employee/user/member/volunteer/patient are roles/relationships, not automatically separate login identity stores**; confidential profile domains remain segregated.
4. **CMS publishes from source-owned data, not from copied operational data**. Public display has approval/visibility.
5. **Internal Foundation branch ≠ healthcare provider center/center branch**. They can have a reporting association only if the business rule explicitly requires it.
6. **Reports query permissions and business owners**; they never bypass operational scope to assemble private cross-center records.

## PRD preparation notes

For each CG-01–13, 19–21 PRD, explicitly define: actor and authority, owned record fields, dynamic configuration, lifecycle/status transitions, approval route, backend business rules, admin view, relevant public/mobile self-service, imports/exports if specified, exceptions, reporting, NFR/security and manual QA scenarios. UI screenshots are references; each shown visual element is not an authorization for a new independent subsystem.

**Open issues** are centralized in [CG-BR-900](04-TRACEABILITY-DECISIONS.md); do not resolve them by adding assumptions to individual PRDs. Apply the cross-platform P0 security, concurrency, financial correctness, privacy, availability/recovery and audit gates in [CG-BR-600](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) to every relevant functional PRD, without copying all shared NFR text into each module.
