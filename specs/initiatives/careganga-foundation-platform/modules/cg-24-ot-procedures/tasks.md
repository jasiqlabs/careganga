# CG-24 — Five Independent OT & Procedure Stories with Manual QA

**Sources:** [module.md](module.md), [DLD](dld.md), [UI/UX](uiux.md), [PRD](../../prd.md) FR-081/086/conditional FR-087, [HLD](../../hld.md) §5.5, integrated Healthcare BR CG-24-BR01–04, original CareGanga screenshot audit H14 (exact H14 image NOT_AVAILABLE; authentic U01 shared brand inspected) and [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md).
**H14/H15 source limitation:** H14 has indexed original UI audit control descriptions; FR-086's H15 reference has no directly available picture or indexed contents. Exact H14/H15 source image match, animations and rendered device QA remain NOT_RUN; never claim H15 functionality from its identifier alone.\n**Status:** expert source-design REVIEWED, SHA-bound owner delegation recorded only after final current-ledger write; authenticated local Harness resolver, independent CRITICAL clinical/DB/privacy reviewer, actual SQL migrations/restore, Web/native builds, H14 exact pixels, Android/Play, real concurrency and NFR measurements NOT_RUN.
**Execution:** Use current Harness pin `26371c78da3a6d94717d65d24f159f03127a2a8a`; choose one real predecessor-ready US, source implementation PostgreSQL + typed NestJS + corresponding responsive Admin/Center/public Web and relevant native Public/Internal Android, then independent source review → fix → re-review → each QA ID trace with actual file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE. Do not run CI/GH Actions, do not call source-only QA clinical/device/runtime PASS. Keep code statuses only under final `## Execution progress`.

## Reviewed story definitions — delegated SOURCE DESIGN only
### US-001 — Publish genuine CG-14-linked procedure information and enquiry with ERP OFF

**Outcome/acceptance:** Authorized Foundation and own center can review/publish versioned safe procedure-specific information against an actual CG-14 approved procedure service and its original fee, and Public Web/native Android can view current approved details/enquiry while OT operations stay OFF.

**Requirements:** CG-24-BR01; PRD FR-081/FR-086; H14 Procedure Master + source-approved CG-14 public service; CG-NFR privacy/UI/DB.

**True predecessors:** Real CG-01 actor with current protected procedure review, actual CG-14 verified/published center and approved procedure service/price. No room/team/CG-15 patient/CG-17 financial policy, no ERP ON or CG-20.

**Cross-stack implementation:** Source-owned ot_procedure_detail with exact CG-14 source service fee/revision pointer (no CG-24 second fee), guarded approval/publish state and optional original CG-03 approval adapter if genuinely required. Responsive Foundation Admin and own-center Center Portal, actual Public Next.js/Public Android published service and genuine enquiry, equivalent authorized Foundation Internal Android review.

