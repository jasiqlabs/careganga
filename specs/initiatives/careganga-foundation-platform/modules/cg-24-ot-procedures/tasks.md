# CG-24 — OT & Procedure ERP: four full-stack user stories, 48 QA

**Authority:** healthcare BR CG-24-BR01–04, PRD FR-086, HLD §5.5, H14, module/DLD/UIUX. All four stories design-only, no actual implementation or QA. Backend/DB/Center Portal/Admin Web and applicable public enquiry native consumer must be developed through JASIQ harness implement→review→fix→re-review→story-by-story file:function source QA, after genuine predecessors; no CI/GitHub Actions. Formal development gate blocked until current global PRD/HLD, authenticated resolver, independent CRITICAL DB/clinical/security QA.

### US-001 — Approved procedure catalog and verified room/team/resource readiness

**Outcome/acceptance:** Publish verified procedure information and display true own-center room, professional, equipment and capability readiness only after ERP activation. **Prerequisite:** Actual approved CG-14 center/professional; original procedure service enquiry independent of optional ERP; no CG-15 patient or CG-17 finance prerequisite. **DB source:** ot_procedure_catalog, ot_room, ot_resource, ot_team_membership, ot_readiness_event. **Typed API:** /api/v1/ot/procedures; /api/v1/ot/rooms; /api/v1/ot/teams. **Original Admin:** H14 Procedure Master, OT Resource and approved partner details.

**Manual QA (source design only / NOT_RUN):**
- **US-001-QA01:** Core CG-14 center/doctor approved procedure listing and enquiry available with global ERP OFF.
- **US-001-QA02:** Center A catalog reflects real scope/license and current professional capability.
- **US-001-QA03:** Unlicensed OT room or expired facility evidence cannot be marked ready.
- **US-001-QA04:** Room and equipment inventory are CG-24 resource references, never CG-12 Foundation stock.
- **US-001-QA05:** Qualified staff from genuine CG-14 doctor or approved professional link, no duplicate doctor identity.
- **US-001-QA06:** Center B cannot read private Center A OT room, staff roster or equipment evidence.
- **US-001-QA07:** Procedure catalog fee revision does not automatically create CG-17 Foundation subsidy.
- **US-001-QA08:** H14 original Procedure Master/OT Resource details, responsive source statuses and code labels.
- **US-001-QA09:** Two admins edit same room state, CAS ensures one effective version and review history.
- **US-001-QA10:** ERP OFF/missing flag prevents all room/team/resource command or worker, provider price enquiry remains.
- **US-001-QA11:** Global ON but CG-14 center lacking OT_ERP grant denied direct resource/room API.
- **US-001-QA12:** Source QA composite FK/center permission, professional license, actual SQL/restore/render NOT_RUN.

**Verification:** Each US-001-QA01–QA12 trace true CG-01/14/15/19 original owner → current signed source / transaction → PostgreSQL scoped row/concurrency → Center/Admin Web + appropriate public info; record file:function and SOURCE_VERIFIED/GAP/NOT_VERIFIABLE only when real code exists. Real DB/client/pixel/medical QA NOT_RUN.

### US-002 — Schedule real patient procedure with atomic room/team reservation

**Outcome/acceptance:** A real approved procedure gets one valid time-bound room/surgeon/anesthetist/resources reservation or explicit unavailable/conflict, never double-booked. **Prerequisite:** US-001 real approved center/room/team resources, CG-15 authorized consented patient and eligible specialist; no CG-17 money prerequisite. **DB source:** ot_case_booking, ot_room_reservation, ot_staff_reservation, ot_resource_reservation. **Typed API:** /api/v1/ot/bookings; /api/v1/ot/bookings/:ref/reschedule. **Original Admin:** H14 OT Booking & Scheduling, patient timeline and selected room, team and resources.

**Manual QA (source design only / NOT_RUN):**
- **US-002-QA01:** Real CG-15 patient+consent and current verified approved procedure selected.
- **US-002-QA02:** Qualified surgeon/anesthetist/OT nurse/room/equipment checked for same root and authorized center.
- **US-002-QA03:** Two simultaneous reservations for same room/time: one accepted, one 409 conflict.
- **US-002-QA04:** Same surgeon scheduled in two center OT cases simultaneously rejected, including location travel margin if configured.
- **US-002-QA05:** Unready equipment or inactive professional denies booking with human action.
- **US-002-QA06:** No external/public patient OT self-checkout or false confirmed slot when ERP OFF.
- **US-002-QA07:** Original room/staff/resource booked states indexed, timezone/DST/overnight duration controlled.
- **US-002-QA08:** Reschedule releases old holds only when new full resource set atomically confirmed.
- **US-002-QA09:** Canceled case frees holds idempotently; late duplicate webhook doesn't re-reserve.
- **US-002-QA10:** Center A care/booking private patient cannot be queried by Center B/revoked role.
- **US-002-QA11:** H14 original OT Booking details and timeline in Admin/Center Portal, public enquiry unaffected.
- **US-002-QA12:** Source QA serialized DB reservation/unique constraints, retry/rollback, Web/device/clinical NOT_RUN.

