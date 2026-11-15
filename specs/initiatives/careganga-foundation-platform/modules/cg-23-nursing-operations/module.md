# CG-23 — Partner Nursing Operations (Optional ERP)

**Authority:** Healthcare BR CG-23-BR01–04, PRD FR-085, HLD §5.5, business D-23/26–28 and original screenshot H13. **Decision:** Build with product; global deployment default `CAREGANGA_ERP_NURSING_ENABLED=false`; no runtime/clinical/device/SQL QA performed. Database risk CRITICAL; UIUX REQUIRED, DLD REQUIRED; original single modular monolith.

## Ownership and independently deliverable stories

CG-23 owns verified nurse registration/approved center affiliation, bounded nursing availability, patient-linked nursing service request/assignment, care-plan and completed visit source states. It does not own CG-14 verified partner center, CG-15 patient ID and consent, CG-19 protected file bytes, CG-03 approval case, CG-10/11 employee/payroll or CG-09 Foundation ledger/CG-17 monetary policy. The **core partner nursing service listing/enquiry remains genuine CG-14** when this ERP is OFF; no dependency on future CG-23 records.

### US-001 — Approved nurse credentials, center affiliation and availability

**Outcome:** One verified nurse can have multiple explicitly approved center affiliations; center-specific current availability and qualification, no CG-10 payroll master.

**Independent prerequisites:** Real CG-14 verified nursing partner and CG-01 scoped center actor. Works without patient/booking or CG-17.

**DB owner:** nursing_professional, nursing_affiliation, nursing_credential_review, nurse_availability_rule; **API:** /api/v1/nursing/nurses and /api/v1/nursing/availability; **original UI:** H13 nurse master and nurse schedule, verified center context. 12 source QA cases in [tasks.md](tasks.md).

### US-002 — Request consented patient nursing service and assign qualified nurse

**Outcome:** A current approved service, patient, place and time receives one qualified available nurse and an honest assigned status without double booking.

**Independent prerequisites:** US-001 real available verified nursing staff and actual CG-15 consented patient; no CG-17 finance prerequisite.

**DB owner:** nursing_service_request, nursing_assignment, nursing_visit_reservation; **API:** /api/v1/nursing/service-requests and /api/v1/nursing/assign; **original UI:** H13 nursing booking list, details, nurse/assignment and schedule. 12 source QA cases in [tasks.md](tasks.md).

### US-003 — Record protected care plan and actual visit delivery

**Outcome:** Authorized nurse documents only actual visits and limited plan, patient/care team sees purpose-bound record; no automatic clinical intervention or Foundation cash movement.

**Independent prerequisites:** US-002 real assignment and original CG-19 protected files; no future CG-20 analytics.

**DB owner:** nursing_care_plan_revision, nursing_visit_event, nursing_service_status_event; **API:** /api/v1/nursing/visits and /api/v1/nursing/care-plans; **original UI:** H13 care plan, visit/progress, document tabs and actionable status. 12 source QA cases in [tasks.md](tasks.md).

### US-004 — Source-verified service performance, optional finance and safe disable

**Outcome:** Correct source-derived visit counts and, only with real CG-17 policy, one verified source-linked assistance/settlement effect; no double Foundation ledger.

**Independent prerequisites:** US-002/003 actual nursing service for performance; genuine CG-17 only where an approved policy already exists.

**DB owner:** Read-only nursing service/visit source projection, immutable optional CG-17 source event key; **API:** /api/v1/nursing/reports and typed CG-17 nursing-service adapter; **original UI:** H13 completed/pending service cards and scoped reporting; Foundation overview H01. 12 source QA cases in [tasks.md](tasks.md).

## Effective configuration, clinical and full-stack acceptance

One original CG-14 center-capability `NURSING_ERP` grant is necessary but insufficient: authenticated runtime flag true + module/migration ready + current CG-01 exact center/role + real license/clinical patient consent/CG-15 identity govern every action, list, record, notification, private file and background delivery. Missing/malformed flag OFF. Foundation Super Admin may see a redacted summary, not automatically access patient care-plan. Center Portal is the operational responsive Web; native Public Android may show own confirmed service status only when appropriate, no Super Admin clone or mandatory staff-native nursing app. Screenshot KPI totals not fake data. Global OFF denies new operations and tenant scans; original protected clinical/finance record remains only under lawful historical entitlement. 4 stories × 12 QA = **48** planned; no code/runtime QA PASS.
