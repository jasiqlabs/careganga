/** Reference-led public healthcare source regression checks. LOCAL only.
 * Parse and contract checks; not a build, database, device, scanner or visual pass.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const files={
  "backend": "apps/backend/src/modules/cg-15-patients-appointments/application/doctor-availability.service.ts",
  "directoryBackend": "apps/backend/src/modules/cg-14-healthcare-network/application/health-public-directory.service.ts",
  "webCms": "apps/web/src/features/cms-public-content/cms-public-extended.tsx",
  "nativeCms": "apps/android-public/src/features/cms/cms-extended-native-screen.tsx",
  "cmsScreen": "apps/android-public/src/features/cms/public-cms-screen.tsx",
  "nativeRoot": "apps/android-public/app/index.tsx",
  "webDirectory": "apps/web/src/app/health-network/page.tsx",
  "nativeDirectory": "apps/android-public/src/features/health-network/public-healthcare-directory.tsx",
  "webSchedule": "apps/web/src/app/health-network/doctors/[doctorRef]/schedule/page.tsx",
  "nativeSchedule": "apps/android-public/src/features/health-network/doctor-schedule-preview.tsx",
  "nativeBooking": "apps/android-public/src/features/appointments/native-consultation-action.tsx",
  "webBooking": "apps/web/src/features/appointments/patient-booking-action.tsx",
  "patientProfile": "apps/web/src/app/patients/me/page.tsx",
  "privateDetail": "apps/web/src/features/appointments/patient-appointment-detail.tsx",
  "slip": "apps/backend/src/modules/cg-19-documents-notifications/application/cg19-consultation-slip-renderer.ts",
  "receipt": "apps/backend/src/modules/cg-19-documents-notifications/application/center-collection-receipt-renderer.ts"
};
const s={};
for(const [key,path] of Object.entries(files)){
 s[key]=readFileSync(resolve(root,path),"utf8");
 const parsed=ts.createSourceFile(path,s[key],ts.ScriptTarget.Latest,true,path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,path+": "+parsed.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "));
 assert.doesNotMatch(s[key],/^(<{7}|={7}|>{7})/m,path+" merge conflict");
}
const rules=[
  [
    "CMS category navigation",
    [
      "webCms",
      "name=\"category\""
    ],
    [
      "nativeCms",
      "onHealthcareDirectory(healthcareCode(item.title))"
    ],
    [
      "cmsScreen",
      "onHealthcareDirectory={onHealthcareDirectory}"
    ],
    [
      "nativeRoot",
      "initialCategory={directoryCategory}"
    ],
    [
      "nativeDirectory",
      "useState(reschedule?\"\":initialCategory)"
    ]
  ],
  [
    "Approved live photo scope",
    [
      "directoryBackend",
      "CLEAN_VERIFIED"
    ],
    [
      "directoryBackend",
      "rights.revoked_at IS NULL"
    ],
    [
      "webDirectory",
      "/photos/"
    ],
    [
      "nativeDirectory",
      "/api/documents/health-center-content/public/"
    ]
  ],
  [
    "Verified appointment response bounds",
    [
      "backend",
      "MAX_CENTERS=40"
    ],
    [
      "backend",
      "MAX_SLOTS=144"
    ],
    [
      "webSchedule",
      "rawOptions.centers.length<=40"
    ],
    [
      "webSchedule",
      "rawSelected.slots.length<=144"
    ],
    [
      "nativeSchedule",
      "MAX_CENTERS=40,MAX_SLOTS=144"
    ],
    [
      "nativeSchedule",
      "result.slots.length>MAX_SLOTS"
    ]
  ],
  [
    "Selected booking action and original recovery",
    [
      "webSchedule",
      "activeSlot=selected?.slots.find"
    ],
    [
      "nativeSchedule",
      "selectionLocked"
    ],
    [
      "nativeBooking",
      "Check current reservation status"
    ],
    [
      "webBooking",
      "Check current reservation status"
    ]
  ],
  [
    "Patient registration continuity",
    [
      "webSchedule",
      "?returnTo="
    ],
    [
      "patientProfile",
      "safeReturn("
    ],
    [
      "nativeRoot",
      "<Modal visible={patientOpen}"
    ],
    [
      "nativeDirectory",
      "if(reviewActive)return;"
    ]
  ],
  [
    "Private document preview and actual receipt semantics",
    [
      "privateDetail",
      "previewGeneration"
    ],
    [
      "privateDetail",
      "URL.revokeObjectURL"
    ],
    [
      "slip",
      "This slip is not a payment receipt"
    ],
    [
      "receipt",
      "Verified cash received:"
    ]
  ],
  [
    "Slip layout fit and QR quiet zone",
    [
      "slip",
      "[10,9.5,9,8.5]"
    ],
    [
      "slip",
      "matrix.length+8"
    ],
    [
      "slip",
      "263,245"
    ],
    [
      "slip",
      "266,245"
    ]
  ]
];
for(const [name,...checks] of rules){
 for(const [key,needle] of checks)assert.ok(s[key].includes(needle),name+": "+files[key]+" missing "+needle);
 console.log("PASS source: "+name);
}
console.log("Reference-led source checks passed. Runtime and rendered QA remain separate.");
