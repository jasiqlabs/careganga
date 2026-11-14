# CG-BR-600 — Cross-Platform Non-Functional Business Requirements (NFR)

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Version:** 1.0 · **Date:** 14 November 2026  
**Status:** Product-owner/architect-proposed measurable baseline, pending client sizing and service-level approval  
**Applies to:** Public Website, Foundation Web Admin, Healthcare Center Portal, Public Android, Internal Android, centralized backend, database, documents and third-party integrations.

## 1. How to read this without overengineering

The CareGanga requirements PDF directly requires secure authentication/session management, backend role and geographic scope enforcement, reliable payment/ledger posting, cross-platform data consistency, logging, backup/recovery, responsive UIs, and secure center/healthcare access (S-01 pp. 5–6, 40–43, 52, 57–59). These are **source-backed functional/quality obligations**.

The PDF does **not** specify numeric response-time, availability, recovery or load limits. The numeric targets below are therefore **professional starting proposals**, not claims made by the client. Ratify production volume, hosting/budget and SLAs before treating targets as contractual acceptance criteria. Do not use hypothetical numbers as excuse to drop crucial data integrity or security requirements.

**Priority markers:** **P0** = mandatory to call a relevant workflow production-ready; **P1** = recommended launch service target to approve with client; **P2** = later improvement or policy-dependent. NFRs are shared requirements: PRDs **reference these IDs** and add only module-specific exceptions, rather than duplicating a separate NFR checklist in 21 documents.

## 2. One-page acceptance scorecard

| Group | Non-negotiable P0 behaviour | Proposed measurable starting target / verification |
| --- | --- | --- |
| **Security / isolation** | Backend enforces roles, geography, center and sensitive-data access on all reads/writes/exports; secure login, session and 2FA support | Negative tests using public, staff, Foundation Admin and two unrelated centers; **zero cross-scope data disclosures** |
| **Booking integrity** | No double-booking, inconsistent auto-center assignment or silent fee change | 20 simultaneous attempts to book one last slot → only permitted capacity succeeds; every other gets accurate unavailable response |
| **Financial integrity** | No duplicate payment, contribution, expense, payroll or ledger posting after retry/webhook | Replay payment callback and requests; verify **one** accepted monetary outcome per source event |
| **Consistency** | Same authoritative data across Admin, center portal, website and Android | State changes reflected on authenticated refresh; public cache invalidation proposed **≤60 seconds** after publish |
| **Performance** | Usable listings, search, role-scoped dashboards, saves and appointment selections | Proposed API **p95 ≤1.0s** for common reads/writes; complex reports separately profiled; website field Core Web Vitals measured |
| **Reliability** | No hidden failure, lost approved work or half-completed financial transition | Defined retry/recovery tests for gateway, uploads, network interruption and notification provider failures |
| **Availability / recovery** | Restore path and accessible backups tested; failures discoverable | Proposed **99.9%** measured monthly application availability, **RPO ≤1 hour**, **RTO ≤4 hours**, budget/service design to be confirmed |
| **UX/accessibility** | Clear mobile-first workflows and useful errors; no misleading success | Design review, keyboard/focus/contrast checks, usable 360px smartphone layout; aim WCAG 2.2 AA for web |
| **Auditability** | Trace privileged, money, approval, clinical-access and publication decisions | For a sampled action, actor/time/scope/record/old-new state or decision can be reconstructed without logging secrets |
| **Operations/observability** | Key service failures and business exceptions are visible to operators | Alerts for repeated payment mismatch, booking conflicts, job failures and backup failure; tested before release |

