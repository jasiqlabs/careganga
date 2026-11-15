# CG-23 — Nursing Operations: Story-Level Cross-Stack Tasks & QA

**Canonical authorities:** [module.md](module.md) · [dld.md](dld.md) · [uiux.md](uiux.md) · [PRD](../../prd.md) FR-081/085 and conditional FR-087 · [HLD](../../hld.md) §5.5 · Healthcare BR CG-23-BR01–04 · real H13 screenshot audit · [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md).
**Source visual evidence:** Original full-resolution U01.png directly inspected for shared CareGanga Admin brand. H13 Nursing Service Management JPG/PNG not currently available; repository audit and earlier source-description used, exact H13 pixels/motion PENDING. No fabricated patient data or screenshot counts.
**Harness:** latest main SHA `26371c78da3a6d94717d65d24f159f03127a2a8a` is reviewed/pinned (two compatible UI §4A updates), local authenticated resolver NOT_RUN. Implement according to jasiq-dev, current story and all actual channel/DB/clinical contracts. Each changed line must meet human-visible minimal field/no technical UUID/safe exception rule.
**One story at a time:** Real PostgreSQL migrations/constraints → typed NestJS original-owner facades and exact CG-01/14 grants/CG-15 patient consent when needed → responsive Foundation Admin/Center Portal/public Web applicable → native Public/Internal Android audience parity → expert source review→fix→re-review→trace every QA ID in the same tasks.md Execution progress. No CI/GitHub Actions, no fake passing unexecuted clinical or device tests.
**Approval/risk truth:** owner-delegated SHA-bound SOURCE DESIGN approval (see initiative approvals ledger) is not authenticated Harness PASS, independent CRITICAL clinical/DB/privacy/regulatory signoff, code/SQL/device/Play tests, client UAT or deployment permission. All runtime gates NOT_RUN. Global `CAREGANGA_ERP_NURSING_ENABLED=false` at deployment by default, no private operational routes/worker/patient data when OFF.

## Current owner-delegated task definitions — design-only
### US-001 — Verify nurse professional, credential and real center affiliations (ERP ON)

**Outcome/Acceptance:** One genuinely qualified nurse professional can register and receive separately approved CG-14 nursing center affiliations without patient, shifts, employment, payroll or financial/CG-17 prerequisites.

**Requirements:** CG-23-BR01; FR-085, FR-081, D-23/26/27 and critical credential/privacy NFR.

**Full source-owned cross-stack implementation:** CG-23 nursing_professional/nursing_credential_submission/nursing_affiliation, same-root actual CG-14 center legal readiness, original CG-19 protected evidence and CG-03 frozen credential verification case introduced here only when policy requires, CG-01 action gates. Original H13 Foundation Admin/Center Portal identity-review and same-authorized Internal Android Foundation review; public CG-14 nursing information unchanged. No CG-15 or CG-10 source.

**True predecessors:** Real CG-01 current Foundation root/role and CG-14 verified nursing capable center with approved NURSING_ERP grant, current global backend ON/code+schema ready; genuine original CG-03/19 source contracts where actual evidence/review used.

