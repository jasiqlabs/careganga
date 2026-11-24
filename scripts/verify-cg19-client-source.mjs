// CG19 client-reference SOURCE checker only. Not a database/provider/device test.
// Run: npm run verify:cg19-client-source
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const root=fileURLToPath(new URL("../",import.meta.url));
const read=p=>readFileSync(resolve(root,p),"utf8");
const dir="apps/backend/src/modules/cg-19-documents-notifications/";
const catalog=read(dir+"application/client-email-template-source.ts");
const payload=catalog.split(
 "export const CLIENT_EMAIL_SOURCE:readonly ClientEmailSource[]=\n")[1]?.split(
 " as const;")[0];
assert.ok(payload,"Client email catalog source array missing");
const emails=JSON.parse(payload);
assert.equal(emails.length,52,"Every client template must be represented");
assert.equal(new Set(emails.map(t=>t.code)).size,52,"Unique client template codes");
assert.ok(emails.every(t=>/^CG-(MEM|VOL|DON|REF|EMP|DES|PROM|SAL|SUP)-[0-9]{3}$/.test(t.code)));
assert.ok(emails.every(t=>t.subject&&t.body&&t.trigger&&t.attachmentRule));
const original=read("docs/research/client-reference-20261120/master-email-spec-v2-parsed.txt");
const markers=[...original.matchAll(
 /^(CG-(?:MEM|VOL|DON|REF|EMP|DES|PROM|SAL|SUP)-\d{3})\s+—\s+([^\n]+)/gm)]
 .map(m=>({code:m[1],title:m[2].trim(),index:m.index}));
assert.equal(markers.length,52,"Original DOCX extraction has 52 template markers");
const removePageLabels=x=>x
 .replace(/^<PARSED TEXT FOR PAGE: \d+ \/ 22>\s*$/gm,"")
 .replace(/^\s*CareGanga Foundation \| Master Email Template & Workflow Specification \| Developer Handover\s*$/gm,"");