**Original manual QA (PLANNED / NOT EXECUTED):**
- **US-001-QA01 —** With all four ERP flags OFF and genuinely approved CG-14 partner center/procedure service, display real published procedure information and original CG-14 fee/enquiry without creating any room, booking or patient.
- **US-001-QA02 —** An authorized Center A editor selects only current own-center CG-14 procedure service and saves safely bounded descriptive title, preparation disclaimer and estimated duration; no independently editable duplicate fee in CG-24.
- **US-001-QA03 —** Attempt create source detail for non-existent, suspended, unpublished or foreign-center CG-14 service → current source validation rejects and does not publish a phantom procedure.
- **US-001-QA04 —** Verify currently published fee is returned from original CG-14 service revision; changing CG-24 descriptive content never silently changes source fee or creates CG-17 Foundation subsidy.
- **US-001-QA05 —** Submit procedure detail with genuine required independent CG-03 review → original case/digest and qualified current reviewer can approve and guarded CG-24 finalizer publishes one accepted revision.
- **US-001-QA06 —** Self-approve where separation required, forged case approval, expired reviewer, stale CG-14 service fee or mismatched digest → remain review-pending/denied and retain original prior version.
- **US-001-QA07 —** Concurrent edits/publish of identical procedure+source revision use CAS and immutable approval history; one version wins, no overlapping contradictory current approved detail.
- **US-001-QA08 —** Invalid unbounded preparation copy, fake clinical certification, unsupported surgery claim, empty detail or unsafe script/HTML → sanitized/validated content and safe human feedback, not a clinical guarantee.
- **US-001-QA09 —** One CG-14 provider can publish different procedure details while another center chooses independent service info; no cross-center price/history or sensitive professional details leak.
- **US-001-QA10 —** Anonymous Public Next.js and native Public Android show only CG-14 ACTIVE VERIFIED/PUBLISHED center + approved source-safe CG-24 detail, original actual fee/validity and contact; no sample H14 counts.
- **US-001-QA11 —** After CG-14 center publication withdrawn, professional qualification revoked or procedure revision withdrawn, public Web/native source cache invalidates; no stale 'available OT' or price promise.
- **US-001-QA12 —** Public procedure has no approved specific detail but real CG-14 approved basic service → CG-14 directory remains truthful, no invented description, dummy doctor or auto-disabled provider card.
- **US-001-QA13 —** Public enquiry uses actual current approved CG-14 published contact or genuinely available CG-19 channel, not 'Booked', 'Paid', '30% subsidy', room availability or a fake support ticket.
- **US-001-QA14 —** Private procedure description review is authorized under CG-01 current actor/current Center A; Center B, revoked staff, anonymous user or root-guessing cannot list drafts/options/reviewer evidence.
- **US-001-QA15 —** Foundation Admin Procedure Master follows authentic U01 CareGanga navy/blue shell and indexed H14 source structure; forms/minimal fields, statuses, filters, narrow responsive and no raw UUID; H14 exact pixel/motion NOT_RUN.
- **US-001-QA16 —** Internal Android same Foundation entitled description reviewer has actual approve/return/history parity and accessible native actions; Public Android has identical genuine published detail/enquiry to Web and no private OT menu.
- **US-001-QA17 —** Global ERP flag malformed/false but public detail exists → private OT rooms, resource selectors, booking/case/reports/jobs/API all deny; procedure-content source controls still operate only for correctly permitted author.
- **US-001-QA18 —** Trace same-root/center service FK or guarded facade, source version/uniqueness and approval audit, public source update, unsafe copy, controlled input, restore, API redaction and current Harness §4A; independent DB/browser/device proof NOT_RUN.

**Acceptance trace requirement:** Trace each QA ID from current channel action/rejection → CG-01/14/15 current owner/clinical purpose → typed API + scoped Postgres constraint/mutation → original CG-03/19 owner adapter only where actually introduced → permitted other Web/native state. Record source files/functions, fix/re-review. Actual independent SQL/race/regulatory/device/motion verification remains NOT_RUN.

### US-002 — Verify operational OT room, qualified team and shared physical equipment readiness

**Outcome/acceptance:** One real licensed OT center with current approved OT_ERP can register and review actual room/equipment readiness and qualified CG-14 professional requirements without patient/booking, and shared physical assets remain one identity.

**Requirements:** CG-24-BR01; FR-086 + FR-081 gate; H14 OT Resource / OT Team; CRITICAL DB and original CG-14/19 role.

**True predecessors:** Current verified CG-14 facility/center, current independently approved OT_ERP grant, actual qualified CG-14 professional identity/affiliation where required, CG-01 action and global ON. No US-001 procedure-detail or CG-15 patient/US-003 reservation needed.

**Cross-stack implementation:** ot_room, ot_physical_resource, ot_procedure_requirement, ot_resource_readiness_event with original CG-19 protected evidence adapter introduced here, on-Center Portal source management, Foundation Admin/eligible Internal Android current reviewer oversight, private typed list/options/status and NO public asset list.

