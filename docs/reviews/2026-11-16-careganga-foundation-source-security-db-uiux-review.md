# CareGanga — Independent source review of implemented Foundation modules (16 November 2026)

**Repository:** `jasiqlabs/careganga` · **Reviewed head:** `feature/careganga-cg02-foundation-structure-dev-20261115` · **Merge target:** `main`.
**Decision:** `SOURCE_ACCEPTED_FOR_MAIN_INTEGRATION` for the **implemented Foundation code only** (CG-01, CG-02, CG-03, CG-19, CG-21); **NOT** deployment, production or runtime QA certification.
**Reviewer independence disclosure:** a fresh adversarial review pass by the assistant outside the original implementation narrative; **not an independent human/organizational security assessor**. Do not mislabel it as a third-party penetration test.

## Scope, source material and exclusions

- Reviewed implementation structure across NestJS/PostgreSQL, Next Admin/public Web, Internal Android, Public Android and the owner-owned CG-01/03/19 integrations; scrutinized the 53-file feature-to-main source diff, critical 31 SQL migrations, role/action routing, query safety, owner/source boundaries and relevant navigation/screens. The planning-only modules CG-04 through CG-24 are **not implemented code** and are not asserted to pass source QA.
- Reopened the authentic user-provided **167-screen** original Admin archive from private CareGanga Library, not an assistant-generated mock: `CareGanga-Original-Admin-Screenshots-Verified-20261115.zip`; used the exact original U05, U08, U18, U19, U20, U21 and U22 PNGs and the existing indexed [screenshot evidence audit](../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md). Reuse original CareGanga navy/blue, cards/drawers, sidebar/header, status and responsive semantics. Static originals cannot establish working backend behaviours, exact CSS implementation or animation timing.
- **Not executed:** npm dependency installation/build/typecheck, actual PostgreSQL migration, EXPLAIN/lock or restore testing, security penetration test, offline/resume race reproduction, S3/Firebase + scanner + communications delivery, internal/public Android binaries/devices, rendered screenshot/pixel/motion comparison. **Runtime QA PASS: 0**; **visual match: NOT_RUN**; **MOTION_REFERENCE_UNVERIFIED**. The private reference archive is not committed to GitHub.
- No CI/GitHub Actions used. Source inspection, manual cross-file tracing and static SQL placeholder-count checks are **not** live test runs. The source review did not execute `npm ci`; current `main` tracks a root `package-lock.json`, but a clean local install remains NOT_RUN under the [central F0–F5 validation handoff](../../specs/initiatives/careganga-foundation-platform/FOUNDATION_F0_F5_LOCAL_VALIDATION_HANDOFF.md).

## Security and authorization verdict — source review

| Risk | Reviewed owner evidence | Source disposition |
|---|---|---|
| Actor/session/credential revocation | `CG01 SessionService`, protected access owner, CG03 Super Admin fresh proof, role and account guards | Source controls present; the current password-based login and session proof require a new independent source review and live tests |
| Cross-root data and authorization | Root-scoped composite FKs, CG02 service root predicates, actor-scoped branch/department queries, backend `requireAction`, same-origin BFF allowlists | Source guards present; cross-root adversarial PostgreSQL test not run |
| UI privilege visibility | Protected Next routes and shared `foundation-admin-nav.tsx`; previously stale menu grants and disabled view-only editors | **Fixed:** all protected menu destinations revalidate current CG01 grants, document page's dual-capability requirement enforced; restricted edit forms/actions hidden rather than merely disabled |
| Approval/source tampering | Immutable submitted-revision hash, CG03 case-kind checks, Super Admin decision and different proposer, owner-side finalization | Corrected previously found late-committed case attachment; no independent approval or pseudo-approval duplicated |
| Protected attachments and download | CG19 S3/Firebase private providers, version-pinned SHA/MIME, fail-closed ClamAV scan, signed access, sorted file/revocation proof locks | Source controls present; real provider policy, scanner and signed link expiry **NOT_RUN** |
| Public contact/notice safety | HMAC-authenticated guest proxy, guest throttle, encrypted support details, actual provider delivery states | Source controls present; ingress/cloud/provider tests **NOT_RUN** |
| Input/XSS/SQL injection | React escapes dynamic content; inspected parameterized query templates and fixed-string account predicate interpolations; Web BFF route allowlists | No confirmed SQL injection or unsafe HTML-rendering path in inspected services; not a complete automated taint-analysis claim |

