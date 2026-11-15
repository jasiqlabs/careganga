# CG-23 — Five Original Nursing Stories & 90 Manual Source-QA Scenarios

**Authority:** [module](module.md) · [DLD](dld.md) · [UI/UX](uiux.md) · [PRD](../../prd.md) FR-081/085, conditional FR-087 · [HLD](../../hld.md) §5.5 · Healthcare BR CG-23-BR01–04 · H13 original indexed source · [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md).
**Current design:** five owner-vertical source stories, each with 18 concrete scenario QA IDs. H13 exact image bytes not available; original Admin shared U01 source examined. Current pinned Harness `26371c78da3a6d94717d65d24f159f03127a2a8a` includes mandatory PRODUCT_UI_QUALITY_STANDARD §4A for each changed line. Local authenticated Harness resolver, independent critical database/clinical/privacy and actual SQL/Web/native/visual/device QA remain NOT_RUN.
**Development direction:** Start only real dependency-ready US, implement PostgreSQL+backend current source, relevant Foundation Admin/Center/Public Web and Public/Internal Android where genuinely applicable. Implement → expert source review → fix → re-review → trace every individual QA ID with actual file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE, then update only `## Execution progress`. Do not run CI/GH Actions. Source review does not prove runtime/clinical/visual PASS.

## Reviewed story definitions — current source-design decision only
### US-001 — Verify nursing professional credentials and independent center affiliations

**Outcome/acceptance:** Current authorized nursing partner can register one verifiable professional, submit and review original CG-19 evidence, and approve each separately scoped CG-14 nursing-center affiliation under effective global ON and current professional license, independently of patient/shift/finance.

**Requirements:** CG-23-BR01; FR-081/085; H13 nurse identity and affiliations; original CG-01/03/14/19 permission and evidence.

**Actual dependency:** Genuine CG-01 actor/root and verified CG-14 nursing center with approved NURSING_ERP, global deployment ON; CG-03 review/CG-19 proof adapters introduced in this US only if required; no CG-15 patient, CG-10 employee or future US.

**Implementation contract:** NestJS credential/affiliation DTO/guard, nursing_professional and nursing_credential_submission and nursing_affiliation root+center SQL, CG-19 file and conditional CG-03 case finalizer; Foundation Admin reviewer and own-center Portal applicant, same authorized Foundation review in native Internal Android; no public private nurse list.