**Original manual QA (PLANNED / NOT EXECUTED):**
- **US-002-QA01 —** With backend global OT OFF, all CG-24 room/equipment/team list/options/detail/create/update/export/worker routes refuse; public CG-14 procedure enquiry remains available.
- **US-002-QA02 —** Global ON with Center A ACTIVE VERIFIED/licensed and approved current OT_ERP grant plus qualified actor → actual room creation/readiness succeeds without any patient/booking or CG-17 money.
- **US-002-QA03 —** Global ON but Center B OT_ERP suspended, facility licence expired, module schema absent or CG-01 permission revoked → room/resource operation fails closed; no automatically approved center.
- **US-002-QA04 —** Create named Center A OT Room 1 with actual permitted license/readiness evidence, source status and current version; duplicate normalized room label under same center conflicts but Center B independently labelled room remains distinct.
- **US-002-QA05 —** Register one actual physical instrument/device used by Center A and moved to Center B under source-verified legal operator → retains one global physical asset identity, not two simultaneously reservable copies.
- **US-002-QA06 —** Select CG-14 surgeon, anesthetist and qualified team requirement by original global professional and current verified center affiliation; no duplicate surgeon master or CG-10/11 employee/payroll.
- **US-002-QA07 —** Expired CG-14 professional registration, suspended affiliation, missing qualified role or invalid Center A resource status cannot be represented as READY for a new case.
- **US-002-QA08 —** Protected original CG-19 room/professional/inspection evidence pending scan, expired file, revoked proof or wrong-root ref leaves resource PENDING/UNAVAILABLE; no fake verified certificate from text box.
- **US-002-QA09 —** Two reviewers concurrently update readiness with stale versions → CAS one accepted immutable ot_resource_readiness_event, loser actionable conflict, old evidence remains auditable.
- **US-002-QA10 —** Quarantine or mark UNAVAILABLE a real room/equipment while no booking exists → new candidate selection denies, original signed status and center scope preserved.
- **US-002-QA11 —** Center A user with resource.read but no resource.approve/update cannot approve readiness via direct API or forged client boolean; controls hidden under actual permissions.
- **US-002-QA12 —** Another Center B or Foundation user lacking source right guesses asset document, list, room options/selection or private team roster → scoped backend denies before private metadata leak.
- **US-002-QA13 —** One professional linked to two centers can be independently qualified for each; later US-003 will use original person identity root-global for actual schedule conflict, not affiliation IDs.
- **US-002-QA14 —** Current original Center Portal shows readable Rooms & Resources list, readiness/expiring/inspection status, evidence drawer and clinician-team requirements, authentic CareGanga source design and responsive mobile Web; H14 direct-image pixel NOT_RUN.
- **US-002-QA15 —** Foundation Admin and native Internal Android the same current authorized reviewer can inspect/approve/return readiness with equivalent real action, source evidence and accessible Back/keyboard/role behavior, not a third Center Android.
- **US-002-QA16 —** Public Website and Public Android see only CG-14 published service and no private OT room label, asset count, staff shifts, record, price inflation or inspection document.
- **US-002-QA17 —** CRITICAL same-root/center FKs, unique actual physical asset identity, current source/professional scope, short locking, source event idempotency, backup/restore/index query and CG-19 adapter regression require independent execution, NOT_RUN.
- **US-002-QA18 —** Every changed user field and backend failure obeys current Harness §4A minimal human-readable labels, no raw UUID/license bytes/SQL/HTTP code, protected correlated logs, correct unknown outcome and current source validity.

**Acceptance trace requirement:** Trace each QA ID from current channel action/rejection → CG-01/14/15 current owner/clinical purpose → typed API + scoped Postgres constraint/mutation → original CG-03/19 owner adapter only where actually introduced → permitted other Web/native state. Record source files/functions, fix/re-review. Actual independent SQL/race/regulatory/device/motion verification remains NOT_RUN.

### US-003 — Book real consented OT cases with atomic room, global professional and asset reservation

**Outcome/acceptance:** An authorized OT center creates a genuine CG-15 patient case with current approved procedure/fee and atomically reserves all required room, globally identified staff and actual shared equipment, preventing conflicting bookings or orphaned holds.

**Requirements:** CG-24-BR02; FR-086; H14 OT Booking & Scheduling; CG-NFR patient privacy/CRITICAL concurrency.

