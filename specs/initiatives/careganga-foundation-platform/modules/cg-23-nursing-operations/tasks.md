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

### US-004 — Protected care plan, verified visit delivery and corrections

**Outcome/acceptance:** Own-center qualified nurse and approved care team securely record actual assigned visits and protected immutable care-plan revisions with CG-19 original evidence; no invented visit completion or CG-17 money.

**Requirements:** CG-23-BR02–03, FR-085, H13 Care Plan/Visit & Progress/Documents.

**Actual dependencies:** Actual US-003 assigned reservation and current CG-15 patient-care consent, professional verification and current Center+CG-01 action. Introduce own CG-19 evidence adapter; no CG-17/20 need.

**Implementation contract:** NestJS signed original event and encrypted plan revision, CG-23 clinical access guard + original CG-19 documents, Center Portal H13 full nursing view, actual qualified Foundation Admin/Internal Android clinical review only, Public Web/native patient own released limited status.

**Story-level QA (PLANNED / NOT EXECUTED):**
- **US-004-QA01 —** Assigned professionally verified current nurse with actual Center A clinical purpose opens only consented patient's correct plan, not arbitrary shared Foundation notes.
- **US-004-QA02 —** Save first real care-plan draft with actual author, source revision, review/patient context and protected content; no public or generic Center Admin exposure.
- **US-004-QA03 —** Concurrent plan updates using stale revision reject losing update and retain prior immutable plan, with human revision conflict.
- **US-004-QA04 —** Different Center B worker, unassigned nurse, revoked care team and unrelated root cannot list, access, export or guess private care plan.
- **US-004-QA05 —** Consent revoked while plan/files are displayed denies next read/write, expires protected file access and clears local Web/native cached PHI.
- **US-004-QA06 —** Only actual assigned nurse can START an existing scheduled visit within authorized source rule; future unassigned times do not become performed.
- **US-004-QA07 —** Visit COMPLETE requires genuine work evidence and professional confirmation/independent review if required, not elapsed schedule time or screen badge.
- **US-004-QA08 —** Two duplicate completion callbacks or retries return same original event and one final state, not two visits or patient invoices.
- **US-004-QA09 —** Missed visit, sick nurse, cancellation and handover are separate original events and preserve true history rather than false Completed.
- **US-004-QA10 —** Professionally authorized correction/retraction creates linked new event to exact original signed visit and revision without deleting prior notes.
- **US-004-QA11 —** Original CG-19 evidence adapter validates scanner/MIME/size/owner/source and only returns verified current authorized file; missing file is PENDING.
- **US-004-QA12 —** Forged, expired, cross-root or stale CG-19 document token and revoked clinical role fail on direct file API with no patient information disclosed.
- **US-004-QA13 —** Original H13 Service Details, Nurse & Assignment, Care Plan, Visit & Progress, Documents tabs map to actual verified restricted statuses and safe actions; direct H13 image pixel pending.
- **US-004-QA14 —** Responsive Center Portal tabs, form/date, narrow stack, keyboard, focus and nontechnical empty/pending/conflict/error states align with CareGanga original Admin tokens.
- **US-004-QA15 —** Public Web and Public Android patient status only for actual authenticated consented own patient if implemented, never notes/diagnosis/coordinates/third-party files.
- **US-004-QA16 —** Internal Android authorized Foundation clinician mirrors applicable Admin clinical review for same role using native Back/keyboard/secure storage; general Admin sees no plan.
- **US-004-QA17 —** SQL source FK/immutable revision, race, consent revocation, backup/restore and independent qualified clinical reviewer trace are mandatory separate QA, NOT_RUN.
- **US-004-QA18 —** Harness §4A enforces human-readable labels, necessary fields only, safe nontechnical errors and restricted redacted logs for any backend/API/Web/mobile change.

**Review requirement:** Trace every QA identifier to actual file:function, original owner and patient-purpose checks, SQL record and applicable Web/native actions; source-only QA does not certify live/device/clinical tests.

### US-005 — Source-backed nursing reports, due reminders and conditional CG-17 finance

**Outcome/acceptance:** Real nurse request/visit metrics and bounded reminder work remain usable without CG-17; only genuinely completed and separately approved eligible service can signal original CG-17 settlement once.

**Requirements:** CG-23-BR04, FR-081/085, conditional FR-087 and H13 status cards.

**Actual dependencies:** US-003 genuine request sufficient for assigned/booked report; US-004 genuine professional completion for completed metric and optional financial signal; current CG-17 policy only for optional money, not for source reports.

**Implementation contract:** CG-23 bounded source projection and indexed due-only notification event through original CG-19 when configured, conditional nursing_financial_source_event and typed CG-17 completion adapter. Center Portal own reports, Foundation Admin permitted summaries, native Internal Android same role; no CG-20 requirement.

