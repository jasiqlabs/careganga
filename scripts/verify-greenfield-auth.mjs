import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// STATIC SOURCE CHECK ONLY. Never marks a story, a runtime test, or provider delivery PASS.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const get=(path)=>readFileSync(join(root,path),'utf8');
const checks=[];
function check(label,condition){checks.push({label,ok:Boolean(condition)});}
function walk(path){
  const dir=join(root,path);
  if(!existsSync(dir))return [];
  return readdirSync(dir).flatMap(name=>{
    const relative=join(path,name);
    return statSync(join(root,relative)).isDirectory()?walk(relative):[relative];
  });
}

for(const path of [
  'apps/backend/src/modules/cg-01-identity-access/application/invitation-enrollment.service.ts',
  'apps/backend/src/modules/cg-01-identity-access/http/invitation.controller.ts',
  'apps/android-internal/src/features/identity-access/invitation-activation-screen.tsx',
  'apps/web/src/app/staff/activate/page.tsx',
  'scripts/totp.mjs',
  'scripts/run-all-foundation-qa.mjs'
])check('No retired file: '+path,!existsSync(join(root,path)));

const forbidden=/(accounts\.invite\b|\/api\/access\/invitations\b|\/staff\/activate\b|InvitationActivationScreen\b|invitation-enrollment\b|\binviteOnly\b|\brootMfaRequired\b|\brequiresFreshAuthenticator\b|\btotp\b)/i;
const paths=[
  ...walk('apps/backend/src'),
  ...walk('apps/web/src'),
  ...walk('apps/android-internal/src'),
  ...walk('apps/android-public')
].filter(x=>/\.(ts|tsx|mjs)$/.test(x));
const stale=paths.flatMap(path=>get(path).split('\n').flatMap((line,index)=>
  forbidden.test(line)?[path+':'+(index+1)]:[]));
check('No retired authentication references in active application source'+
  (stale.length?' ('+stale.join(', ')+')':''),stale.length===0);

const session=get('apps/backend/src/modules/cg-01-identity-access/http/session.controller.ts');
const recovery=get('apps/backend/src/modules/cg-01-identity-access/http/recovery.controller.ts');
const accounts=get('apps/backend/src/modules/cg-01-identity-access/application/accounts.service.ts');
const catalog=get('apps/backend/src/modules/cg-01-identity-access/domain/capability-catalog.ts');
const nav=get('apps/web/src/shared/foundation-admin-nav.tsx');
const bootstrap=get('apps/backend/src/modules/cg-01-identity-access/infrastructure/bootstrap-root.ts');
const otp=get('apps/backend/src/modules/cg-01-identity-access/application/recovery.service.ts');
check('Routine password login and authenticated change-password endpoints',
  session.includes('@Post("login")')&&session.includes('password:body.password')&&
  session.includes('@Post("password/change")'));
check('Password recovery request/confirm and six-digit OTP generation',
  recovery.includes('@Post("request")')&&recovery.includes('@Post("confirm")')&&
  otp.includes('randomInt(0,1_000_000)'));
check('Direct ACTIVE account creation requires create + assign permissions',
  accounts.includes("'ACTIVE'")&&accounts.includes('"accounts.create"')&&
  accounts.includes('"roles.assign"'));
check('Role catalog has the account-creation capability',
  catalog.includes('key:"accounts.create"'));
check('Create-only operator can open permitted account screen',
  nav.includes('currentActions.has("accounts.create")')&&
  nav.includes('currentActions.has("roles.assign")'));
check('Initial Super Admin provisioning is explicitly offline',
  bootstrap.includes('--confirm-one-time-root')&&!session.includes('@Post("bootstrap")'));

const sql23=get('apps/backend/db/migrations/0023_cg19_notifications_notices.sql');
const sql24=get('apps/backend/db/migrations/0024_cg19_foundation_support.sql');
check('CG-19 notices declare the called SQL trigger function',
  sql23.includes('CREATE FUNCTION cg19_message_template_frozen()')&&
  sql23.includes('EXECUTE FUNCTION cg19_message_template_frozen()'));
check('CG-19 support migration has complete initial table definitions',
  sql24.includes("term_digest text NOT NULL CHECK (term_digest ~ '^[a-f0-9]{64}$')")&&
  sql24.includes('CREATE TABLE cg19_support_reply (')&&
  sql24.includes('CREATE TABLE cg19_support_search_token ('));
check('Backend compiled start path matches tsconfig rootDir',
  JSON.parse(get('apps/backend/package.json')).scripts.start==='node dist/src/main.js');

let total=0;
for(const [owner,expected] of Object.entries({
  '01-identity-access':51,'21-platform-configuration-audit':16,
  '03-registration-approvals':31,'19-documents-notifications':42,
  '02-foundation-structure':25
})){
  const task=get('specs/initiatives/careganga-foundation-platform/modules/cg-'+owner+'/tasks.md');
  const ids=new Set([...task.matchAll(/\bUS-\d{3}-QA\d{2}\b/g)].map(x=>x[0]));
  total+=ids.size;
  check('Canonical '+owner+' QA definitions: '+expected,ids.size===expected);
}
check('Total canonical Foundation QA definitions: 165',total===165);
for(const c of checks)console.log((c.ok?'SOURCE_OK':'SOURCE_FAIL')+': '+c.label);
console.log('Static source checks '+checks.filter(x=>x.ok).length+'/'+checks.length+
  ', QA definitions '+total+'. RUNTIME/DEVICE/POSTGRES/PROVIDER QA: NOT_RUN.');
if(checks.some(x=>!x.ok))process.exitCode=1;