**Story-level QA (PLANNED / NOT EXECUTED):**
- **US-001-QA01 —** With actual CG-01 authorized current Center A and verified CG-14 NURSING_ERP grant, register nurse real qualification/registration issuer/jurisdiction and minimal protected identity; no automatic CG-10 employee, CG-04 volunteer or CG-14 doctor row.
- **US-001-QA02 —** Global CAREGANGA_ERP_NURSING_ENABLED absent, malformed, false or stringly invalid → private nurse list/options/create/review/export/deep-link and jobs reject; genuine CG-14 public published nursing enquiry unaffected.
- **US-001-QA03 —** Global ON with center NURSING_ERP denied, expired provider license, schema not activated, revoked current CG-01 action or suspended Center A → backend fails closed before returning private nurse data; UI hides forbidden actions.
- **US-001-QA04 —** Upload actual professional license/evidence via original CG-19 protected source adapter, validate supported content/ownership/scan/current verification; a pending/failed upload does not verify professional credentials.
- **US-001-QA05 —** Submit credential revision to actual original CG-03 review when policy requires; only current unrelated qualified reviewer and matching pinned original digest can verify, not applicant-set `approved=true` or forged case ref.
- **US-001-QA06 —** Registration issuer, jurisdiction, duplicate active normalized credential digest and effective date enforce genuine same-identity uniqueness; two distinct nurses are not conflated by name or phone and no raw license number leaks.
- **US-001-QA07 —** Credential pending, rejected, returned, expired, suspended or withdrawn can be inspected by authorized staff but never counts AVAILABLE or VERIFIED for new assignments; future status transitions are versioned.
- **US-001-QA08 —** One verified nurse linked to Center A and Center B under separately approved effective affiliation → exactly one professional and two independently guarded center relationships; Center B cannot read Center A private source evidence.
- **US-001-QA09 —** Concurrent affiliation approval or duplicate callback on the same nurse+center+effective interval → one accepted current affiliation, stable revision/effect, original reviewer/audit preserved; overlapping active same-role windows denied or explicitly replaced.
- **US-001-QA10 —** Center A reader guesses Center B professional/affiliation/evidence ref, API list/selector/query export → same-root-and-center source authorization denies unrelated relationship and private license bytes.
- **US-001-QA11 —** Foundation general network operator has safe high-level verified professional count but no clinical credential download grant → list/aggregate excludes protected registration fields and tiny private details.
- **US-001-QA12 —** Approver lost role or Center A is suspended after reviewing draft but before confirmation → backend rechecks current actor, license and revision; denied action does not activate nurse.
- **US-001-QA13 —** Invalid unsupported qualification, impossible date, missing required issuer, enormous text, unsafe user-generated error/code and raw numeric IDs → useful field validation, safe human-readable labels, no technical stack.
- **US-001-QA14 —** Center Portal Nurse Master list/detail/credential status/filter/review return and actual original H13 indexed style; Foundation Admin original CareGanga sidebar/tokens; direct H13 pixels and animations still NOT_RUN.
- **US-001-QA15 —** Native Internal Android same currently entitled Foundation reviewer can open credential review, original evidence status, approve/return/deny and readable audit with Back/keyboard/touch, or explicitly documented justified server-supported channel exclusion; no WebView.
- **US-001-QA16 —** Native Public Android/Public Web never expose private nurse identity/registration/document, even when public CG-14 nursing partner listing is visible; public source has only verified approved service info and enquiry.
- **US-001-QA17 —** Cross-root identity, revoked account session, file protected link, audit trail, expiry/change race and actual non-superuser PostgreSQL FK/composite uniqueness/restore/negative test are documented for independent run, not called PASS from code.
- **US-001-QA18 —** Check new end-user fields/toasts/PDF and backend exception projections against current Harness PRODUCT_UI_QUALITY_STANDARD §4A: source-derived business names, no unnecessary root/center IDs, redacted correlated logs and no false verified badge.

**Review requirement:** trace each QA ID to current server scope/owner, concrete SQL constraint/source revision, relevant Web/native action/denial and CG-03/15/19 facade. Record real code evidence, manually fix/re-review. Independent migrations/device/visual QA NOT_RUN.

### US-002 — Maintain real nurse availability, shifts and leave independently of patients

**Outcome/acceptance:** Authorized current nursing-center coordinator can record effective local-time shifts, leave/holiday exceptions and honest candidate availability for a verified affiliated nurse without CG-15 patient, future assignment or CG-17 billing.

**Requirements:** CG-23-BR01 and overlap guard CG-23-BR03; FR-085; H13 schedule/calendar.

**Actual dependency:** US-001 genuine VERIFIED nurse and currently approved actual CG-14 center affiliation and current CG-01 action/global ON; no patient, booking, CG-17 or CG-20.

**Implementation contract:** Versioned nurse_availability_rule and nurse_availability_exception, typed candidate read and guarded edit/leave APIs, indexed bounded UTC date projection. Center Portal schedule editor, Foundation Admin permitted oversight and same eligible Internal Android review; no public nurse slot sales.

