# CareGanga — 20 Nov 2026 client document/email acceptance and source-gap register

**Evidence:** [five source JPGs + checksums](../research/CAREGANGA-CLIENT-DOCUMENTS-REFERENCE-20261120.md); [52 client email templates](../research/CAREGANGA-CLIENT-MASTER-EMAIL-V2-COVERAGE-20261120.md). This is **cross-owner acceptance detail within existing canonical stories/tasks**, not a duplicate tracker, new development module, test execution, approval, or retroactive PASS. Actual asset comparisons use client-provided restricted JPG/DOCX originals.

## Verified as already in main vs actual gaps

| Area | Grounded code already present | New source gap / current disposition |
| --- | --- | --- |
| CG-19 documents | Scoped protected files, approved private access letter, some finance/appointment PDFs | Client's member certificate+welcome+ID, volunteer two-sided card+full three-document pack, HR offer letter and donation receipt layout are **NOT IMPLEMENTED** as these concrete templates; wait on owner records/approvals |
| CG-19 messaging | Generic approval-event/notice outbox, SendGrid/Twilio adapter, attempts and support | 52 distinct client template IDs/triggers, event-specific attachments + suppression, role/expiry/corrections, complete delivery tracking not shown; add after owner event integration |
| CG-04 | PRD/DLD/UIUX/story QA for member and volunteer | No CG-04 backend module currently in main; client ID/tier/fee/validity/benefits/QR and approval email/pack requirements remain to implement |
| CG-07 | PRD/DLD/UIUX/story QA and older donation receipt PDF reference mapping | No CG-07 backend donation owner currently in main; provider-confirmed unique paid receipt, duplicate/refund and source joins remain to implement |
| CG-10 | HR specs/QA and current CG-01 account roles | No CG-10 backend HR owner currently in main; actual offer/appointment/joining/promotion/designation document states remain to implement |
| CG-11 | Payroll specs/QA and existing generic CG-09 finance | No CG-11 payroll owner currently in main; payslip versus paid salary notifications still owner dependent |
| CG-03, CG-09, CG-21, CG-01 | Approval, finance, configuration and identity fundamentals | Add adapters only; don't infer applicant approval from document verification or provider accepted status; resolve credential setup rule conflict before changing auth |

## Acceptance cases to trace into existing owner story QA (add as supplemental criteria, not new counted scenarios)

| ID | Owners | Source-first acceptance and later runtime negative case |
| --- | --- | --- |
| DOC-01 | CG-04/CG-19 | Approved member, known tier, one stable ID; certificate and welcome letter visually match client layout and share current true membership/issue/term |
| DOC-02 | CG-04/CG-03/CG-19 | Three member PDFs are issued and emailed **only** after final decision and successful generation; missing one blocks full approval email |
| DOC-03 | CG-04/CG-19 | Free volunteer application through receive/verify/approve; two-sided ID, term and three-file pack; QR safe and original card superseded after reissue |
| DOC-04 | CG-07/CG-09/CG-19 | Provider failed/pending/duplicate callbacks never create paid receipt; one verified original payment creates one correct landscape receipt with accurate source/amount in words |
| DOC-05 | CG-07/CG-09/CG-19 | Distinct duplicate-payment/refund phases; only provider-processed refund gets “processed”; no repeated receipt for same transaction |
| DOC-06 | CG-10/CG-03/CG-19 | Offer, approval, appointment and joining states distinct; real title/contract/salary/letter number/signatory; unapproved/stale docs cannot be mailed |
| DOC-07 | CG-10/CG-01/CG-19 | Designation/promotion/access-change effective date, new approved ID/cert and superseded old version; no plaintext passwords; wrong-branch scope denied |
| DOC-08 | CG-11/CG-09/CG-19 | Employee-only salary slip after payroll approval; only provider-confirmed disbursement gets payment-success email, including out-of-order callbacks |
| DOC-09 | CG-19 | 52 template IDs versioned with exact event map, required source placeholders, organization-approved preview, no raw sensitive data or sample values |
| DOC-10 | CG-19/CG-01 | Event+template+recipient+document-version dedup; retry, timeouts, bounce, provider accepted vs delivered log; cross-root recipient denied |
| DOC-11 | CG-19 | Support ticket ID, statuses, privacy-safe status email, verified registered requester and authorized approved PDF/expiring link before resend |
| DOC-12 | CG-21/CG-19 | No unverified 80G or corporate claims; official verified address/legal identity/signature/contact/QR branding across all five PDFs |
| DOC-13 | CG-01/CG-19 | Resolve client setup-link vs current Admin-created password flow; no plaintext password, no unapproved credential change |
| DOC-14 | CG-19, all owners | Web preview and relevant authorized Android download/share are readable, keyboard/touch accessible, server-permission consistent; compare original visual JPG vs rendered generated PDF and QR validity |
| DOC-15 | all | Single event ownership and no duplicate journal/document master; simultaneous retries/edits/expiry/revoke safe; migrations/rollback/indexes and recovery actually executed |

