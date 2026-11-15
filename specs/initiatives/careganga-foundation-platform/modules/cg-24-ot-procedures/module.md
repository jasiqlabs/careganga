# CG-24 — Partner OT & Procedure Operations (Optional ERP)

**Owner scope:** Healthcare BR CG-24-BR01–04, FR-086, HLD §5.5, D-23/26–28, original CareGanga Admin H14. Build optional ERP functionality, but `CAREGANGA_ERP_OT_ENABLED=false` on deployment until actually implemented, migrated, reviewed and authorized. Design stage only; CRITICAL DB/clinical/privacy review and executable QA NOT_RUN.

## Single owner, no future module dependencies for partner core

CG-24 uniquely owns procedure catalog details, room/team/resource readiness, source-linked patient OT reservation, case status/evidence and source-derived utilization. Genuine CG-14 owns verified partner center, doctor/affiliation/service scope and approved general service directory; CG-15 owns patient/consent/identity; CG-19 owns private file bytes; CG-17 owns approved assistance and original CG-09 owns Foundation journal only. Public verified procedure catalogue/enquiry is genuine partner function even with OT ERP OFF, with **no** direct OT booking or clinical promise. No hospital-wide EMR, medicine dispensing, insurance or CG-12 item stock duplicate.

### US-001 — Approved procedure catalog and verified room/team/resource readiness

**Outcome:** Publish verified procedure information and display true own-center room, professional, equipment and capability readiness only after ERP activation. **Real prerequisites:** Actual approved CG-14 center/professional; original procedure service enquiry independent of optional ERP; no CG-15 patient or CG-17 finance prerequisite.

**DB owner:** ot_procedure_catalog, ot_room, ot_resource, ot_team_membership, ot_readiness_event. **API:** /api/v1/ot/procedures; /api/v1/ot/rooms; /api/v1/ot/teams. **Original UI:** H14 Procedure Master, OT Resource and approved partner details. Twelve source QA cases in tasks.md.

### US-002 — Schedule real patient procedure with atomic room/team reservation

**Outcome:** A real approved procedure gets one valid time-bound room/surgeon/anesthetist/resources reservation or explicit unavailable/conflict, never double-booked. **Real prerequisites:** US-001 real approved center/room/team resources, CG-15 authorized consented patient and eligible specialist; no CG-17 money prerequisite.

**DB owner:** ot_case_booking, ot_room_reservation, ot_staff_reservation, ot_resource_reservation. **API:** /api/v1/ot/bookings; /api/v1/ot/bookings/:ref/reschedule. **Original UI:** H14 OT Booking & Scheduling, patient timeline and selected room, team and resources. Twelve source QA cases in tasks.md.

### US-003 — Controlled pre-op/in-progress/post-op case evidence and completion

**Outcome:** Only authorized original care team moves the exact case through guarded clinical statuses and signed private source history without automatic clinical advice. **Real prerequisites:** US-002 real approved booking and original CG-19 protected file authority, actual assigned care-team actors.

**DB owner:** ot_case_status_event, ot_case_note_revision, ot_document_source. **API:** /api/v1/ot/cases/:ref/status; /api/v1/ot/cases/:ref/documents. **Original UI:** H14 pre-op & post-op/status timeline, assigned OT team and case sheet. Twelve source QA cases in tasks.md.

### US-004 — Procedure utilization, source settlement integration and safe disable

**Outcome:** Scope-safe room usage/procedure statistics and only genuinely approved CG-17 assistance/settlement effects without a second payment journal. **Real prerequisites:** US-001 real resources and US-002 booking/source; actual CG-17 verified policy only when lawful billing is enabled.

**DB owner:** Original ot_room_reservation/ot_case_status_event derived metrics, optional unique service effect ref. **API:** /api/v1/ot/reports; typed optional CG17.recordProcedureService. **Original UI:** H14 OT utilization, statuses, case list and Foundation dashboard safe aggregate H01. Twelve source QA cases in tasks.md.

## Effective gate and NFR

Global typed config flag true + actual module/schema/QA ready + CG-14 active approved `OT_ERP` grant for real center + current CG-01 exact role/center/clinical scope + verified professional/consent/CG-19 protected evidence. Fail closed when unknown. No new ERP commands/exports/jobs/sidebar with flag OFF; original public hospital/procedure discovery, doctor consultations and historical permitted record/legal retention continue. Center Portal is responsive operational Web, original Foundation Admin is oversight, Public Android may show vetted procedure enquiry only, no full native OT case editor. Numeric and elapsed time displays reflect original source; lock shared rooms/team/equipment on real booking, avoid phantom time slots and auto payouts. 4 stories × 12 = **48 planned manual QA**; actual SQL/security/medical/pixel/device QA NOT_RUN.