**Story-level QA (PLANNED / NOT EXECUTED):**
- **US-005-QA01 —** Real Center A requests/assignments produce correct H13 counts, as-of, date/status and original source with no screenshot sample KPI.
- **US-005-QA02 —** With US-003 only and no US-004 completion/CG-17 policy, report safely shows booked/assigned without invented completed source or money.
- **US-005-QA03 —** Scheduled/assigned, performed, professionally completed, missed, canceled, returned and corrected remain distinct source and chart statuses.
- **US-005-QA04 —** Foundation general reporter can view allowed aggregate only without private patient's plan, home location, diagnosis or sensitive small cells.
- **US-005-QA05 —** Center B/revoked actor tries list/filter/options/export of Center A report → backend source authorization denies before aggregation.
- **US-005-QA06 —** CG-10/11 employee/salary and nurse earnings never created or leaked from CG-23 reports even where a nurse works in several centers.
- **US-005-QA07 —** Actual US-004 confirmed completed service with NO CG-17 approved policy remains COMPLETED without Foundation contribution or CG-09 journal.
- **US-005-QA08 —** Current approved CG-17 nursing policy + actual accepted fee and completed source allow one narrow CG-23 completion adapter event to original CG-17 decision.
- **US-005-QA09 —** Client-provided 30% discount or `paid=true` from screenshot cannot create patient cash, benefit, liability or auto-settlement.
- **US-005-QA10 —** Actual approved Foundation liability and patient center collection retain separate DUE/APPROVED/SETTLED statuses, patient cash not Foundation income.
- **US-005-QA11 —** Race/replay duplicate completion signal or CG-17 missing acknowledgement yields one original source effect and safe Pending reconciliation, not duplicate payout.
- **US-005-QA12 —** Cancel/retract professionally verified visit after financial effect sends one linked compensating original CG-17 correction, never silently deletes clinical/posted history.
- **US-005-QA13 —** Opted-in real due visit with eligible recipient and current consent produces one CG-19 reminder effect, actual sent status only from original owner.
- **US-005-QA14 —** No recipient grant, canceled booking, no channel or failed provider → reminder suppressed/pending/failed truthfully, no PHI in push or email.
- **US-005-QA15 —** Global ERP OFF, center revoked, or zero due reminders across tenants: all CG-23 jobs/private report APIs denied or idle, no tenant scan/egress.
- **US-005-QA16 —** Foundation Admin and equally authorized Internal Android show matching source summaries/actions, Center Portal own-center only, Public apps no private MIS; H13 direct visual QA pending.
- **US-005-QA17 —** Test root+center scoped SQL indices/source timestamps, CG-17 unique key and original CG-09 journal state, retries, migration/restore, due-only EXPLAIN separately, NOT_RUN.
- **US-005-QA18 —** Apply Harness §4A to every user-facing value, PDF/export/status, safe error and clinical redacted log; preserve native accessibility and honest unknown outcomes.

**Review requirement:** Trace every QA identifier to actual file:function, original owner and patient-purpose checks, SQL record and applicable Web/native actions; source-only QA does not certify live/device/clinical tests.

## Execution progress
- **US-001–005: current owner-delegated SOURCE DESIGN only** (after actual approval-ledger commit). Five source-owned vertical stories with **90 distinct QA (18 per story)**. Implementation on planning branch NOT_STARTED; no clinical/runtime/code completion claimed.
- **Gates NOT_RUN:** local Harness resolver; independent qualified clinical, CRITICAL database and privacy review; migrations/backup/restore, cross-center no-overlap 20-way race, CG-19/17 integration; actual responsive Web, Public/Internal Android, Play/AAB/16KB, rendered H13 pixel/motion; idle DB/HTTP egress NOT_MEASURED.
- Development follows newest approved source and real predecessor order. Execute one dependency-ready story, independent code review → fix → re-review → exact scenario QA source trace, update only this progress section. ERP globally OFF by default; original CG-14 nursing partner public enquiry remains available. No CI/GH Actions.


### 21 November 2026 — Owner-approved Web ↔ Android same-capability contract

**Owner:** cg-23-nursing-operations; **current source:** PLANNED_NOT_IMPLEMENTED (owner backend and feature routes do not exist on the current branch). This is owner-delegated **design-content acceptance**, not source completion, independent clinical/pharmacy review, code/SQL/PDF/Play/runtime QA or authorization to implement future modules automatically. Preserve the original per-story QA IDs and all four optional ERP OFF defaults; do not introduce a new patient payment/discount flow, drug dispense, clinical decision or unsupported staff role.

**Same authorized audience channels:** Foundation Admin / assigned center staff Web **↔ Internal Android** for verified nursing center oversight, consent-controlled case/shift/staff assignment, handover/actual source proof only with original optional ERP ON. Approved anonymous/patient Web **↔ Public Android** for real approved CG14 nursing center enquiry with ERP OFF and individual own status solely when original consent and identity permit. If an authorized center operator can perform a protected original story on responsive Web, the same enrolled center actor must have its equivalent in Internal Android, even if the old design called it a Web-only “workstation”; a 3rd center app is not required. Any genuine platform-specific exemption needs explicit owner approval and rationale in original QA. ERP OFF must never surface disabled fake stock/shifts/OT actions as operational.

