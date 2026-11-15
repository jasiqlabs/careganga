# CG-24 — Detailed-Level Design: Optional OT & Procedures

**Authority:** [module](module.md), [tasks](tasks.md), [UI/UX](uiux.md), healthcare BR CG-24-BR01–04, PRD FR-086, HLD §5.5, screenshot H14. **Source only:** no authenticated Harness resolver, independent CRITICAL SQL/clinical review, actual migration/device/visual/perf tests performed.

## PostgreSQL canonical sources and uniqueness

| Source row | Critical constraints / authority |
| --- | --- |
| `ot_procedure_catalog(root_id,id,center_id,code,service_source_ref,price_minor,currency,valid_from,valid_to,review_state,revision)` | Same-root CG-14 center and verified service source, immutable approved fee; public only source-safe approved details |
| `ot_room(root_id,id,center_id,code,active,license_evidence_ref,version)` | UNIQUE(root,center,code), genuine licensed room/approved center, file bytes CG-19 |
| `ot_resource(root_id,id,center_id,resource_type,code,readiness_state,version)` + `ot_team_membership` | Same-root center, actual CG-14 doctor/verified professional link, approved effective date; no payroll or Foundation inventory ownership |
| `ot_readiness_event(root_id,id,room_or_resource_ref,source_event_key,digest,state,actor,at)` | Append-only UNIQUE(root,source_event_key), audit/inspection without automatic clinical certification |
| `ot_case_booking(root_id,id,center_id,patient_ref,procedure_id,room_id,scheduled_start,scheduled_end,status,consent_ref,version)` | Same-root genuine CG-15 patient/consent, same-root center/procedure/room FK, positive bounded duration, encrypted sensitive data, current version CAS |
| `ot_room_reservation`, `ot_staff_reservation`, `ot_resource_reservation` `(root_id,id,case_id,resource_ref,start_at,end_at,hold_status,source_key)` | Database exclusion or atomic slot-lock strategy prevents overlap across same resource/root even across centers; unique source idempotency, short transaction to atomically reserve all required resources. Validate PostgreSQL exclusion-extension compatibility during actual migration |
| `ot_case_status_event(root_id,id,case_id,source_key,digest,from_state,to_state,actor,at)` | UNIQUE(root,source_key); immutable actual authorized transition, error/out-of-order safe |
| `ot_case_note_revision(root_id,id,case_id,author,revision,protected_note_digest,consent_ref,document_ref_nullable)` | Clinical purpose/CG-19 authorization, immutable corrections, no shadow medical file engine |

**Migrations:** Additive in single CG-01 PostgreSQL history. Inspect actual original CG-14/15/19 keys and existing slot/patient consent model before DDL, enforce composite root+center FKs and indexed active time ranges, data retention and backup/restore. No separate service DB or false clinical result. Actual SQL/EXPLAIN/backup/restart/security review NOT_RUN.

## Full-stack route/state and transaction design

**US-001:** Original Center Portal Admin creates approved center procedure and scoped room/resource/team readiness, current licence/qualified staff/CG-03 reviewer where policy requires, publication only as verified CG-14 partner service; APIs `GET/POST /api/v1/ot/procedures`, `/rooms`, `/teams`, guarded role/center/flag. Unverified facility → `UNAVAILABLE`, not bookable.

**US-002:** Only real CG-15 consented patient and currently approved professional/center can reserve. `POST /api/v1/ot/bookings`, `POST /api/v1/ot/bookings/:ref/reschedule`, `POST .../cancel` use one short transaction: validate current slot/resource/qualification, acquire room/staff/resource locks in stable order, insert all or none, unique idempotency/digest, rollback on conflict, retries return original case. Do not hold DB lock across external notification/payment provider calls. Approved period and timezone required; no confirmed public OT checkout.

**US-003:** Guard `SCHEDULED → PRE_OP_READY → IN_PROGRESS → POST_OP → COMPLETED` with CANCELLED/REVIEW_REQUIRED valid exception branches; exact assigned care-team/clinical authorization+current consent on every case command and document download. `POST /api/v1/ot/cases/:ref/status`, `POST /api/v1/ot/cases/:ref/notes`, `GET /api/v1/ot/cases/:ref/documents` reuse protected CG-19 file and append-only source event; no automatic diagnosis/treatment/recovery judgment or upload of private documents into public source.

**US-004:** H14 KPIs and utilization are scoped reads from actual reservation and case event; when genuinely approved service completion and CG-17 benefit/policy exist, introducing CG-24 typed adapter emits immutable original source digest once, CG-17 owns dues/settlement and CG-09 solely actual Foundation journal. No speculative commission/partner cash transfer. `GET /api/v1/ot/reports` original owner, no CG-20 requirement.

**OFF behavior and worker/security:** `CAREGANGA_ERP_OT_ENABLED` typed default false, current CG-14 approved OT_ERP center grant, current CG-01 exact action+scope+code/schema ready/clinical prerequisites. Guard list/export/options/background jobs as well as writes; historical clinical read only with original lawful consent and purpose. No tenant idle poll. Current partner directory, care consultation, CG-09 Foundation accounting, CG-19 evidence and CG-15 patient portal unaffected. Original H14 responsive Web/Center Portal, accessible status/Back/stale error, Public Android only service enquiry; actual Web/native/SQL/PNG/video QA pending.