**True predecessors:** US-001 real approved CG-14-linked procedure description, US-002 actual verified room/resource/qualified team, actual CG-15 patient and current procedural consent, current CG-01/14/OT_ERP grant. No CG-17 policy or US-004 clinical outcome needed.

**Cross-stack implementation:** ot_case_booking, ot_case_resource_assignment and one ot_capacity_reservation with canonical ROOM/PERSON/EQUIPMENT keys, actual PostgreSQL GiST exclusion + short locks/finite slot policy. Center Portal booking/reschedule/cancel, Foundation Admin current oversight and Internal Android same-role review, no public OT checkout.

**Original manual QA (PLANNED / NOT EXECUTED):**
- **US-003-QA01 —** Own Center A authorized operator selects genuine CG-15 consented patient, approved original CG-14 service/fee, current US-001 procedure and US-002 ready room/qualified staff/equipment; one confirmed full case after atomic success.
- **US-003-QA02 —** Expired/refused/revoked CG-15 patient procedural consent, unauthorized care purpose, foreign Center B or root patient and unapproved service → no booking/patient information or source mutation.
- **US-003-QA03 —** Requested room overlaps already HELD/CONFIRMED reserved slot in same center → PostgreSQL exclusion allows only one; loser sees nontechnical room unavailable and no phantom confirmed case.
- **US-003-QA04 —** One original CG-14 surgeon affiliated with two centers attempts overlapping OT cases → reservation canonical PERSON key is globally identical across center affiliations, second booking denied.
- **US-003-QA05 —** One physical shared instrument registered under two location presentations is attempted for overlapping cases → canonical EQUIPMENT identity prevents second simultaneous reservation.
- **US-003-QA06 —** Race 20 concurrent bookers against one remaining room/team/equipment interval with identical and distinct request keys → only one true complete reservation set, no partial room-only case, negative status or duplicate person assignment.
- **US-003-QA07 —** All required surgeon/anaesthetist/OT clinical roles and equipment quantity/qualification are verified from actual US-002 requirements; missing one is not silently optional or replaced with unqualified staff.
- **US-003-QA08 —** Service/procedure duration, approved turnover margin if actually configured, local timezone/DST ambiguous time and end-exclusive window checked; invalid duration or non-existent local instant rejected before locking.
- **US-003-QA09 —** Pending CG-19 room certificate, CG-14 professional licence suspended, room quarantined or CG-14 facility grant revoked just before reservation commit → current source revalidated inside critical command and no booking accepted.
- **US-003-QA10 —** Two operators reschedule same confirmed case concurrently → one valid new **full** reservation set committed and old release in same transaction; losing update leaves original booking unaffected.
- **US-003-QA11 —** New reschedule requested during competing reservation fails → old confirmed room/team/equipment remain reserved, and UI says choose different slot, not false cancellation or partial hold.
- **US-003-QA12 —** Cancel real case and retry cancellation idempotently → only own case holds release once, immutable cancellation status retained and unrelated case/person/asset unaffected.
- **US-003-QA13 —** Duplicate request after unknown commit status uses original source digest/idempotency to retrieve one accepted case; changed case payload with same key conflicts, no double booking from retry.
- **US-003-QA14 —** Case has future booking but current resource remains occupied by an overrun actual IN_PROGRESS case → availability/review shows not currently ready, later clinical start blocked until actual qualified release; no automatic free on scheduled end.
- **US-003-QA15 —** Center B guessed case ref, unassigned professional or Foundation generic report actor attempts patient/room list/detail/edit/export → original Center A + care-purpose and role access enforced by API and DB; no PHI leak.
- **US-003-QA16 —** Center Portal H14 booking form (patient/procedure/room/team/equipment/time) and right case panel expose Candidate vs Confirmed vs Conflict/Review Needed, responsive accessible filters/Back/error; H14 direct image visual QA pending.
- **US-003-QA17 —** Foundation Admin and Internal Android same permitted Foundation case oversight/review use equivalent source actions if delivered, while Public Next.js/Public Android never show OT self-checkout, available surgery slot or patient-private case.
- **US-003-QA18 —** Independent actual btree_gist migration, 20-way room/person/equipment race, cross-center source identity, deadlock-order/rollback, batch reschedule, restore, query budget and user-facing Harness §4A review required; no SQL/device PASS yet.