**Existing planned story QA status:** All source `NOT_IMPLEMENTED`; original tests `NOT_RUN`. Each original case must map applicable `WEB_SOURCE`, `INTERNAL_ANDROID_SOURCE`, `PUBLIC_WEB_SOURCE`, `PUBLIC_ANDROID_SOURCE` or `NOT_APPLICABLE (reason)`, with typed backend contract and original screenshot H refs. Public price/enquiry when ERP OFF remains distinct from conditional protected ERP ON; never mark it complete before real client implementations. No extra test/story IDs, no active module approval or main merge.

### 21 Nov 2026 — Nursing partner discount V1 while ERP remains OFF (reuse original QA IDs)

**SELECTED V1:** CG14 original US001/002/004 nursing-partner legal registration, verified center/public enquiry and CG17 original US001/002/005/006/007 benefit, actual delivered nursing proof, monthly settlement and own-center dashboard. **Not** an assumption that CG23 nurse roster or home visit ERP has been built.
- **CG14 US001-QA01/04, US004-QA02/04:** approved NURSING provider enrolled with real center/legal/license proof; independent verification, protected customer contact, public Web/native listing and own-center access while all ERP flags OFF. Pending/suspended center has no eligible benefit.
- **CG23 US001-QA01–06** remain explicitly **FUTURE_ERP_NOT_RUN** for detailed nurse credential registry; do not require CG23 internal nurse creation to register the agency.
- **CG17 US001/002/004/005/006/007 existing QA:** eligible customer and current center service, configurable capped Foundation subsidy, genuine patient net collection, dated delivered nursing service receipt/qualified review (CG19 protected) and independent CG17 accepted claim; cross-center guessed record/duplicate invoice, cancellation/no service and altered practitioner proof cannot generate payment; Foundation manual monthly partial/complete payout posts only via CG09 and partner sees own current due/paid.
- **CG23 US002–005:** 72 further shift/visit/care-plan/ERP-report QA remain NOT_IMPLEMENTED/NOT_RUN. Original 90 CG23 cases and Web↔Android applicability unchanged; **source implementation selected only for CG14/17 partner path until specifically authorized for optional ERP**. No real clinical, SQL, device or finance QA executed.


## CG-MB cross-branch/center QA overlay — 23 Nov 2026

**Authoritative original scope:** CG-14 genuine nursing CENTER affiliation + patient-own consent and clinician credential, not CG-02 branch. **Separate bugs:** CG-MB-010, CG-MB-013; [cross-module QA scenarios MB-T01–T22](../../../../../docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md) and [bug register](../../../../../docs/bugs/multibranch/README.md). **All original QA IDs/previous statuses are retained; these additions are NOT_RUN** and add no duplicate QA identifiers. Test Foundation root R, two ACTIVE internal branches A/B, closed C, two unrelated current CG14 verified centers X/Y where eligible, manager A/B, ordinary staff, independent approver, revoked account, patient with/no center-specific consent, and only real owner events.

| Original user story and existing QA anchor | Source-linked multi-branch/center scenario | Required backend/database/client test | State |
| --- | --- | --- | --- |
| US-001 (existing US-001-QA01) | Verify nurse identity once with separate X/Y center affiliations and license evidence; X manager cannot approve Y affiliation or access Y private professional docs. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-002 (existing US-002-QA01) | X/Y nurse availability/leave must prevent global double booking when nurse serves both centers; revoked X cannot edit Y schedule. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-003 (existing US-003-QA01) | Consented patient at X requests home/center nursing; Y staff cannot see X patient, and X cannot assign nurse without active center/credential/patient consent. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-004 (existing US-004-QA01) | Protected nursing care plan, visit evidence and signed correction stays at original X patient and professional; after transfer/suspension, Y cannot view X clinical file. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-005 (existing US-005-QA01) | Source-centered nursing metrics, due reminders, optional CG-17 patient collections and Foundation benefit must keep X/Y separate, ERP OFF denies new operations. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |

**Cross-story mandatory evidence:** For every original case trace current account role/source scope, exact CG-02 branch vs CG-14 center vs patient/recipient ownership, read and mutation; root-only cannot be silently selected by a branch role; wrong-root/same-root-other-center or branch guessed API ID, stale token, cancelled/closed source, concurrent idempotent command and unchanged history. Check all list/detail/options/exports/CG19 PDF/document/signed URL/notices/CG20 scheduled report/CG17 money where applicable, current outbox recipient at delivery, redaction and traceable denial. Explicitly mark `CG02_BRANCH=NOT_APPLICABLE` for owner-only center clinical action, not a false branch FK. Perform original Web/Center UI ↔ native Internal Android and public Web ↔ native Public Android parity, screenshot-based UX, fresh+upgrade PostgreSQL and actual provider/device QA. Record independent reviewer, exact commit, QA original ID, observed result and remaining blocker. No CI or merge to main.