## Evidence status

- **Reviewed:** original 5 JPG content and 22-page 52-template document; current main folder topology and selected CG-19 notification/storage source, and existing original donation reference. Additional new client-source requirements are mapped to existing modules.
- **NOT_RUN:** compilation, migrations, API/runtime, PDF rendering/pixel-diff, QR scan, sender-domain verification, actual provider/refund testing, Web/Android end-to-end parity, independent qualified DB/security review. No PASS or source-implementation claim follows from this documentation commit.
- **Next:** Implement missing owner-specific source under separately authorized JASIQ-dev delivery; add precise `file:function` evidence and results to each existing `tasks.md` case, preserve their counts and approval hash history, and validate against actual restricted reference images.

No new client-facing feature, module, workflow, data seed, exposed sample signature, CSS theme, or payment policy was unilaterally enabled by this source alignment.

## Feature-branch actual CG-19 remediation and source tests (2026-11-20)

**Only feature branch:** `feature/careganga-client-document-email-references-20261120`; `main` unchanged. These are code changes inside already-existing CG-19, not full event delivery.

| Existing owning story | New source implementation / manual test case | Source status | Runtime |
| --- | --- | --- | --- |
| CG-19 US-003 support | Add migration `1901_cg19_client_support_ticket_number.sql` to issue immutable, unique displayable ticket numbers to public and center cases, preserving guest private receipt and authorized staff/center scope; backfill older cases | CODE_ADDED · review required | NOT_RUN |
| CG-19 US-003 support | Replay exact guest/center request key returns **same ticket number**; conflicting payload rejected; only possession of private receipt reveals public status, visible ticket number never grants read access | CODE_ADDED · test required | NOT_RUN |
| CG-19 US-003 Web/mobile | Public Web, Public Android, Foundation Admin Web, Internal Android and center portal display current ticket number without exposing private UUID as business label; staff and center retain original role scope | CODE_ADDED · compare original screenshots and devices | NOT_RUN |
| CG-19 US-002 email reference | Exact 52 client template IDs, trigger copy, subject, body, placeholders and attachment rules in typed reference source; additive DB migration `1902_cg19_client_email_source_drafts.sql` permanently disables all imported source drafts | CODE_ADDED · source check required | NOT_RUN |
| CG-19 US-002 access | Foundation Admin with `communications.notices.manage` only can preview/import disabled client reference copies; wrong role and root forbidden; no sending/approval/recipient fabricated | CODE_ADDED · negative test required | NOT_RUN |
| CG-19 US-002 replay | Concurrent/repeated draft import is unique by root/template/version and detects source digest drift; rollback on import conflict; existing CG03/NOTICE/CG15 outbox and live delivery remain untouched | CODE_ADDED · database race test required | NOT_RUN |
| CG-19 US-002 integration | For membership, volunteer, donation, refunds, HR, payroll: **do not** mark 52 new emails delivered until true owner source, approved documents and business status exist; draft catalog is not event wiring | DEPENDENT_OWNER | NOT_RUN |
| CG-19 US-002 security | Verify no sample member/volunteer/employee/donor data is inserted as recipient or financial proof, and no client approval or tax benefit is inferred from a design | CODE_REVIEW_PENDING | NOT_RUN |

**Executable local source check:** `npm run verify:cg19-client-source` validates 52 catalog entries against the client-extracted text, source placeholder tokens, immutability/disabled migration gates, auth wiring, proxy routes and current Web+Android support ID surfaces. **Do not claim this checker has run** until local execution evidence is recorded. After `npm ci` run backend + Web builds, both Expo typechecks, disposable PostgreSQL 17 full migrations/backfill, ticket replay/race/guard testing, password/RBAC/source-isolation regressions, and rendered/visual QA. Provider/send/attachment/QR workflows for undelivered owner modules remain future source-owner tasks and must not be reported as implemented.

