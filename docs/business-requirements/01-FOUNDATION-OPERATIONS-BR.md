# CG-BR-100 — Foundation Administration, Programs and Operations

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Status:** Internal consolidated BR · 14 November 2026  
**Scope:** CG-01 through CG-13, CG-19 through CG-21. Healthcare-specific requirements remain in [CG-BR-200](02-INTEGRATED-HEALTHCARE-BR.md). Public content controls are in [CG-BR-300](03-CMS-CHANNELS-BR.md).

## Reading convention

Each requirement is stated as a desired **business capability**, not as a dedicated screen or an instruction to build an extra engine. **Owner** means the module responsible for the truth of the data. **Admin controls** means authorized configuration and operational actions. **Public** means website and public Android app where relevant; **Internal mobile** means the permissioned staff/volunteer Android app. Where the original requirements specify a process but no detailed validation, keep the requirement and complete those details in the module PRD.

## CG-01 — Identity, Accounts, Roles and Permissions

**Purpose:** One identity and access capability serving Foundation employees/volunteers, public applicants and users, and healthcare center personnel. Business relationships (employee, member, volunteer, patient, donor) are not synonyms for a login account.

**Business requirements**

- **CG-01-BR01:** Allow authorized creation, activation, suspension and deactivation of internal accounts; manage permitted profile/contact details and secure credential recovery.
- **CG-01-BR02:** Permit configurable roles with names/descriptions, protected built-in roles, custom roles, assignment to users, active status and role-assignment history.
- **CG-01-BR03:** Provide action-level permissions (view, create, edit, delete where applicable, approve, export, publish, sensitive administration) by module and applicable sub-function.
- **CG-01-BR04:** Support starting a role with no permissions or copying permissions from an existing role, then editing the copy.
- **CG-01-BR05:** Enforce geographic authorization for organization-wide, state, district, sub-division and block scopes and relevant branch assignments.
- **CG-01-BR06:** Enforce center/center-branch-specific scope for healthcare portal personnel, independently of Foundation geography.
- **CG-01-BR07:** Ensure every list, search, record, report, export, linked-dropdown option and mutation respects the actor's access. Required supporting information must remain selectable for a permitted workflow without exposing unauthorized records.
- **CG-01-BR08:** Preserve protected Super Admin authority and audit changes to roles, permissions and assignments.
- **CG-01-BR09:** Provide public login/registration or verified account self-service wherever a particular public business workflow calls for it; not every public visitor must have an internal role.

**Admin controls:** Role matrix, assignments, geographic/branch/center scope, account statuses, access reports.  
**Cross-channel:** Foundation web, center portal, internal Android; public website/app for public accounts.  
**Not separate modules:** “User Directory,” “Role Manager,” “Role Copy,” “Permissions Matrix” are views of CG-01.  
**Dependencies:** CG-02 organization geography; CG-03 approval of protected assignments where policy requires.

## CG-02 — Foundation Organization, Branches, Departments and Committees

**Purpose:** Own the organizational and geographic structure of CareGanga, **distinct** from the healthcare provider network.

- **CG-02-BR01:** Maintain Foundation identity, official contact/address, registrations and appropriately authorized organization settings.
- **CG-02-BR02:** Maintain Foundation branch names/types/codes, status (active/inactive/closed), geographic location, contact, photos, opening date, registration and agreements.
- **CG-02-BR03:** Support the specified seven-stage branch registration: basic information; location/contact; official photo/registration; agreement/documents; manager appointment; staff/volunteers/projects; review/submit.
- **CG-02-BR04:** Save incomplete branch drafts; show setup completeness, missing documents, verification and approval status.
- **CG-02-BR05:** Generate branch code after applicable final approval; preserve change history.
- **CG-02-BR06:** Associate branches with employees, coordinators, volunteers, departments, members, projects and budget allocations without duplicating their owner profiles.
- **CG-02-BR07:** Maintain departments and their functions, branch associations and member assignments; maintain committees and committee/personnel associations.
- **CG-02-BR08:** Provide branch directory, search/filter, authorized status changes and exports.
- **CG-02-BR09:** Internal Foundation branches must **not be automatically published**; only expressly approved organization information appears publicly.

