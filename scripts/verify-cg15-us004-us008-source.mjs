/**
 * CG-15 US004–US008 JASIQ DEV static source-wiring preflight.
 * No CI/GitHub Actions. This is NOT compilation, SQL execution, privacy
 * penetration testing, Web/native rendering or any of 128 QA PASS.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const s={
 db1:read("apps/backend/db/migrations/1420_cg15_doctor_schedule_original_source.sql"),
 leave:read("apps/backend/db/migrations/1421_cg15_original_doctor_leave_cg03_review.sql"),
 db3:read("apps/backend/db/migrations/1423_cg15_center_provisional_patient_intake.sql"),
 db4:read("apps/backend/db/migrations/1424_cg15_consultation_reservation_and_appointments.sql"),
 db5:read("apps/backend/db/migrations/1426_cg19_private_consultation_slip.sql"),
 db6:read("apps/backend/db/migrations/1425_cg15_visit_queue_and_booking_changes.sql"),
 service:read("apps/backend/src/modules/cg-15-patients-appointments/application/consultation-booking.service.ts"),
 original:read("apps/backend/src/modules/cg-15-patients-appointments/application/consultation-slip-source.facade.ts"),
 queue:read("apps/backend/src/modules/cg-15-patients-appointments/application/consultation-queue.service.ts"),
 admin:read("apps/backend/src/modules/cg-15-patients-appointments/application/patient-admin-overview.service.ts"),
 adminCtrl:read("apps/backend/src/modules/cg-15-patients-appointments/http/patient-admin-overview.controller.ts"),
 bookingCtrl:read("apps/backend/src/modules/cg-15-patients-appointments/http/consultation-booking.controller.ts"),
 queueCtrl:read("apps/backend/src/modules/cg-15-patients-appointments/http/consultation-queue.controller.ts"),
 nest:read("apps/backend/src/modules/cg-15-patients-appointments/patients-appointments.module.ts"),
 owner:read("apps/backend/src/modules/cg-19-documents-notifications/documents-notifications.module.ts"),
 cg19:read("apps/backend/src/modules/cg-19-documents-notifications/application/appointment-slip-document.service.ts"),
 cg19Ctrl:read("apps/backend/src/modules/cg-19-documents-notifications/http/appointment-slip.controller.ts"),
 cg19Pdf:read("apps/backend/src/modules/cg-19-documents-notifications/application/cg19-consultation-slip-renderer.ts"),
 qr:read("apps/backend/src/modules/cg-19-documents-notifications/application/cg19-appointment-qr.ts"),
 publicSlots:read("apps/backend/src/modules/cg-15-patients-appointments/application/doctor-availability.service.ts"),
 webBff:read("apps/web/src/app/api/consultations/[...parts]/route.ts"),
 webBooking:read("apps/web/src/features/appointments/patient-booking-action.tsx"),
 webReschedule:read("apps/web/src/features/appointments/patient-reschedule-action.tsx"),
 webHistory:read("apps/web/src/features/appointments/my-consultation-history.tsx"),
 webSlip:read("apps/web/src/features/appointments/patient-appointment-detail.tsx"),
 webPublic:read("apps/web/src/app/health-network/doctors/[doctorRef]/schedule/page.tsx"),
 webQr:read("apps/web/src/features/appointments/appointment-status-verifier.tsx"),
 nativeBooking:read("apps/android-public/src/features/appointments/native-consultation-action.tsx"),
 nativeHistory:read("apps/android-public/src/features/appointments/native-consultation-history.tsx"),
 nativeSlots:read("apps/android-public/src/features/health-network/doctor-schedule-preview.tsx"),
 nativeQueue:read("apps/android-internal/src/features/appointments/native-center-visit-queue.tsx"),
 internalApp:read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"),
 webQueue:read("apps/web/src/features/appointments/center-visit-queue.tsx"),
 queueBff:read("apps/web/src/app/api/appointments/queue/[...parts]/route.ts"),
 webAdmin:read("apps/web/src/features/appointments/foundation-patient-bookings.tsx"),
 adminPage:read("apps/web/src/app/(admin)/admin/health-network/patients/page.tsx"),
 adminBff:read("apps/web/src/app/api/appointments/admin/patients/route.ts"),
 roles:read("apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts"),
 nav:read("apps/web/src/shared/foundation-admin-nav.tsx"),
 catalog:read("apps/backend/src/core/http/safe-error-copy.ts"),
 env:read(".env.example"),
 pkg:read("package.json"),
 signup:read("apps/backend/src/modules/cg-01-identity-access/application/public-patient-signup.service.ts"),
 signupModule:read("apps/backend/src/modules/cg-01-identity-access/identity-access.module.ts"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["global doctor interval exclusion exists at PostgreSQL boundary",
  s.db4.includes("cg15_global_doctor_time_nonoverlap")&&
  s.db4.includes("tstzrange(start_at,end_at,'[)') WITH &&")],
 ["original root-qualified patient/doctor/center/schedule source FKs",
  s.db4.includes("REFERENCES cg15_patient(root_realm_id,id)")&&
  s.db4.includes("REFERENCES health_doctor_center(root_realm_id,doctor_id,center_id,id)")&&
  s.db4.includes("REFERENCES cg15_schedule_revision(root_realm_id,schedule_id,id)")],
 ["booking never claims online paid or CG17 subsidy",
  s.db4.includes("CHECK(payment_mode='PAY_AT_CENTER')")&&
  s.db4.includes("CHECK(collection_state IN('DUE_AT_CENTER','NOT_COLLECTIBLE'))")&&
  s.db4.includes("booking_state='CANCELLED' AND collection_state='NOT_COLLECTIBLE'")],
 ["hold configured 5–10 minutes or fail closed",
  s.service.includes("CG15_HOLD_MINUTES")&&s.service.includes("value<5||value>10")&&
  s.env.includes("CG15_HOLD_MINUTES=")],
 ["real session and current patient consent",
  s.service.includes("this.identity.verifySession(bearer)")&&
  s.service.includes("consent_granted!==true")&&
  s.service.includes("contact_phone_verified_at")],
 ["original CG14 doctor center and fee source, not shadow",
  s.service.includes("eligibleScheduleSource(tx,doctorId)")&&
  s.service.includes("health_center_fee")],
 ["schedule revision and original exception checked on confirm",
  s.service.includes("cg15_schedule_weekly_window")&&
  s.service.includes("cg15_schedule_exception")&&
  s.service.includes("current.slot.revisionId!==hold.schedule_revision_id")],
 ["doctor row FOR UPDATE serializes reservation transactions",
  s.service.includes("SELECT id FROM health_doctor WHERE root_realm_id=$1 AND id=$2 FOR UPDATE")],
 ["hold and confirmation original request keys and source digests",
  s.db4.includes("request_digest char(64)")&&
  s.db4.includes("confirmation_digest char(64)")&&
  s.service.includes("CG15_BOOKING_REQUEST_CONFLICT")],
 ["confirmed booking immutable event and due-at-center proof",
  s.db4.includes("cg15_appointment_event_immutable")&&
  s.service.includes('await this.event(tx,actor,booking.rows[0],0,"CONFIRMED"')],
 ["accepted booking snapshot includes patient/doctor/center",
  s.db4.includes("patient_display_name text NOT NULL")&&
  s.db4.includes("doctor_name text NOT NULL")&&
  s.original.includes("a.patient_display_name")],
 ["booking and document terms revision separate from queue state",
  s.db4.includes("terms_revision integer NOT NULL")&&
  s.service.includes("terms_revision=terms_revision+1")&&
  s.original.includes("row.terms_revision")],
 ["public advisory slot reads real occupied intervals",
  s.publicSlots.includes("cg15_doctor_reservation")&&
  s.publicSlots.includes("h.expires_at>now()")&&
  s.publicSlots.includes("bookable:bookingEnabled")],
 ["public Web center and time first use accepted fee and source",
  s.webPublic.includes("<PatientBookingAction")&&
  s.webPublic.includes("<PatientRescheduleAction")&&
  s.webBooking.includes('paymentMode:"PAY_AT_CENTER"')],
 ["public Web patient-only BFF denies unexpected routes/CSRF",
  s.webBff.includes('get("cg_patient_session")')&&
  s.webBff.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.webBff.includes("allowed(parts,method)")],
 ["native booked patient also uses same original backend",
  s.nativeBooking.includes("/api/v1/appointments/consultations/")&&
  s.nativeBooking.includes("SecureStore.getItemAsync")&&
  s.nativeSlots.includes("NativeConsultationAction")],
 ["atomic reschedule releases and obtains reservation in same transaction",
  s.service.includes('async reschedule(')&&
  s.service.includes("status='RELEASED'")&&
  s.service.includes("INSERT INTO cg15_doctor_reservation")&&
  s.service.includes('await tx.query("ROLLBACK")')],
 ["current own patient controls cancel with event history",
  s.service.includes('async cancel(')&&
  s.service.includes("patient_id=$3 FOR UPDATE")&&
  s.service.includes("'CANCELLED'")],
 ["Web/native own history and cancellation actions",
  s.webHistory.includes("/cancel")&&
  s.nativeHistory.includes("/cancel")&&
  s.webHistory.includes("My consultations")],
 ["Web/native reschedule final review with price",
  s.webReschedule.includes("acceptedFeeVersion")&&
  s.nativeBooking.includes("expectedVersion:p.reschedule.expectedVersion")],
 ["visit queue own-center permission in CG01 and CG14",
  s.roles.includes('key:"health.visits.manage"')&&
  s.queue.includes('this.centers.assertCurrent(tx,actor,center,"health.visits.manage")')],
 ["visit queue per center/date unique sequence and immutable events",
  s.db6.includes("UNIQUE(root_realm_id,center_id,queue_local_date,queue_sequence)")&&
  s.db6.includes("cg15_visit_event_immutable")],
 ["visit queue every check-in serializes token and validates booking",
  s.queue.includes("pg_advisory_xact_lock")&&
  s.queue.includes('booking.booking_state!=="CONFIRMED"')],
 ["visit status machine disallows completion jump",
  s.queue.includes('IN_CONSULTATION:["COMPLETED"]')&&
  s.queue.includes('WAITING:["IN_CONSULTATION","NO_SHOW"]')],
 ["visit Web/Internal Android use same guarded endpoints",
  s.webQueue.includes("/check-in")&&
  s.nativeQueue.includes("/check-in")&&
  s.internalApp.includes("NativeCenterVisitQueue")],
 ["internal Android queue access hidden without role",
  s.internalApp.includes('roleActions.includes("health.visits.manage")')&&
  s.internalApp.includes("setPatientQueueOpen(true)")],
 ["original CG19 secure storage used and no synthetic direct PDF URL",
  s.cg19.includes("PrivateObjectStorage")&&
  s.cg19.includes("readVerifiedPrivateObject")&&
  s.cg19.includes("writeVerifiedPrivateDocument")],
 ["private slip issues only one source revision and preserves immutable bytes",
  s.db5.includes("UNIQUE(root_realm_id,appointment_id,source_revision)")&&
  s.db5.includes("cg19_consultation_slip_source_frozen")],
 ["private status-only QR token HMAC and true QR matrix",
  s.cg19.includes('createHmac("sha256"')&&
  s.qr.includes("export function opaqueAppointmentQr(")&&
  s.cg19Pdf.includes("opaqueAppointmentQr(token)")],
 ["public QR response does not return PHI",
  s.cg19.includes("return {valid:!!source&&")&&
  s.cg19Ctrl.includes('this.throttle.hit(request,"slip")')],
 ["booking PDF uses current original auth and source digest",
  s.cg19.includes("this.original.original(bearer,bookingRef)")&&
  s.cg19.includes('getSubject()!=="CG15-APPOINTMENT:"+source.sourceDigest')],
 ["CG19 owner registered with CG15 narrow source module",
  s.owner.includes("ConsultationSlipSourceModule")&&
  s.owner.includes("AppointmentSlipDocumentService")],
 ["appointment calendar excludes phone/diagnosis/QR",
  s.service.includes('"BEGIN:VCALENDAR"')&&
  !s.service.includes("DTSTART:"+value.phone)&&
  s.bookingCtrl.includes('calendar.ics')],
 ["patient private Web detail renders original slip state and calendar",
  s.webSlip.includes('slip?.status==="ISSUED"')&&
  s.webSlip.includes('calendar.ics')],
 ["protected H15 current root-only capability and no public patient dump",
  s.roles.includes('key:"health.patients.admin.view"')&&
  s.roles.includes("assignable:false,sensitive:true")&&
  s.admin.includes('requireAction(bearer,"health.patients.admin.view")')],
 ["H15 UI six real KPIs and bounded search",
  s.webAdmin.includes("Total Patients")&&
  s.webAdmin.includes("Today's Bookings")&&
  s.admin.includes("LIMIT $5")],
 ["H15 own Web route protects role, no patient identity exposure to public",
  s.adminPage.includes('rightsSet.has("health.patients.admin.view")')&&
  s.adminBff.includes('get("cg_staff_session")')],
 ["original CG21-editable messages for booking, visits and slip",
  s.catalog.includes("CG15_BOOKING_SLOT_TAKEN")&&
  s.catalog.includes("CG15_QUEUE_CHANGED")&&
  s.catalog.includes("CG19_SLIP_UNAVAILABLE")],
 ["explicit local checker command",
  s.pkg.includes("verify:cg15-us004-us008-source")],
 ["pre-signup ownership SMS must be approved before CG01 account insertion",
  s.signup.includes('this.provider("VerificationCheck"')&&
  s.signup.includes('if(check!=="approved")')&&
  s.signup.indexOf('if(check!=="approved")')<
   s.signup.indexOf('"INSERT INTO account(')],
 ["consultation center QR only after current CG14 assigned scope",
  s.queue.includes('async verifySlipAtMyCenter(')&&
  s.queue.includes('this.scope(tx,actor,center)')&&
  s.queue.includes('d.source_revision=a.terms_revision')],
 ["cancelled consultation releases liability not paid",
  s.service.includes("collection_state='NOT_COLLECTIBLE'")&&
  s.service.includes("changeCutoffMs()")],
 ["doctor leave 1421 preserves all prior CG03 case kinds without corrupt source or duplicate function",
  s.leave.includes("case_kind='CG15_DOCTOR_LEAVE'")&&
  s.leave.includes("cg15_exception_digest ~ '^[0-9a-f]{64}$'")&&
  (s.leave.match(/CREATE OR REPLACE FUNCTION cg03_health_source_immutable/g)||[]).length===1&&
  (s.leave.match(/ADD CONSTRAINT cg03_leave_only_source/g)||[]).length===1&&
  (s.leave.match(/ux_cg03_leave_original_exception/g)||[]).length===1&&
  s.leave.includes("END; $$;")],
 ["center intake migration has exactly one intact original table and provenance trigger",
  (s.db3.match(/CREATE TABLE cg15_patient_center_intake/g)||[]).length===1&&
  (s.db3.match(/CREATE INDEX ix_cg15_center_intake_recent/g)||[]).length===1&&
  (s.db3.match(/CREATE TRIGGER cg15_center_intake_provenance_immutable/g)||[]).length===1&&
  s.db3.includes("CHECK(request_digest ~ '^[a-f0-9]{64}$')")&&
  s.db3.includes("CHECK(consent_version ~ '^[A-Za-z0-9._-]{1,32}$')")],
 ["visit-event migration no duplicate CREATE or unterminated request digest",
  (s.db6.match(/CREATE TABLE cg15_visit_queue/g)||[]).length===1&&
  (s.db6.match(/CREATE TABLE cg15_visit_event/g)||[]).length===1&&
  (s.db6.match(/CREATE TRIGGER cg15_visit_event_immutable/g)||[]).length===1&&
  s.db6.includes("CHECK(request_digest ~ '^[a-f0-9]{64}$')")],
 ["CG15 all PL/pgSQL function terminators remain valid original dollar-quoted source",
  [s.db1,s.leave,s.db3,s.db4,s.db5,s.db6].every(sql=>
   sql.includes("END; $$;")&&!sql.includes("END; $;"))],
 ["patient public signup controller and service are both imported and registered",
  s.signupModule.includes('import { PublicPatientSignupController }')&&
  s.signupModule.includes('import { PublicPatientSignupService }')&&
  s.signupModule.includes("PublicPatientSignupService]")],
 ["live doctor slots type permits actual booking and current fee revision",
  s.publicSlots.includes("bookingEnabled:boolean;day:string")&&
  s.publicSlots.includes("consultationFeeVersion?:number|null")],
 ["all 128 original QA identifiers preserved",
  Array.from({length:8},(_,i)=>i+1).every(n=>
   Array.from({length:16},(_,k)=>
    "US-"+String(n).padStart(3,"0")+"-QA"+String(k+1).padStart(2,"0"))
     .every(key=>s.tracker.includes(key)))]
];
let failures=0;
for(const [name,ok] of checks){
 process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+name+"\n");
 if(!ok)failures++;
}
process.stdout.write("CG15 US004–US008 static source: "+(checks.length-failures)+
 "/"+checks.length+". NOT actual SQL, Nest, Web, native, visual or QA PASS.\n");
if(failures)process.exitCode=1;
