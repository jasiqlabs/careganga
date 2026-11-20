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
for(const t of emails){
 assert.ok(original.includes(t.code+" — "+t.title),t.code+" title mismatch");
 assert.ok(original.includes("Subject: "+t.subject),t.code+" subject mismatch");
 const fields=[...new Set(
  [...(t.subject+"\n"+t.body).matchAll(/\{#([A-Z0-9_]+)#\}/g)].map(x=>x[1]))];
 assert.deepEqual(t.placeholders,fields,t.code+" placeholder mismatch");
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
const supportSql=read("apps/backend/db/migrations/1901_cg19_client_support_ticket_number.sql");
assert.match(supportSql,/ADD COLUMN ticket_number text NOT NULL/);
assert.match(supportSql,/UNIQUE\(ticket_number\)/);
assert.match(supportSql,/ticket_number IS DISTINCT FROM OLD\.ticket_number/);
const support=read(dir+"application/support.service.ts");
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
console.log("CG19 client SOURCE checks passed: 52 exact references, disabled mail drafts, secure support ticket parity.");
console.log("Not a Postgres migration, provider, PDF, Web build or Android device test.");
