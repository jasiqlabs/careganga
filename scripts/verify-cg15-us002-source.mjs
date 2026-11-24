/**
 * CG-15 US002 standalone source preflight. Intentionally NOT runtime QA.
 * Never label an advisory preview as a free appointment or a reservation.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const s={
 source:read("apps/backend/src/modules/cg-15-patients-appointments/application/doctor-availability.service.ts"),
 controller:read("apps/backend/src/modules/cg-15-patients-appointments/http/doctor-availability.controller.ts"),
 module:read("apps/backend/src/modules/cg-15-patients-appointments/patients-appointments.module.ts"),
 throttle:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-public-request-throttle.service.ts"),
 doctors:read("apps/web/src/app/health-network/doctors/[doctorRef]/page.tsx"),
 healthcareEditorial:read("apps/web/src/features/cms-public-content/cms-editorial-route.tsx"),
 cmsPage:read("apps/web/src/features/cms-public-content/cms-public-page.tsx"),
 publicWeb:read("apps/web/src/app/health-network/doctors/[doctorRef]/schedule/page.tsx"),
 publicAndroid:read("apps/android-public/src/features/health-network/doctor-schedule-preview.tsx"),
 nativeEntry:read("apps/android-public/src/features/health-network/public-healthcare-directory.tsx"),
 catalog:read("apps/backend/src/core/http/safe-error-copy.ts"),
 tasks:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["source: root-owned exact published provider and center",s.source.includes("root.realm_key='FOUNDATION_ROOT'")&&
  s.source.includes("c.publication_state='PUBLISHED'")&&
  s.source.includes("pub.generation=c.publication_generation")],
 ["source: original independent CG03 doctor/center approvals",s.source.includes("HEALTH_CENTER_VERIFICATION")&&
  s.source.includes("HEALTH_DOCTOR_VERIFICATION")&&
  s.source.includes("fresh_password_verified_at IS NOT NULL")],
 ["source: original CG19 scanner and current unrevoked evidence",s.source.includes("HEALTH_CENTER_LICENSE")&&
  s.source.includes("HEALTH_DOCTOR_LICENSE")&&
  s.source.includes("CLEAN_VERIFIED")&&s.source.includes("revoked_at IS NULL")],
 ["source: center-specific original CG14 fee",s.source.includes("health_center_fee")&&
  s.source.includes("f.doctor_center_id=assoc.id")&&
  s.source.includes("f.consultation_mode='IN_PERSON'")],
 ["source: actual current CG15 weekly schedule by exact association",s.source.includes("cg15_doctor_schedule")&&
  s.source.includes("cg15_schedule_revision")&&
  s.source.includes("cg15_schedule_weekly_window")],
 ["source: approved leave doctor global, holiday/block center only",s.source.includes("cg15_schedule_exception")&&
  s.source.includes("kind='LEAVE' OR center_id=$3")&&
  s.source.includes("state='ACTIVE'")],
 ["source: date and slot count bounded",s.source.includes("maxAdvanceDays=30")&&
  s.source.includes("MAX_CENTERS=40")&&s.source.includes("MAX_SLOTS=144")],
 ["source: date window is based on each verified healthcare center local calendar",
  s.source.includes("function withinCenterBookingWindow(day:string,zone:string)")&&
  s.source.includes('local.year+"-"+local.month+"-"+local.day')&&
  s.source.includes("Number(local.day)+maxAdvanceDays")&&
  s.source.includes("const localCenters=centers.filter(x=>withinCenterBookingWindow(day,x.time_zone))")&&
  s.source.includes("if(!withinCenterBookingWindow(day,center.time_zone))")],
 ["source: doctor public profile links to current booking, no misleading disabled copy",
  s.doctors.includes("View available times & book an in-person appointment")&&
  s.doctors.includes("Payment is due at the center")&&
  !s.doctors.includes("Online booking and payments are not enabled")&&
  s.publicWeb.includes("<PatientBookingAction")&&
  s.publicAndroid.includes("<NativeConsultationAction")],
 ["source: local IANA ambiguity DST fail closed",s.source.includes("Intl.DateTimeFormat")&&
  s.source.includes("exact.length===1?exact[0]:null")],
 ["source: same real instant in doctor-time-first",s.source.includes("sharedInstant")&&
  s.source.includes("sharedInstant===chosen.startAt")],
 ["source: no extra original center query per slot-first",s.source.includes("this.dayForSource(center,day)")&&
  !s.source.includes("this.dayForCenter(doctorRef,center.center_id,day)")],
 ["source: consistent typed safe advisory response",s.source.includes("type DayPreview=")&&
  s.source.includes("type PreviewSlot=")&&s.source.includes("bookingEnabled:false")&&
  s.source.includes("bookable:bookingEnabled")],
 ["source: no fake booking payment or patient writes",!s.source.includes("INSERT INTO appointment")&&
  !s.source.includes("INSERT INTO patient")&&
  !s.source.includes("UPDATE health_center_fee")],
 ["source: 3 anonymous read-only no-store endpoints",s.controller.includes('Get("doctor/:doctorRef/center-options")')&&
  s.controller.includes('Get("center-first")')&&s.controller.includes('Get("slot-first")')&&
  s.controller.includes('"no-store"')],
 ["source: exact signed HMAC public ingress throttle",s.controller.includes('this.ingress.hit(request,"availability")')&&
  s.throttle.includes('availability:400')&&s.throttle.includes("timingSafeEqual")],
 ["source: one CG15 Nest owner",s.module.includes("DoctorAvailabilityService")&&
  s.module.includes("DoctorAvailabilityController")],
 ["source: Web current CG14 verified profile with advisory link",s.doctors.includes("publicDoctor(doctorRef)")&&
  s.doctors.includes("/schedule")],
 ["source: Web two current preview modes and guarded real booking action",s.publicWeb.includes("center-first?doctorRef=")&&
  s.publicWeb.includes("slot-first?doctorRef=")&&
  s.publicWeb.includes("<PatientBookingAction")&&
  s.publicWeb.includes("Appointments are confirmed only after final review")&&
  !s.publicWeb.includes('>Confirm appointment</button>')],
 ["source: published CG18 healthcare landing links to real CG15 consultation action only after approval",
  s.healthcareEditorial.includes('if(page.state==="NOT_PUBLISHED")notFound()')&&
  s.healthcareEditorial.includes('if(page.state!=="PUBLISHED")return')&&
  s.healthcareEditorial.includes('slug==="healthcare"')&&
  s.healthcareEditorial.includes('href="/health-network?tab=doctors"')&&
  s.healthcareEditorial.includes('book an appointment')&&
  s.cmsPage.includes("{children}")&&
  s.doctors.includes("View available times & book an in-person appointment")&&
  s.publicWeb.includes("<PatientBookingAction")],
 ["source: native client uses original Public Android verified doctor",s.nativeEntry.includes("DoctorSchedulePreview")&&
  s.nativeEntry.includes('selection?.kind==="doctor"')&&
  s.publicAndroid.includes("EXPO_PUBLIC_API_URL")],
 ["source: native 30-day center and cross-center preview",s.publicAndroid.includes("dateAt(offset)")&&
  s.publicAndroid.includes("/center-options?date=")&&
  s.publicAndroid.includes("slot-first?doctorRef=")&&
  s.publicAndroid.includes("MAX_CENTERS=40,MAX_SLOTS=144")&&
  s.publicAndroid.includes("result.centers.length>MAX_CENTERS")&&
  s.publicAndroid.includes("result.centerChoices.length>MAX_CENTERS")&&
  s.publicAndroid.includes("result.slots.length>MAX_SLOTS")&&
  s.publicAndroid.includes("result.day!==day||result.time!==time")],
 ["source: native client uses actual shared brand tokens",s.publicAndroid.includes("careGangaPublicTheme")&&
  s.publicAndroid.includes("theme.primary")&&
  !s.publicAndroid.includes("theme.textPrimary")],
 ["source: clear editable invalid/unavailable errors",s.catalog.includes("CG15_AVAILABILITY_INVALID")&&
  s.catalog.includes("CG15_AVAILABILITY_UNAVAILABLE")],
 ["source: original 128 story QA refs retained",(()=>{
  const observed=new Set(s.tasks.match(/\bUS-00[1-8]-QA\d{2}\b/g)??[]);
  const required=new Set();
  for(let story=1;story<=8;story++)
   for(let n=1;n<=16;n++)required.add("US-"+String(story).padStart(3,"0")+
    "-QA"+String(n).padStart(2,"0"));
  return [...required].every(x=>observed.has(x));
 })()]
];
let errors=0;
for(const [name,okay] of checks){
 process.stdout.write((okay?"SOURCE_PRESENT":"SOURCE_GAP")+" "+name+"\n");
 if(!okay)errors++;
}
process.stdout.write("CG15 US002 source preflight "+
 (checks.length-errors)+"/"+checks.length+
 ". This is NOT PostgreSQL, backend, Web, native, visual or original QA execution.\n");
if(errors)process.exitCode=1;
