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
assert.match(support,/new ConflictException\("Assign an eligible operator/);
assert.doesNotMatch(support,/sha\(explanation\)/);
assert.match(staffWeb,/statusNote\.trim\(\)\.length<8/);
assert.match(staffAndroid,/statusNote\.trim\(\)\.length<8/);
assert.match(staffWeb,/selected\.statusNotes\.map/);
assert.match(staffAndroid,/selected\.statusNotes\.map/);
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
console.log("CG19 SOURCE checks: 52 exact client texts/triggers/attachment rules; disabled drafts, scoped ticket/status/notes safeguards.");
console.log("Not a Postgres migration, provider, PDF, Web build or Android device test.");
