/**
 * CG-16 US-004 source-only guard. No real device/browser, SQL or phone call
 * executed. Does not approve CG19 stored enquiries, CG03 rate review or ERP.
 */
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const web="apps/web/src/app/healthcare/centers/[slug]/page.tsx";
const native="apps/android-public/src/features/health-network/public-healthcare-directory.tsx";
const lab="apps/android-public/src/features/health-network/public-lab-offer-directory.tsx";
const backend="apps/backend/src/modules/cg-16-healthcare-diagnostics/application/diagnostics-public-catalog.service.ts";
const docs=["apps/web/src/app/healthcare/page.tsx",web,native,lab,backend];
for(const path of docs){
 const content=read(path);
 if(path.endsWith(".ts")||path.endsWith(".tsx")){
  const parsed=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,
   path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,path+": TypeScript/JSX syntax invalid");
 }
 assert.doesNotMatch(content,/^(<{7}|={7}|>{7})/m,path+": merge markers");
}
const a=read(web),b=read(native),c=read(lab),original=read(docs[0]);
assert.match(a,/publicLabOffers\(new URLSearchParams\(\{center:slug\}\)\)/,
 "Provider detail needs current source-scoped CG16 offers");
assert.match(a,/labs\.state==="READY"&&labs\.items\.length>0/,
 "Do not show specific test CTA for a missing/unapproved/withdrawn offer");
assert.match(a,/href=\{"tel:"\+c\.publicPhone\}/,
 "Enquiry must use original current CG14 public phone");
assert.match(a,/\/health-network\/lab-tests\?center=/,
 "Web CTA must restrict to actual source-selected center");
assert.match(b,/hasCurrentLabOffers\(selection\.slug\)/,
 "Native must independently verify current center offers");
assert.match(b,/hasCenterLabOffer&&selection\?\.kind==="center"/,
 "Native CTA cannot depend only on self-declared capability");
assert.match(b,/Enquire about tests by phone/,
 "Native must expose nonpayment direct contact");
assert.match(c,/export async function hasCurrentLabOffers\(/,
 "Native verified public offer gate unavailable");
assert.match(c,/initialCenterSlug/,"Native must preserve specific original lab center");
assert.match(original,/CmsEditorialRoute slug="healthcare"/,
 "Client-owned CMS healthcare entry cannot be replaced by test directory");
assert.match(read(backend),/price\.status='APPROVED'/,
 "No draft/offline commercial price on public contact page");
for(const text of [a,b,c]){
 assert.doesNotMatch(text,/(?:Book Lab Test|Checkout for Lab|Mark.*Paid)/i,
  "Lab CTA must not create unsupported payment/booking");
}
console.log("CG16 US004 SOURCE/PARSE GUARD PASS; NO runtime Web/native/contact/security QA");
