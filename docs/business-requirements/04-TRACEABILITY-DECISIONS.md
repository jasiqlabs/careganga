# CareGanga — Open Business Decisions and PRD Entry Rules

**Document ID:** CG-BR-900  
**Status:** Consolidated decision register; client confirmation required for affected workflows  
**Project:** CareGanga Foundation, including Integrated Healthcare Assistance

## Purpose

This document contains only **unresolved business decisions** that materially affect PRD behaviour. Confirmed requirements live in the [Master BR](00-MASTER-BUSINESS-REQUIREMENTS.md), [Foundation BR](01-FOUNDATION-OPERATIONS-BR.md), [Healthcare BR](02-INTEGRATED-HEALTHCARE-BR.md), [CMS and Channel BR](03-CMS-CHANNELS-BR.md) and [shared NFR baseline](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md).

Source evidence is documented separately in [PDF-to-BR coverage mapping](05-SOURCE-TO-BR-COVERAGE-AUDIT.md) and [Admin screenshot/UI reference audit](../research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md). The supplied Admin ZIP is accessible and all 167 images have individual reference IDs A/B/C/U. The healthcare mockups are complementary references. Source screenshots show design and observable controls, not confirmation of working application functions.

## Business decisions requiring client confirmation

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
| **D-25** | Medium | Center Portal requirements reference authorized backup/restore operations alongside central backup/restore | Confirm center access to scoped export/recovery requests versus Foundation-only system restoration; CG-21/14 |

**Decision policy:** An open decision is not permission to exclude a committed written requirement; nor to invent workflows beyond it. Document client outcome, affected BR ID, reason, date and downstream PRDs when resolved. Core BR authoring may continue while individual PRD locking waits for decisions that materially affect its workflow.

**Priority:** Critical and high items must be settled before approving a PRD that depends on them. Medium items may be deferred until their relevant PRD if they do not alter a shared domain model or compliance responsibility.

## Decision discipline

- A screenshot option or CTA is evidence of client intent and must be addressed, but is not independently proof of a complete functioning service, provider integration or approved commercial policy.
- No confirmed written requirement is excluded merely because a screenshot does not show it.
- A decision can be resolved only by a recorded client response or formally delegated business authority. Until then, retain both evidence and the question; do not invent a payment route, eligibility policy, mobile scope or consent rule.
- When resolved, update the **existing owning BR requirement** and the relevant PRD, record decision owner/date/rationale here, and remove the row from the unresolved section. Do not create another competing "final BR" document.

## PRD entry checklist

Each PRD must identify: source reference, CG-BR requirement IDs, actor and permission scope, configurable Admin controls, domain-owned data, workflow statuses, client decision dependencies, Foundation Web/Admin/Center Portal/Public Website/Public Android/Internal Android applicability, backend consequences, documents/communication/payment/reporting effects, [CG-NFR-600](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) IDs and manual QA acceptance scenarios.

**Quality gate:** Production-critical correctness, sensitive-data access, fund integrity, concurrency, recovery and failure behaviour are obligatory. Numerical response-time and SLA targets in CG-BR-600 remain proposed until the Foundation confirms workload, hosting and operations.
