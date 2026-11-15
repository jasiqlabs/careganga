# CG-04 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT; [module](module.md), [PRD](../../prd.md) FR-009, FR-010, FR-011, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** PRD/HLD current approval REVIEW_REQUIRED, authenticated local resolver and hash-bound module/task/design approvals NOT_RUN. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Proposed task definitions — dependency ordered, NOT YET APPROVED

### US-001 — Configure tier price, validity, benefits/appearance and publication

Outcome: Configure tier price, validity, benefits/appearance and publication; maintain member roster, expiry, renewal history, status and protected information changes.
Requirements: FR-010, CG-04-BR02, CG-04-BR04, CG-04-BR06; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-04 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Create and version tier price/validity/benefits with approval-only publication and genuine scoped picker. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-001-QA01:** Given an authorized actor and actual prerequisite records, create and version tier price/validity/benefits with approval-only publication and genuine scoped picker. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-001-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-001-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-001-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-001-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-001-QA06:** Original CareGanga screenshot refs B09, B10, U14, U15, U16, U17, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — Source-specific boundary:** Deactivate a currently published paid tier while a valid member renews; old approved term remains historical, renewal follows the currently authorized eligible tier version and never silently changes past fees.
Verification: On actual implementation source-trace US-001-QA01–QA07 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — Select configured public membership tier, provide…

Outcome: Select configured public membership tier, provide contact/address/referral/documents, pay applicable fee, track review, and receive member ID/certificate/card **only after required conditions**.
Requirements: FR-009, CG-04-BR01, CG-04-BR02, CG-04-BR03, CG-04-BR04, CG-04-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-04 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Register verified applicant and track real payment/approval state; only active approved member receives real card. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-002-QA01:** Given an authorized actor and actual prerequisite records, register verified applicant and track real payment/approval state; only active approved member receives real card. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-002-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-002-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-002-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-002-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-002-QA06:** Original CareGanga screenshot refs B09, B10, U14, U15, U16, U17, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — Module-critical regression:** A paid membership application is rejected after verified fee receipt, then a duplicate refund callback occurs. Expected: the membership stays rejected, finance authorizes a single full joining-fee refund, no member number/card is issued and the applicant sees the actual refund status.
- **US-002-QA08 — Source-specific boundary:** Submit a paid tier application, change the tier price during review, then reject the application; retain accepted fee snapshot, one approved refund trail, and issue neither member ID nor card.
- **US-002-QA09 — transferred branch owner QA:** Register/renew an actual member linked to an authorized ACTIVE CG-02 branch. Verify CG-04 owns the member↔branch association/history and enforces scope on list/options/detail; closed or foreign branch rejected, a CG-02 branch remains unchanged, no synthetic CG-10 employee or CG-18 publication required.
- **US-002-QA10 — true CG-04-issued member document via CG-19:** After actual CG-04 member approval, verified CG-09 fee state and CG-03 final decision, request front/back ID card/certificate from shared CG-19 versioned template using only authorized current CG-04 member/branch/photo/expiry fields. Only then issue one real protected PDF/card and QR minimal allowed verification; changing name/photo/expiry uses a new audited issuance rather than editing issued bytes. Rejected/pending/refunded member, guessed PDF URL or revoked reader cannot receive a valid document. CG-19 itself owns template/media/issued file but never creates a fake member master, membership tier or finance balance.
Verification: On actual implementation source-trace US-002-QA01–QA10 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: US-001

### US-003 — Apply with personal/geographic profile, skills, experience, preferred…

Outcome: Apply with personal/geographic profile, skills, experience, preferred department, schedule, referral and identity evidence; receive verified status and authorized assignments.
Requirements: FR-011, CG-04-BR07, CG-04-BR08, CG-04-BR09, CG-04-BR10, CG-04-BR11; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: CG-04 owns the full responsive Web/eligible native Android/backend/API/DB workflow. Implement all required BR fields, real references and domain rules, not mock future owners.
Acceptance: Submit volunteer skill/area availability, preserve review and restrict private assignments. Reject invalid/foreign scope, stale edits, retries and provider uncertainty with truthful persisted result and user-facing state; original CareGanga appearance is mandatory.
QA cases:
- **US-003-QA01:** Given an authorized actor and actual prerequisite records, submit volunteer skill/area availability, preserve review and restrict private assignments. Verify actual applicable Web/Android state, backend guard, correctly committed domain operation and audit without invented future data.
- **US-003-QA02:** A revoked, unprivileged or out-of-scope actor uses a deep link, direct API, related selector or export → backend denies, UI shows a safe next action, no private data or mutation escapes.
- **US-003-QA03:** Two concurrent submissions or a replay/lost response → scoped row revision and unique source prevent duplicate effect, show accurate conflict/refresh.
- **US-003-QA04:** Invalid field, absent source, unavailable required owner/provider or uncertain network result → distinct field error/empty/pending/unavailable UI, no invented success, safe retry.
- **US-003-QA05:** Authorized second channel/report/related owner sees same real state; restricted read remains denied, absent future integration honestly unavailable.
- **US-003-QA06:** Original CareGanga screenshot refs B09, B10, U14, U15, U16, U17, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-003-QA07 — Source-specific boundary:** Volunteer applies with Weekends Only and approved CG-02 department; a reviewer returns missing identity evidence, applicant corrects/resubmits, and no Internal Android staff privileges appear merely from volunteer approval.
- **US-003-QA08 — transferred branch owner QA:** Submit/approve actual volunteer with permitted CG-02 branch/department preference and effective-dated CG-04 volunteer assignment. Wrong/closed branch or department denied, stale assignment rejected, old history retained on change; no CG-02 volunteer master or automatically granted CG-01 staff role. Web/Android show authentic state.
Verification: On actual implementation source-trace US-003-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