**Story-level QA (PLANNED / NOT EXECUTED):**
- **US-002-QA01 —** One VERIFIED active nurse at Center A with current NURSING_ERP and coordinator role can create valid weekday recurring shift and effective range; the rule is a working candidate, not a real booked visit.
- **US-002-QA02 —** Current nurse active in Center A but unapproved affiliation to Center B → Center B cannot see/change private shift or create B service availability, despite shared nurse professional identity.
- **US-002-QA03 —** With no CG-15 patient/CG-17 policy/US-003 assignment table populated, US-002 shift create/filter/edit/holiday preview works as independently testable end-to-end operational feature.
- **US-002-QA04 —** Overnight shift local 22:00→06:00 and IANA zone conversion yields precise end-exclusive UTC windows in bounded period, without treating end as before start or all-day availability.
- **US-002-QA05 —** Timezone/date DST transition with ambiguous/nonexistent local time is explicitly validated or disambiguated by original policy; never silently double-book or invent nonexistent local hours.
- **US-002-QA06 —** Add current approved leave/holiday exception and compare candidate windows → approved leave removes candidate availability only in entitled center/time, does not erase previously accepted actual bookings.
- **US-002-QA07 —** Two current coordinators edit same rule/leave revision concurrently → CAS one writer wins; conflicting stale editor gets readable refresh rather than lost interval/approval.
- **US-002-QA08 —** Duplicate leave creation or connection lost during shift save with same source key → replay returns exactly one original record and revision; changed payload using old key conflicts.
- **US-002-QA09 —** Invalid weekday mask, zero/negative duration, unbounded recurrence, invalid local time or start after expiry rejected before DB write, preserving previous effective schedule.
- **US-002-QA10 —** Attempt to create overlapping active affiliation/shift at same center with contradictory intervals → deterministic owner rule reports conflict or valid union, never two silently inconsistent displayed candidates.
- **US-002-QA11 —** Verified one nurse works at two centers with distinct nonoverlapping shift rules → each center maintains its own authorized schedule; cross-center actual reservation will later be checked globally in US-003, so preview says Candidate only.
- **US-002-QA12 —** Professional credential expired or current CG-14 nursing-center grant revoked mid-week → future candidate availability disappears and all active private shift operations fail closed, even with stale Web/native cache.
- **US-002-QA13 —** Global feature OFF or account moved to another center → schedule read/options/export/job denied, current CG-14 public nursing partner enquiry unaffected and no per-center idle scheduler scans.
- **US-002-QA14 —** Foundation Admin H13 Nurse Schedule and own Center Portal calendar/list filters by readable staff name/day/status, no raw UUID and correct empty/no-shift/error/suspended states; original H13 screenshot pixels NOT_RUN.
- **US-002-QA15 —** Native Internal Android Foundation role entitled to review/edit Center A schedule uses native weekday selection/time picker/leave status with safe Back/touch/focus and same backend action; no automatic Center Portal mobile app.
- **US-002-QA16 —** Public Web/native Android cannot enumerate exact private nurse shifts or home-visit routing, regardless of public CG-14 nurse service catalogue, guessed query or direct URI.
- **US-002-QA17 —** Bounded horizon expansion and root+nurse+center availability indexes, repeat queries/explain, true IANA clock conversion, concurrent revision and DB restore are independently specified, SQL/runtime device NOT_RUN.
- **US-002-QA18 —** Human visible validation labels, absence of duplicate patient/center fields, current original owner as-of, safe unknown-write retry and redacted event logs meet latest Harness §4A on every code diff.

**Review requirement:** trace each QA ID to current server scope/owner, concrete SQL constraint/source revision, relevant Web/native action/denial and CG-03/15/19 facade. Record real code evidence, manually fix/re-review. Independent migrations/device/visual QA NOT_RUN.

### US-003 — Create consented nursing service requests and prevent global nurse overbooking

**Outcome/acceptance:** Current center can create a real approved nursing service request for an actual consented CG-15 patient and reserve distinct recurring visit instances with one qualified nurse, without public checkout or CG-17 finance; overlapping nurse visits across centers are prevented by database constraints.

**Requirements:** CG-23-BR02–03; FR-085 and FR-081; H13 bookings and assignment; original CG-15 consent and CG-14 service/fee.

**Actual dependency:** Real US-001 verified affiliated nurse, US-002 candidate shift and actual CG-15 patient+current nursing-purpose consent, real CG-14 approved nursing center/service/rate, global ON/CG-01 current center action. No US-004 care plan or CG-17 settlement.

**Implementation contract:** nursing_service_request/assignment/visit_reservation and exact CG-14 fee revision+CG-15 purpose, PostgreSQL cross-center root+nurse tstzrange gist exclusion under short transaction. Center Portal create/assign/reschedule/cancel, Foundation Admin permitted status, Public Android only actual own safe status if supported.