**Manual scenario QA (planned, NOT executed):**
- **US-001-QA01 —** Create one real current CG-14 nursing center and a legitimate nurse profile with verified name/qualification/issuing register/jurisdiction and professional expiry. Current authorized Center Portal user can submit source-specific candidate without CG-15 patient/CG-10 employee.
- **US-001-QA02 —** Submit original CG-19 protected license/certificate evidence for real nurse source revision; missing, expired, wrong-root or unscanned content stays PENDING/REJECTED, not instantly VERIFIED.
- **US-001-QA03 —** Introduce real source-bound NURSING_CREDENTIAL_VERIFICATION review in original CG-03 only when policy requires; actual approved case digest+revision+reviewer permits one guarded CG-23 finalization, not client approved=true.
- **US-001-QA04 —** Proposer/self-reviewer when independent verification required, revoked Foundation professional reviewer, forged outcome, old case after changed credential or replay → backend denies with source audit; accepted old revisions remain immutable.
- **US-001-QA05 —** Same verified nurse affiliated separately with CG-14 Center A and B can have one professional identity but distinct affiliation, role, effective date and local eligibility. Center B has no right to Center A's private evidence merely because shared professional.
- **US-001-QA06 —** Attempt active duplicate registration from same issuer/jurisdiction/registration digest under one root → unique exact professional or controlled duplicate review, no shadow nurse identity; legitimately distinct registrant not accidentally merged by phone/name.
- **US-001-QA07 —** Existing real CG-14 doctor/CG-10 employee/CG-04 volunteer sharing displayed name must NOT become same nurse or acquire nursing employment/payroll automatically; explicit professional source remains sole nurse identity.
- **US-001-QA08 —** Professional credential expires or CG-14 center licence/PHARMACY/NURSING permission suspended → current nurse eligibility for new assignment/verification is revoked, source history and independent other-center affiliation remain auditable.
- **US-001-QA09 —** Center A applicant, Foundation analyst and unauthorized Center C try nurse options/list/detail/credential preview/download/export with manipulated root/center/ref → permission/source scopes deny confidential data at query and CG-19 file access.
- **US-001-QA10 —** Actor lacks nurse.review or affiliation.approve but has safe nurse.options grant → options expose minimum readable permitted name and status only, not credential license, evidence, full profile, other-center schedule or application.
- **US-001-QA11 —** Submit two conflicting affiliation amendments/review callbacks concurrently → expected revision and unique effective period reject overlap/duplicate effect without retroactively changing earlier accepted period.
- **US-001-QA12 —** Set global CAREGANGA_ERP_NURSING_ENABLED false, missing, malformed or UI-forced ON while grant present → all CG-23 nurse ERP APIs/menus/exports/workers remain OFF; CG-14 published nursing services and public enquiry work normally.
- **US-001-QA13 —** Set backend global ON but module schema incomplete, center grant pending or current CG-01 role revoked → effective source capability remains unavailable, no optimistic menu, force-refresh or default Super Admin bypass.
- **US-001-QA14 —** Credential audit stores original reviewer, source digest/version and protected evidence ref with bounded retention; no raw registration number/identity/clinical content in logs, URLs, attachment previews outside current authorization.
- **US-001-QA15 —** Foundation Admin Web H13 restricted nurse list/filter/reviewer form and Center Portal nurse registration/proposal match original CareGanga U01 logo/nav/tokens, responsive table/panel, real pending/returned/verified/expired states and nontechnical errors; exact H13 pixels NOT_RUN.
- **US-001-QA16 —** Internal Android with same currently authorized Foundation reviewer can find current pending nurses, review protected evidence, return/approve and see accurate result via genuine native task screens, Back/keyboard/TalkBack. Public Android has no private nurse menu.
- **US-001-QA17 —** With no CG-15 patient, no US-002 shifts, no CG-17 money and no CG-20 reports, complete nurse credential+affiliation US-001 flow and ensure CG-14 base provider listing/CG-19/03 initial use unaffected.
- **US-001-QA18 —** Review disposable PostgreSQL uniqueness/FK/index, original CG-03/19 source adapter, adverse role scope, expired-license race, migration/backup/restore, HTML/API error mapping and optional Android SDK/16KB source plan; real code/SQL/clinical/browser/native QA NOT_RUN.

**Verification:** For each QA identifier trace actual source file:function and correct UX → current actor/center/patient-purpose API → original source policy/revision → verified database/CG-03/19/17 effect and current Web/native states. Record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE only with file evidence; live independent DB/clinical/device QA remains NOT_RUN until separately executed.

### US-002 — Create real nurse shifts, leave and candidate availability without patients (ERP ON)

**Outcome/Acceptance:** A verified affiliated nurse has center-specific effective weekday/shift and leave windows with source-truth candidate availability, independent of CG-15 patient or financial services; booking exclusivity is introduced by US-003.

**Requirements:** CG-23-BR01/03; FR-085/081; H13 nurse schedule and safe cross-center/timezone NFR.

**Full source-owned cross-stack implementation:** CG-23 nurse_availability_rule and nurse_availability_exception, typed current center/qualified nurse facades and bounded date preview with original Center Portal shifts/leave editor, permitted Foundation Admin and Internal Android oversight. No patient request or saved reservation required.

**True predecessors:** US-001 real VERIFIED nurse with ACTIVE nursing affiliation to eligible CG-14 center, current CG-01 shift action and global Nursing ERP ON; NO CG-15, CG-17, CG-19 evidence, US-003 or US-004.

