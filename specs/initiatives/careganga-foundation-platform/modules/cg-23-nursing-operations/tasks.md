# CG-23 — Nursing ERP: four vertical stories and 48 manual QA cases

**Source:** Integrated healthcare BR CG-23-BR01–04, PRD FR-085, HLD §5.5, original H13, module/UIUX/DLD. **Implementation blocked** until full platform gate/predecessor and independent clinical/CRITICAL database QA; code/SQL/runtime/device/visual NOT_RUN. No future module prerequisite, no second task tracker and no CI/GitHub Actions. For each US run backend+PostgreSQL → original Admin/Center Web → applicable real Public Android state → expert source review/fix/re-review → each QA identifier trace and progress update.

### US-001 — Approved nurse credentials, center affiliation and availability

**Acceptance:** One verified nurse can have multiple explicitly approved center affiliations; center-specific current availability and qualification, no CG-10 payroll master. **Dependencies:** Real CG-14 verified nursing partner and CG-01 scoped center actor. Works without patient/booking or CG-17. **Backend/DB:** nursing_professional, nursing_affiliation, nursing_credential_review, nurse_availability_rule. **Typed API:** /api/v1/nursing/nurses and /api/v1/nursing/availability. **Original UI:** H13 nurse master and nurse schedule, verified center context.

**Manual QA (PLANNED / NOT_RUN):**
- **US-001-QA01:** Original H13 nurse identity and qualification entered by authorized current nursing center.
- **US-001-QA02:** Credential and professional license document authenticated through CG-19 protected file and real original CG-03 process if required.
- **US-001-QA03:** One nurse affiliated to Center A; Center B sees no private A credentials until its own approved affiliation.
- **US-001-QA04:** Two center-specific affiliation schedules can coexist without creating duplicate global employee master.
- **US-001-QA05:** Expired/denied professional credential removes availability from new bookings.
- **US-001-QA06:** CG-01 revoked nurse coordinator cannot directly update schedule or export private nurse docs.
- **US-001-QA07:** Weekly hours, leave, holidays, slot duration and timezone validated; no negative/open-ended dates.
- **US-001-QA08:** Duplicate nurse profile/affiliation idempotent and original reviewed digest retained.
- **US-001-QA09:** Concurrent same shift edit version/CAS protects one effective availability revision.
- **US-001-QA10:** ERP global OFF or absent blocks all private nurse ERP APIs and workers even if center granted; core nursing enquiry remains.
- **US-001-QA11:** H13 responsive Center Portal and authorized Foundation Web nurse list/detail, source loading/empty/pending/error.
- **US-001-QA12:** Source trace protected PostgreSQL FKs/uniqueness, API/role/center guards, visual/native N/A, independent SQL QA NOT_RUN.

**Verification:** Trace US-001-QA01–QA12 by actual source file:function, current role/center/clinical proof, same-root DB API, Center Portal/Admin Web and only genuinely applicable native status. Actual execution, original asset pixel, Play/SQL/restore/security benchmark NOT_RUN.

### US-002 — Request consented patient nursing service and assign qualified nurse

**Acceptance:** A current approved service, patient, place and time receives one qualified available nurse and an honest assigned status without double booking. **Dependencies:** US-001 real available verified nursing staff and actual CG-15 consented patient; no CG-17 finance prerequisite. **Backend/DB:** nursing_service_request, nursing_assignment, nursing_visit_reservation. **Typed API:** /api/v1/nursing/service-requests and /api/v1/nursing/assign. **Original UI:** H13 nursing booking list, details, nurse/assignment and schedule.

**Manual QA (PLANNED / NOT_RUN):**
- **US-002-QA01:** Real consented CG-15 patient registered with current scope, name and service category selected.
- **US-002-QA02:** No CG-15 patient or revoked clinical consent prevents new nursing booking.
- **US-002-QA03:** Valid nursing center + actual requested location, frequency/duration/period/price accepted, no fictional automatic checkout.
- **US-002-QA04:** Server time and timezone overlap double-assignment of nurse across two centers denied.
- **US-002-QA05:** Two concurrent assigners attempt same nurse/time; one accepted booking and one conflict.
- **US-002-QA06:** Unverified nurse or inactive center/service never becomes assigned.
- **US-002-QA07:** Foundation Admin can view network-safe status, unrelated center staff cannot inspect patient's care details.
- **US-002-QA08:** Current center nurse may accept/reject only own assigned actual visit under exact permission.
- **US-002-QA09:** Repeat request or lost assign response keyed to original idempotency produces one booking/assignment.
- **US-002-QA10:** Global/center grant OFF hides Create Booking/Assign and blocks direct API, while lawful history remains.
- **US-002-QA11:** H13 original booking list/right detail, patient data redaction, responsive/retry and native public status only if source-supported.
- **US-002-QA12:** Real PostgreSQL reservation constraints/scoped indexes and API/source UI trace, device SQL and visual NOT_RUN.

**Verification:** Trace US-002-QA01–QA12 by actual source file:function, current role/center/clinical proof, same-root DB API, Center Portal/Admin Web and only genuinely applicable native status. Actual execution, original asset pixel, Play/SQL/restore/security benchmark NOT_RUN.