**Story-level QA (PLANNED / NOT EXECUTED):**
- **US-003-QA01 —** Own Center A user chooses actual CG-15 consented patient and approved CG-14 nursing service, current accepted fee revision and explicit appointment period, location type and recurrence; source persists true purpose and minimal home location.
- **US-003-QA02 —** CG-15 patient missing, unrelated Foundation root, expired/revoked consent, wrong approved care purpose or unauthorized Center B patient ref → service create/selector/detail fails closed without private patient leak.
- **US-003-QA03 —** Nursing request has candidate verified nurse and valid Center A shift at requested local time, no other assignment → actual reserved visit with current source version and explicit ASSIGNED status, not patient PAID.
- **US-003-QA04 —** Two separate approved nursing centers attempt to book same professional at overlapping UTC interval → one root+nurse cross-center exclusion wins, losing center sees human 'This nurse is unavailable at the selected time'.
- **US-003-QA05 —** Race 20 simultaneous assigners for one remaining nurse visit interval, including Center A/B competing requests → only one actual held/confirmed visit wins; no double booking or unexpected global time slot merge.
- **US-003-QA06 —** Create recurring visit every few days over bounded configured period → real individually validated visit instances with unique sequence and actual exclusion for each, no infinite recurrence expansion or fake future completion.
- **US-003-QA07 —** Change nurse after assignment → validate new professional license and current affiliation+shift+consent, reserve new visit set first under safe transaction then release original booking; losing race preserves original assignment.
- **US-003-QA08 —** Reschedule one occurrence, cancel visit and release reserved times → proper source-linked status history and no unrelated occurrences removed; canceled slot may be available again only after actual commit.
- **US-003-QA09 —** Center A coordinator with permission request.create but not nurse.assign cannot auto-assign through forged DTO or direct endpoint; same staff without clinical purpose cannot read protected private home address.
- **US-003-QA10 —** Quoted CG-14 nursing service fee revised after patient request acceptance → accepted rate revision remains traceable, no silent reprice or assumed 30% Foundation assistance.
- **US-003-QA11 —** Missing CG-17 finance policy or all payment gateways inactive → genuine nursing service request and assignment works as DUE/UNBILLED per accepted agreement, without online checkout or CG-09 finance.
- **US-003-QA12 —** Global ERP OFF, nursing center capability suspended or nurse credential expires just before reserve/assign commit → backend rechecks current source and denies; a previous valid visit remains preserved but no future worker/clinical action bypass.
- **US-003-QA13 —** Duplicated request, repeated callback, lost acknowledgement or changed request payload under reused idempotency key → one source request/visit instance set, return original or conflict and no ghost duplicate.
- **US-003-QA14 —** Center Portal H13 Service Details/Nurse & Assignment tabs and Filter State/District/Center/Service/Date show real source-backed booking and conflict, no mock count; Foundation overview purpose-scoped and no wrong-center plan access.
- **US-003-QA15 —** Authenticated actual patient's native Public Android can show only own released source-approved booking status if separately delivered, with readable screen and safe Back/loader; public anonymous Web/Android has no nursing checkout or private roster.
- **US-003-QA16 —** Internal Android same Foundation approved audience as Admin Web sees current granted request oversight/assignment review, with action parity or explicitly approved absence; no full Center Portal clinical workstation.
- **US-003-QA17 —** PostgreSQL btree_gist extension and exclusion constraint, same-root/center composite FK, visit-level unique, time-bound query and 20-way race/rollback/restore are required independent proof; NOT_RUN now.
- **US-003-QA18 —** User-facing messages and notifications show nurse/service names, no patientId/license number/raw SQL; consent-specific errors safe, unknown write state preserved and sensitive input/log fields redacted per Harness §4A.

**Review requirement:** trace each QA ID to current server scope/owner, concrete SQL constraint/source revision, relevant Web/native action/denial and CG-03/15/19 facade. Record real code evidence, manually fix/re-review. Independent migrations/device/visual QA NOT_RUN.

## Execution progress

- US-001–005: design review IN_PROGRESS; no implementation claimed on planning branch. Independent local Harness, clinical DB, migrations/restore, responsive/browser/native/Play/device/visual and measured NFR tests NOT_RUN.