for(const [i,m] of markers.entries()){
 const end=markers[i+1]?.index??original.indexOf("\nJ. Master attachment",m.index);
 assert.ok(end>m.index,"Template source boundary present: "+m.code);
 const part=removePageLabels(original.slice(m.index,end));
 const field=k=>part.match(new RegExp("^"+k+":\\s*(.*)$","m"))?.[1]?.trim()??"";
 const body=(part.match(/^Subject: [^\n]+\n([\s\S]*?)^Attachment \/ developer rule:/m)||
  [])[1]?.trim()??"";
 const rule=(part.match(/^Attachment \/ developer rule:\s*([\s\S]*)$/m)||
  [])[1]?.trim().replace(/\n\s*/g," ")??"";
 const source=emails[i];
 assert.equal(source.code,m.code,"Template source order/code: "+m.code);
 assert.equal(source.title,m.title,"Template title: "+m.code);
 assert.equal(source.trigger,field("Trigger"),"Client trigger: "+m.code);
 assert.equal(source.recipient,field("Recipient"),"Client recipient rule: "+m.code);
 assert.equal(source.subject,field("Subject"),"Client subject: "+m.code);
 assert.equal(source.body,body,"Client email body: "+m.code);
 assert.equal(source.attachmentRule,rule,"Client attachment rules: "+m.code);
 const fields=[...new Set(
  [...(source.subject+"\n"+source.body).matchAll(/\{#([A-Z0-9_]+)#\}/g)]
   .map(x=>x[1]))];
 assert.deepEqual(source.placeholders,fields,"Placeholder list: "+m.code);
}
const mailCapacitySql=read("apps/backend/db/migrations/1905_cg19_email_body_channel_limit.sql");
assert.match(mailCapacitySql,/channel='EMAIL' AND length\(body\) BETWEEN 8 AND 12000/);
assert.match(mailCapacitySql,/channel IN\('IN_APP','SMS'\) AND length\(body\) BETWEEN 8 AND 480/);
assert.match(mailCapacitySql,/channel='EMAIL' AND length\(body_snapshot\) BETWEEN 8 AND 12000/);
const existingChannelProvider=read(dir+"infrastructure/channel-providers.ts");
assert.match(existingChannelProvider,/message\.body\.length>12000/);
assert.match(existingChannelProvider,/message\.body\.length>160/);
assert.ok(emails.some(t=>t.body.length>480),"At least one original client email exceeds former 480 cap");
assert.ok(emails.every(t=>t.body.length<=12000),"All original client email bodies within EMAIL-only limit");
const draftSql=read("apps/backend/db/migrations/1902_cg19_client_email_source_drafts.sql");
assert.match(draftSql,/CHECK\(enabled=false\)/);
assert.match(draftSql,/CHECK\(status='SOURCE_DRAFT'\)/);
assert.match(draftSql,/UNIQUE\(realm_id,template_code,version\)/);
const service=read(dir+"application/client-email-template.service.ts");
assert.match(service,/requireAction\(token,"communications\.notices\.manage"\)/);
assert.match(service,/ON CONFLICT\(realm_id,template_code,version\) DO NOTHING/);
assert.match(service,/deliveryEnabled:false/);
assert.doesNotMatch(service,/providers\.send\(|sendgrid\.com|mail\/send/);
const controller=read(dir+"http/communications.controller.ts");
const module=read(dir+"documents-notifications.module.ts");
const proxy=read("apps/web/src/app/api/communications/[...parts]/route.ts");
assert.match(module,/ClientEmailTemplateService/);
assert.match(controller,/@Get\("client-email-templates"\)/);
assert.match(controller,/@Post\("client-email-templates\/import-drafts"\)/);
assert.match(proxy,/parts\[0\]==="client-email-templates"/);
const ui=read("apps/web/src/features/communications/communications-workspace.tsx");
assert.match(ui,/disabled (?:source )?drafts only/i);
assert.match(ui,/Email reference templates/);
assert.match(ui,/saved client email reference differs from this source version/i);
// Same-actor Web/Internal Android catalog and disabled-draft import parity.
// Source-presence assertion only; no real provider, DB or device PASS.
const nativeNotices=read("apps/android-internal/src/features/communications/foundation-notice-admin-screen.tsx");
assert.match(nativeNotices,/type ClientEmailReference=\{code:string;title:string;owner:string;/);
assert.match(nativeNotices,/"client-email-templates"\)/);
assert.match(nativeNotices,/"client-email-templates\/import-drafts","POST"\)/);
assert.match(nativeNotices,/result\.deliveryEnabled!==false/);
assert.match(nativeNotices,/result\.total!==52/);
assert.match(nativeNotices,/setEmailImportUnknown\(true\)/);
assert.match(nativeNotices,/emailImportUnknown\?"Check uncertain import"/);
assert.match(nativeNotices,/mail|email/i);
assert.match(nativeNotices,/mayManage&&<View style=\{s\.card\}>/);
assert.match(nativeNotices,/x\.attachmentRule/);
assert.match(nativeNotices,/x\.placeholders\.join/);
const supportStatesSql=read("apps/backend/db/migrations/1903_cg19_client_support_states.sql");
assert.match(supportStatesSql,/WAITING_FOR_USER/);
assert.match(supportStatesSql,/STATUS_UPDATED/);
const staffWeb=read("apps/web/src/features/support/foundation-support-workspace.tsx");
const staffAndroid=read("apps/android-internal/src/features/support/foundation-support-screen.tsx");
assert.match(staffWeb,/CHANGE_STATUS/);
assert.match(staffAndroid,/SET_STATUS/);
assert.match(staffWeb,/ESCALATED/);
assert.match(staffAndroid,/WAITING_FOR_USER/);
const supportSql=read("apps/backend/db/migrations/1901_cg19_client_support_ticket_number.sql");
assert.match(supportSql,/ADD COLUMN ticket_number text NOT NULL/);
assert.match(supportSql,/UNIQUE\(ticket_number\)/);
assert.match(supportSql,/ticket_number IS DISTINCT FROM OLD\.ticket_number/);
const noteSql=read("apps/backend/db/migrations/1904_cg19_support_status_notes.sql");
assert.match(noteSql,/CREATE TABLE cg19_support_status_note/);
assert.match(noteSql,/note_encrypted bytea/);
assert.match(noteSql,/UNIQUE\(case_id,case_revision\)/);
assert.match(noteSql,/cg19_support_immutable_evidence/);
const support=read(dir+"application/support.service.ts");
assert.match(support,/statusNotes:notes\.rows\.map/);
assert.match(support,/WAITING_FOR_USER","RESOLVED","CLOSED"\]\.includes/);
assert.match(support,/if\(c\.status==="CLOSED"&&x\.status!=="OPEN"\)/);
assert.match(support,/if\(c\.status==="RESOLVED"/);
assert.match(support,/hmac\("status-note"/);
assert.match(support,/\["CLOSED","RESOLVED"\]\.includes\(c\.status\)/);
const centerDesk=read("apps/web/src/features/health-network/center-support-desk.tsx");
assert.match(centerDesk,/\["CLOSED","RESOLVED"\]\.includes\(detail\.status\)/);
assert.match(centerDesk,/closed=\{\["CLOSED","RESOLVED"\]\.includes\(detail\.status\)\}/);
const centerAttachments=read(dir+"application/center-support-attachment.service.ts");
assert.match(centerAttachments,/editable&&\(\["CLOSED","RESOLVED"\]\.includes\(c\.status\)/);
assert.match(centerAttachments,/await this\.own\(tx,actor,center,ref,input\.version,true\)/);
assert.match(centerAttachments,/row\.health_source_version,true/);
assert.match(support,/new ConflictException\("Assign an eligible operator/);
assert.doesNotMatch(support,/sha\(explanation\)/);
assert.match(staffWeb,/statusNote\.trim\(\)\.length<8/);
assert.match(staffAndroid,/statusNote\.trim\(\)\.length<8/);
assert.match(staffWeb,/\(selected\.statusNotes\?\?\[\]\)\.map/);
assert.match(staffAndroid,/\(selected\.statusNotes\?\?\[\]\)\.map/);
assert.match(support,/ticketNumber:old\.rows\[0\]\.ticket_number/);
assert.match(support,/ticketNumber:created\.rows\[0\]\.ticket_number/);
assert.match(support,/ticketNumber:row\.ticket_number/);
assert.match(support,/ticketNumber:record\.ticket_number/);
assert.match(support,/ticketNumber:c\.ticket_number/);
for(const p of [
 "apps/web/src/features/support/foundation-support-workspace.tsx",
 "apps/web/src/features/cms-public-content/cg19-public-contact-form.tsx",
 "apps/web/src/features/health-network/center-support-desk.tsx",
 "apps/android-internal/src/features/support/foundation-support-screen.tsx",
 "apps/android-public/src/features/support/foundation-contact-screen.tsx"
])assert.match(read(p),/ticketNumber/,p+" missing readable reference");
const sourceCodes=new Set(emails.map(t=>t.code));
for(const id of ["CG-MEM-007","CG-VOL-005","CG-DON-001","CG-REF-004",
 "CG-EMP-005","CG-SAL-002","CG-SUP-001","CG-SUP-006"])
 assert.ok(sourceCodes.has(id),"Missing high-risk source event "+id);
// CG19 US001-QA02/03/05/08/11: staff Android MUST perform the
// existing protected Web letter actions, not send the user back to Web.
const letterWeb=read("apps/web/src/features/documents/private-letter-panel.tsx");
const letterNative=read("apps/android-internal/src/features/documents/native-private-letter-panel.tsx");
const nativeEvidence=read("apps/android-internal/src/features/documents/private-case-evidence-screen.tsx");
const nativeShell=read("apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx");
const letterRoutes=read(dir+"http/private-letter.controller.ts");
for(const action of ["template/approve","issue","requests/","/reconcile","/revoke"]){
 assert.ok(letterNative.includes(action),"Staff Android missing original CG19 letter action: "+action);
 assert.ok(letterWeb.includes(action),"Existing staff Web action changed unexpectedly: "+action);
}
for(const route of ['@Get("template")','@Post("template/approve")',
 '@Get("case/:caseRef")','@Post("issue")','@Get("requests/:requestKey")',
 '@Post(":documentRef/reconcile")','@Post(":documentRef/revoke")']){
 assert.ok(letterRoutes.includes(route),"Original CG19 backend API is required: "+route);
}
assert.match(letterNative,/canIssue:boolean;canRevoke:boolean/,
 "Per-action current CG01 permission needed on native letters");
assert.match(letterNative,/requestKey:issueKey\.current/,
 "Lost-response native issue retries must use original idempotency key");
assert.match(letterNative,/if\(!canIssue\|\|busy\|\|uncertain\|\|/,
 "Uncertain original letter outcome blocks unsafe new writes");
assert.match(letterNative,/onPreview\(item\.documentRef\)/,
 "Native private PDF must reuse actual original authorized byte preview");
assert.match(nativeEvidence,/async function revokeMedia\(item:Media\)/,
 "CG19 original private evidence must support authorized native revocation");
assert.match(nativeEvidence,/expectedRevision:item\.revision/,
 "Native revoke needs exact original file revision, not blind delete");
assert.match(nativeEvidence,/setRevokeUncertain\(item\.fileRef\)/,
 "Unknown native file-revocation outcome must not claim success or retry blindly");
assert.match(nativeEvidence,/Review and revoke private file/,
 "Original Web file revoke must be available to same native authorized staff");
assert.match(read(dir+"http/private-evidence.controller.ts"),
 /@Post\("files\/:fileRef\/revoke"\)/,
 "Reuse the real CG19 private-file revoke controller; no duplicate endpoint");
assert.match(nativeEvidence,/<NativePrivateLetterPanel/,
 "Existing staff evidence screen mounts original private letter actions");
assert.match(nativeEvidence,/onPreview=\{async ref=>\{await previewVerified\(ref,"letter"\)\}\}/,
 "Native private letter preview uses original authenticated, bounded PDF reader");
assert.doesNotMatch(nativeEvidence,/require\s+privileged\s+confirmation\s+in\s+the\s+Foundation\s+Web/,
 "Do not direct same-authorized staff to Web for already implemented letter actions");
assert.match(nativeShell,/canViewLetters=\{roleActions\.includes\("documents\.letters\.issue"\)\}/,
 "Native letter issue must use current original CG01 permission");
assert.match(nativeShell,/canRevokeLetters=\{roleActions\.includes\("documents\.letters\.revoke"\)\}/,
 "Native letter revoke must use separate current CG01 permission");
assert.match(letterNative,/sourceRevision,requestKey:issueKey\.current/,
 "Native issued private PDF is pinned to original approved case revision");

console.log("CG19 SOURCE checks: 52 exact client texts/triggers/attachment rules; disabled drafts, scoped ticket/status/notes safeguards.");
console.log("Not a Postgres migration, provider, PDF, Web build or Android device test.");

// E2E-007 original CG19 opt-in/withdraw owner: source-only, no provider execution.
const newsletter=read(dir+"application/newsletter-consent.service.ts");
const newsletterMigration=read("apps/backend/db/migrations/9999_cg19_newsletter_consent.sql");
const newsletterController=read(dir+"http/support.controller.ts");
const newsletterProxy=read("apps/web/src/app/api/support/[...parts]/route.ts");
for(const x of ["cg19_newsletter_subscription","cg19_newsletter_challenge","cg19_newsletter_consent_event","attempt_count BETWEEN 0 AND 5","state='WITHDRAWN' AND email_encrypted IS NULL"])assert.ok(newsletterMigration.includes(x),x);
for(const x of ['x.consent!==true','randomInt(0,100000000)','createCipheriv("aes-256-gcm"','timingSafeEqual','this.support.newsletterThrottle','this.providers.configured("EMAIL","TRANSACTIONAL")','send.state==="ACCEPTED"?"CHECK_EMAIL"','c.attempt_count>=5','current.revision===c.confirmed_revision','DELETE FROM cg19_newsletter_challenge','state==="SUBSCRIBED"?sealEmail(email):null','FOR UPDATE SKIP LOCKED'])assert.ok(newsletter.includes(x),x);
for(const path of ["start","confirm","withdraw"]){
 assert.ok(newsletterController.includes('@Post("public/newsletter/'+path+'")'));
 assert.ok(newsletterController.includes('"newsletter-'+path+'"'));
}
assert.ok(newsletterProxy.includes('["start","confirm","withdraw"].includes(parts[2])')&&newsletterProxy.includes('"newsletter-"+parts[2]'));
for(const path of ["apps/web/src/features/cms-public-content/cg19-newsletter-form.tsx","apps/android-public/src/features/cms/native-newsletter-form.tsx"]){
 const ui=read(path);for(const x of ['consent:true','/api/support/public/newsletter/','"CHECK_EMAIL"','"SUBSCRIBED":"WITHDRAWN"','Use private withdrawal key'])assert.ok(ui.includes(x),path+": "+x);
}
console.log("CG19 newsletter source: explicit consent, verified email, bounded attempts, encrypted contact, revision/withdrawal and shared public ingress; runtime/provider NOT_RUN.");