**Acceptance trace requirement:** Trace each QA ID from current channel action/rejection → CG-01/14/15 current owner/clinical purpose → typed API + scoped Postgres constraint/mutation → original CG-03/19 owner adapter only where actually introduced → permitted other Web/native state. Record source files/functions, fix/re-review. Actual independent SQL/race/regulatory/device/motion verification remains NOT_RUN.

### US-004 — Guard actual pre-op, in-progress, post-op and protected clinical evidence

**Outcome/acceptance:** Actual assigned qualified clinical team records verified phases, source-correct protected notes and signed corrections, and owns real room/team/asset occupancy until clinical release.

**Requirements:** CG-24-BR03–04; PRD FR-086 / conditional FR-087; H14; current CG-01/14/15/17/19 boundaries.

**True predecessors:** Actual US-003 confirmed case with complete reservation, current CG-15 procedure consent and qualified CG-14 team, original CG-19 clinical evidence adapter introduced here. No CG-17 benefit required.

**Cross-stack implementation:** Original ot_case_status_event, ot_case_note_revision and ot_resource_live_occupancy, Center Portal H14 clinical tabs, protected CG-19 document authority, Foundation Admin/Internal Android only appropriately assigned clinical/exception roles; public clinical detail denied.

**Original manual QA (PLANNED / NOT EXECUTED):**
- **US-004-QA01 —** Actual assigned qualified clinical user with current Center A OT_ERP and patient consent can open one correct case and clinical phase, unrelated Foundation finance role cannot.
- **US-004-QA02 —** Real pre-op readiness review needs current verified room, professional, consent and protected evidence, not a draft or screenshot badge.
- **US-004-QA03 —** Direct transition SCHEDULED→COMPLETED, CANCELLED→IN_PROGRESS or out-of-order POST_OP is denied by source state machine.
- **US-004-QA04 —** Actual START atomically claims every ROOM/PERSON/EQUIPMENT live occupancy after rechecking original resource and patient permissions, no partial claim.
- **US-004-QA05 —** Procedure running beyond planned end retains live occupancy; later case cannot start on occupied room even when original slot expired.
- **US-004-QA06 —** Two competing START actions from different Center A/B cases sharing global surgeon/asset permit only one live occupancy.
- **US-004-QA07 —** Upcoming confirmed booking with older surgery overrun enters REVIEW_NEEDED and cannot silently start or auto-cancel due to expired planned end.
- **US-004-QA08 —** Actual professionally verified performed and POST_OP progression allows signed COMPLETED and one release of all occupied resources with real end evidence.
- **US-004-QA09 —** Expired professional, unassigned actor or generic cashier cannot mark surgery clinically completed or release resource from elapsed clock alone.
- **US-004-QA10 —** Actual care notes store qualified author, protected signed revision and source, with concurrent stale editors rejected rather than overwrite.
- **US-004-QA11 —** Exact duplicate event/key+digest or unknown callback returns one original clinical transition, new digest with reused key conflicts.
- **US-004-QA12 —** Authorized correction/retraction produces a separately linked immutable event and does not delete old operative evidence or auto-adjust CG-09.
- **US-004-QA13 —** CG-19 current protected clinical evidence adapter validates scan, MIME, ownership, purpose and per-file grant; unverified upload is PENDING.
- **US-004-QA14 —** Cross-root/Center B/other patient or revoked role trying guessed file/case URL cannot read clinical text, document, notes or write status.
- **US-004-QA15 —** Patient consent revoked while case tab open denies new file/notes and clears sensitive Web/native cache; lawful CG-15/19 original release remains separate.
- **US-004-QA16 —** H14 original Procedure Details, OT Team, OT Resources, Pre-op & Post-op, Documents are real source-backed responsive Center Portal tabs; H14 pixel/motion QA NOT_RUN.
- **US-004-QA17 —** Internal Android only identical qualified Foundation-authorized clinical/exception action is supported with native Back/secure cache; Public Android/Public Web never private OT case editor.
- **US-004-QA18 —** Independent actual Postgres clinical event/occupancy race, role/consent negative and restore QA plus Harness §4A safe errors/trace are required, NOT_RUN.