**Manual scenario QA (planned, NOT executed):**
- **US-002-QA01 —** With approved nurse N and Center A affiliation, create valid Monday–Friday 09:00–17:00 local rule, source version, effective dates and IANA center timezone; preview legitimate bounded future shift windows with current source scope.
- **US-002-QA02 —** Center B can define separately approved nurse N schedule under its own affiliation, without copying Center A policy or exposing A's private leave notes; neither shift alone claims a guaranteed available visit slot.
- **US-002-QA03 —** Create overnight shift e.g. 20:00–06:00 next calendar day → correct UTC instants and source local date, no negative duration or off-by-one day; reject unsupported format/timezone.
- **US-002-QA04 —** During a daylight-saving transition in a supported IANA zone, nonexistent/ambiguous local time must be resolved by explicit policy or rejected safely; no double-generated shift and no guessed UTC offset.
- **US-002-QA05 —** Add specific leave/holiday interval matching original nurse rule → actual affected candidate availability absent, original rule retained; no automatic cancellation of an already assigned patient visit before US-003 owner-specific controlled change.
- **US-002-QA06 —** Two concurrent shift amendments at same original nurse+center/effective dates → one revision accepted and one stale conflict; no two simultaneously active contradictory rule versions.
- **US-002-QA07 —** Same nurse has available shifts at Centers A and B at overlapping times → US-002 alone may show eligible shift candidates but cannot promise reservation; US-003 later enforces global person-time conflicts across centers.
- **US-002-QA08 —** Unauthorized Center B operator edits Center A shift or Foundation actor without authorized nursing shift action lists other center/nurse private reasons → direct API/options/detail/export blocked; minimum safe label only when original grant permits.
- **US-002-QA09 —** Credential becomes expired or current CG-14 center affiliation suspended while schedule page open → backend denies new preview/create even if stale client shift still displayed; accurate refresh/status and no saved illegal rule.
- **US-002-QA10 —** Create rule with invalid weekday mask, minute range, start>end without explicit overnight, unbounded recurrence, unsupported calendar or effective_from after valid_to → safe validation before database insert, no per-user/tenant scan.
- **US-002-QA11 —** Create source-bound leave with nonexistent nurse/affiliation or attempted use of CG-10 staff leave ID → reject; CG-10 payroll/leave source untouched, one CG-23 nursing exception authority.
- **US-002-QA12 —** Repeated rule submission after lost response with identical idempotency/source version → one accepted state; different payload using same key conflicts and no duplicate calendar rows.
- **US-002-QA13 —** US-003 patient reservation not yet implemented → source-safe UI label 'Eligible shift, assignment not available yet' rather than unsupported patient booking CTA or fake no-booking availability status.
- **US-002-QA14 —** All four ERP flags false or Nursing flag false → CG-23 schedule/list/edit/export/worker routes disabled; core CG-14 nursing opening hours/service/enquiry remain public without nurse-specific calendar data.
- **US-002-QA15 —** Center Portal original H13 Nurse Schedule filtered by actual center/nurse/period, create/edit/leave and status, Foundation Admin restricted oversight responsive/narrow, original CareGanga tokens and source-backed empty/loading/error; exact H13 pixels NOT_RUN.
- **US-002-QA16 —** Native Internal Android with same authorized Foundation shift reviewer sees actionable schedule/leave/read/update or documented legitimately authorized role exclusion; no WebView, appropriate Back, touch, keyboard, TalkBack and updated permissions.
- **US-002-QA17 —** Large registered professional roster with no patients, no visit reservations and no due notifications → bounded indexed date-window expansion, capped results, zero job scans, no background heartbeat; measure actual query/egress later.
- **US-002-QA18 —** Inspect source role revocation, current group/center FK, unique active rule/scope, timezone/overnight tests, restore/rollback/EXPLAIN and same real source shared by Web/native; actual SQL/browser/device/clinical QA NOT_RUN.

**Verification:** For each QA identifier trace actual source file:function and correct UX → current actor/center/patient-purpose API → original source policy/revision → verified database/CG-03/19/17 effect and current Web/native states. Record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE only with file evidence; live independent DB/clinical/device QA remains NOT_RUN until separately executed.

### US-003 — Consent a real patient request and reserve one qualified nurse without double booking (ERP ON)

**Outcome/Acceptance:** Authorized own-center staff can request current CG-14 nursing service for a real consented CG-15 patient, freeze accepted fee/location/frequency and assign real qualified professional to bounded visit occurrences with cross-center no-overlap.

**Requirements:** CG-23-BR02/03; FR-085/081; H13 booking/assignment; original CG-15 consent and CG-14 current service fee; cross-center CRITICAL DB exclusion.

**Full source-owned cross-stack implementation:** CG-23 nursing_service_request, nursing_assignment, nursing_visit_reservation and PostgreSQL root+nurse global overlap EXCLUDE constraint, actual CG-14 approved service fee and CG-15 patient purpose facade. Center Portal booking/assignment and Foundation Admin source-specific H13 list/detail; Public Web/native no public checkout, own-source-verified limited status if actually delivered; matching eligible Internal Android Foundation oversight.

**True predecessors:** Actual US-001 verified nurse+center and US-002 shift; real CG-15 current consented patient, actual CG-14 approved nursing service/current fee/center, global ON/current grant/actor. CG-17 is NOT prerequisite.

