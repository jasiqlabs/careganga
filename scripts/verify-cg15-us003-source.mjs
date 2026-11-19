/**
 * CG-15 US-003 local source preflight, not runtime, migration, emulator,
 * independent human clinical review or PASS of any original 16 QA scenarios.
 * Intentionally fails if the narrow own-patient Web/native parity regresses.
 */
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const dir=resolve(import.meta.dirname,"..");
const read=p=>readFileSync(resolve(dir,p),"utf8");
const s={
 db:read("apps/backend/db/migrations/1422_cg15_patient_self_consent.sql"),
 service:read("apps/backend/src/modules/cg-15-patients-appointments/application/patient-profile.service.ts"),
 ctrl:read("apps/backend/src/modules/cg-15-patients-appointments/http/patient-profile.controller.ts"),
 module:read("apps/backend/src/modules/cg-15-patients-appointments/patients-appointments.module.ts"),
 web:read("apps/web/src/features/patients/patient-profile-panel.tsx"),
 webPage:read("apps/web/src/app/patients/me/page.tsx"),
 webProxy:read("apps/web/src/app/api/patients/[...parts]/route.ts"),
 webEntry:read("apps/web/src/app/health-network/page.tsx"),
 native:read("apps/android-public/src/features/patients/patient-profile-native.tsx"),
 nativeEntry:read("apps/android-public/app/index.tsx"),
 errors:read("apps/backend/src/core/http/safe-error-copy.ts"),
 env:read(".env.example"),
 rootPackage:read("package.json"),
 tracker:read("specs/initiatives/careganga-foundation-platform/modules/cg-15-patients-appointments/tasks.md")
};
const checks=[
 ["one root-qualified patient source with separate unique human ID",
  s.db.includes("CREATE TABLE cg15_patient (")&&
  s.db.includes("PRIMARY KEY(root_realm_id,id)")&&
  s.db.includes("UNIQUE(root_realm_id,virtual_display_id)")],
 ["same-root original CG01 patient account FK with current unique link",
  s.db.includes("REFERENCES account(id,realm_id)")&&
  s.db.includes("ux_cg15_patient_one_active_self_account")&&
  s.db.includes("WHERE revoked_at IS NULL")],
 ["one idempotent registration source key/digest with current account lock",
  s.db.includes("cg15_patient_registration_command")&&
  s.service.includes("FOR UPDATE OF a")&&
  s.service.includes("request_digest")&&
  s.service.includes("CG15_PATIENT_REQUEST_CONFLICT")],
 ["current CG01 session AND verified account-contact required",
  s.service.includes("this.identity.verifySession(bearer)")&&
  s.service.includes("contact_phone_verified_at")&&
  s.service.includes("this.activeAccount(c,actor,true)")],
 ["no family phone ID auto-match, no automatic patient merge",
  !s.service.includes("WHERE phone=")&&
  !s.service.includes("normalized_mobile=")&&
  !s.service.includes("UPDATE cg15_patient_account_link SET patient_id")],
 ["actual patient-care consent configured by Foundation, no fabricated text",
  s.service.includes("CG15_PATIENT_CONSENT_VERSION")&&
  s.service.includes("CG15_PATIENT_CONSENT_TEXT")&&
  s.env.includes("CG15_PATIENT_CONSENT_TEXT=")],
 ["immutable original consent and patient change events",
  s.db.includes("cg15_patient_consent_immutable")&&
  s.db.includes("cg15_patient_event_immutable")&&
  s.service.includes("CONSENT_WITHDRAWN")],
 ["same patient own-only, CAS version and rollback",
  s.service.includes("WHERE l.root_realm_id=$1 AND l.account_id=$2")&&
  s.service.includes("old.revision!==expected")&&
  s.service.includes('await c.query("ROLLBACK")')],
 ["versioned original consent withdrawal returns current protected state",
  s.service.includes("revision=revision+1")&&
  s.service.includes("v.granted")&&
  s.ctrl.includes('Post("me/consent")')],
 ["backend endpoints registered via original CG15 Nest module",
  s.module.includes("PatientProfileService")&&
  s.module.includes("PatientProfileController")&&
  s.ctrl.includes('Controller("api/v1/patients")')],
 ["private patient Web cookie never uses staff cookie",
  s.webProxy.includes('get("cg_patient_session")')&&
  !s.webProxy.includes('get("cg_staff_session")')&&
  s.webProxy.includes('sameSite:"strict"')],
 ["CSRF protected writes and public endpoint allowlist",
  s.webProxy.includes('request.headers.get("origin")!==request.nextUrl.origin')&&
  s.webProxy.includes("authorized(parts,method)")&&
  s.webProxy.includes('"no-store"')],
 ["Web reads policy, creates/edits profile and manages consent",
  s.web.includes('request<Consent>("policy")')&&
  s.web.includes('"registration","POST"')&&
  s.web.includes('"me","PATCH"')&&
  s.web.includes('"me/consent","POST"')],
 ["Web reuses registration key for uncertain same payload",
  s.web.includes("pendingRegistration.current.key")&&
  s.web.includes("pendingRegistration.current?.digest!==digest")],
 ["genuine private noindex Web route, reachable from public healthcare",
  s.webPage.includes("robots:{index:false,follow:false}")&&
  s.webEntry.includes('href="/patients/me"')],
 ["native separate secure token and present-state session validation",
  s.native.includes('cg_public_patient_only_session')&&
  s.native.includes("SecureStore.setItemAsync")&&
  s.native.includes("AppState.addEventListener")],
 ["native Web business parity and idempotent registered profile",
  s.native.includes('"/api/v1/patients/registration"')&&
  s.native.includes('"/api/v1/patients/me/consent"')&&
  s.native.includes("pendingRegistration.current.key")],
 ["public Android entry renders real own-patient native component",
  s.nativeEntry.includes("PatientProfileNative")&&
  s.nativeEntry.includes("setPatientOpen(true)")],
 ["Foundation-editable human patient error message copy present",
  s.errors.includes("CG15_PATIENT_INVALID")&&
  s.errors.includes("CG15_PATIENT_CONTACT_UNVERIFIED")&&
  s.errors.includes("CG15_PATIENT_CHANGED")],
 ["source preflight exposed as explicit local npm command",
  s.rootPackage.includes("verify:cg15-us003-source")],
 ["16 original US003 case definitions preserved with separate progress",
  Array.from({length:16},(_,i)=>"US-003-QA"+String(i+1).padStart(2,"0"))
   .every(id=>s.tracker.includes(id))]
];
let gaps=0;
for(const [label,ok] of checks){
 process.stdout.write((ok?"SOURCE_PRESENT":"SOURCE_GAP")+" — "+label+"\n");
 if(!ok)gaps++;
}
process.stdout.write("CG-15 US-003 local static preflight: "+
 (checks.length-gaps)+"/"+checks.length+
 ". NO SQL/TypeScript/browser/native/security/visual test was executed by this static preflight.\n");
if(gaps)process.exitCode=1;