**Current source corrections on the same authorized feature branch:** original Admin header/search/Help/View Site and grouped navigation; current-grant refresh for all protected menus (including special document access); original U18 branch status KPI cards, approved directory with real code/name/location/type/manager/opening date, search, summaries; U19/U20 numbered seven-stage stepper and real saved-evidence/setup summary; U22 native right-side accessible department drawer and `openingDate` persisted/read; read-only branch details without unauthorized edit UI; close stale editor on branch change/status. Re-review corrected permission predicates and active/inactive editing visibility after first patch.

## Database and consistency — source review

- Checked SQL source `0201_cg02_foundation_structure.sql`, `0202` draft authority, CG03 `0022` branch-case extension, CG19 `0203` pre-submission evidence, `0204` approved branches, `0205` immutable operating events and `0206` post-activation protected media, plus original CG01/03/19 migration definitions.
- Source protections include same-root composite FKs, normalized geography/department uniqueness, immutable submitted revisions, single approval case/source revision, unique activation per registration and code, command request-digest replay, server optimistic versions, active branch/area constraints, link uniqueness and immutable audit events.
- Independently reran a **heuristic** placeholder/bind-count inspection of **176 SQL template calls** across seven critical CG02/CG03/CG19 services: **zero detected count mismatches**; checked prior critical activation INSERT is seven placeholders/seven values. This does **not** parse/execute PostgreSQL or prove referential integrity.
- Corrected source gap in branch-scoped department `opening_date`: creation already accepted it, but detail/edit did not preserve it; both DTO response and parameterized `UPDATE` now include it.
- The migration runner uses direct migration URL, a PostgreSQL advisory lock, transactional SQL, recorded source SHA-256 and omission checks. Real same-history upgrade/rollback/restore, FK enforcement, query plans and concurrent effects remain **NOT_RUN**.

## Original-Admin UI/UX comparison

| Original evidence | Implemented source comparison | Verdict |
|---|---|---|
| U05/U08 shared branded shell, active blue sidebar, searchable menu, desktop heading and utility bar | Shared original semantic colors, grouped permission-gated sidebar, live permitted-module Ctrl+K search, real Help/View Site, current-grant refresh and top header | `SOURCE_ALIGNED`; rendered visual not executed; global person search deliberately not faked |
| U18 branch status cards, filters, directory table, status/type summaries | Real actor-scoped backend counts, status selection and bounded name/code/type search, manager/location, opening date directory, status/type summaries and source-backed export | `SOURCE_ALIGNED_CORE`; some original advanced filters/states-map/stat tiles absent rather than invented from future owners |
| U19/U20 seven-stage registration, documents, manager, GPS and right setup/proof status | Actual source-backed seven-stage draft Web/Internal Android, document proof, original case/status, numbered progress, saved proof summary; GPS coordinates supplied; no fake app-only approval | `SOURCE_ALIGNED_CORE`; no original-style embedded map picker; device/rendered reference comparison NOT_RUN |
| U21 department KPIs, filters, one master | CG02 Foundation-only status and committee counts, bounded filters/table, zero-branch support and real CG01 account heads | `SOURCE_ALIGNED_CORE`; future employee/volunteer counts intentionally not fabricated |
| U22 right-side department editor including opening date/head/parent/area | Existing Foundation drawer + newly corrected operating-branch native dialog and stored opening date, actual eligible selectors and permission-hidden create/edit | `SOURCE_ALIGNED`; rendered screenshot/focus/keyboard QA NOT_RUN |

**Visual truth:** SOURCE_ALIGNED means the inspected source follows the original's essential component and business-data pattern; it is **not** an exact pixel or animation PASS. State/district/region and map-provider integrations may be expanded in CG02 only through real configured geography/location APIs, not sample images, fake map pins or new future-module records.

## CG02 story QA trace

Every case is retained in [canonical tasks](../../specs/initiatives/careganga-foundation-platform/modules/cg-02-foundation-structure/tasks.md); **25 case definitions** and source trace pointers have been reviewed. No case is a real runtime PASS.