**Manual scenario QA (planned, NOT executed):**
- **US-003-QA01 —** Current Center A coordinator chooses actual consented CG-15 patient and actual approved CG-14 nursing service, accepted price/currency/revision, approved home or center site, frequency, duration and bounded date → persists one scoped request with current consent evidence.
- **US-003-QA02 —** No actual CG-15 patient, expired/withdrawn care-purpose consent, mismatched center, wrong service/price revision or unverified center → no new request and patient identity not disclosed in options.
- **US-003-QA03 —** Private home address/contact saved only in protected minimal service location field, never public listing, analytics/toast/logs or unrelated Foundation role; own staff see only current purpose/assignment.
- **US-003-QA04 —** Actual US-001 verified nurse and US-002 eligible shift satisfy requested nursing service qualification, location/period/duration → one authorized confirmed reservation and assignment created, no shortcut based only on dropdown name.
- **US-003-QA05 —** Two centers attempt to book the same nurse for overlapping actual visit instants concurrently → PostgreSQL root+nurse exclusion/short guarded transaction admits at most one across all center assignments and reports readable conflict.
- **US-003-QA06 —** Exact back-to-back end-exclusive visits (09:00–10:00 and 10:00–11:00) may be allowed when current scheduling policy permits, overlapping 09:59 rejects; travel/buffer not guessed until approved.
- **US-003-QA07 —** Recurring request daily visits expands only within bounded approved planning horizon, one immutable occurrence per visit_sequence; no infinite calendar, unbounded rows or invented visit completion.
- **US-003-QA08 —** Center A schedules nurse for next week, later changes nurse affiliation/credential/license or active leave → validation catches conflict/eligibility at assignment/reschedule and avoids presenting stale qualified nurse.
- **US-003-QA09 —** Patient has an original CG-15 doctor consultation booking concurrently → independent doctor-wide slot source stays unaffected; CG-23 nursing booking must not block unrelated CG-15 doctor occupancy or clone its patient/booking table.
- **US-003-QA10 —** Two assigners race the last qualified slot in same center, or server reply lost after commit → same request idempotency and DB unique/overlap guard produce one assignment/one set of occurrences, safe conflict/unknown outcome and correct original lookup.
- **US-003-QA11 —** Reschedule actual booked visit to another available slot under guarded transaction preserves prior source until replacement wins; failed replacement leaves original valid reservation, no double nurse hold.
- **US-003-QA12 —** Cancel approved pending nursing request releases original eligible confirmed reservation with source-coupled status event; can't infer automatic refund/CG-17 payment or delete actual patient/care history.
- **US-003-QA13 —** Nurse rejects assignment or another qualified nurse is selected → original source assignment/change history retained and new nurse is rechecked across all actual centers before becoming current.
- **US-003-QA14 —** ERP global false, center grant suspended or CG-01 permission changed during booking flow → all CG-23 create/list/options/assignment/export denied, pending source data retained with no active background workers.
- **US-003-QA15 —** Foundation Admin H13 network list shows only safe request/assigned/ongoing and source-as-of; Center Portal contextual patient+nurse details visible only to actual authorized care coordinator, no general Foundation Super Admin plan access.
- **US-003-QA16 —** Public Website/native Public Android contain only CG-14 verified nursing services/enquiry and no public nursing booking/checkout/paid button. Authenticated own patient minimal status requires real CG-15/23 purpose and same Web/native state, no patient-private link inference.
- **US-003-QA17 —** Internal Android current authorized Foundation scheduling coordinator performs same permitted view/assign/review as Admin Web using native workflow and current role, Back/keyboard/accessible errors; no fabricated Center Android app.
- **US-003-QA18 —** Independent DB QA must verify btree_gist extension readiness, root+nurse time exclusion/active status, 20-way last-slot race, infinite recurrence cap, same-root FKs and duplicate request, migration/restore/EXPLAIN; actual code/UI/mobile/SQL execution NOT_RUN.

**Verification:** For each QA identifier trace actual source file:function and correct UX → current actor/center/patient-purpose API → original source policy/revision → verified database/CG-03/19/17 effect and current Web/native states. Record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE only with file evidence; live independent DB/clinical/device QA remains NOT_RUN until separately executed.

## Execution progress

- **US-001–005:** planning source design being refined; no CG-23 implementation evidenced on this planning branch. This section is for future actual developer source evidence, not preapproved test results.
- **Independent gates:** authenticated local Harness resolver, qualified CRITICAL nursing/DB/privacy review, actual migrations/backup/restore/SQL concurrency, Web/native visual and Play device, clinical/legal signoff, load/idle queries/egress all NOT_RUN.
