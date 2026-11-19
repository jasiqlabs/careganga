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
 intakeDb:read("apps/backend/db/migrations/1423_cg15_center_provisional_patient_intake.sql"),
 identityDb:read("apps/backend/db/migrations/1428_cg15_in_person_patient_identity_verification.sql"),
 claimDb:read("apps/backend/db/migrations/1429_cg15_patient_center_intake_claim.sql"),
 intakeService:read("apps/backend/src/modules/cg-15-patients-appointments/application/center-patient-intake.service.ts"),
 intakeController:read("apps/backend/src/modules/cg-15-patients-appointments/http/center-patient-intake.controller.ts"),
 intakeProxy:read("apps/web/src/app/api/appointments/patients/[...parts]/route.ts"),
 intakeWeb:read("apps/web/src/features/patients/center-patient-intake-panel.tsx"),
 intakeWorkspace:read("apps/web/src/features/patients/center-patient-intake-workspace.tsx"),
 intakeAdminPage:read("apps/web/src/app/(admin)/admin/health-network/patient-intake/page.tsx"),
 adminHome:read("apps/web/src/app/(admin)/admin/page.tsx"),
 adminNav:read("apps/web/src/shared/foundation-admin-nav.tsx"),
 centerPortal:read("apps/web/src/features/health-network/center-draft-portal.tsx"),
 centerScope:read("apps/backend/src/modules/cg-14-healthcare-network/application/health-center-support-scope.facade.ts"),
 capability:read("apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts"),
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
 ["Web uses original CG01 contact verify start/confirm before registration",
  s.webProxy.includes('route==="mobile/confirm"')&&
  s.web.includes('"mobile/confirm","POST"')&&
  s.web.includes("!contact?.verified")],
 ["native uses original CG01 mobile proof, never client-side fake VERIFIED",
  s.native.includes('"/api/identity/mobile/verify/start"')&&
  s.native.includes('"/api/identity/mobile/verify/confirm"')&&
  s.native.includes("r.data?.status!==\"VERIFIED\"")&&
  s.native.includes("!contact?.verified")],
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
 ["assisted patient intake table is root+center qualified, consent attested only",
  s.intakeDb.includes("CREATE TABLE cg15_patient_center_intake")&&
  s.intakeDb.includes("REFERENCES health_center(root_realm_id,id)")&&
  s.intakeDb.includes("consent_version text NOT NULL")&&
  s.intakeDb.includes("assisted_consent_attested=true")],
 ["assisted patient source reuses current CG01 and CG14 exact own center",
  s.intakeService.includes("this.sessions.verifySession(bearer)")&&
  s.intakeService.includes('this.ownCenter.assertCurrent(tx,actor,centerRef,"health.patients.intake")')&&
  s.centerScope.includes("health.centers.draft.edit")],
 ["CG01 has independent assignable center intake capability",
  s.capability.includes('key:"health.patients.intake"')&&
  s.capability.includes('assignable:true,sensitive:true')],
 ["intake never auto-claims any phone, account or clinical history",
  !s.intakeService.includes("INSERT INTO cg15_patient_account_link")&&
  !s.intakeService.includes("normalized_mobile=")&&
  s.intakeService.includes("'PROVISIONAL'")&&
  s.intakeService.includes("'PATIENT_CARE',$3,false")],
 ["center intake uses transactional request-key replay and original source",
  s.intakeService.includes("ON CONFLICT(root_realm_id,center_id,created_by_account,request_key) DO NOTHING")&&
  s.intakeService.includes("CG15_PATIENT_REQUEST_CONFLICT")&&
  s.intakeService.includes('await tx.query("ROLLBACK")')],
 ["own-center endpoints are real Nest registrations",
  s.intakeController.includes('Controller("api/v1/appointments/patients")')&&
  s.intakeController.includes('Get("my-centers/:centerRef/intakes/:requestKey")')&&
  s.module.includes("CenterPatientIntakeService")&&
  s.module.includes("CenterPatientIntakeController")],
 ["center intake Web BFF staff cookie, scoped verbs and CSRF",
  s.intakeProxy.includes('get("cg_staff_session")')&&
  s.intakeProxy.includes('request.headers.get("origin")!==request.nextUrl.origin')&&
  s.intakeProxy.includes('parts[2]==="intakes"')],
 ["verified enabled Center Portal mounts hidden current-role intake UI",
  s.centerPortal.includes('CenterPatientIntakePanel')&&
  s.intakeWeb.includes('action.key==="health.patients.intake"')&&
  s.intakeWeb.includes("policy.available")],
 ["unknown intake result retries SAME command reference",
  s.intakeWeb.includes("pending.current.requestKey")&&
  s.intakeWeb.includes("submit(true)")&&
  s.intakeWeb.includes("setUncertain(true)")],
 ["original error catalogue includes center and intake not found outcomes",
  s.errors.includes("CG15_PATIENT_CENTER_UNAVAILABLE")&&
  s.errors.includes("CG15_PATIENT_INTAKE_NOT_FOUND")],
 ["intake-only role lists verified own-center choices with no draft-edit dependency",
  s.intakeService.includes('this.sessions.requireAction(bearer,"health.patients.intake")')&&
  s.intakeService.includes("a.account_ref=$2 AND a.status='ACTIVE'")&&
  s.intakeService.includes("c.access_state='ENABLED'")&&
  s.intakeController.includes('Get("my-centers/intake-options")')],
 ["intake-only role reachable in permissioned H15 route without center edit",
  s.intakeAdminPage.includes('actions.has("health.patients.intake")')&&
  s.intakeAdminPage.includes("CenterPatientIntakeWorkspace")&&
  !s.intakeAdminPage.includes('actions.has("health.centers.draft.edit")')],
 ["real assigned center selector, no caller-provided arbitrary center entry",
  s.intakeWorkspace.includes("my-centers/intake-options")&&
  s.intakeWorkspace.includes("centers.some(x=>x.centerRef===chosen)")],
 ["sidebar healthcare section visibility follows CG01 action",
  s.adminNav.includes("healthPatientIntake")&&
  s.adminNav.includes('allowed("health.patients.intake",canViewPatientIntake)')&&
  s.adminNav.includes('{name:"HEALTHCARE",keys:')],
 ["receptionist dashboard shows permitted patient intake only",
  s.adminHome.includes("canIntakePatients")&&
  s.adminHome.includes('x.key==="health.patients.intake"')],
 ["replay checks existing command before requiring new consent version",
  s.intakeService.includes("const prior=await tx.query<Intake>")&&
  s.intakeService.indexOf("const prior=await tx.query<Intake>")<
   s.intakeService.indexOf("const version=configuredConsent()")&&
  s.service.includes("const oldCommand=await c.query<CommandRow>")&&
  s.service.indexOf("const oldCommand=await c.query<CommandRow>")<
   s.service.indexOf("const terms=policy()")],
 ["patient identity proof and source-audit event are distinct from CG01 phone proof",
  s.identityDb.includes("cg15_patient_identity_challenge")&&
  s.identityDb.includes("cg15_patient_identity_event")&&
  s.identityDb.includes("IDENTITY_VERIFIED")&&
  s.service.includes("beginIdentityVerification(bearer:string)")&&
  s.service.includes("randomBytes(12)")],
 ["authorized receptionist verifies person in person using original patient code",
  s.intakeService.includes("async verifyIdentity(")&&
  s.intakeService.includes('this.scope(tx,actor,centerRef)')&&
  s.intakeService.includes("identityCheckedInPerson:true")&&
  s.intakeController.includes('Post("my-centers/:centerRef/verify-identity")')&&
  s.intakeWorkspace.includes("Record verified identity")],
 ["provisional receptionist patient claim remains an explicit current-authorized proof",
  s.claimDb.includes("cg15_patient_center_claim")&&
  s.claimDb.includes("cg15_patient_center_claim_immutable")&&
  s.intakeService.includes("async issueClaim(")&&
  s.service.includes("async claimCenterIntake(")&&
  s.intakeController.includes('Post("my-centers/:centerRef/claims")')&&
  s.ctrl.includes('Post("me/claim-intake")')],
 ["both Web and Android patient can claim real original center patient",
  s.web.includes('request<Profile>("me/claim-intake"')&&
  s.native.includes('"/api/v1/patients/me/claim-intake"')&&
  s.intakeWeb.includes("Give patient a one-time claim code")&&
  s.webProxy.includes('route==="me/claim-intake"')],
 ["one signed-in clinical patient identity, never a same-phone automatic merge",
  s.service.includes("if(linked)")&&
  s.service.includes("CG15_PATIENT_ALREADY_REGISTERED")&&
  !s.service.includes("WHERE normalized_mobile=")&&
  s.service.includes("cg15_patient_identity_event")],
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