**Regression guard:** Public support status continues to require the 43-character private receipt; the readable ticket reference never authenticates. Never send an incomplete 3-PDF approval pack, unverified paid donation receipt, 80G wording or salary-paid message. No CG-01 login, CG-09 accounting, CG-15 healthcare source, or already-enabled CG-19 notification/send path was intentionally changed.

## Client support lifecycle implementation acceptance — 20 Nov 2026

- Code added in existing CG-19: additive `1903_cg19_client_support_states.sql` preserves legacy `OPEN` (New equivalent), `REPLIED`, `CLOSED` and supports `ASSIGNED`, `IN_PROGRESS`, `WAITING_FOR_USER`, `ESCALATED`, `RESOLVED`; immutable `STATUS_UPDATED` event with actor/time and recipient-safe public state. No new support-case table.
- CG-19 US-003 regression: assign/unassign updates only eligible OPEN/ASSIGNED state; admin-only status changes in Web and Internal Android use optimistic revision and backend permission; wrong-root/account/closed direct API denies/requires appropriate transition. New public status `ACTION_REQUIRED` does not expose private content. Existing private receipt remains the only guest status proof.
- CG-19 US-003 visible UI: filters include all meaningful support states; resolved KPI includes RESOLVED and CLOSED; center/guest cannot change Foundation staff status. No status email is claimed until CG-SUP-001–006 sender/recipient verification and event adapter are implemented.
- Manual negative QA to execute: open→assign→in-progress→waiting→escalated→resolved→closed→reopened, duplicate requests and stale revision race, center/public scope denial, frontend/native old-state refresh, PostgreSQL clean migration/backup/restore, no duplicate event/log, and client-styled responsive UI.
- **Source review status:** CODE_ADDED, source assertions executed and verified via `verify:cg19-client-source` (52/52 client templates match, immutable ticket guards, encrypted status notes, disabled draft checks). Full workspace builds (`apps/backend` and `apps/web`) and both Android Expo typechecks (`android-internal` and `android-public`) executed and **PASSED** with zero errors. **Executed disposable PostgreSQL 17 database runtime, live provider delivery, and physical Android device QA remain NOT_RUN** due to local environment boundaries. Do not mark any previous QA case passed solely by this section.

## Source finding/remediation trace — 20 Nov 2026, same CG-19 QA IDs

| Finding | Existing case(s) | Source fix / owner | QA evidence status |
| --- | --- | --- | --- |
| Case could reach CLOSED/RESOLVED/WAITING without resolution information | US-003-QA01,03,06,09 | `SupportService.mutate`: required private note, 1904 protected encrypted immutable status evidence and scoped staff detail | CODE_ADDED; builds PASS; DB runtime NOT_RUN |
| CLOSED→arbitrary working state or RESOLVED→unreviewed reassign | US-003-QA02,03,09 | `SupportService.mutate`: validate state transitions, eligible assignee and case revision; existing cases preserved | CODE_ADDED; builds PASS; DB concurrency NOT_RUN |
| Public receipt exposure risk from resolution detail | US-003-QA05,08,12 | Public `receipt/status` returns **only** status + ticket number; staff `detail` alone decrypts scoped notes; SHA replaced with keyed HMAC | SOURCE_INSPECTED; builds PASS; HTTP/security runtime NOT_RUN |
| Web/Internal Android did not require/display closure notes | US-003-QA06,14 | Shared backend `note` contract and private statusNotes on Admin Web + Internal Android; distinct Resolved/Closed labels and accurate KPI counts | CODE_ADDED; Web/Android TS builds PASS; device NOT_RUN |
| Email catalog static checker did not compare full original body/rules | US-002-QA12,13 | Source test now matches all 52 template trigger/recipient/subject/body/attachment rules from exact original extracted DOCX; drafts still disabled | SOURCE_TEST_AUTHORED; local Node execution PASS |

**Source trace chain:** `apps/web/src/features/support/foundation-support-workspace.tsx` / `apps/android-internal/src/features/support/foundation-support-screen.tsx` → `apps/backend/src/modules/cg-19-documents-notifications/http/support.controller.ts` → `SupportService.mutate, detail, publicState` → `1901` ticket + `1903` state + `1904` note tables → `cg19_support_event`. Privileged email source chain: `communications-workspace.tsx` → Next BFF `[...parts]/route.ts` → Nest `communications.controller.ts` → `ClientEmailTemplateService` → `1902` **disabled drafts**.

