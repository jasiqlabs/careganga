# CG-23 — Detailed-Level Design: Optional Partner Nursing ERP

**Authority:** [module](module.md), [tasks](tasks.md), [UIUX](uiux.md), FR-085, original screenshot H13, HLD §5.5, CG-23-BR01–04. **Source design only**; authenticated Harness resolver, independent CRITICAL DB/clinical/security, real SQL/restore and Web/device QA NOT_RUN.

## PostgreSQL source and isolation

| Canonical CG-23 row | Guards, indexes, audit and correctness |
| --- | --- |
| `nursing_professional(root_id,id,professional_ref_nullable,credential_type,credential_no,verification_state,version)` | Same root verified identity evidence CG-19 + lawful retention; unique root/normalized credential when present; never alias CG-10 employee blindly |
| `nursing_affiliation(root_id,id,nurse_id,center_id,approved_state,role,approval_ref,effective_from,effective_to,version)` | composite root/center FK CG-14, root/nurse FK, no overlapping active affiliation periods per nurse+center; CG-03 case in its original owner |
| `nurse_availability_rule(root_id,id,nurse_id,center_id,weekday,start_local,end_local,timezone,effective_from,effective_to,version)` | validated bounded window and leave/holiday overrides, indexed scoped date; no calendar full scan |
| `nursing_service_request(root_id,id,patient_ref,center_id,service_code,location_private,frequency,begin_at,end_at,price_minor,currency,status,consent_ref,version)` | same-root genuine CG-15 patient/consent and CG-14 approved center; minimum private data, explicit status/time; idempotency key |
| `nursing_assignment(root_id,id,service_request_id,nurse_id,center_id,period_start,period_end,status,version)` + `nursing_visit_reservation` | qualified current affiliation, no double nurse assignment across partner centers at same time (transactional exclusion or unique slot locking); full same-root FKs |
| `nursing_care_plan_revision(root_id,id,request_id,digest,protected_content,review_state,author,revision)` | encrypted purpose-bound medical notes, immutable revision, strict approved actor access; CG-19 owns uploaded file bytes |
| `nursing_visit_event(root_id,id,request_id,assignment_id,source_key,kind,observed_at,actor,document_ref_nullable)` | UNIQUE(root,source_key), idempotent immutable actual visit history, no false clinical validation |
| `nursing_service_status_event(root_id,id,request_id,source_key,state,actor,at)` | append-only trace; current status CAS, patient status privacy guard |

**All source rows** have root+center where appropriate, opaque UUID and composite `(root_id,id)` parent keys and root/center indexes; no exposed UUID in display. No separate DB or CG-15 patient clone. Avoid storing unneeded diagnoses. Add migrations through CG-01 single history, inspect original source keys/schema first, restore/rollback and cross-center negative tests; **NOT_RUN**.

## Lifecycle, APIs, owner adapters and concurrency

US-001 `DRAFT → SUBMITTED/RETURNED → VERIFIED/REJECTED → ACTIVE/EXPIRED`; a verified nurse can be separately affiliated to two actual providers, with organization-specific shifts/leave. Real CG-14 center must be active and service grant current. `GET/POST /api/v1/nursing/nurses`, `POST .../:ref/affiliate`, `GET/PATCH /api/v1/nursing/availability` with typed scoped DTO, exact current actor and original CG-03/19 credential approval/evidence where required.

US-002 `REQUESTED → APPROVED/RETURNED → ASSIGNED/DECLINED/CANCELLED`; request/assignment only for legitimate CG-15 patient with consent and active CG-14 nursing service, with price only from verified center policy, not CG-17 assistance. Original nurse booking conflicts use short DB transaction and no-overlap reservation/lock; a second concurrent assignment yields conflict not overbooked. `POST/GET /api/v1/nursing/service-requests`, `POST /api/v1/nursing/assignments`, current encrypted care location limited to center staff.

US-003 `ASSIGNED → ONGOING → COMPLETED / EXCEPTION / CANCELLED`; append-only signed visit events and immutable care-plan revision, purpose-bound content access, original CG-19 protected file adapter, no automatically generated clinical advice. `GET/POST /api/v1/nursing/visits`, `PATCH /api/v1/nursing/care-plans/:ref`, authenticated own-patient scoped status read. A retry with same source key returns original event.

US-004 source-derived aggregate of actual service/visit events, and only when real CG-17 approved assistance policy/source exists, typed `CG17.applyNursingServiceEffect(root,center,serviceRef,verifiedDigest)` once. CG-09 posts only Foundation money when actual CG-17 authority confirms, never from private nurse input. No CG-20 required to show original H13 basic stats.

**Global/center OFF:** `CAREGANGA_ERP_NURSING_ENABLED` default false+actual code/schema/QA ready+CG-14 approved NURSING_ERP+CG-01 exact action and center+patient consent. All private command/list/export/file access and workers guard current state; strict historical clinical read only when lawfully authorized, not a silent bypass. Current CG-14 public partner nursing service card/enquiry unaffected. Bounded indexed due-visit notification only for enabled qualifying jobs; zero active jobs means zero tenant-wide polls. Security: PII/medical encrypted/limited, role/center/subject audit, source validation, backpressure, rate-limits, no raw technical IDs/errors. Web UI parity and applicable native status, original CareGanga appearance, runtime QA pending.
