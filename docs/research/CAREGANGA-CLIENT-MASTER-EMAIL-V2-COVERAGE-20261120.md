# CareGanga — client Master Email Templates v2.0, 52-trigger source inventory

**Client source:** *CareGanga_Final_Master_Email_Templates_Developer_Handover.docx*, version 2.0, dated 29 October 2026 (22 pages), exact SHA-256 `2572f999668aacd5a7bd08de08b44bcfd6bae4fafd6d33596a5f0a671e97585b`. Full parsed text is committed at [client-reference-20261120/master-email-spec-v2-parsed.txt](client-reference-20261120/master-email-spec-v2-parsed.txt). The original DOCX remains the authority for content/format; do not invent omissions from text extraction. Source has **52** distinct templates.

**Current main source truth:** CG-19 notification service currently auto-seeds a short generic decision email plus notice text; `cg19_message_template` enforces only `CG03_DECISION`/`NOTICE` and a 480-character body. The 52 client workflows are **not already implemented** simply because generic email delivery/outbox code exists. Scope and implementation depend on the genuine owning source events; do not seed messages for modules not developed.

## Complete client template inventory

| Template ID | Original client title | Source/receiving owner |
| --- | --- | --- |
| CG-MEM-001 | Application submitted / admin notification | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-002 | Membership payment successful + receipt | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-003 | Documents received | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-004 | Documents verified | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-005 | Documents rejected / correction required | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-006 | Application sent back | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-007 | Final membership approval + full document pack | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-008 | Application rejected | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-009 | General Membership renewal reminder | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-010 | Renewal payment confirmed | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-MEM-011 | Renewal rejected / renewal sent back | CG-04 / CG-03 / CG-09 / CG-19 |
| CG-VOL-001 | Volunteer application submitted | CG-04 / CG-03 / CG-19 |
| CG-VOL-002 | Volunteer documents received | CG-04 / CG-03 / CG-19 |
| CG-VOL-003 | Volunteer documents verified | CG-04 / CG-03 / CG-19 |
| CG-VOL-004 | Volunteer documents rejected / sent back | CG-04 / CG-03 / CG-19 |
| CG-VOL-005 | Volunteer application approved + full document pack | CG-04 / CG-03 / CG-19 |
| CG-VOL-006 | Volunteer application rejected | CG-04 / CG-03 / CG-19 |
| CG-VOL-007 | Volunteer renewal reminder | CG-04 / CG-03 / CG-19 |
| CG-DON-001 | Donation successful + donation slip | CG-07 / CG-09 / CG-19 |
| CG-DON-002 | Possible duplicate donation/payment detected | CG-07 / CG-09 / CG-19 |
| CG-DON-003 | Duplicate payment confirmed / next steps | CG-07 / CG-09 / CG-19 |
| CG-REF-001 | Refund request received | CG-07 / CG-09 / CG-19 |
| CG-REF-002 | Refund approved / processing | CG-07 / CG-09 / CG-19 |
| CG-REF-003 | Refund rejected | CG-07 / CG-09 / CG-19 |
| CG-REF-004 | Refund processed | CG-07 / CG-09 / CG-19 |
| CG-REF-005 | Refund failed/delayed | CG-07 / CG-09 / CG-19 |
| CG-EMP-001 | Employee registration submitted | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-002 | Employee documents submitted/received | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-003 | Employee documents verified | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-004 | Employee documents rejected / sent back | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-005 | Employee approved + offer/approval/appointment documents | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-006 | Joining confirmed + joining letter | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-007 | Employee login, role and access assigned | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-008 | Employee account/role access changed | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-EMP-009 | Employee account suspended/deactivated | CG-10 / CG-03 / CG-01 / CG-19 |
| CG-DES-001 | Designation application submitted | CG-10 / CG-03 / CG-19 |
| CG-DES-002 | Designation documents verified / rejected / sent back | CG-10 / CG-03 / CG-19 |
| CG-DES-003 | Designation approved + certificate | CG-10 / CG-03 / CG-19 |
| CG-DES-004 | Designation certificate expiry/renewal reminder | CG-10 / CG-03 / CG-19 |
| CG-PROM-001 | Promotion approved | undefined |
| CG-PROM-002 | Updated ID card/certificate/letter issued | undefined |
| CG-PROM-003 | Renewal approved / new ID card issued | undefined |
| CG-SAL-001 | Salary generated / payroll approved | CG-11 / CG-09 / CG-19 |
| CG-SAL-002 | Salary disbursed / payment confirmed | CG-11 / CG-09 / CG-19 |
| CG-SAL-003 | Salary delayed/failed | CG-11 / CG-09 / CG-19 |
| CG-SAL-004 | Salary slip resent through support request | CG-11 / CG-09 / CG-19 |
| CG-SUP-001 | Support request received | CG-19 |
| CG-SUP-002 | Ticket status updated | CG-19 |
| CG-SUP-003 | Document resend completed | CG-19 |
| CG-SUP-004 | Ticket waiting for information / cannot fulfil yet | CG-19 |
| CG-SUP-005 | Ticket closed | CG-19 |
| CG-SUP-006 | Internal notification: new ticket / assignment | CG-19 |

