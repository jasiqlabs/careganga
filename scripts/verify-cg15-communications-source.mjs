/** CG15→CG19 original committed-appointment event source preflight.
 * Static source assertions only, NEVER delivery, SQL migration or QA PASS.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const src={
 db:read("apps/backend/db/migrations/1433_cg19_appointment_event_notification_source.sql"),
 recoveryIndex:read("apps/backend/db/migrations/1435_cg19_appointment_pending_recovery_global.sql"),
 captured:read("apps/backend/src/modules/cg-19-documents-notifications/application/notification.service.ts"),
 worker:read("apps/backend/src/modules/cg-19-documents-notifications/infrastructure/communication-worker.ts"),
 delivery:read("apps/backend/src/modules/cg-19-documents-notifications/application/delivery.service.ts"),
 pkg:read("package.json"),
 tasks:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["real original immutable source and atomic trigger",
  src.db.includes("AFTER INSERT ON cg15_appointment_event")&&
  src.db.includes("INSERT INTO cg19_appointment_event_outbox(realm_id,event_id)")&&
  src.db.includes("REFERENCES cg15_appointment_event(root_realm_id,id)")],
 ["bounded indexed due-only pending outbox",
  src.db.includes("ix_cg19_appointment_event_outbox_pending")&&
  src.db.includes("WHERE state='PENDING'")&&
  src.captured.includes("WHERE ob.realm_id=$1 AND ob.state='PENDING'")&&
  src.captured.includes("LIMIT 25 FOR UPDATE OF ob SKIP LOCKED")],
 ["source grants new kind without mutating CG03 and notice source",
  src.db.includes("source_kind IN ('CG03_DECISION','NOTICE','CG15_APPOINTMENT')")&&
  src.db.includes("cg15_appointment_event_id=source_key")],
 ["source capture checks verified patient, active account and latest consent",
  src.captured.includes("p.profile_status='VERIFIED'")&&
  src.captured.includes("cg15_patient_identity_event proof")&&
  src.captured.includes("l.revoked_at IS NULL")&&
  src.captured.includes("a.status='ACTIVE'")&&
  src.captured.includes("consent.purpose='PATIENT_CARE'")],
 ["provider channels are only verified and transactionally opted in",
  src.captured.includes('const channels:Channel[]=["IN_APP"]')&&
  src.captured.includes('this.hasConsent(client,realm,account,"EMAIL","TRANSACTIONAL")')&&
  src.captured.includes('this.hasConsent(client,realm,account,"SMS","TRANSACTIONAL")')],
 ["generic appointment messages have no patient, fee or medical details",
  src.captured.includes("Your CareGanga appointment has a status update")&&
  !src.captured.includes("JSON.stringify(event)")],
 ["duplicate source event and notification replay fail closed",
  src.captured.includes("ON CONFLICT DO NOTHING RETURNING id")&&
  src.captured.includes("SET state='CAPTURED',")&&
  src.db.includes("PRIMARY KEY(realm_id,event_id)")],
 ["no fabricated delivery; original CG19 attempt/receipt provider owns transport",
  src.captured.includes('channel==="IN_APP"?"IN_APP":"QUEUED"')&&
  src.delivery.includes("this.providers.send(")&&
  src.delivery.includes("cg19_delivery_receipt")],
 ["current consent and patient ownership rechecked immediately before send",
  src.delivery.includes('row.source_kind==="CG15_APPOINTMENT"')&&
  src.delivery.includes("consent.purpose='PATIENT_CARE'")&&
  src.delivery.includes("l.revoked_at IS NULL")&&
  src.delivery.includes("if(!own.rowCount)permitted=false")],
 ["appointment inbox and read both recheck CURRENT ownership and consent",
  src.captured.split("n.source_kind<>'CG15_APPOINTMENT' OR EXISTS(").length===3&&
  src.captured.split("AND owned.revoked_at IS NULL").length===3&&
  src.captured.split("appointment_event.id=n.cg15_appointment_event_id").length===3&&
  src.captured.split("consent.purpose='PATIENT_CARE'").length>=4],
 ["worker catches original transactional NOTIFY and bounded recovery",
  src.worker.includes("LISTEN cg19_appointment_committed")&&
  src.worker.includes("captureCommittedAppointments(realm)")&&
  src.worker.includes("await this.reconcilePendingAppointments()")&&
  !src.worker.includes("captureCommittedAppointments(this.rootRef)")&&
  src.worker.includes("UNLISTEN cg19_appointment_committed")],
 ["original committed booking/cancellation source leads to only real CG19 transport",
  src.db.includes("AFTER INSERT ON cg15_appointment_event")&&
  src.captured.includes("async captureCommittedAppointments(realm:string)")&&
  src.captured.includes("INSERT INTO cg19_notification(")&&
  src.captured.includes("'CG15_APPOINTMENT'")&&
  src.captured.includes("ON CONFLICT DO NOTHING RETURNING id")&&
  src.worker.includes("await this.delivery.tick()")&&
  src.delivery.includes('row.source_kind==="CG15_APPOINTMENT"')&&
  src.delivery.includes("this.providers.send(")&&
  src.delivery.includes("cg19_delivery_receipt")&&
  src.delivery.includes('state="DELIVERED"')===false],
 ["one cross-root bounded missed queue/appointment source recovery, no per-root idle polling",
  src.worker.includes("private async reconcilePendingAppointments()")&&
  src.worker.includes("SELECT realm_id FROM cg19_appointment_event_outbox")&&
  src.worker.includes("WHERE state='PENDING'")&&
  src.worker.includes("ORDER BY recorded_at,realm_id,event_id LIMIT 64")&&
  src.worker.includes("await this.reconcilePendingAppointments()")&&
  src.worker.includes("this.source.captureCommittedAppointments(root)")&&
  src.captured.includes("LIMIT 25 FOR UPDATE OF ob SKIP LOCKED")&&
  src.recoveryIndex.includes("CREATE INDEX ix_cg19_appointment_pending_recovery_global")&&
  src.recoveryIndex.includes("ON cg19_appointment_event_outbox(recorded_at,realm_id,event_id)")&&
  src.recoveryIndex.includes("WHERE state='PENDING'")],
 ["original story set preserved and local command wired",
  src.pkg.includes("verify:cg15-communications-source")&&
  Array.from({length:8},(_,n)=>n+1).every(n=>
   Array.from({length:16},(_,i)=>"US-"+String(n).padStart(3,"0")+
    "-QA"+String(i+1).padStart(2,"0")).every(id=>src.tasks.includes(id)))]
];
let failed=0;
for(const [name,okay] of checks){
 process.stdout.write((okay?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!okay)failed++;
}
process.stdout.write("CG15/CG19 notification source "+(checks.length-failed)+
 "/"+checks.length+"; not a PostgreSQL, provider, privacy or executed QA PASS.\n");
if(failed)process.exitCode=1;