**Acceptance trace requirement:** Verify source actor/real clinical purpose, Postgres transaction and original CG-19/CG-17 effect plus every applicable Web/native result by file:function; never call independent clinical/DB/pixel/Play QA PASS without execution.

### US-005 — Report real OT utilisation and optionally signal completed services to CG-17

**Outcome/acceptance:** Real scoped OT resource/case metrics and bounded due reminders work from actual events; only qualified completed cases with approved CG-17 policy may signal original financial effects once.

**Requirements:** CG-24-BR03–04; PRD FR-086 / conditional FR-087; H14; current CG-01/14/15/17/19 boundaries.

**True predecessors:** US-002 room source sufficient for readiness report; US-003 booking for occupancy; US-004 genuine completed case for completion and optional CG-17 adapter; CG-17 policy only when optional finance enabled. No CG-20 dependency.

**Cross-stack implementation:** Original scoped room/resource/case source projections, optional immutable ot_case_financial_signal/CG-17 typed adapter, actual due-only CG-19 notification event, Foundation Admin/Center Portal/Internal Android current approved summary; public private MIS denied.

**Original manual QA (PLANNED / NOT EXECUTED):**
- **US-005-QA01 —** US-002 source rooms alone create real readiness/empty report, no fake booking or H14 sample counts.
- **US-005-QA02 —** US-003 bookings without US-004 completion yield scheduled/reserved state only, not clinically completed or Foundation paid.
- **US-005-QA03 —** Actual US-004 start/post-op/completed events separate planned window, true live occupancy and performed duration in source KPI.
- **US-005-QA04 —** Current Center A filtering by room/procedure/date/status and source cutoff returns only authorized rows; other center/root cannot list or aggregate private cases.
- **US-005-QA05 —** Foundation general manager and corresponding Internal Android see safe permissioned aggregates, not clinical notes or tiny identifying groups.
- **US-005-QA06 —** CG-20 unavailable and CG-17 disabled does not block actual CG-24 own room/case source report.
- **US-005-QA07 —** True clinically completed case without approved effective CG-17 OT assistance policy shows no Foundation support configured, no CG-09 journal.
- **US-005-QA08 —** Original CG-17 approved policy, valid accepted CG-14 fee, real patient/center and qualified US-004 completion create one narrow source event that CG-17 independently validates.
- **US-005-QA09 —** Client-supplied 30% benefit, `paid=true`, fake center commission or H14 gross cannot authorize subsidy, patient cash or Foundation accounting.
- **US-005-QA10 —** CG-17 returned patient DUE/collected vs Foundation approved DUE/settled displayed separately; patient money never added to CG-09 Foundation cash.
- **US-005-QA11 —** Duplicate completed event/restart/lost CG-17 acknowledgement gives one original source key and Pending reconciliation, not duplicate liability/payout.
- **US-005-QA12 —** Real signed correction/cancellation after prior eligible completion produces unique compensating linked CG-17 event, preserves original journal/audit.
- **US-005-QA13 —** Actual due OT reminder to current consented recipient uses original CG-19 source notification once; queue acceptance isn't proof of SENT.
- **US-005-QA14 —** Missing provider, revoked consent, canceled procedure or invalid recipient suppresses/marks notice unavailable and never pushes private procedure details.
- **US-005-QA15 —** Backend OT OFF, revoked grant or zero due jobs prevents CG-24 reports/workers/private export and provider/tenant scans, leaves CG-14 published enquiry.
- **US-005-QA16 —** Foundation Admin/Internal Android same role get equivalent permitted H14 KPI and exception status, Center Portal own-center, Public Web/Android no private OT MIS.
- **US-005-QA17 —** Source SQL indexes, accurate occupancy sums, restore, CG-17 source idempotency/reversal and CG-09 journal parity plus egress metrics require independent execution, NOT_RUN.
- **US-005-QA18 —** Harness §4A human-readable role-safe charts/exports/notifications/errors, no UUID/clinical detail/SQL logs, responsive and native accessibility reviewed in source and later runtime.

