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
 assistedDb:read("apps/backend/db/migrations/1430_cg15_patient_assisted_booking_authorization.sql"),
 patientOwn:read("apps/backend/src/modules/cg-15-patients-appointments/application/patient-profile.service.ts"),
 patientController:read("apps/backend/src/modules/cg-15-patients-appointments/http/patient-profile.controller.ts"),
 staffBff:read("apps/web/src/app/api/appointments/staff-consultations/[...parts]/route.ts"),
 staffWeb:read("apps/web/src/features/appointments/center-assisted-consultation-booking.tsx"),
 staffSlipBff:read("apps/web/src/app/api/appointments/staff-slips/[...parts]/route.ts"),
 staffSlipWeb:read("apps/web/src/features/appointments/center-consultation-slip.tsx"),
 nativeStaffBooking:read("apps/android-internal/src/features/appointments/native-center-assisted-booking.tsx"),
 nativeStaffSlip:read("apps/android-internal/src/features/appointments/native-center-consultation-slip.tsx"),
 intakeService:read("apps/backend/src/modules/cg-15-patients-appointments/application/center-patient-intake.service.ts"),
 slipSourceModule:read("apps/backend/src/modules/cg-15-patients-appointments/consultation-slip-source.module.ts"),
 staffPortal:read("apps/web/src/features/health-network/center-draft-portal.tsx"),
 staffIntake:read("apps/web/src/features/patients/center-patient-intake-workspace.tsx"),
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
 nativeDirectory:read("apps/android-public/src/features/health-network/public-healthcare-directory.tsx"),
 webDirectory:read("apps/web/src/app/health-network/page.tsx"),
 nativeHistory:read("apps/android-public/src/features/appointments/native-consultation-history.tsx"),
 nativeSlots:read("apps/android-public/src/features/health-network/doctor-schedule-preview.tsx"),
 nativeQueue:read("apps/android-internal/src/features/appointments/native-center-visit-queue.tsx"),
 internalApp:read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx"),
 webQueue:read("apps/web/src/features/appointments/center-visit-queue.tsx"),
 queueBff:read("apps/web/src/app/api/appointments/queue/[...parts]/route.ts"),
 webAdmin:read("apps/web/src/features/appointments/foundation-patient-bookings.tsx"),
 adminPage:read("apps/web/src/app/(admin)/admin/health-network/patients/page.tsx"),
 adminBff:read("apps/web/src/app/api/appointments/admin/patients/route.ts"),
 centerScope:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts"),
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
 ["visit appointment root+center+event consistency enforced at database boundary",
  s.db4.includes("UNIQUE(root_realm_id,id,center_id)")&&
  s.db6.includes("FOREIGN KEY(root_realm_id,appointment_id,center_id)")&&
  s.db6.includes("REFERENCES cg15_consultation_appointment(root_realm_id,id,center_id)")&&
  s.db6.includes("UNIQUE(root_realm_id,id,appointment_id)")&&
  s.db6.includes("FOREIGN KEY(root_realm_id,visit_id,appointment_id)")],
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
 ["source: full-day original own-center queue totals match Web and Internal Android",
  s.queue.includes("async summary(bearer:string,centerRaw:string,dayRaw:unknown)")&&
  s.queue.includes('GROUP BY booking_state')&&
  s.queue.includes("await this.scope(tx,actor,center)")&&
  s.queueCtrl.includes('Get("my-centers/:centerRef/summary")')&&
  s.queueBff.includes('parts[2]==="summary"&&method==="GET"')&&
  s.webQueue.includes("Original center daily attendance totals")&&
  s.nativeQueue.includes("Original complete-day consultation summary")&&
  s.webQueue.includes('setSummary(data)')&&
  s.nativeQueue.includes('setSummary(report)')],
 ["source: current-center operational booking history has immutable bounded status-only source",
  s.queue.includes('async bookingHistory(bearer:string,centerRaw:string,bookingRaw:string,beforeRaw?:string)')&&
  s.queue.includes("AND center_id=$2 AND id=$3")&&
  s.queue.includes("ORDER BY e.new_revision DESC LIMIT 26")&&
  s.queue.includes("beforeStatus:publicStatus(e.prior_snapshot)")&&
  s.queue.includes("afterStatus:publicStatus(e.new_snapshot)")&&
  s.queueCtrl.includes('Get("my-centers/:centerRef/bookings/:bookingRef/history")')&&
  s.queueBff.includes('parts[4]==="history"&&method==="GET"')&&
  s.webQueue.includes("View original booking history")&&
  s.nativeQueue.includes("Original booking history")&&
  s.webQueue.includes("auditSerial.current++")&&
  s.nativeQueue.includes("auditSerial.current++")],
 ["source: queue writes preserve exact original request only for unknown results",
  s.webQueue.includes("status:r.status")&&
  s.webQueue.includes("deterministic")&&
  s.webQueue.includes("status>=400&&status<500")&&
  s.nativeQueue.includes("status>=400&&status<500")],
 ["visit status machine disallows completion jump",
  s.queue.includes('IN_CONSULTATION:["COMPLETED"]')&&
  s.queue.includes('WAITING:["IN_CONSULTATION"]')&&
  !s.queue.includes('ARRIVED:["WAITING","NO_SHOW"]')],
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
 ["center queue limit applies after exact original center-local date predicate",
  s.queue.includes("(a.start_at AT TIME ZONE a.time_zone)::date=$3::date")&&
  !s.queue.includes("interval '48 hours'")&&
  s.queue.includes("LIMIT 101")&&
  s.queue.includes("afterRaw.split")&&s.queue.includes("last.start_at.toISOString()")],
 ["true person-specific identity gate required for any consultation booking",
  s.service.includes('patient.profile_status!=="VERIFIED"')&&
  s.service.includes("!patient.identity_verified")&&
  s.service.includes("cg15_patient_identity_event")],
 ["lost-response original hold and confirmation replay uses exact own-account key",
  s.service.includes("async holdByRequest(")&&
  s.service.includes("async confirmationByRequest(")&&
  s.bookingCtrl.includes('Get("holds/by-request/:requestKey")')&&
  s.bookingCtrl.includes('Get("confirmations/by-request/:requestKey")')&&
  s.webBooking.includes("confirmations/by-request/")&&
  s.nativeBooking.includes("holds/by-request/")],
 ["cross-doctor reschedule locks both doctors, atomically preserves old slot and exact key recovery",
  s.service.includes('v.doctorRef===undefined?null:uuid(v.doctorRef)')&&
  s.service.includes('new Set([doctor.rows[0].doctor_id,newDoctorId])')&&
  s.service.includes('this.eligible(tx,actor,newDoctorId,center,start,end)')&&
  s.service.includes('doctor_id=$3,center_id=$4')&&
  s.service.includes('async rescheduleByRequest(')&&
  s.service.includes("action='RESCHEDULED' AND request_key=$3")&&
  s.bookingCtrl.includes('Get("me/:bookingRef/reschedule/by-request/:requestKey")')&&
  s.webBff.includes('p[2]==="reschedule"&&p[3]==="by-request"')&&
  s.webReschedule.includes("doctorRef:p.doctorRef")&&
  s.webReschedule.includes("/reschedule/by-request/")&&
  s.nativeBooking.includes("doctorRef:p.doctorRef")&&
  s.nativeBooking.includes("/reschedule/by-request/")&&
  s.webDirectory.includes("Choose a time with this doctor")&&
  s.nativeDirectory.includes("reschedule={reschedule}")&&
  s.nativeHistory.includes("<PublicHealthcareDirectory")],
 ["staff cancellation uses explicit CG01 grant, current center scope, original lock and one event",
  s.roles.includes('key:"health.appointments.cancel"')&&
  s.centerScope.includes('"health.appointments.cancel"')&&
  s.service.includes("async cancelForCenter(")&&
  s.service.includes('tx,actor,centerRef,"health.appointments.cancel"')&&
  s.service.includes('centerRef?"AND center_id=$3":""')&&
  s.service.includes("private async cancelOriginal(")&&
  s.service.includes("'CANCELLED'")&&
  s.bookingCtrl.includes('Post("staff/centers/:centerRef/bookings/:bookingRef/cancel")')&&
  s.staffBff.includes('p[2]==="bookings"&&ID.test(p[3])&&p[4]==="cancel"')&&
  s.webQueue.includes('reason:"CENTER_REQUEST"')&&
  s.webQueue.includes('Confirm center cancellation')&&
  s.nativeQueue.includes('canCancel&&a.bookingStatus==="CONFIRMED"')&&
  s.nativeQueue.includes('reason:"CENTER_REQUEST"')&&
  s.internalApp.includes('canCancel={roleActions.includes("health.appointments.cancel")}')],
 ["latest patient-care consent is enforced for center QR, check-in and queue identity",
  s.queue.includes('AND pc.purpose=\'PATIENT_CARE\' ORDER BY pc.revision_no DESC LIMIT 1)=true')&&
  s.queue.includes("CASE WHEN consent.granted IS TRUE THEN p.first_name ELSE NULL END")&&
  s.queue.includes('consentGranted:x.consent_granted')&&
  s.queue.includes("FROM cg15_patient_consent WHERE root_realm_id=$1")&&
  s.queue.includes("FOR SHARE")&&
  s.webQueue.includes("item.consentGranted&&item.bookingStatus")&&
  s.nativeQueue.includes('row.consentGranted')&&
  s.nativeQueue.includes('a.consentGranted&&!["CANCELLED","NO_SHOW"]')],
 ["no-show marks only original NEVER-arrived booking after its scheduled end",
  s.queue.includes("async markNoShow(")&&
  s.queue.includes('booking.booking_state!=="CONFIRMED"')&&
  s.queue.includes('booking.end_at.getTime()>Date.now()')&&
  s.queue.includes("SELECT 1 FROM cg15_visit_queue WHERE root_realm_id=$1 AND appointment_id=$2")&&
  s.queue.includes("action='NO_SHOW' AND request_key=$3")&&
  s.queue.includes("VALUES($1,$2,$3,$4,'NO_SHOW'")&&
  s.queueCtrl.includes('Post("my-centers/:centerRef/no-show")')&&
  s.queueBff.includes('"no-show"')&&
  s.webQueue.includes('next==="CHECK_IN"?"check-in":"no-show"')&&
  s.nativeQueue.includes('next==="CHECK_IN"?"check-in":"no-show"')&&
  s.webQueue.includes('!item.visitRef&&')&&
  s.nativeQueue.includes('!a.visitRef&&')],
 ["patient Public Android uses explicit rejected-status handling and scoped receptionist codes",
  s.nativeBooking.includes('status:r.status')&&
  s.nativeBooking.includes('status>=400&&status<500')&&
  s.nativeBooking.includes("staffCode.centerRef===p.centerRef")&&
  s.nativeSlots.includes('detail.consultationFeeMinor,detail.consultationFeeVersion')&&
  s.nativeSlots.includes('c.consultationFeeMinor,c.consultationFeeVersion')],
 ["cross-doctor same-center same-time change is not mistaken for no change",
  s.service.includes('old.doctor_id===newDoctorId))')],
 ["patient-only hold status blocks staff-created reservations of other patients",
  s.service.includes("if(patient.id!==row.rows[0].patient_id)")&&
  s.service.includes('await this.ownPatient(tx,actor,false)')&&
  s.bookingCtrl.includes('Get("holds/:holdRef")')],
 ["patient Web unknown-outcome recovery uses original keys and rejects deterministic errors",
  s.webBooking.includes("status:response.status")&&
  s.webBooking.includes("confirmations/by-request/")&&
  s.webBooking.includes("holds/by-request/")&&
  s.webBooking.includes('status>=400&&status<500')&&
  !s.webBooking.includes("Check my recent appointments")],
 ["patient receptionist code is never displayed under a different center",
  s.webBooking.includes("staffCode.centerRef===p.centerRef")&&
  s.webBooking.includes("centerRef:p.centerRef")],
 ["patient Web booking component resets on genuine doctor center slot fee change",
  s.webPublic.includes("key={[doctorRef,centerRef,slot.startAt,slot.endAt,")&&
  s.webPublic.includes("key={[doctorRef,c.centerRef,c.startAt,c.endAt,")],
 ["internal receptionist booking day change clears patient authorization",
  s.nativeStaffBooking.includes("setOffset(n=>Math.max(0,n-1));setDay(null);clear()")&&
  s.nativeStaffBooking.includes("setOffset(n=>Math.min(30,n+1));setDay(null);clear()")],
 ["center receptionist Web clears sensitive patient code when center doctor or day changes",
  s.staffWeb.includes('setPatientId("");setCode("");setHold(null);setBooking(null)')&&
  s.staffWeb.split('setSelected(null);setPatientId("");setCode("");').length>=3],
 ["center queue pages in Web and Internal Android use validated cursor",
  s.queue.includes("afterRaw.split")&&
  s.queue.includes("LIMIT 101")&&
  s.queueCtrl.includes('@Query("after")after?:string')&&
  s.queueBff.includes('params.set("after",after)')&&
  s.webQueue.includes("Next 100")&&
  s.nativeQueue.includes("Next 100")],
 ["H15 registers and books only through actual assigned-center intake action and shows true consent",
  s.adminPage.includes('rightsSet.has("health.patients.intake")')&&
  s.adminPage.includes('href="/admin/health-network/patient-intake"')&&
  s.staffIntake.includes("<CenterPatientIntakePanel")&&
  s.staffIntake.includes("<CenterAssistedConsultationBooking")&&
  s.staffWeb.includes('request<Hold>("holds","POST"')&&
  s.staffWeb.includes('request<Booking>("confirm","POST"')&&
  s.admin.includes("consent.granted AS consent_granted")&&
  s.admin.includes("patientProfileStatus:x.profile_status")&&
  s.webAdmin.includes("patientConsentGranted")&&
  s.webAdmin.includes("patientProfileStatus")],
 ["H15 real geography and server-center filters survive >200 centers",
  s.admin.includes("centerChoicesComplete")&&
  s.admin.includes("centerSearch.trim()")&&
  s.adminBff.includes('"centerSearch"')&&
  s.webAdmin.includes("Filter centers")],
 ["original H15 patient and booking search is root-protected and strictly bounded",
  s.admin.includes('requireAction(bearer,"health.patients.admin.view")')&&
  s.admin.includes("position(lower($10::text)")&&
  s.admin.includes("p.virtual_display_id")&&
  s.admin.includes("a.booking_display_id")&&
  s.adminCtrl.includes('@Query("search")search?:string')&&
  s.webAdmin.includes("Find a patient or booking")&&
  s.adminBff.includes('key==="search"?80:key==="centerSearch"?60:50')&&
  s.adminCtrl.includes('@Query("centerSearch")centerSearch?:string')&&
  s.admin.includes("centerSearch.trim()")],
 ["patient-owned short-lived center booking code and original hold are bound by composite FK",
  s.assistedDb.includes("cg15_patient_assisted_booking_code")&&
  s.assistedDb.includes("FOREIGN KEY(root_realm_id,hold_id,patient_id,center_id)")&&
  s.assistedDb.includes("cg15_assisted_booking_code_immutable")&&
  s.patientOwn.includes("async beginAssistedBooking(")&&
  s.patientController.includes('Post("me/assisted-booking-code")')],
 ["receptionist holder uses real doctor-global hold, verified person and scoped own center",
  s.service.includes("async holdForCenter(")&&
  s.service.includes("async confirmForCenter(")&&
  s.service.includes("this.assistedPatientForHold(")&&
  s.service.includes("this.currentAssistedPatient(")&&
  s.service.includes('"health.patients.intake"')&&
  s.service.includes("INSERT INTO cg15_consultation_hold")&&
  s.bookingCtrl.includes('Post("staff/holds")')&&
  s.bookingCtrl.includes('Post("staff/confirm")')],
 ["only authenticated receptionist staff BFF can submit patient booking using same request key",
  s.staffBff.includes('get("cg_staff_session")')&&
  !s.staffBff.includes('get("cg_patient_session")')&&
  s.staffBff.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.staffWeb.includes('request<Hold>("holds","POST"')&&
  s.staffWeb.includes('request<Booking>("confirm","POST"')&&
  s.staffWeb.includes("confirmations/by-request/")],
 ["center portal and intake-only receptionist route both mount original patient booking",
  s.staffPortal.includes("<CenterAssistedConsultationBooking")&&
  s.staffIntake.includes("<CenterAssistedConsultationBooking")&&
  s.webBooking.includes("me/assisted-booking-code")&&
  s.nativeBooking.includes("me/assisted-booking-code")],
 ["patient consultation history uses precise cursored paging Web and Android",
  s.service.includes("cursor_at")&&
  s.service.includes("afterRaw.split")&&
  s.webHistory.includes("Load older consultations")&&
  s.nativeHistory.includes("Load older consultations")],
 ["center consultation slip uses original CG19 private PDF, current CG14 center scope and CG15 consent",
  s.original.includes("async originalForCenter(")&&
  s.original.includes('this.ownCenter.assertCurrent(')&&
  s.original.includes('"health.visits.manage"')&&
  s.original.includes("consent.granted")&&
  s.cg19.includes("this.original.originalForCenter(")&&
  s.cg19Ctrl.includes('Get("staff/:bookingRef/file")')&&
  s.cg19Ctrl.includes('Post("staff/:bookingRef/issue")')&&
  s.slipSourceModule.includes("HealthCenterSupportScopeFacade")],
 ["staff slip proxy never uses public patient session or untrusted file route",
  s.staffSlipBff.includes('get("cg_staff_session")')&&
  !s.staffSlipBff.includes('get("cg_patient_session")')&&
  s.staffSlipBff.includes('req.headers.get("origin")!==req.nextUrl.origin')&&
  s.staffSlipBff.includes('includes("application/pdf")')],
 ["actual assigned-center queue lazily issues, verifies and reprints only a consented current slip",
  s.staffSlipWeb.includes("CenterConsultationSlip")&&
  s.staffSlipWeb.includes('record?.status==="NOT_ISSUED"')&&
  s.staffSlipWeb.includes("Check original slip status")&&
  s.webQueue.includes("<CenterConsultationSlip")&&
  s.cg19.includes('!doc.revoked_at') ],
 ["internal Android receptionist uses original CG15 staff hold and confirmation, not a shadow booking",
  s.internalApp.includes("NativeCenterAssistedBooking")&&
  s.internalApp.includes('roleActions.includes("health.patients.intake")')&&
  s.nativeStaffBooking.includes('"/api/v1/appointments/consultations/staff/"')&&
  s.nativeStaffBooking.includes('api<Hold>(token,"holds","POST"')&&
  s.nativeStaffBooking.includes('api<Booking>(token,"confirm","POST"')&&
  s.nativeStaffBooking.includes("confirmations/by-request/")],
 ["internal native date uses assigned original center time zone without hardcoded city",
  s.intakeService.includes("timeZone:x.time_zone")&&
  s.nativeStaffBooking.includes("centerZone")&&
  !s.nativeStaffBooking.includes("Asia/Kolkata")],
 ["internal Android center queue previews one ephemeral, privately verified CG19 PDF",
  s.nativeQueue.includes("<NativeCenterConsultationSlip")&&
  s.nativeStaffSlip.includes('"/api/v1/appointments/slips/staff/"')&&
  s.nativeStaffSlip.includes('File.preview(')&&
  s.nativeStaffSlip.includes('Paths.cache')&&
  s.nativeStaffSlip.includes('new URL(route,base)')&&
  s.nativeStaffSlip.includes('process.env.NODE_ENV==="production"') ],
 ["all CG15 SQL migrations have explicit opt-in manual lexical checker",
  s.pkg.includes('verify:cg15-migrations-source') ],
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