| Story | Source review | Evidence | Unexecuted gate |
|---|---|---|---|
| US001 QA01–QA05 | `SOURCE_TRACED` (5) | CG02 FoundationStructureService, CG01 identity facade, Web profile/geography/department + BFF | Live persistence/role/network |
| US001 QA06 | `SOURCE_ALIGNED_VISUAL_NOT_RUN` | U21/U22 and original CareGanga shared theme and drawer | Rendered original-vs-app comparison |
| US001 QA07–QA08 | `SOURCE_TRACED` (2) | SQL0201 root FK/UNIQUE, authority, parent-cycle/selector/role constraints | PostgreSQL races/revocation |
| US001 QA09 | `SOURCE_TRACED_DB_RUNTIME_NOT_RUN` | Migration runner, SQL0201 constraints, access guards | Migration, restore, EXPLAIN, egress |
| US002 QA01–QA05 | `SOURCE_TRACED` (5) | Web/native draft, CG02 frozen activation, CG03 real case and CG19 real proof | End-to-end actual provider/DB |
| US002 QA06 | `SOURCE_ALIGNED_VISUAL_NOT_RUN` | U18–U22 source patterns | Pixel/motion/device comparison |
| US002 QA07–QA09 | `SOURCE_TRACED` (3) | Sorted locked CG03/CG19 proofs and CG02 activation, unique keys, replay/return guards | Concurrent PostgreSQL/proxy interruption |
| US002 QA10 | `SOURCE_ALIGNED_DEVICE_NOT_RUN` | Web/native stages, bounded lists, genuine status/messages | Native device, accessibility and screenshot |
| US002 QA11–QA16 | `SOURCE_TRACED` (6) | Owner-specific CG01/02/03/19 typed interfaces, recovery, lock boundary and protected file revisions | Actual HTTP/password proof/restore/scan/provider/lock tests |

**Review status:** 21 primary source-trace dispositions plus 4 cases requiring independent visual/runtime or database execution; zero unsupported claims of 25 runtime passes. Previously identified CG02 source gaps REV-01 (activation placeholder), REV-02 (late case reconciliation), REV-03 (inactive historical file revoke/reactivation guard), REV-04 (CG03 inbox paging), REV-05 (CG02 department paging) were re-read against repaired source and are **SOURCE_FIXED**, with runtime regressions still open.

## Merge scope and non-waived gates

**The owner authorized source-only integration into `main` now, not production release.** This verdict supports integrating the reviewed Foundation feature branch **only if** `main` remains an ancestor of the final head and GitHub reports a clean merge. Never rewrite `main`, run CI/GitHub Actions or deploy automatically.

After source-only merge, local developer must still generate/commit verified workspace lockfile, install/build/typecheck Next/Nest/Expo, apply all migrations twice on disposable PostgreSQL, test restore/concurrency/role isolation/fresh current-password proof, verify CG19 storage and scanner, run Web/Internal Android device QA and original screenshot comparisons. Record the real PASS/FAIL results in the canonical CG02 tracker. Any failures are fixed and independently re-reviewed in their owning code before release. **Production readiness remains BLOCKED.**

## Follow-on greenfield integration review (current feature branch)

**Feature merge:** `6d151b2a` integrated the November 16 newer mainline as a real second-parent merge, selecting the repaired CG-19 notices/support SQL, current NestJS compiled start path and a few source/type adjustments. It intentionally retained the working CG-01 mobile/email + password flow and rejected newer mainline invitation/TOTP runtime scripts whose case assertions were not reliable evidence. The retired Web activation redirect was removed in a follow-on commit.

**New source-only observations:** The previous feature's `0024_cg19_foundation_support.sql` had a broken `term_digest` CHECK/table section. The merged SQL now contains separate complete search-token/reply definitions; `0023` references the actual `cg19_message_template_frozen()` function. The notices service now retrieves the inserted template subject/body before using both for outbound delivery. A selected 14-condition source cross-check passed textual presence checks, including the 165 canonical case *definitions* and backend start path. This is **not** a SQL grammar parse, executed migration, build, independent human review, vulnerability scan or live case result.

**Open defects/gates:** Unknown full TypeScript compilation outcome, exact hash-bound design re-approval, local PG17 migrate/repeat/restore, backend/Web boot, native Android binaries and devices, original CareGanga rendered UI comparison, malicious client/role/security race tests, SMTP/SMS OTP, object-storage/ClamAV and independent qualified source/security/database review. Keep 165 canonical runtime cases **NOT_RUN** and `main` untouched until an authorized merge gate is met.

## Retired authentication reference sweep — 16 November 2026

At feature code snapshot `ec8be4a750127539b9a0d15ceab909d6bebbc45a`, a **read-only search across all 162 active backend, Admin/Public Web and Internal/Public Android TypeScript/TSX/MJS source files** found **0 occurrences** of the retired access invitation permission, invitation API, activation path/component/service, `inviteOnly`, obsolete authenticator flags, TOTP or passwordless/magic-link login symbols. Fetch failures: 0. Root `.env.example`, `README.md`, canonical PRD and HLD were separately checked for those retired technical references, also with zero matches. Previous modular source reviews covered the CG-01 through CG-24 module/DLD/UIUX/tasks text; legitimate CG-14 health-center affiliation wording remains a **business onboarding use case**, not a CG-01 credential invitation.

This is a **keyword/source consistency sweep**, not TypeScript compilation, exhaustive dynamic call-graph review, verified runtime tests or a source-security certification. The new source verifier additionally enforces the same active-code blacklist when executed locally. All 165 runtime cases remain `NOT_RUN`.