**Acceptance trace requirement:** Verify source actor/real clinical purpose, Postgres transaction and original CG-19/CG-17 effect plus every applicable Web/native result by file:function; never call independent clinical/DB/pixel/Play QA PASS without execution.

## Execution progress

- **US-001–005: OWNER_DELEGATED_SOURCE_DESIGN_APPROVED only at current verified initiative approval SHA-256**, five independently scoped OT stories / 90 distinct planned QA (18 per story). Source implementation on planning branch NOT_STARTED; code/clinical/release certification NOT claimed.
- **Formal and independent gates NOT_RUN:** authenticated local Harness resolver; qualified CRITICAL clinical/privacy/PostgreSQL reviewer; real migration/backup/restore/GiST and 20-way room/person/asset conflict/overrun race; backend/Web/Center Portal/Public and Internal Android runtime; original H14 image pixel/motion; Play/AAB/16KB; real latency/idle worker/HTTP egress measurements.
- **Development:** follow actual DELIVERY_ORDER prerequisites, implement/review/fix/re-review each dependency-ready story and exact QA ID using real source file:function evidence. Keep default OT ERP OFF until independent acceptance; CG-14 procedure catalogue/enquiry remains live. No CI/GH Actions.


### 21 November 2026 — Owner-approved Web ↔ Android same-capability contract

**Owner:** cg-24-ot-procedures; **current source:** PLANNED_NOT_IMPLEMENTED (owner backend and feature routes do not exist on the current branch). This is owner-delegated **design-content acceptance**, not source completion, independent clinical/pharmacy review, code/SQL/PDF/Play/runtime QA or authorization to implement future modules automatically. Preserve the original per-story QA IDs and all four optional ERP OFF defaults; do not introduce a new patient payment/discount flow, drug dispense, clinical decision or unsupported staff role.

**Same authorized audience channels:** Foundation Admin / assigned center staff Web **↔ Internal Android** for qualified protected procedure center review, assigned OT scheduling/preparation/procedure handover and original medical record actions only with explicitly approved optional ERP ON. Approved anonymous/patient Web **↔ Public Android** for approved procedure/center information and enquiry with ERP OFF, patient-specific own status only with current verified consent. If an authorized center operator can perform a protected original story on responsive Web, the same enrolled center actor must have its equivalent in Internal Android, even if the old design called it a Web-only “workstation”; a 3rd center app is not required. Any genuine platform-specific exemption needs explicit owner approval and rationale in original QA. ERP OFF must never surface disabled fake stock/shifts/OT actions as operational.

**Existing planned story QA status:** All source `NOT_IMPLEMENTED`; original tests `NOT_RUN`. Each original case must map applicable `WEB_SOURCE`, `INTERNAL_ANDROID_SOURCE`, `PUBLIC_WEB_SOURCE`, `PUBLIC_ANDROID_SOURCE` or `NOT_APPLICABLE (reason)`, with typed backend contract and original screenshot H refs. Public price/enquiry when ERP OFF remains distinct from conditional protected ERP ON; never mark it complete before real client implementations. No extra test/story IDs, no active module approval or main merge.

### 21 Nov 2026 — OT/procedure partner-first V1 with ERP OFF (existing QA trace only)

