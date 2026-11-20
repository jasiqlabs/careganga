# CareGanga — client CG-19 code/fix/source trace and local QA handoff

**Branch ONLY:** `feature/careganga-client-document-email-references-20261120` → draft PR #14. **Base:** original `main` SHA `661045d363dcae4077e1b15366161b870c6e7d5d`; **source review checkpoint:** `f377e5361b53e263d3572940c0539f9dfca10e11` (further commits may update head). **Do not merge or push changes to main** until current branch has independent code/security/DB review and local QA evidence. Do not run GitHub CI/Actions. No real patient/member/donor/salary data or client sample signatures in test fixtures.

## 1. Implemented owner source in this feature branch

| Owner / QA | Exact source paths | Committed effect | Source review / execution |
| --- | --- | --- | --- |
| CG-19 US-003 QA01/03/05/08/09/12 | `apps/backend/db/migrations/1901_cg19_client_support_ticket_number.sql`, `application/support.service.ts` | Unique immutable display ticket for existing public AND center cases; existing private 43-char receipt remains status proof; no public case lookup by ticket | SOURCE_INSPECTED / DB NOT_RUN |
| CG-19 US-003 QA01/06/09/12/14 | `1903_cg19_client_support_states.sql`, `application/support.service.ts` | OPEN/ASSIGNED/IN_PROGRESS/WAITING_FOR_USER/ESCALATED/REPLIED/RESOLVED/CLOSED, versioned staff updates, distinct resolved-vs-closed presentation | SOURCE_INSPECTED / DB/device NOT_RUN |
| CG-19 US-003 QA02/03/06/08/09/12 | `1904_cg19_support_status_notes.sql`, `SupportService.mutate/detail` | Private immutable encrypted staff explanation for WAITING/RESOLVED/CLOSED; status CAS, safe transitions, scoped FK/actor/source, keyed HMAC | SOURCE_INSPECTED / DB/security NOT_RUN |
| CG-19 US-003 QA05/06/14 | `apps/web/src/features/support/foundation-support-workspace.tsx`; `apps/android-internal/src/features/support/foundation-support-screen.tsx`; `apps/web/src/features/health-network/center-support-desk.tsx`; public Web & Public Android contact forms | Single shared original support service; ticket parity across surfaces; accurate status labels and staff-only notes UI | SOURCE_INSPECTED / Web/device NOT_RUN |
| CG-19 US-002 QA12/13 | `application/client-email-template-source.ts`, `application/client-email-template.service.ts`, `1902_cg19_client_email_source_drafts.sql`, `http/communications.controller.ts`, `documents-notifications.module.ts`, Web BFF and Admin communications UI | Exact 52 client template copy, role-protected preview and idempotent `SOURCE_DRAFT` import only. **Database CHECK disables all sending**; source owner event integration NOT implemented | 52/52 SOURCE_COPY_MATCH / DB/Web NOT_RUN |
| CG-19 US-002 QA04/12/13/14 | `1905_cg19_email_body_channel_limit.sql`, `infrastructure/channel-providers.ts` | Email message body capacity 8–12000 without increasing original IN_APP/SMS 8–480 DB limits, notice 10–480 or Twilio 160 limit | SOURCE_INSPECTED / SQL/provider NOT_RUN |

All 52 client emails also have **one per-template original-trigger / owner / attachment / negative-acceptance row** in [matrix](CAREGANGA-52-EMAIL-TEMPLATE-SOURCE-QA-MATRIX-20261120.md). New artifacts do **not** add new canonical CG-19 QA case IDs: original story set US-001/002/003 (42 QA), nor mark earlier completion retrospectively.

## 2. Mandatory local commands (developer-controlled workstation only)