**Verification:** Each US-002-QA01–QA12 trace true CG-01/14/15/19 original owner → current signed source / transaction → PostgreSQL scoped row/concurrency → Center/Admin Web + appropriate public info; record file:function and SOURCE_VERIFIED/GAP/NOT_VERIFIABLE only when real code exists. Real DB/client/pixel/medical QA NOT_RUN.

### US-003 — Controlled pre-op/in-progress/post-op case evidence and completion

**Outcome/acceptance:** Only authorized original care team moves the exact case through guarded clinical statuses and signed private source history without automatic clinical advice. **Prerequisite:** US-002 real approved booking and original CG-19 protected file authority, actual assigned care-team actors. **DB source:** ot_case_status_event, ot_case_note_revision, ot_document_source. **Typed API:** /api/v1/ot/cases/:ref/status; /api/v1/ot/cases/:ref/documents. **Original Admin:** H14 pre-op & post-op/status timeline, assigned OT team and case sheet.

**Manual QA (source design only / NOT_RUN):**
- **US-003-QA01:** Guard schedule/pre-op-ready/in-progress/post-op/completed/cancelled statuses with verified actor.
- **US-003-QA02:** Only assigned current surgeon/authorized nurse may sign applicable case documentation.
- **US-003-QA03:** Unrelated clinician or Center B cannot read clinical notes/files or update case status.
- **US-003-QA04:** Immutable original status event idempotent on repeated source key and digest.
- **US-003-QA05:** Out-of-order completed callback before pre-op/in-progress rejected, no invented outcome.
- **US-003-QA06:** Case notes versioned/corrected without deleting previous clinical evidence.
- **US-003-QA07:** CG-19 original private scan/revision/download authority, no CG-24 shadow file bytes.
- **US-003-QA08:** Consent changes during session revoke new note/read access per legal policy.
- **US-003-QA09:** Late staff/room readiness revocation triggers review/exception, not false completed.
- **US-003-QA10:** Global ERP OFF stops new case status writes, lawful history read remains purpose protected.
- **US-003-QA11:** H14 original Pre-op/Post-op & Documents tabs, status timeline readable responsive and accessibility.
- **US-003-QA12:** Source QA row locks/audit/redacted logs/medical security, real clinical/runtime NOT_RUN.

**Verification:** Each US-003-QA01–QA12 trace true CG-01/14/15/19 original owner → current signed source / transaction → PostgreSQL scoped row/concurrency → Center/Admin Web + appropriate public info; record file:function and SOURCE_VERIFIED/GAP/NOT_VERIFIABLE only when real code exists. Real DB/client/pixel/medical QA NOT_RUN.

### US-004 — Procedure utilization, source settlement integration and safe disable

**Outcome/acceptance:** Scope-safe room usage/procedure statistics and only genuinely approved CG-17 assistance/settlement effects without a second payment journal. **Prerequisite:** US-001 real resources and US-002 booking/source; actual CG-17 verified policy only when lawful billing is enabled. **DB source:** Original ot_room_reservation/ot_case_status_event derived metrics, optional unique service effect ref. **Typed API:** /api/v1/ot/reports; typed optional CG17.recordProcedureService. **Original Admin:** H14 OT utilization, statuses, case list and Foundation dashboard safe aggregate H01.

**Manual QA (source design only / NOT_RUN):**
- **US-004-QA01:** H14 room occupancy/utilization computed only from valid original confirmed reservations.
- **US-004-QA02:** Current requested/scheduled/in-progress/completed/canceled counts match case source not mocks.
- **US-004-QA03:** Foundation network aggregate excludes private patient names and diagnosis from reports.
- **US-004-QA04:** Center A permitted export excludes Center B and masks restricted patient documents.
- **US-004-QA05:** CG-17 policy absent means procedure complete but liability/settlement unknown, no fake paid.
- **US-004-QA06:** Real approved CG-17 policy links exactly one immutable service event, CG-09 Foundation-only journal.
- **US-004-QA07:** Repeated status completion/payment callbacks never duplicate fee or contribution effect.
- **US-004-QA08:** Refund/adjustment uses genuine CG-17 reversal and retains source case history.
- **US-004-QA09:** Global OFF hides OT operation reports and stops optional workers, lawful case history preserved.
- **US-004-QA10:** Room readiness/deactivation impacts future bookings without silently invalidating actual historic case.
- **US-004-QA11:** Original H14 KPI+detail reports, scoped pagination/index, idle worker zero tenant scans.
- **US-004-QA12:** Full source trace CG-14/15/19/17/09, current Admin/Center Portal, DB rollback and clinical QA NOT_RUN.

**Verification:** Each US-004-QA01–QA12 trace true CG-01/14/15/19 original owner → current signed source / transaction → PostgreSQL scoped row/concurrency → Center/Admin Web + appropriate public info; record file:function and SOURCE_VERIFIED/GAP/NOT_VERIFIABLE only when real code exists. Real DB/client/pixel/medical QA NOT_RUN.

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source QA planned, real source/SQL/medical/Web/native/pixel QA NOT_RUN.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source QA planned, real source/SQL/medical/Web/native/pixel QA NOT_RUN.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source QA planned, real source/SQL/medical/Web/native/pixel QA NOT_RUN.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source QA planned, real source/SQL/medical/Web/native/pixel QA NOT_RUN.