**SELECTED V1:** CG14 existing hospital/clinic partner verification + SURGERY service, CG24 US001 approved source procedure description/enquiry if needed, **CG17** approved patient contribution and evidence-backed monthly partner settlement. CG24 US002–005 remain **future optional ERP**.
- **CG14 US001/002/004 QA:** legal surgery/OT center registration and professional/facility readiness verified under CG14/19, public service eligibility and source-approved center fee, no fabricated standalone OT provider type or mandatory CG24 room setup.
- **CG24 US001-QA01/02/03/04/05/13:** approved current CG14 SURGERY service and safe current procedure detail/fee and enquiry appear Web/native while `CAREGANGA_ERP_OT_ENABLED=false`; no booking slot promise, patient clinical record, discount until CG17 policy or unverified surgeon credential.
- **CG17 US001/002/005/006/007 existing QA:** one actual performed service has customer consent, genuine partner bill, independent qualified CG19 protected procedure confirmation and original CG17 verified manual ERP-OFF service source; protected policy computes gross/patient net/Foundation share, pending approval vs liable vs partially/fully settled distinct, monthly actual CG09 bank payout keyed once; no payment for merely booked/no-show, duplicate invoice/ERP completion or revoked center.
- **DEFERRED:** CG24 US002–005 72 original OT operational QA remain PLANNED_NOT_IMPLEMENTED/NOT_RUN. Full 90 QA IDs unchanged, no room, resource, OT booking, clinical chart, OT worker or ERP activation in limited release. Web↔Internal/Public Android parity applies to each actually authorized MVP action. Local/clinical/SQL/Web/mobile runtime QA NOT_RUN; implementation needs explicit approval.


## CG-MB cross-branch/center QA overlay — 23 Nov 2026

**Authoritative original scope:** CG-14 verified OT CENTER + real room/team/assets + patient consent; never CG-02 branch permission. **Separate bugs:** CG-MB-010, CG-MB-013; [cross-module QA scenarios MB-T01–T22](../../../../../docs/qa/CAREGANGA-MULTIBRANCH-SOURCE-AND-RUNTIME-TEST-PLAN-20261123.md) and [bug register](../../../../../docs/bugs/multibranch/README.md). **All original QA IDs/previous statuses are retained; these additions are NOT_RUN** and add no duplicate QA identifiers. Test Foundation root R, two ACTIVE internal branches A/B, closed C, two unrelated current CG14 verified centers X/Y where eligible, manager A/B, ordinary staff, independent approver, revoked account, patient with/no center-specific consent, and only real owner events.

| Original user story and existing QA anchor | Source-linked multi-branch/center scenario | Required backend/database/client test | State |
| --- | --- | --- | --- |
| US-001 (existing US-001-QA01) | With ERP OFF publish only actual approved X/Y procedure catalog/enquiry; no private OT booking or CG-02 branch disclosure to public. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-002 (existing US-002-QA02) | With ERP enabled at X only, room/clinician/equipment readiness can be managed by qualified X actor; Y and Foundation branch manager A cannot edit X readiness. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-003 (existing US-003-QA01) | Book X procedure with patient consent and protected current clinician/room/asset; concurrent X/Y scheduling of shared clinician or asset must not create double booking. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-004 (existing US-004-QA01) | Pre-op/OT/post-op documentation and CG-19 evidence at X protected by licensed purpose/consent; Y guessing patient or procedure reference receives no private clinical data. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |
| US-005 (existing US-005-QA04) | X/Y room utilization and source-approved CG-17 completion/settlement stay center-specific, no center patient collection counted as Foundation money; ERP OFF new writes blocked. | Real CG-01/02/14 owner source, typed command and independent reviewer; Web/Internal Android/Public Web/Public Android only per genuine audience; PostgreSQL source/FK and wrong-scope denial, saved export/file/outbox/worker after revoke | NOT_RUN |

**Cross-story mandatory evidence:** For every original case trace current account role/source scope, exact CG-02 branch vs CG-14 center vs patient/recipient ownership, read and mutation; root-only cannot be silently selected by a branch role; wrong-root/same-root-other-center or branch guessed API ID, stale token, cancelled/closed source, concurrent idempotent command and unchanged history. Check all list/detail/options/exports/CG19 PDF/document/signed URL/notices/CG20 scheduled report/CG17 money where applicable, current outbox recipient at delivery, redaction and traceable denial. Explicitly mark `CG02_BRANCH=NOT_APPLICABLE` for owner-only center clinical action, not a false branch FK. Perform original Web/Center UI ↔ native Internal Android and public Web ↔ native Public Android parity, screenshot-based UX, fresh+upgrade PostgreSQL and actual provider/device QA. Record independent reviewer, exact commit, QA original ID, observed result and remaining blocker. No CI or merge to main.