**Build & Verification Evidence (2026-11-20):**
- `npm run verify:cg19-client-source`: PASS (52 templates, disabled drafts, support ticket/status safeguards)
- `npm run verify:core-source`: PASS (89/89 static preflight checks, 296 QA IDs)
- `npm run verify:cg01-uiux-source`: PASS (39 Web routes, 20 native insets, 21 protected native routes)
- `npm run verify:cg15-communications-source`: PASS (14/14 source assertions)
- `npm run verify:design-approvals`: PASS (107/107 exact SHA-256 approvals checked)
- `npm run build -w apps/backend`: PASS (NestJS tsc compile 0 errors)
- `npm run build -w apps/web`: PASS (Next.js 16.4.6 Turbopack production build 0 errors, 40+ routes compiled)
- `npx tsc --noEmit -p apps/android-internal/tsconfig.json`: PASS (0 errors)
- `npx tsc --noEmit -p apps/android-public/tsconfig.json`: PASS (0 errors)

**Open gates:** disposable PostgreSQL apply/rollback/restore and negative cases, physical/emulator device QA, real signed provider sandbox, independently approved legal data and source owner events for future modules. None are executed merely by this source-trace patch.

| Existing US-002 cases | Additional client copy integration check | Status |
| --- | --- | --- |
| US-002-QA12 / QA13 | Additive `1905` email-only body capacity and SendGrid 12000 limit; original short notices and SMS remain bounded; source template drafts stay unsendable | CODE_ADDED / SOURCE_INSPECTED; migration/provider NOT_RUN |


**Template-by-template trace:** [52 client email QA source matrix](CAREGANGA-52-EMAIL-TEMPLATE-SOURCE-QA-MATRIX-20261120.md). Each of the 52 templates has original trigger, receiving owner, original attachment rule and relevant negative acceptance under existing story IDs. Copy source matched, but **business event / mail / attachment / device runtime remains NOT_RUN**.


**Additional US-003-QA03/09 source fix:** Resolved cases previously allowed both Foundation and center reply to silently move to REPLIED, bypassing the required reopen step. Both `SupportService.mutate(REPLY)` and `centerReply` now deny `RESOLVED` and `CLOSED` pending authorized explicit OPEN, with Web/Internal Android/center Web reply actions hidden. Re-test direct API, stale revision and negative scope; backend/Web/Android runtime NOT_RUN.


**Critical truth check:** `1905` increases allowed EMAIL-only copy length but does **not** implement a new authorized source event kind/recipient/attachment pipeline. The existing CG03_DECISION/NOTICE `cg19_notification` sources remain unchanged. All 52 client `SOURCE_DRAFT` templates are intentionally unavailable for sending until genuine owner data and CG-19 versioned document integration are explicitly implemented/reviewed. Center portal's `RESOLVED` and `CLOSED` support cases now block both reply and attachment editor; recheck HTTP direct access at runtime. Do not label these dependent event-approval scenarios complete.


### Center attachment API resolved-case security fix — 20 Nov 2026 (CG-19 US-003-QA02/07/09/12)

**Finding:** after center reply/status guards were updated, the original `CenterSupportAttachmentService.own(...editable)` still checked only CLOSED. An authenticated current center representative could attempt new upload initiation or final confirmation against a RESOLVED support case by bypassing the disabled frontend, even though UI now treats that case as finalized.

**Source fix:** in the **existing** CG-19 center support attachment owner, the shared editable `own` guard now rejects both `CLOSED` and `RESOLVED` for initiation and confirmation. The guard is transaction-scoped, uses current CG-14 center membership, case/source FK and expected revision; previous authorized read/download/status and private-file **revocation** remain available to preserve privacy after closure. No second support/storage master or new module.

**QA to actually execute:** (1) initiate while OPEN succeeds only with authorized center + valid clean storage; (2) in-flight upload initiated OPEN, then case RESOLVED before confirm → reject with no new clean stored file; (3) direct forged initiation/confirm while RESOLVED/CLOSED → conflict, no mutation; (4) current center A vs B isolation; (5) after staff explicitly reopens OPEN, valid new upload still requires current case revision and original source version; (6) existing validated files remain visible/downloadable and revocable after resolution; (7) scanner unavailable → never accepted. Source INSPECTED, real DB/storage/Web tests NOT_RUN.


**Client email draft conflict UX (US-002-QA06/12):** Import conflict on an already-stored source version now uses a specific friendly error in Foundation Admin Web; it distinguishes a changed client email **reference** from a normal notice edit and does not imply any email was sent. Verify 409/role-denied/stale local import in Web after actual backend migration; source only until runtime evidence.
