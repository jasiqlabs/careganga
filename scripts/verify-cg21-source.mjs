import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const nativePath="apps/android-internal/src/features/platform-configuration/native-platform-configuration.tsx";
const shellPath="apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx";
const modulesPath="apps/android-internal/src/features/dashboard/dashboard-modules.ts";
const native=read(nativePath),shell=read(shellPath),modules=read(modulesPath);
for(const path of [nativePath,shellPath,modulesPath]){
  const s=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,
    path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(s.parseDiagnostics.length,0,path+" TS/TSX syntax: "+
    s.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
}
assert.match(native,/careGangaTheme/,"Reuse CG01 visual identity");
assert.doesNotMatch(native,/\bWebView\b/,"Do not replace native screen with WebView");
for(const action of ["platform.settings.view","platform.settings.manage",
 "platform.integrations.view","platform.integrations.manage","platform.audit.view",
 "platform.audit.export","platform.recovery.view","platform.recovery.request",
 "platform.recovery.authorize"])
 assert.ok(native.includes(action),"Protected action missing "+action);
for(const endpoint of ["/settings","/settings/history","/integrations","/error-messages",
 "/audit?source=","/audit/detail/","/audit/export?source=","/recovery/availability",
 "/recovery/operations","/recovery/request","/recovery/changes/",
 "/recovery/authorization/changes/","/changes/","/authorize"])
 assert.ok(native.includes(endpoint),"CG21 original owner endpoint missing "+endpoint);
assert.match(native,/CG21RecoveryOutcome/);
assert.match(native,/Check original command/);
assert.match(native,/SAFE_COPY/);
assert.match(native,/No backup will be restored/);
assert.match(native,/appliedFrom/);
assert.match(native,/appliedTo/);
assert.match(native,/Sharing.shareAsync/);
assert.match(native,/new File\(Paths.cache/);
assert.match(native,/await file.write\(x.csv\)/);
assert.match(native,/Status|status/);
assert.match(modules,/key:"platformConfiguration"/);
assert.match(modules,/openPlatformConfiguration:\s*\(\)\s*=>\s*void/);
assert.match(shell,/NativePlatformConfiguration\s*=\s*lazy/);
assert.match(shell,/platformConfigOpen\s*&&\s*token\s*&&\s*actor/);
assert.match(shell,/openPlatformConfiguration:\s*\(\)\s*=>\s*openOnly\(setPlatformConfigOpen\)/);
assert.match(shell,/platformConfigOpen,/,"Native back-handler dependencies must include CG21");
assert.ok((shell.match(/setPlatformConfigOpen\(false\)/g)||[]).length>=4,
 "Sign-out, expiry and Back must close protected CG21 screen");
const ownerBase="apps/backend/src/modules/cg-21-platform-configuration-audit/http/";
for(const owner of ["platform-settings.controller.ts","platform-audit.controller.ts",
 "recovery.controller.ts","safe-error-messages.controller.ts"])
 assert.ok(read(ownerBase+owner).includes("@Controller("),
  "Original protected owner controller missing "+owner);
// Private Foundation audit CSV must not remain as an unbounded app cache
// after sharing or when a share/export error interrupts the native flow.
assert.match(native,/let temporary:File\|null=null/,
 "Native CG21 audit export should explicitly own one temporary file");
assert.match(native,/temporary\.create\(\)/,
 "Actual CG21 protected audit bytes are written to an initialized private file");
assert.match(native,/finally\{\s*try\{temporary\?\.delete\(\)\}catch\{\}/,
 "Always delete the original protected audit CSV in success/error cleanup");
assert.doesNotMatch(native,/await Sharing\.shareAsync\(file\.uri/,
 "Native CG21 must never leave prior unmanaged audit CSV copies");
const tasks=read("specs/initiatives/careganga-foundation-platform/modules/cg-21-platform-configuration-audit/tasks.md");
const ids=new Set(tasks.match(/US-00[12]-QA\d\d/g)||[]);
assert.equal(ids.size,16,"Preserve CG21's original two user stories and sixteen QA scenarios");
assert.match(tasks,/ANDROID_DEVICE_QA/);
console.log("CG21 STRUCTURAL SOURCE READBACK: TSX syntax, original API coverage, actor guard and navigation checks passed.");
console.log("NOT_RUN: Web/Android TypeScript full typechecks, backend build, migration/restore, actual permission/backup-provider calls, browser/device/visual QA and independent review.");