**Admin controls:** Branch wizard/approval, geography masters as agreed, department/committee setup, staff links, status and document verification.  
**Public:** Only published organizational content, not the internal branch master.  
**Cross-channel:** Foundation Admin and role-scoped Internal Android.

## CG-03 — Applications, Document Verification and Approvals

**Purpose:** A reusable lifecycle for applications and approvals. **Each domain owns the underlying business record; CG-03 owns submission, review routing and decision evidence.**

- **CG-03-BR01:** Support application intake for members, volunteers, CSR partners, Foundation branches, employees and healthcare providers/doctors where approval is required.
- **CG-03-BR02:** Assign an application/reference number at submission and expose permitted status tracking.
- **CG-03-BR03:** Provide filtered approval queues, applicant detail, submission source, uploaded documents, payment references, notes, communications and decision history.
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
- **CG-04-BR08:** Volunteer departments and availability choices are configurable by authorized administrators; default illustrative departments include health, education, child welfare, disaster relief, environment, women empowerment, community development and general support.
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

**Admin controls:** Campaign status/publishing, donor entries, payment references, provider-integrated corrections, donor communications.  
**Public:** Donate, payment state, receipt, campaigns, applicable donation history.

## CG-08 — CSR Partners, Funding and Fund Allocation

- **CG-08-BR01:** Receive CSR partner applications and records of organization name, contacts, documents and verification status.
- **CG-08-BR02:** Verify CSR partners through common approval workflow and maintain approved partner directory.
- **CG-08-BR03:** Create funding proposals associated with projects/partners, requested amount, purpose, attachments and responsible personnel.
- **CG-08-BR04:** Support shared funding showing CSR partner contribution, Foundation contribution and percentage allocations, with agreements and budget categories.
- **CG-08-BR05:** Route funding approvals and preserve approved/rejected/pending statuses and reviewer history.
- **CG-08-BR06:** Link approved funds to project allocations, utilization and reporting through CG-09; public partner publication is independent of partner verification.

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
- **CG-09-BR07:** Support multi-item vouchers with quantity, unit, price/rate, tax, additional charges, calculated total and attachment references.
- **CG-09-BR08:** Submit vouchers for verification and multi-level approvals, with approved, rejected, pending and payment-released states.
- **CG-09-BR09:** Employees or eligible volunteers can claim expenses/allowances using purpose, date, category, project, amount, preferred payment method and bill/proof; track approval, payable and payment.
- **CG-09-BR10:** Keep original expense claim, approved voucher, payment and ledger posting linked. A reimbursement request does not create multiple separate expenses merely because it moves through screens.

### Invoices, receipts and budgets

- **CG-09-BR11:** Maintain internal invoices and receipts, with person/organization/vendor references, items, prices, discounts/taxes where applicable, due/payment terms, linked campaign/project, documents, approval and PDFs.
- **CG-09-BR12:** Send/download/print invoices/receipts; email/WhatsApp sharing only through configured channels and permitted templates.
- **CG-09-BR13:** Create and approve project/branch/category budgets by period, with authorized allocation, utilized and remaining amounts.
- **CG-09-BR14:** Track vendor/payee information and outstanding/bank reconciliation consistently where financial transactions require it.
- **CG-09-BR15:** Provide finance search/filter/report/exports by branch, project, period, account, payment method, creator, approver, status and amount.

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
- **CG-13-BR04:** Configure rank names, point/referral thresholds, benefits and progression history. Illustrative ranks: Bronze, Silver, Gold, Platinum, Diamond, Royal, Legend.
- **CG-13-BR05:** Maintain reward product catalog (physical/digital), image, category, quantity/stock where applicable, points cost and availability.
- **CG-13-BR06:** Let eligible users submit point-redemption requests, view status/history and have fulfillment processed by authorized staff.
- **CG-13-BR07:** Points deducted and rewards issued must match completed qualifying/redemption transactions; fulfillment and stock movement must be traceable, including reversal/correction under defined rules.
- **CG-13-BR08:** Provide referral/leaderboard/rank/points and redemption reports with privacy-aware visibility.

