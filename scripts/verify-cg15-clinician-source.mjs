/**
 * CG15 US-006-QA05 / CG14 original account-to-doctor identity source.
 * Static wiring check only. NOT actual PostgreSQL, clinician proof,
 * penetration testing, Web/Android rendering or original QA PASS.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const src={
 db:read("apps/backend/db/migrations/1436_cg14_verified_clinician_account_link.sql"),
 owner:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-clinician-identity.service.ts"),
 ctrl:read("apps/backend/src/modules/cg-14-healthcare-network/http/health-clinician-identity.controller.ts"),
 module:read("apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts"),
 queue:read("apps/backend/src/modules/cg-15-patients-appointments/application/consultation-queue.service.ts"),
 web:read("apps/web/src/features/appointments/center-visit-queue.tsx"),
 native:read("apps/android-internal/src/features/appointments/native-center-visit-queue.tsx"),
 account:read("apps/web/src/app/(admin)/admin/page.tsx"),
 doctor:read("apps/web/src/features/health-network/doctor-onboarding.tsx"),
 gui:read("apps/web/src/features/health-network/clinician-account-link.tsx"),
 bff:read("apps/web/src/app/api/health-network/[...parts]/route.ts"),
 migration:read("scripts/verify-cg15-migrations-source.mjs"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["single doctor and account current association, no phone identity match",
  src.db.includes("ux_health_doctor_current_account")&&
  src.db.includes("ux_health_account_current_doctor")&&
  src.db.includes("FOREIGN KEY(root_realm_id,doctor_id)")&&
  src.db.includes("FOREIGN KEY(account_id,root_realm_id)")&&
  !src.db.includes("phone")],
 ["proposed-only is never active, accepted+revoked histories are audited",
  src.db.includes("status IN('PENDING','ACTIVE','REVOKED')")&&
  src.db.includes("accepted_at IS NOT NULL")&&
  src.db.includes("health_doctor_account_event_immutable_guard")],
 ["foundation independent reviewer cannot self-assign",
  src.owner.includes('requireAction(bearer,"health.doctors.verify")')&&
  src.owner.includes("this.current.assertCurrent(c,actor")&&
  src.owner.includes("account===actor.accountId")&&
  src.owner.includes("status='VERIFIED' FOR SHARE")],
 ["real recipient only can accept and requires recent authenticated password session",
  src.owner.includes('this.sessions.verifySession(bearer)')&&
  src.owner.includes("actor.passwordAuthenticatedAt.getTime()>10*60*1000")&&
  src.owner.includes('account_id=$3 FOR UPDATE')&&
  src.owner.includes("link.status!==\"PENDING\"")],
 ["independent current reviewer revokes source and audit survives",
  src.owner.includes("async revoke(")&&
  src.owner.includes("revoked_by=$3")&&
  src.owner.includes("'REVOKED'")],
 ["original current clinician, association, center and live account verified inside DB write",
  src.owner.includes("assertCurrentAppointmentClinician(")&&
  src.owner.includes("l.account_id=$2 AND l.doctor_id=$4")&&
  src.owner.includes("assoc.center_id=$3")&&
  src.owner.includes("assoc.affiliation_state='APPROVED'")&&
  src.owner.includes("l.status='ACTIVE'")&&
  src.owner.includes("FOR SHARE OF l,d,assoc,a")],
 ["clinical queue operation also requires both current CG01 and CG14 clinician authority",
  src.queue.includes('tx,actor,center,"health.visits.clinical.manage"')&&
  src.queue.includes('this.clinicians.assertCurrentAppointmentClinician(')&&
  src.queue.includes("tx,actor,center,ap.doctor_id")],
 ["Web and Android hide unrelated doctor actions independent of role",
  src.queue.includes("clinicianAssignments:own.rows.map(")&&
  src.web.includes('clinicianAssignments.some(a=>a.centerRef===center&&a.doctorRef===item.doctorRef)')&&
  src.native.includes('clinicianAssignments.some(link=>link.centerRef===center&&link.doctorRef===a.doctorRef)')],
 ["CG14 sole owner provider and protected API exposed without public link",
  src.module.includes("HealthClinicianIdentityService")&&
  src.module.includes("HealthClinicianIdentityController")&&
  src.ctrl.includes('Controller("api/v1/health-network/clinician-accounts")')&&
  src.bff.includes('if(parts[0]==="clinician-accounts")')],
 ["real reviewer and self UI integrated, no technical account ID user entry",
  src.gui.includes('Find the doctor\'s registered staff account by name')&&
  src.gui.includes("personally accept")&&
  src.doctor.includes('<ClinicianAccountLinkReviewer')&&
  src.account.includes('<ClinicianAccountAcceptance/>')&&
  !src.gui.includes('placeholder="Account ID"')],
 ["forward migration in CG15 preflight and original cases not changed",
  src.migration.includes('1436_cg14_verified_clinician_account_link.sql')&&
  Array.from({length:8},(_,n)=>n+1).every(n=>Array.from({length:16},(_,k)=>
   "US-"+String(n).padStart(3,"0")+"-QA"+String(k+1).padStart(2,"0"))
   .every(id=>src.tracker.includes(id)))]
];
let fail=0;
for(const [name,okay] of checks){
 process.stdout.write((okay?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!okay)fail++;
}
process.stdout.write("Original clinician link source "+(checks.length-fail)+"/"+checks.length+
 " (lexical only; not an executed patient/DB/device/security QA PASS).\n");
if(fail)process.exitCode=1;