1. Fetch and switch to the *existing* feature branch. Confirm `git branch --show-current`, `git status --short`, and `git rev-parse HEAD`. Do **not** merge/rebase into main without later authorization. Back up all uncommitted local work before tests.
2. `npm ci` from workspace root. Use Node 22+ matching `package.json`; keep `.env` and credentials out of Git.
3. `npm run verify:cg19-client-source` — exact 52 source-copy, migration, guard and UI wiring assertions. Record actual exit status/stdout.
4. `npm run build -w apps/backend` and `npm run build -w apps/web` — record exit/output and fix compile/Next route issues **in this feature branch only**.
5. `npx tsc --noEmit -p apps/android-internal/tsconfig.json` and `npx tsc --noEmit -p apps/android-public/tsconfig.json`; launch both apps in appropriate Expo/dev builds for layout/touch/role proof.
6. `npm run verify:core-source`, `npm run verify:cg01-uiux-source`, `npm run verify:cg15-communications-source` plus project-specific validations affected by CG-19. Record any pre-existing failures separately; do not alter unrelated functionality.
7. On a **fresh disposable** PostgreSQL database with pretest backup, perform original ordered migrations through `1901`–`1905` using configured `DATABASE_MIGRATION_URL` and `npm run db:migrate`. Re-run migration idempotence, old-case backfill, rollback/restore and index/foreign-key constraints. **Never** point this step at production; inspect the migration runner's version ordering first.

No live SendGrid/Twilio messages should go to real people. Use approved sandbox/test recipients and disabled external sending when checking other behavior.

## 3. Execute CG-19 US-003 case matrix with true database and HTTP

| QA case | Required action / negative scenario | Expected source evidence |
| --- | --- | --- |
| US-003-QA01/03 | Public Web and Public Android send with identical `requestKey` replay; same ticket and receipt; a changed payload with same key is rejected | 1 case, 1 ticket, immutable request-key/receipt; 409 for changed content |
| US-003-QA05/08 | Guest POST `receipt/status` correct private receipt, guessed ticket, forged/expired receipt, wrong root, contact enumeration | Valid proof returns only safe ticket+status; forged/unverified gets safe 400/404/429; no note/contact or case-body leakage |
| US-003-QA01/06/14 | Foundation staff with support.cases.view opens case, assigns eligible operator, reads status history, sees current notes; wrong role does not see page/endpoint | BFF/backend permission + current role source; 403 on direct API bypass |
| US-003-QA03/09 | Two staff compete using same expected revision: assign/status/close with 2 distinct requests | One accepted; stale request conflicts 409; one audit and optional note per case revision |
| US-003-QA06/09 | OPEN→ASSIGNED→IN_PROGRESS→WAITING_FOR_USER→RESOLVED→CLOSED; force status changes with missing/short `note` | Note required 8–1200 on Waiting/Resolved/Closed; no missing/empty accepted; encrypted evidence audit survives |
| US-003-QA02/09 | CLOSED→ESCALATED, RESOLVED→IN_PROGRESS, ASSIGNED without assignee, reassign resolved/closed, unassigned rogue target | 409/403 as appropriate, original state unchanged; reopen OPEN before active work |
| US-003-QA06/14 | Web+Internal Android status picker, resolved-vs-closed text, helper/error, keyboard/a11y, narrow screen, back navigation, refresh | CG-01 consistent UI baseline; protected notes only staff, never guest |
| US-003-QA07/12 | Authorized center A sees only its cases/tickets; center B wrong-scope access & forged case ref | No leakage or cross-center ticket/case mutations; same CG-19 source, no second master |
| US-003-QA08/12 | Attempt direct UPDATE/DELETE of `cg19_support_status_note`, modify ticket_number, FK wrong actor/root, duplicate case+revision | Immutable triggers/FKs/unique constraint reject; no raw note plaintext in DB |
| US-003-QA10/11 | No scanner/object store/SMTP setup: public text contact + FAQ still works independently, no fake delivery | Real persisted case/FAQ and protected receipt; no outbound provider call |
| US-003-QA13 | FAQ publish/revision/withdraw with wrong role, HTML, duplicate question | Existing CG-19 behavior unchanged and permissioned |

