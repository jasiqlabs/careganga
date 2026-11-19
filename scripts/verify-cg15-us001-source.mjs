/**
 * CG-15 US001 JASIQ DEV source-wiring preflight (no CI/GitHub Actions).
 * Source-only checks; NEVER a runtime migration, build, native, visual, QA PASS.
 * Run from checkout: node scripts/verify-cg15-us001-source.mjs
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const s={
 schema:read("apps/backend/db/migrations/1420_cg15_doctor_schedule_original_source.sql"),
 originalCase:read("apps/backend/db/migrations/1421_cg15_original_doctor_leave_cg03_review.sql"),
 main:read("apps/backend/src/app.module.ts"),
 perms:read("apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts"),
 catalog:read("apps/backend/src/core/http/safe-error-copy.ts"),
 ownerModule:read("apps/backend/src/modules/cg-15-patients-appointments/patients-appointments.module.ts"),
 sourceModule:read("apps/backend/src/modules/cg-15-patients-appointments/doctor-leave-source.module.ts"),
 cg03Module:read("apps/backend/src/modules/cg-03-registration-approvals/registration-approvals.module.ts"),
 cg14Module:read("apps/backend/src/modules/cg-14-healthcare-network/health-network.module.ts"),
 service:read("apps/backend/src/modules/cg-15-patients-appointments/application/doctor-schedule.service.ts"),
 controller:read("apps/backend/src/modules/cg-15-patients-appointments/http/doctor-schedule.controller.ts"),
 originalSource:read("apps/backend/src/modules/cg-15-patients-appointments/application/doctor-leave-review-source.facade.ts"),
 reviewer:read("apps/backend/src/modules/cg-03-registration-approvals/application/doctor-leave-approval.service.ts"),
 reviewerApi:read("apps/backend/src/modules/cg-03-registration-approvals/http/doctor-leave-approval.controller.ts"),
 web:read("apps/web/src/features/appointments/doctor-schedule-workspace.tsx"),
 webReview:read("apps/web/src/features/appointments/doctor-leave-review-workspace.tsx"),
 webAdmin:read("apps/web/src/app/(admin)/admin/health-network/schedules/page.tsx"),
 webReviewPage:read("apps/web/src/app/(admin)/admin/health-network/doctor-leaves/page.tsx"),
 centerPortal:read("apps/web/src/features/health-network/center-draft-portal.tsx"),
 webApi:read("apps/web/src/app/api/appointments/schedules/[...parts]/route.ts"),
 reviewBff:read("apps/web/src/app/api/health/doctor-leave-reviews/[...parts]/route.ts"),
 native:read("apps/android-internal/src/features/registration-approvals/doctor-leave-native-review.tsx"),
 nativeEntry:read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const tests=[
 ["source: 1420 migration has one valid exception/command/event definition",[
  "cg15_schedule_exception(","cg15_schedule_command(","cg15_schedule_event("
 ].every(t=>s.schema.split("CREATE TABLE "+t).length===2)&&
  s.schema.includes("source_digest char(64) NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$')")&&
  s.schema.includes("version integer NOT NULL CHECK(version BETWEEN 1 AND 2147483646)")],
 ["source: 1420 all PLPGSQL dollar delimiters balanced",(
  s.schema.match(/AS \\$\\$/g)??[]).length===3&&
  (s.schema.match(/END \\$\\$;/g)??[]).length===3],
 ["source: original leave transitions fail closed at database boundary",
  s.schema.includes("NEW.state IS DISTINCT FROM OLD.state")&&
  s.schema.includes("NEW.approved_case_ref=NEW.original_case_ref")&&
  s.schema.includes("Original doctor leave case may be linked only once")],

 ["source: no copied doctor/provider",s.schema.includes("REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id)")&&
  !s.schema.includes("CREATE TABLE cg15_doctor(")],
 ["source: center and doctor exact foreign key",s.schema.includes("UNIQUE(root_realm_id,doctor_id,center_id,id)")&&
  s.schema.includes("UNIQUE(root_realm_id,association_id,consultation_mode)")],
 ["source: versioned immutable original schedule",s.schema.includes("cg15_schedule_revision")&&
  s.schema.includes("cg15_revision_frozen")&&s.schema.includes("fk_cg15_schedule_current_exact_revision")],
 ["source: original window exclusion",s.schema.includes("ex_cg15_weekly_window_no_overlap")&&
  s.schema.includes("int4range(")],
 ["source: original true CG03 leave case",s.originalCase.includes("CG15_DOCTOR_LEAVE")&&
  s.originalCase.includes("cg03_case_finance_source_disjoint")&&
  s.originalCase.includes("fk_cg03_leave_original_exception")],
 ["source: leave SHA pattern intact",s.originalCase.includes("cg15_exception_digest ~ '^[0-9a-f]{64}$'")&&
  !s.originalCase.includes("cg15_exception_digest ~ '^[0-9a-f]{64}\n")],
 ["source: original CG03 immutable pointer",s.originalCase.includes("NEW.cg15_exception_digest IS DISTINCT FROM OLD.cg15_exception_digest")],
 ["source: CG01 permissions installed",s.perms.includes('"health.schedules.view"')&&
  s.perms.includes('"health.schedules.manage"')],
 ["source: role proof and same center",s.service.includes("this.ownCenter.assertCurrent")&&
  s.service.includes('this.identity.assertCurrent(tx,actor,')],
 ["source: current CG14 doctor and center proof",s.service.includes("HEALTH_DOCTOR_LICENSE")&&
  s.service.includes("HEALTH_CENTER_LICENSE")&&s.service.includes("CLEAN_VERIFIED")],
 ["source: parent-first provider center doctor lock",s.service.includes("SELECT status FROM health_provider")&&
  s.service.includes("SELECT status,access_state,time_zone FROM health_center")&&
  s.service.includes("FOR UPDATE")],
 ["source: clinic operating hours checked",s.service.includes("health_center_hours")&&
  s.service.includes("CG15_SCHEDULE_OUTSIDE_CENTER_HOURS")],
 ["source: doctor shared interval conflict",s.service.includes("noOtherCenterOverlap")&&
  s.service.includes("CG15_SCHEDULE_DOCTOR_CONFLICT")],
 ["source: CAS revisions and idempotent replay",s.service.includes("cg15_schedule_command")&&
  s.service.includes("version=$6 RETURNING id")&&s.service.includes("PREVIOUSLY_CONFIRMED")],
 ["source: no mocked patients or appointments",!s.schema.includes("CREATE TABLE appointment")&&
  !s.service.includes("INSERT INTO appointment(")],
 ["source: leave original CG03 submitted",s.service.includes("this.leaveReview.create(tx,actor,original)")&&
  s.originalSource.includes("DoctorLeaveReviewSourceFacade")],
 ["source: independent protected reviewer",s.reviewer.includes("verifyReviewer")&&
  s.reviewer.includes("requireFreshFoundationRootProof")&&
  s.reviewer.includes("c.proposer_id===actor.accountId")],
 ["source: original review process source pinned",s.reviewer.includes("case_kind='CG15_DOCTOR_LEAVE'")&&
  s.reviewer.includes("this.source.original")&&s.reviewer.includes("originalCaseRef!==caseRef")],
 ["source: distinct publisher fresh proof and apply CAS",s.service.includes("this.leaveReview.approved")&&
  s.service.includes("this.sessions.requireFreshFoundationRootProof")&&
  s.service.includes("state='ACTIVE'")],
 ["source: protected apply idempotent after completion",s.service.includes("Replay a completed protected action BEFORE demanding PENDING_OWNER")],
 ["source: no booking cancelled by proposed leave",s.service.includes('input.kind==="LEAVE"?"PENDING":"ACTIVE"')&&
  !s.service.includes("UPDATE appointment SET")],
 ["source: original mutable exceptions audited",s.schema.includes("cg15_exception_source_frozen")&&
  s.schema.includes("cg15_event_frozen")],
 ["source: no background per-tenant worker",!s.service.includes("setInterval(")&&
  !s.service.includes("startScheduler(")],
 ["source: original Nest modules wired",s.main.includes("PatientsAppointmentsModule")&&
  s.ownerModule.includes("RegistrationApprovalsModule")&&
  s.cg03Module.includes("DoctorLeaveSourceModule")&&
  s.cg14Module.includes("HealthCenterSupportScopeFacade]")],
 ["source: scoped Foundation/Center API",s.controller.includes('Controller("api/v1/appointments/schedules")')&&
  s.controller.includes("centerSave")&&s.controller.includes("applyLeave")],
 ["source: private CSRF Web BFF",s.webApi.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.webApi.includes('cookies()).get("cg_staff_session")')],
 ["source: original CG03 reviewer Web BFF",s.reviewBff.includes("doctor-leave-reviews")&&
  s.reviewBff.includes("current")],
 ["source: H07 Foundation Web and Center Portal",s.web.includes("Weekly working hours")&&
  s.web.includes("doctorName")&&s.webAdmin.includes("DoctorScheduleWorkspace")&&
  s.centerPortal.includes("DoctorScheduleWorkspace")],
 ["source: protected two-role Foundation leave UX",s.webReview.includes("Record independent CG-03 decision")&&
  s.webReview.includes("Apply approved leave")&&
  s.webReviewPage.includes("canReview")],
 ["source: Internal Android real CG03 reviewer",s.native.includes("DoctorLeaveNativeReview")&&
  s.native.includes("BackHandler.addEventListener")&&
  s.nativeEntry.includes("setDoctorLeaveReviewsOpen(true)")],
 ["source: editable errors owner CG21",s.catalog.includes("CG15_SCHEDULE_CHANGED")&&
  s.catalog.includes("CG15_LEAVE_SOURCE_CHANGED")],
 ["original US001 16 QA IDs kept",(()=>{
  const found=new Set(s.tracker.match(/\bUS-001-QA\d{2}\b/g)??[]);
  return found.size===16&&Array.from({length:16},(_,i)=>
   "US-001-QA"+String(i+1).padStart(2,"0")).every(x=>found.has(x));
 })()]
];
let gaps=0;
for(const [label,present] of tests){
 process.stdout.write((present?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+label+"\n");
 if(!present)gaps++;
}
process.stdout.write("CG-15 US-001 static wiring: "+(tests.length-gaps)+
 "/"+tests.length+"; not a PostgreSQL, build, Android, pixel, security or original QA PASS.\n");
if(gaps)process.exitCode=1;
