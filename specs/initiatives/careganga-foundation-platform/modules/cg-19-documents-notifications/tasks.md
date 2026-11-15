# CG-19 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-070, FR-071, FR-072, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** CG-19 REVIEW_IN_PROGRESS (module and DLD corrected; UIUX/tasks final review pending). PRD/HLD v1.1 current approval REVIEW_REQUIRED; pinned Harness resolver and current-hash module/task/UIUX/DLD approvals NOT_RUN. Stories remain BLOCKED pending owner-confirmed continuation. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — NOT YET APPROVED

### US-001 — Generate versioned, permissioned membership/employee IDs, letters…

Outcome: Generate versioned, permissioned membership/employee IDs, letters, donation/financial receipts, appointment slips and PDFs with source-linked status, print/share and safe QR verification.
Requirements: FR-070, CG-19-BR01, CG-19-BR02, CG-19-BR05, CG-19-BR08; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-19 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Issue source-derived real CG-01/03 document or permissioned file/link and verify private sharing/access expiry. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-001-QA01:** Starting from actual authorized actor and implemented owner record: issue source-derived real CG-01/03 document or permissioned file/link and verify private sharing/access expiry. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner-specific regression:** Wrong actor/signed URL does not disclose patient, salary, agreement or bank files. Confirm correct database/remote state, access scope and user response under repeat or conflict.
- **US-001-QA08 — Source-specific contract:** Generate a front/back ID card or receipt for a real approved source record using versioned template, QR, issue/expiry and allowed fields; private salary/patient details must not appear via public QR or guessed download.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Provide configured email/SMS/WhatsApp/push, broadcast notice…

Outcome: Provide configured email/SMS/WhatsApp/push, broadcast notice, audience/priority/expiry/template control and observable delivery/failure history without duplicating module records.
Requirements: FR-071, CG-19-BR03, CG-19-BR04, CG-19-BR06, CG-19-BR09; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-19 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Send one permitted templated message after real owner event via bounded outbox/retry, with truthful delivery states. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-002-QA01:** Starting from actual authorized actor and implemented owner record: send one permitted templated message after real owner event via bounded outbox/retry, with truthful delivery states. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-002-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Source-specific contract:** Send a time-limited targeted notice to one authorized role; an SMS/WhatsApp provider timeout leaves pending/retry and one deduplicated delivery log, and a later revoked recipient cannot read the message.
Verification: On actual implementation source-trace US-002-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Track public contact/helpdesk and center support tickets/FAQs, owner…

Outcome: Track public contact/helpdesk and center support tickets/FAQs, owner, replies/status and restricted identity; share support workflow across channels.
Requirements: FR-072, CG-19-BR07; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-19 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create actual support request, assign authorized owner and record replies/closure with private attachments. Business result must agree with real authorized source, rejected/concurrent/retried state, permitted Web/native consumer and original CareGanga component/motion reference.
QA cases:
- **US-003-QA01:** Starting from actual authorized actor and implemented owner record: create actual support request, assign authorized owner and record replies/closure with private attachments. Expected: verified persisted result or accurately pending state, safe UI feedback and one audited owner transition.
- **US-003-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable verified provider/source or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B38, B41, B42, C15, C16, C17, C18, C35, C36, C39, C40, C41, C42, C43, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — Source-specific contract:** Public contact and center helpdesk requests share one scoped support source; Center A cannot view Center B's confidential ticket, and closing/reopening preserves assignment/response history.
Verification: On actual implementation source-trace US-003-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