## 4. Execute CG-19 US-002 email acceptance safely

| QA | Required data / procedure | Expected evidence |
| --- | --- | --- |
| US-002-QA12 | Preview list all 52 unique IDs; compare original DOCX subject, body, trigger, recipient, placeholders and required attachment rule | Exact 52 originals, not guessed data/approval |
| US-002-QA12 | Import from current Foundation Admin with `communications.notices.manage` twice / concurrent; replay after changed client source digest | First creates disabled `SOURCE_DRAFT`; second returns alreadyPresent, no duplication; mismatch 409/rollback |
| US-002-QA02/11 | Wrong role, revoked staff, wrong/root-scope, direct Nest and Web BFF route calls to catalog/import | Access denied; no leaked private source or unauthorized DB changes |
| US-002-QA04/12/13 | Existing generic CG03/NOTICE/CG15 email with verified sender/recipient, 480-char notice; EMAIL-only 481 to 12000 and >12000 body | Existing notice hard limit remains, EMAIL new bound only; signed status = accepted ≠ delivered |
| US-002-QA14/15 | SMS 160, Unicode segments, missing sender, verified recipient revoked before due send | Existing SMS limit and consent/revocation behavior unchanged; no phantom delivered |
| US-002-QA12/13 | Try to activate a client `SOURCE_DRAFT`, send a CG-SUP template without verified recipient, or send member/volunteer 3-PDF pack with any file absent | DB CHECK rejects activation; no event-specific mail or fake attachment/delivery; dependent owner stays PENDING |

## 5. Remaining boundary / truth

**No automatic event-driven sending of client 52 templates exists yet.** The CG-19 catalog is *source drafted* and the existing generic active outbox remains separate. A real business event + actual approved PDF versions + verified current recipient/contact + allowed legal/terms policy + provider delivery result are required before sending any of these templates. This is especially important for public support: submitted email/phone is not automatically a verified destination. Do not automate CG-SUP-001–006 delivery or personal document resend to an unverified visitor.

CG-04/07/10/11 source owners remain *not implemented in main at this review checkpoint*; their client-specific operational triggers and PDF layouts must be completed **during their own module development** under subsequent approval, not simulated here. CG-01 single-use setup link vs currently active account password flow and legal 80G/Section8/Trust/official office policy are unresolved client decisions; hold affected emails/receipts. No fake donation approval; no salary-paid claim without provider.

**Release decision:** `SOURCE_INSPECTED_CLIENT_COPY_52_52`; `SOURCE_CHANGES_COMMITTED`; `RUNTIME_QA_NOT_RUN`; `FORMAL_INDEPENDENT_REVIEW_PENDING`; `NOT_APPROVED_FOR_MERGE`.

## 6. Evidence recording fields (each original case, no new QA IDs)

`commit SHA | story/QA ID | original client source | backend file:function | SQL table/index/constraint | Web screenshot route | Android screen/device | actor/realm/role | input/outcome | actual status/error | source finding & fix commit | reviewer | date/time | PASS/FAIL/NOT_RUN | remaining source gap`. 

Preserve the test run logs in a **private** QA location; never commit tokens, raw patient/HR salary/donor data, signed links, provider headers or unredacted client sample person information. Repeat Fix → Re-review → QA trace until the existing scenario is genuinely executable and passes. Do not update historical source-verified counters to runtime PASS without proof.


**Additional resolved-case regression (US-003-QA03/09):** A Foundation staff reply and an eligible center portal reply must both reject when case status is `RESOLVED` or `CLOSED` until a Foundation authorized operator explicitly reopens the case as `OPEN`. Both Web/Android staff and center Web must hide reply actions for finalized cases. Test direct forged API bypass and ensure no private reply/audit created. Source fix committed after this handoff's original checkpoint; runtime testing still NOT_RUN.