### US-003 — Record protected care plan and actual visit delivery

**Acceptance:** Authorized nurse documents only actual visits and limited plan, patient/care team sees purpose-bound record; no automatic clinical intervention or Foundation cash movement. **Dependencies:** US-002 real assignment and original CG-19 protected files; no future CG-20 analytics. **Backend/DB:** nursing_care_plan_revision, nursing_visit_event, nursing_service_status_event. **Typed API:** /api/v1/nursing/visits and /api/v1/nursing/care-plans. **Original UI:** H13 care plan, visit/progress, document tabs and actionable status.

**Manual QA (PLANNED / NOT_RUN):**
- **US-003-QA01:** Assigned nurse opens only patient's consented purpose-bound care-plan revision.
- **US-003-QA02:** Stale plan version cannot overwrite newer professional notes; immutable correction recorded.
- **US-003-QA03:** Visit start/complete timestamps/order/expected frequency validated and idempotent.
- **US-003-QA04:** Missed visit, replacement nurse and cancellation preserve true history, not fabricated Completed.
- **US-003-QA05:** Only actual assigned nurse and current authorized clinical team sees restricted progress/document.
- **US-003-QA06:** Center B, unrelated patient, revoked caregiver cannot read protected CG-19 care-plan files.
- **US-003-QA07:** A once completed service cannot be reopened/rebilled from a duplicated visit callback.
- **US-003-QA08:** Unapproved clinical instructions/prescription are not generated by system suggestions.
- **US-003-QA09:** Original CG-19 scanned evidence version and download guard, no stored duplicate file bytes.
- **US-003-QA10:** Global ERP OFF stops new visit edits/notifications while lawful patient own record remains protected.
- **US-003-QA11:** H13 Care Plan/Visit & Progress/Docs original status states, compact responsive Web detail with accessibility.
- **US-003-QA12:** Source trace signed actor event/current assignment/DB/CG-19/privacy; clinical/device/runtime QA NOT_RUN.

**Verification:** Trace US-003-QA01–QA12 by actual source file:function, current role/center/clinical proof, same-root DB API, Center Portal/Admin Web and only genuinely applicable native status. Actual execution, original asset pixel, Play/SQL/restore/security benchmark NOT_RUN.

### US-004 — Source-verified service performance, optional finance and safe disable

**Acceptance:** Correct source-derived visit counts and, only with real CG-17 policy, one verified source-linked assistance/settlement effect; no double Foundation ledger. **Dependencies:** US-002/003 actual nursing service for performance; genuine CG-17 only where an approved policy already exists. **Backend/DB:** Read-only nursing service/visit source projection, immutable optional CG-17 source event key. **Typed API:** /api/v1/nursing/reports and typed CG-17 nursing-service adapter. **Original UI:** H13 completed/pending service cards and scoped reporting; Foundation overview H01.

**Manual QA (PLANNED / NOT_RUN):**
- **US-004-QA01:** Nursing dashboard metrics count genuine requested/assigned/ongoing/completed source rows only.
- **US-004-QA02:** Foundation network summary never lists private patient plan or individual unauthorized diagnosis.
- **US-004-QA03:** Center A permitted report and export excludes Center B and masks patient data.
- **US-004-QA04:** Completed service alone is not Foundation income or a paid partner settlement.
- **US-004-QA05:** When actual CG-17 nursing policy enabled, one immutable event proposed and financially confirmed by original owner.
- **US-004-QA06:** Without real CG-17 policy/CG-09 payment service remains Completed but contribution UNAVAILABLE.
- **US-004-QA07:** Duplicate completion/effect callback does not duplicate approved assistance or payment.
- **US-004-QA08:** Partial refund/adjustment and retracted visit link to original source, no silent deletion.
- **US-004-QA09:** Nurse salary belongs CG-10/11 where genuine employee, not automatically created by CG-23.
- **US-004-QA10:** ERP OFF/center grant suspended cancels due workers, hides new booking, preserves prior settlement and clinical retention.
- **US-004-QA11:** H13 network KPI and history exact status; safe pagination/index and bounded scheduled reports, zero idle polls.
- **US-004-QA12:** End-to-end source trace CG-14/15/19/17/09, two centers, DB migration/restore and actual visual QA NOT_RUN.

**Verification:** Trace US-004-QA01–QA12 by actual source file:function, current role/center/clinical proof, same-root DB API, Center Portal/Admin Web and only genuinely applicable native status. Actual execution, original asset pixel, Play/SQL/restore/security benchmark NOT_RUN.

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY, implementation NOT_STARTED, QA01–QA12 planned; SQL/Web/native/device/runtime/clinical PASS NOT_RUN.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY, implementation NOT_STARTED, QA01–QA12 planned; SQL/Web/native/device/runtime/clinical PASS NOT_RUN.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY, implementation NOT_STARTED, QA01–QA12 planned; SQL/Web/native/device/runtime/clinical PASS NOT_RUN.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY, implementation NOT_STARTED, QA01–QA12 planned; SQL/Web/native/device/runtime/clinical PASS NOT_RUN.