External reference guidance (recommendations, not automatic contractual obligations): [OWASP ASVS 5.0](https://asvs.owasp.org/), [OWASP MASVS](https://mas.owasp.org/MASVS/03-Using_the_MASVS/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [web.dev Core Web Vitals](https://web.dev/articles/vitals).

## 3. Security, identity, session and privacy — P0

- **CG-NFR-SEC01 (source-backed):** Authorize **each** protected API, file, report/export, list, search, reference selector and mutation on backend with both the user's action permission and permitted organization/geographic/branch/healthcare-center scope. Never trust browser/mobile filters or a supplied entity ID as proof of authorization.
- **CG-NFR-SEC02 (source-backed):** Protect the distinction between **public, member, employee, volunteer, beneficiary, patient, doctor, finance officer, center staff and Foundation Admin**. A person having multiple relationships does not collapse their purpose-based access or expose unrelated sensitive records.
- **CG-NFR-SEC03 (source-backed):** A center administrator/receptionist/doctor may only access the patient's data, bookings, documents and collections that their approved center or professional assignment and purpose permit. Foundation reporting access does not automatically imply unrestricted clinical viewing.
- **CG-NFR-SEC04 (source-backed):** Provide secure authentication, password recovery/change, session expiry/revocation, protected admin access and **support for two-factor authentication** for sensitive accounts. MFA enforcement policy (which roles must use it) is a client decision; **proposed P0** for Super Admin, finance and healthcare administrator privileged roles.
- **CG-NFR-SEC05 (proposed P0):** Secure network connections; never store credentials, provider API secrets, payment card data or OTPs in logs or public content. Use approved payment provider-hosted mechanisms for sensitive payment credentials.
- **CG-NFR-SEC06 (proposed P0):** Prevent common authorization, injection, XSS, CSRF and authentication attacks using risk-based OWASP ASVS verification; Android controls should be assessed with OWASP MASVS. The **security test evidence** is the acceptance criterion, not an assertion of certification.
- **CG-NFR-SEC07 (proposed P0):** Rate-limit/abuse-protect authentication, OTP, public booking search, booking verification, payment operations and document download; provide human-friendly throttling errors and fraud/abuse visibility.
- **CG-NFR-SEC08 (source-backed + proposed P0):** Validate uploads by allowed type, genuine content, size and ownership; securely store identity proofs, employee documents, financial bills and medical files, and allow only expiring/authorized access. Malicious upload and unauthorized URL guessing must not reveal data.
- **CG-NFR-SEC09 (proposed P0):** Maintain appropriate consent, notice, purpose limitation and retention/deletion configuration for personal and health information; do not publish a beneficiary/patient testimonial or medical record simply because an admin can upload it.
- **CG-NFR-SEC10 (proposed P0):** Public QR/barcode/booking verification returns a minimal booking-validity result and only deliberately non-sensitive details. Booking ID, patient ID and mobile number alone must not expose medical reports or unrestricted patient profiles.
- **CG-NFR-SEC11 (proposed P0):** Log protected data reads/exports and important configuration changes sufficiently for accountability without logging consultation notes, raw report contents, identity documents, passwords, OTPs or sensitive payment tokens.
- **CG-NFR-SEC12 (proposed P0):** Role and account suspension must remove effective access on next authenticated action or within a documented short revocation bound; stale mobile caches must not permit privileged online work.

## 4. Data integrity, transaction correctness and concurrency — P0

- **CG-NFR-DAT01 (source-backed):** One authoritative source for each business record; no competing membership/profile, doctor-at-center, approval, patient, financial posting or public CMS shadow masters.
- **CG-NFR-DAT02 (source-backed + proposed P0):** All protected business transitions are atomic from the user's perspective: **no approved-without-required-verification, confirmed-and-unavailable appointment, paid-but-unreconciled success claim, or payroll-paid-without-financial-record**. Where external systems require asynchronous reconciliation, show an accurate pending state.
- **CG-NFR-DAT03 (proposed P0):** Idempotent processing of payment callbacks, appointment confirmations, refunds, membership approvals, voucher posting, expense reimbursements, payroll payment batches, stock issuance and reward redemption. Retrying an accepted request must not duplicate a consequential record.
- **CG-NFR-DAT04 (source-backed):** Enforce doctor-center-specific slot capacity across public web, Android and center reception. Cancellation/timeout/retry paths must restore the correct available capacity and preserve history.
- **CG-NFR-DAT05 (proposed P0):** The same doctor-center-slot is never sold twice beyond configured capacity. **Test proposal:** 20 synchronized attempts on one remaining appointment slot; one accepted result for capacity=1 and consistent rejection/status for other attempts.
- **CG-NFR-DAT06 (source-backed):** Price/contribution/payment snapshots at booking time preserve accepted gross charge, Foundation obligation and patient amount. Changes to rules/fee later affect only eligible future transactions, not silently rewrite historical receipts.
- **CG-NFR-DAT07 (source-backed):** Financial amounts reconcile using precise monetary units/rounding, with **gross charge = patient liability + Foundation contribution** for applicable support cases, and paid + due + adjustments/refunds tracked explicitly. Contributions are not counted as patient cash receipts.
- **CG-NFR-DAT08 (proposed P0):** Correction, cancellation, refund, transfer, status changes and backdated edits use permitted business reversals/adjustments with history; finalized monetary or approved evidence is never silently overwritten.
- **CG-NFR-DAT09 (source-backed):** Patient/account linking, approved membership IDs, employee IDs, branch codes, appointment references, invoices and receipts are uniquely attributable and robust to concurrent creation; no accidental duplicate IDs.
- **CG-NFR-DAT10 (proposed P0):** Approval route, delegated scope and reviewer authority are evaluated at decision time and recorded; a revoked reviewer or invalid pending state cannot approve via stale mobile screen.

## 5. Responsiveness, throughput and scale — P0 correctness / P1 numeric targets

- **CG-NFR-PER01 (proposed P1):** **Common API read/save** actions (excluding third-party processing and heavy exports) target **p95 server response ≤1.0 second** at agreed representative load; permission checks are included. Record p50/p95 and failure rate separately by endpoint class.
- **CG-NFR-PER02 (proposed P1):** Directory searches/filtered lists (members, projects, doctors, centers, patients and transactions) target **p95 ≤1.5 seconds** for representative scoped data; use paging rather than loading an unbounded record set.
- **CG-NFR-PER03 (proposed P1):** Public core pages on representative mid-range Android/4G target **LCP ≤2.5 seconds, INP ≤200 ms and CLS ≤0.1** at the 75th percentile, subject to agreed measurement setup. Prioritize critical public registration, donation and healthcare booking journeys.
- **CG-NFR-PER04 (proposed P1):** A confirmed booking action returns an accurate booking result **within 3 seconds** after required external payment confirmation is available; external payment time is excluded from internal timing. Never fake “instant paid” confirmation before authoritative gateway verification.
- **CG-NFR-PER05 (proposed P1):** Initial load scenario for capacity verification: **100 concurrent active users**, including public browse/booking, staff approvals, and center operations, with **20 competing last-slot attempts**. Actual expected user counts, data sizes, number of centers and peak workloads must be confirmed before the benchmark becomes acceptance criteria.
- **CG-NFR-PER06 (proposed P0):** Large reports, exports, media processing and scheduled jobs must not block time-sensitive appointment, payment, attendance and approval operations; export request shows queued/running/ready/failed appropriately if non-instant.
- **CG-NFR-PER07 (proposed P0):** Public website and Android should be navigable and responsive at common smartphone, tablet and desktop widths; center reception workflows should work on desktop/tablet without unnecessary scrolling.

**No premature complexity:** Do not require microservices, message brokers or separate databases merely to meet these BR-level expectations. Select the smallest architecture that can demonstrate them.

## 6. Availability, failure management, backup and recovery — P0 / proposed P1 SLA

- **CG-NFR-REL01 (source-backed):** Provide an observable failure state and safe retry for payment provider timeout, duplicate webhook, SMS/email delivery failure, GPS unavailable, interrupted document upload, provider scheduling conflict and unavailable external services.
- **CG-NFR-REL02 (proposed P0):** A failed notification **must not reverse a successful payment, booking or approval**; a failed payment must not be shown as paid just because a notification succeeded.
- **CG-NFR-REL03 (proposed P1):** Proposed monthly uptime target **99.9%** for production application interfaces, excluding explicitly approved planned maintenance and measuring provider dependencies separately. Final SLA, incident escalation and monitoring window require client approval.
- **CG-NFR-REL04 (source-backed + proposed P1):** Centralized, securely restricted backup/restore process, with proposed **RPO ≤1 hour** and **RTO ≤4 hours** for critical production data, contingent on agreed hosting, operations and budget.
- **CG-NFR-REL05 (proposed P0):** Verify a real backup restore against a non-production recovery target **before go-live** and periodically thereafter; record results and access restrictions. Never let center staff perform unrestricted database restores.
- **CG-NFR-REL06 (proposed P0):** Scheduled/background work (reminders, report generation, notifications, reconciliations) has visible failure/retry state and avoids duplicate records.
- **CG-NFR-REL07 (proposed P0):** Degraded fallback when map, image, email, push or payment services are unavailable: provide appropriate text address/contact, saved draft/error state, and a safe non-payment or retry path as the approved business policy allows.
- **CG-NFR-REL08 (proposed P0):** Planned maintenance, emergency rollback and restore decisions must preserve traceability of finance and medical records. A deployment must not silently delete production data or require all users to log in again repeatedly.

## 7. Audit, diagnostics, operations and support — P0

- **CG-NFR-OPS01 (source-backed):** Record who performed important role/permission, approval, voucher, ledger, payment, settlement, payroll, patient-record-access, provider verification and CMS publication actions, with time, scope and record reference.
- **CG-NFR-OPS02 (proposed P0):** Operators can correlate one user-reported booking/payment/approval issue across API request, source record, gateway status and relevant jobs using a non-sensitive correlation reference. Do not print PII or secrets into diagnostic logs.
- **CG-NFR-OPS03 (proposed P0):** Alert on repeated booking conflicts, failed payment reconciliation, rejected jobs, data-scoping anomalies, storage/backup failures and critical API failures. Alert routing/thresholds belong in operational configuration, not a new business module.
- **CG-NFR-OPS04 (proposed P0):** Expose understandable statuses to users: Draft, Submitted, Pending Review, Returned, Approved, Rejected, Confirmed, Due, Part-Paid, Paid, Failed, Refunded as context requires; no generic "success" toast on failed backend writes.
- **CG-NFR-OPS05 (proposed P1):** Maintain an incident response and escalation contact, backup operator, periodic access review and release/runbook handoff proportionate to project staffing.
- **CG-NFR-OPS06 (source-backed):** Keep help/support tickets and relevant communication history visible to authorized center and Foundation staff, with scoped ownership and status.

## 8. Usability, accessibility and localization — P0 / P1 target

- **CG-NFR-UX01 (proposed P0):** Distinguish public services, Foundation operations and center operations in navigation; show relevant modules only, with no duplicate settings for one policy.
- **CG-NFR-UX02 (proposed P0):** Every critical form identifies required fields, preserves completed entries after recoverable errors, confirms irreversible actions and exposes friendly validation and next-step feedback.
- **CG-NFR-UX03 (proposed P0):** At every appointment/payment stage clearly show **doctor, center, date/time, gross fee, valid contribution and amount due**; do not imply support eligibility before determined.
- **CG-NFR-UX04 (proposed P0):** Public and internal Android experience must prioritize relevant tasks (book, join, donate; field capture, approvals, attendance) without replicating a cluttered desktop menu on a small screen.
- **CG-NFR-UX05 (proposed P1):** Website and center portal target **WCAG 2.2 AA** where practical: keyboard/focus navigation, form labels, adequate contrast, errors and touch target usability. Accessibility checks must cover critical flows.
- **CG-NFR-UX06 (proposed P0):** Support the exact required languages and local formatting once approved; do not hardcode English strings across screens. India-friendly dates, INR and phone/address formats are required for applicable workflows.
- **CG-NFR-UX07 (proposed P0):** Paid receipt vs cash-due slip must be visually unmistakable. PDF, print and share layouts remain readable at A4 and on smartphone preview without truncating amounts, patient identifiers or center details.
- **CG-NFR-UX08 (proposed P1):** Critical forms should have short task-focused steps and contextual help; no extra mandatory fields that do not serve a source requirement, safety or legal obligation.

## 9. Public discovery, CMS and SEO — P0 / P1

- **CG-NFR-WEB01 (source-backed):** Authorized CMS publishing updates the public website/app consistently; old drafts or unpublished information cannot remain exposed through an alternate public URL.
- **CG-NFR-WEB02 (proposed P1):** Authorized published changes normally visible within **60 seconds** after publish/refresh, with explicit documented cache behaviour when higher latency is needed.
- **CG-NFR-WEB03 (proposed P1):** Published public pages have canonical URLs, appropriate titles/descriptions, useful internal links and crawlable service/provider/project information; **private profile, patient, admin, receipt and draft URLs must not be indexable**.
- **CG-NFR-WEB04 (proposed P0):** Do not hardcode sample doctors, ratings, prices, beneficiary counts, provider verification badges, support percentages or locations from the mockups. Empty/unavailable states must be truthful.
- **CG-NFR-WEB05 (proposed P0):** Publishing a center does not bypass its eligibility/verification status; publishing a membership plan does not alter its fee; CMS permission does not authorize finance or medical business changes.

## 10. Mobile-specific and integration behaviour — P0

- **CG-NFR-MOB01 (source-backed):** Public and internal Android use the same authoritative backend business rules; relevant role/center/branch changes cannot be bypassed from a cached mobile screen.
- **CG-NFR-MOB02 (proposed P0):** Interrupted network/upload displays clear pending/failure state and supports safe retry without duplicate expenses, visits, patient registrations, payments or bookings.
- **CG-NFR-MOB03 (proposed P0):** Only collect GPS when the applicable approved field-work business action needs it, disclose permission purpose, and permit a defined exception route if location permission is unavailable. **No general offline synchronization requirement is inferred** from the source.
- **CG-NFR-MOB04 (proposed P0):** Mobile local caches/files/tokens containing sensitive HR, financial or clinical information are secured; logout/revocation removes privileged access to them according to approved device policy.
- **CG-NFR-INT01 (source-backed):** Payment provider, SMS/email/WhatsApp/push and maps/GPS integrations have centralized configuration, verified responses, correct permissions and recorded status.
- **CG-NFR-INT02 (proposed P0):** Integration secrets never leave backend/admin configuration, webhook and gateway authenticity are verified, and intermittent provider failures do not silently break the underlying business record.
- **CG-NFR-INT03 (proposed P0):** Any external-provider or statutory dependency requiring paid credentials/onboarding (for example messaging sender verification or payment merchant setup) has a documented responsibility and fallback/blocked feature state; do not mask missing credentials as a working feature.

## 11. Maintainability, release and data lifecycle — P0

- **CG-NFR-MNT01 (proposed P0):** Business validations, approval rules, monetary calculation, slot allocation and record-level authorization are enforced server-side and reused by all channels.
- **CG-NFR-MNT02 (proposed P0):** Use module boundaries in CG-BR-000; one source owner per entity, explicit cross-module references and migrations. New menus/features must not create duplicate tables or ledgers without a justified ownership change.
- **CG-NFR-MNT03 (proposed P0):** Changes to policies, role permissions, fee/eligibility and schema have reviewable version/change history and safe rollback or corrective operation. Critical accepted documents retain original policy snapshot.
- **CG-NFR-MNT04 (proposed P0):** Maintain a clear production deployment/recovery procedure, access separation for production credentials, and database migration review.
- **CG-NFR-MNT05 (proposed P0):** Data retention, archival/export and deletion of private or medical records follow agreed Foundation governance and legal counsel's policy; do not invent fixed retention periods in engineering.
- **CG-NFR-MNT06 (proposed P0):** Manual QA test cases must trace UI/action → backend authorization/validation → correct domain record → event/financial effects → report/public/mobile effect and verify error paths. Automated checks may support but do not replace requested manual review.

## 12. Module-specific non-negotiable gates: reference, do not clone

| Module(s) | Mandatory NFR evidence on top of shared rules |
| --- | --- |
| **CG-01/02/03** | Role revocation, geography scoping, Super Admin protected actions, approved state only after correct final decision |
| **CG-04/13** | Single accepted member ID and referral reward per eligible registration; approved document and expiry history |
| **CG-05/06/12** | GPS evidence validation, restricted beneficiary detail, no negative/duplicated stock issue due to concurrent fulfillment |
| **CG-07/08/09** | Gateway confirmation, donor receipt and CSR/project allocations reconcile with books; refunds and posting idempotency |
| **CG-10/11** | Private employee salary/files, attendance and leave consistency, single payroll payment record per employee/period/batch |
| **CG-14/15** | Provider/doctor verification gates, cross-center isolation, single slot inventory, safe patient QR and consent |
| **CG-16** | Report access/sign-off and correct sample status; never expose lab result to another patient |
| **CG-17** | Foundation liability and patient paid/due are separate; no silent rate override; settlement and refund reconciliation |
| **CG-18** | Draft vs published isolation, no operational data duplication, verified public listings, safe SEO visibility |
| **CG-19/20/21** | Document permissions, recipient confidentiality, authorized exports, audit, backup and verified recovery |

## 13. Required manual QA evidence template

For each applicable NFR ID and PRD scenario record:

**NFR ID | business journey | actor/scope | test data & precondition | web/Android/portal action | API/database/ledger outcome | negative/retry/concurrency case | observed result | pass/fail | issue and fix reference.**

A workflow cannot be called production-ready if **one of the relevant P0 gates fails**, even when happy-path UI appears correct.

### Minimal core acceptance suite (cross-app)

1. **Two-center isolation:** Center A user attempts Center B patient, slot, collections, documents and reports through UI and API: all unauthorized operations denied.
2. **Geography and role isolation:** District-only officer attempts other district records, approval, exports and lookup controls: denied, while valid current district workflow works end to end.
3. **Race booking:** Two or 20 clients attempt last available slot: never over capacity; summary, receipt and center queue match the winner.
4. **Money retry:** Retry webhook, back button, mobile intermittent network, duplicate callback and cash confirmation: no extra receipt, contribution, ledger posting or provider settlement.
5. **Approval safety:** Revoked reviewer, expired/returned application, concurrent approve and reject, repeated request: only valid authorized transition.
6. **Payroll/stock/reward safety:** Repeated posting/fulfilment or concurrent redemption does not pay twice, deduct twice or issue negative stock without approved exceptional policy.
7. **Public content safety:** Draft/disabled content unavailable publicly, CMS change visible on both public channels, operational owner rules unaffected.
8. **Patient privacy:** Guessing Booking ID/QR/Patient ID cannot expose diagnoses, medical reports or unverified profile.
9. **Failure and restore:** Payment provider offline, email send fails, interrupted file/GPS request, backup restore drill: truthful recoverable states and no silent data loss.
10. **Device/UX:** Public mobile, internal Android and responsive web complete a representative core task with proper validation, readable paid/due documents and no confusing duplicate navigation.

## 14. Formal acceptance and sizing decisions

These questions **must be completed before final numerical SLA approval** but do not hold up documenting P0 integrity/security requirements:

| ID | Required input | Why it matters |
| --- | --- | --- |
| **NDEC-01** | Expected registered users, peak concurrent active sessions, number of centers/doctors, slots/day, documents and annual growth | Final load/performance data sizes |
| **NDEC-02** | Hosting provider, budget, support hours and maintenance window | Availability, RPO/RTO feasibility |
| **NDEC-03** | Required languages, accessibility target and baseline device/network profile | Web/Android test acceptance |
| **NDEC-04** | Client-approved retention/consent, clinical record access, publication of beneficiary stories, legal and regulatory advice | Privacy/governance acceptance |
| **NDEC-05** | Merchant ownership, bank accounts, payment settlement schedule and PSP credentials | Financial integrity and failure response |
| **NDEC-06** | Which admins are required to use 2FA and admin password/session rules | Authentication policy |
| **NDEC-07** | Messaging/push/WhatsApp providers, sender registration and delivery expectations | Notification acceptance |
| **NDEC-08** | Whether there is an explicit offline field-work requirement | Avoid inventing a costly offline sync engine |

**Scope discipline:** These are quality requirements and risk-control checks, **not** new product modules, independently chargeable features, or an instruction to introduce a complex distributed architecture. PRDs should link the relevant IDs and HLD/DLD should determine economical implementation details.
