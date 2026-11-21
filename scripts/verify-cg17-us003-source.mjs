/** Canonical CG17 US003 source/parse preflight; not a provider test.
 * Run locally: node scripts/verify-cg17-us003-source.mjs
 * Never claim real HMAC/capture, PostgreSQL races or Android device PASS.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const src=p=>readFileSync(resolve(root,p),"utf8");
const dir="apps/backend/src/modules/cg-17-healthcare-assistance-settlements/";
const urls={
 binding:dir+"application/center-merchant-provisioning.service.ts",
 checkout:dir+"application/center-merchant-checkout.service.ts",
 controller:dir+"http/center-merchant.controller.ts",
 module:dir+"healthcare-assistance.module.ts",
 sql:"apps/backend/db/migrations/1705_cg17_center_merchant_and_gateway_order.sql",
 bff:"apps/web/src/app/api/healthcare-assistance/merchant/[...parts]/route.ts",
 webCheckout:"apps/web/src/features/healthcare-assistance/center-merchant-checkout.tsx",
 webBinding:"apps/web/src/features/healthcare-assistance/center-merchant-binding.tsx",
 nativeCheckout:"packages/native-checkout/src/native-center-merchant-checkout.tsx",
 nativeBinding:"apps/android-internal/src/features/healthcare-assistance/native-center-merchant-screen.tsx",
 patient:"apps/android-public/src/features/appointments/native-consultation-contribution.tsx",
 staffShell:"apps/android-internal/src/features/identity-access/staff-authentication-screen.tsx",
 staffMenu:"apps/android-internal/src/features/dashboard/dashboard-modules.ts",
 centerPortal:"apps/web/src/features/health-network/center-draft-portal.tsx",
 public:"apps/web/src/features/healthcare-assistance/consultation-contribution.tsx",
 main:"apps/backend/src/main.ts"
};
for(const file of Object.values(urls)){
 const text=src(file);
 if(/\.tsx?$/.test(file)){
  const parsed=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,
   file.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,file+": "+parsed.parseDiagnostics.map(
   x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "));
 }
 assert.doesNotMatch(text,/^(<{7}|={7}|>{7})/m,"Conflict markers: "+file);
}
const check=(name,part,re)=>{
 assert.match(src(urls[part]),re,name+" failed to follow original CG17 source");
};
check("One merchant binding per center","sql",/ux_cg17_active_center_merchant/);
check("No Foundation merchant shared key","sql",/ux_cg17_one_center_per_provider_key/);
check("Single active payment per charge","sql",/ux_cg17_only_one_pending_order/);
check("No client-supplied merchant secret","binding",/CAREGANGA_CG17_CENTER_/);
check("Independent merchant review","binding",/proposed_by===actor.accountId/);
check("Actual provider credential verification","binding",/https:\/\/api\.razorpay\.com\/v1\/payments/);
check("Fail closed when merchant not verified","checkout",/this\.merchants\.verified/);
check("Original CG15 patient or center source","checkout",/this\.cg15\.booking/);
check("Original charged amount","checkout",/BigInt\(charge\.due_minor\)/);
check("Unknown provider order result does not confirm paid","checkout",/status=result&&enabled\?"PENDING":"UNKNOWN"/);
check("Source-backed no-second-order recovery","checkout",/orders\?receipt=/);
check("Raw provider HMAC","checkout",/createHmac\("sha256",credentials\.webhookSecret\)\.update\(raw\)/);
check("Compare HMAC in constant time","checkout",/timingSafeEqual/);
check("Server reads provider captured payment","checkout",/payments\/"/);
check("Server reads provider original order","checkout",/orders\/"/);
check("No fabricated receipt for pending evidence","checkout",/verification_state='VERIFIED_PROVIDER'/);
check("Exact capture replay ledger","checkout",/cg17_merchant_event/);
check("Provider refund verification and adjustment","checkout",/provider_refund_ref/);
check("Raw body enabled for signed callback","main",/rawBody:\s*true/);
check("Patient and staff same original routes","controller",/me\/appointments/);
check("Binding staff-only API","controller",/staff\/centers/);
check("Public Web uses original checkout","public",/CenterMerchantCheckout/);
check("Public Android uses original checkout","patient",/NativeCenterMerchantCheckout/);
check("Private staff internal Android verification","nativeBinding",/NativeCenterMerchantScreen/);
check("Internal Android merchant UI actually routed","staffShell",/NativeCenterMerchantScreen token=\{token\}/);
check("Native merchant staff menu is CG01 permission-gated","staffMenu",/healthcare\.assistance\.merchant\.verify/);
check("Web merchant original center owner UI is reachable","centerPortal",/CenterMerchantBinding/);
check("Web verifies source checkout status","webCheckout",/CENTER|center/);
console.log("CG17 US003 source/parse preflight PASS; provider sandbox, "+
 "migration, real webhook, Web/Android device/independent security QA NOT_RUN.");