**Admin controls:** Referral program settings, points/rank rules, reward catalog and redemption handling.  
**Public:** Self-service referral, points/ranks, rewards catalog/history for eligible logged-in users.

## CG-19 — Shared Documents, Certificates and Communications

**Supporting business capability, not another owner of applications or financial records.**

- **CG-19-BR01:** Provide templates and authorized generation of membership documents, staff letters/ID cards, invoices, vouchers, donation receipts, appointment slips and other required PDFs.
- **CG-19-BR02:** Store user-submitted and business-submitted photographs, document scans, medical reports and proof with owner association and restricted access.
- **CG-19-BR03:** Support common SMS/email/mobile-push communications and WhatsApp where configured, with business-triggered templates, audience, delivery history and error states.
- **CG-19-BR04:** Admin notices/bulletins with content/publication status and authorized notification sending.
- **CG-19-BR05:** Expose appropriate records to correct audience (donor receipt to donor, appointment slip to patient/center, salary slip to employee).
- **CG-19-BR06:** Offer communication logs and template controls without adding independent message histories to every module.

## CG-20 — Dashboards, MIS, Reporting and Exports

- **CG-20-BR01:** Super Admin dashboard aggregates members, volunteers, projects, beneficiaries, fundraising, healthcare and financial statistics with recent activities and action navigation.
- **CG-20-BR02:** Each major owner module can present relevant lists, statistics, trends and workflow-status summaries without creating a competing stored record.
- **CG-20-BR03:** Provide standard financial, project, employee, volunteer, membership, health-provider, patient, donation and operations reports with organization/branch/center and date filters.
- **CG-20-BR04:** Provide authorized custom report building (choose data source/module, filter, group, sort, tabular/chart/summary/pivot where supported).
- **CG-20-BR05:** Save filters/reports, schedule reports with frequency/time, export PDF/Excel or applicable supported formats and share via authorized channels.
- **CG-20-BR06:** Honor data-scope restrictions and sensitive-information masking consistently in dashboard, export and scheduled delivery.

## CG-21 — Settings, Audit, Integrations and Recovery

- **CG-21-BR01:** Central configuration for Foundation information, operational settings, supported integrations and credentials via authorized administration.
- **CG-21-BR02:** Auditable actions including logins where applicable, role changes, approvals, financial changes, publishing, provider verification and protected data access as appropriate.
- **CG-21-BR03:** Provide authorized configuration/monitoring for payments, email/SMS/WhatsApp, push, GPS/maps and related external providers where required.
- **CG-21-BR04:** Provide controlled backup/restore access and a recovery operation model; restoration must not be available to routine staff.
- **CG-21-BR05:** Provide human-readable errors, status and operational controls that avoid silently swallowing backend failures.

## Cross-domain dependency guardrails

1. **Member fees, donations, CSR funds, expense reimbursement, payroll and healthcare money → CG-09 accounting**, each from one traceable owner transaction.
2. **Every business approval → CG-03**, applied only when the owner module has a valid pending decision.
3. **Employee/user/member/volunteer/patient are roles/relationships, not automatically separate login identity stores**; confidential profile domains remain segregated.
4. **CMS publishes from source-owned data, not from copied operational data**. Public display has approval/visibility.
5. **Internal Foundation branch ≠ healthcare provider center/center branch**. They can have a reporting association only if the business rule explicitly requires it.
6. **Reports query permissions and business owners**; they never bypass operational scope to assemble private cross-center records.

## PRD preparation notes

For each CG-01–13, 19–21 PRD, explicitly define: actor and authority, owned record fields, dynamic configuration, lifecycle/status transitions, approval route, backend business rules, admin view, relevant public/mobile self-service, imports/exports if specified, exceptions, reporting, NFR/security and manual QA scenarios. UI screenshots are references; each shown visual element is not an authorization for a new independent subsystem.

**Open issues** are centralized in [CG-BR-900](04-TRACEABILITY-DECISIONS.md); do not resolve them by adding assumptions to individual PRDs.