## Client-wide implementation controls (section A & K, do not weaken)

- Transactional sender `noreply@careganga.com` only after client verifies DNS/provider/monitored support reply handling; configure, don't hardcode. Transactional template master is database-backed: ID, version, language, subject/body, enabled/approved flag, recipient, trigger event, attachment contract and owning team; legal templates require authorized version approval.
- Trigger **after the owning state is committed**, not on a button click or queued provider intent. Use unique business event + template ID + recipient + approved document version as logical dedup key; retry provider sends safely; separately retain accepted, delivered, bounced, failed, suppressed and unknown outcomes; do not promise delivery from accepted submission alone.
- Snapshot/verify recipient destination, entity/realm/root scope, role/authorization, consent/channel and current revocation. No guessable public KYC/medical/bank/salary files; use approved PDF or short-lived access-controlled links; never send plaintext passwords.
- Final **member approval**: all Member ID Card, Welcome Letter and Membership Certificate PDFs exist, approved and verified before one complete pack is queued. **Volunteer approval**: corresponding three PDFs; volunteer application is free. Do not conflate application submitted, documents received, documents verified and final approval.
- Membership payment/renewal and **donation** paid receipt only after provider-confirmed success; donation has **no separate donation approval stage**; duplicate payment gets distinct review, not a duplicate receipt; refund status Requested → Under Review → Approved → Processing → Processed/Failed/Rejected; “processed” only after provider confirmation.
- Employee offer, approval, appointment and joining PDFs only after each real HR event; secure access-onboarding communication is separate. Role/designation/promotion/office changes are audited and updated approved documents supersede old versions.
- Salary slip is employee-only after payroll approved (not proof of disbursement); payment-complete message only after bank/provider confirmation. Support document resend requires verified registered requester, authorized current approved document and ticket/delivery audit.
- Expiry reminders only if the record has an expiry + published renewal policy; avoid lifetime/N/A, renewed, cancelled records and invented volunteer renewal fee.
- 80G or other tax relief language only if exact current legal status and receipt wording are approved. Corporate identifiers, contact details and authorized signatures must be sourced from verified CG-21/CG-02 configuration, not artwork.

## Event contract and attachment-ready gate

A real owner publishes committed `event_id, event_type, source_id, source_revision, root/branch_scope, occurred_at`, with permitted recipient keys, then CG-19 resolves a stable template and validates **all required finalized PDF versions**. If any mandatory file is unavailable, **do not send an incomplete approval pack**; persist pending/internal alert and safe recovery. Preserve outbox+delivery attempts, template version, sender, recipient, provider status, retry count, approved attachment IDs/versions, initiator and related application/payment/ticket ID. Never place sensitive fields or physical/object storage keys in public QR or logs.

## Integration delivery order

1. **CG-19 foundation enhancement** (separate scoped implementation approval): adaptable safe template master/events, provider adapter/outbox, exact text/attachment preview and delivery-log constraints. Reuse existing tables; no duplicate notification pipeline.
2. **Receiving source owners:** CG-04 member/volunteer, CG-07 donation/refund, CG-10 employee/designation/promotion, CG-11 payroll; CG-03 review result, CG-09 financial fact, CG-01 role/setup, CG-21 verified corporate metadata. Wire only the event types from source owners genuinely integrated into main.
3. **Web/Internal/Public Android as applicable:** recipient status/downloads and authorized template previews/editor in existing CG-19 screens, with backend scope enforcement and CG-01 visual semantics. Do not expose staff document packs in public browsing.
4. **JASIQ-dev gates:** Implement → independent security/DB/Web/native/UI review → fix → re-review → exact existing story QA source trace; rendered PDF side-by-side, provider sandbox, PostgreSQL migration, builds/device/accessibility and policy checks **NOT_RUN until executed**. Do not inflate existing module QA counts or mark completed based on this source ingestion.

**Unresolved client confirmations:** approved legal identity/80G/stamps/signature, current business fees/terms, official organization email/domain & monitored mailbox, refund eligibility, exact office/role policies, volunteer validity, and the `CG-EMP-007` setup-link conflict with current CG-01 direct password provisioning. See [five-design reference](CAREGANGA-CLIENT-DOCUMENTS-REFERENCE-20261120.md).
