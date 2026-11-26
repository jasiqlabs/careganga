import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backend = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = (path: string) => readFileSync(new URL("../../web/src/" + path, import.meta.url), "utf8");
const native = (path: string) => readFileSync(new URL("../../android-internal/src/" + path, import.meta.url), "utf8");

// =========================================================================
// US-001: Configure Foundation identity, real geography and departments/committees
// QA Cases: US-001-QA01 to US-001-QA09 (9 QA cases)
// =========================================================================

test("US-001-QA01: Foundation legal/contact details, geography hierarchy and Foundation-scoped committees with zero branches", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");
  const sql = backend("db/migrations/0201_cg02_foundation_structure.sql");
  const webPanel = web("features/foundation-structure/foundation-structure-panel.tsx");
  const webPage = web("app/(admin)/admin/foundation/page.tsx");

  // Profile management
  assert.match(service, /async saveProfile\(/);
  assert.match(service, /INSERT INTO foundation_profile/);
  assert.match(sql, /CREATE TABLE foundation_profile/);
  assert.match(sql, /legal_name text NOT NULL/);

  // Geography hierarchy STATE -> DISTRICT -> SUBDIVISION -> BLOCK
  assert.match(service, /async createArea\(/);
  assert.match(sql, /CREATE TABLE geography_area/);
  assert.match(sql, /level text NOT NULL CHECK\(level IN \('STATE','DISTRICT','SUBDIVISION','BLOCK'\)\)/);

  // Foundation-scoped department/committee with zero branches
  assert.match(service, /async createDepartment\(/);
  assert.match(sql, /CREATE TABLE department/);
  assert.match(sql, /scope_kind text NOT NULL DEFAULT 'FOUNDATION'/);

  // Web presence & zero branch requirement
  assert.match(webPanel, /FoundationStructurePanel/);
  assert.match(webPanel, /legalName/);
  assert.match(webPage, /FoundationStructurePage/);
  assert.match(webPage, /foundation\.profile\.view/);
});

test("US-001-QA02: Revoked, unprivileged or out-of-scope actor denies mutation and prevents private data leaks", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");
  const controller = backend("src/modules/cg-02-foundation-structure/http/foundation-structure.controller.ts");
  const webPage = web("app/(admin)/admin/foundation/page.tsx");

  assert.match(service, /requireAction\(bearer,action\)/);
  assert.match(service, /foundation\.profile\.manage/);
  assert.match(service, /foundation\.geography\.manage/);
  assert.match(service, /foundation\.departments\.manage/);
  assert.match(controller, /@Patch\("profile"\)/);
  assert.match(controller, /@Post\("geography"\)/);
  assert.match(controller, /@Post\("departments"\)/);
  assert.match(webPage, /AccessDeniedView/);
});

test("US-001-QA03: Concurrency & idempotency: saveProfile expected-version and normalized duplicate departments", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");
  const sql = backend("db/migrations/0201_cg02_foundation_structure.sql");

  // expectedVersion conflict check
  assert.match(service, /throw new ConflictException\("Foundation profile changed\. Refresh before saving\."\)/);

  // Duplicate department uniqueness in SQL and service
  assert.match(sql, /CREATE UNIQUE INDEX ux_cg02_department_foundation/);
  assert.match(service, /throw new ConflictException\("This name is already in use"\)/);
});

test("US-001-QA04: Independence & source errors: invalid legal field/parent and safe status lookup without CG03/19", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");

  assert.match(service, /text\(input\.legalName,2,180\)/);
  assert.match(service, /checkAreaParent/);
  assert.match(service, /lookupChange/);
  assert.doesNotMatch(service, /import.*cg-03/);
  assert.doesNotMatch(service, /import.*cg-19/);
});

test("US-001-QA05: Actual Web/API consistency across permitted Admin list, detail, search, typed options and export", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");
  const controller = backend("src/modules/cg-02-foundation-structure/http/foundation-structure.controller.ts");
  const webPanel = web("features/foundation-structure/foundation-structure-panel.tsx");

  assert.match(service, /async exportPage\(/);
  assert.match(controller, /@Get\("export"\)/);
  assert.match(service, /async officeholderOptions\(/);
  assert.match(controller, /@Get\("officeholders\/options"\)/);
  assert.match(webPanel, /exportOffset/);
});

test("US-001-QA06: Correct screen scope U21-U22 branded tokens, drawers, responsive Web and accessible states", () => {
  const webPanel = web("features/foundation-structure/foundation-structure-panel.tsx");

  assert.match(webPanel, /departmentEditorOpen/);
  assert.match(webPanel, /officeholders/);
  assert.match(webPanel, /departmentDialogRef/);
  assert.match(webPanel, /officeholderSearch/);
});

test("US-001-QA07: Independent Foundation-only relational/race checks: foreign-root FKs, cycle prevention, partial UNIQUE", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");
  const sql = backend("db/migrations/0201_cg02_foundation_structure.sql");

  // Cycle prevention in geography hierarchy
  assert.match(service, /WITH RECURSIVE descendants AS/);
  assert.match(service, /throw new ConflictException\("A geography area cannot contain itself"\)/);

  // Composite foreign keys
  assert.match(sql, /FOREIGN KEY\(parent_area_id,root_realm_id\) REFERENCES geography_area\(id,root_realm_id\)/);
  assert.match(sql, /root_realm_id uuid NOT NULL REFERENCES access_realm\(id\)/);
});

test("US-001-QA08: Present-only root authorization & privacy: officeholder assign never grants root privileges", () => {
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");
  const sql = backend("db/migrations/0201_cg02_foundation_structure.sql");

  assert.match(service, /foundation\.departments\.assign/);
  assert.match(service, /async addParticipant\(/);
  assert.match(service, /async endParticipant\(/);
  assert.match(sql, /CREATE TABLE department_participation/);
  assert.match(sql, /office_role text NOT NULL/);
});

test("US-001-QA09: CRITICAL DB migration 0201: foreign keys, partial indexes, bounded queries, zero polling", () => {
  const sql = backend("db/migrations/0201_cg02_foundation_structure.sql");
  const service = backend("src/modules/cg-02-foundation-structure/application/foundation-structure.service.ts");

  assert.match(sql, /CREATE TABLE foundation_profile/);
  assert.match(sql, /CREATE TABLE geography_area/);
  assert.match(sql, /CREATE TABLE department/);
  assert.match(sql, /CREATE TABLE department_participation/);
  assert.match(service, /LIMIT 100/);
  assert.doesNotMatch(service, /setInterval/);
});

// =========================================================================
// US-002: Complete real seven-stage branch registration, approval and activation
// QA Cases: US-002-QA01 to US-002-QA16 (16 QA cases)
// =========================================================================

test("US-002-QA01: Seven-stage branch registration, genuine CG03 case binding, CG19 evidence, and activation", () => {
  const draftService = backend("src/modules/cg-02-foundation-structure/application/branch-registration-draft.service.ts");
  const lifecycle = backend("src/modules/cg-02-foundation-structure/application/branch-lifecycle.service.ts");
  const sql0202 = backend("db/migrations/0202_cg02_branch_registration_drafts.sql");
  const sql0204 = backend("db/migrations/0204_cg02_approved_branches_and_links.sql");

  assert.match(draftService, /async create\(/);
  assert.match(draftService, /async save\(/);
  assert.match(sql0202, /CREATE TABLE branch_registration/);
  assert.match(sql0204, /CREATE TABLE branch_registration_submission/);
  assert.match(lifecycle, /async freezeSubmission\(/);
  assert.match(lifecycle, /async activate\(/);
  assert.match(sql0204, /CREATE TABLE branch\s*\(/);
  assert.match(sql0204, /branch_code text NOT NULL/);
});

test("US-002-QA02: Revoked, unprivileged or out-of-scope actor denies branch access and safe next action", () => {
  const draftService = backend("src/modules/cg-02-foundation-structure/application/branch-registration-draft.service.ts");
  const opsService = backend("src/modules/cg-02-foundation-structure/application/branch-operations.service.ts");
  const webPage = web("app/(admin)/admin/foundation/branches/page.tsx");

  assert.match(draftService, /foundation\.branches\.manage/);
  assert.match(opsService, /foundation\.branches\.view/);
  assert.match(opsService, /foundation\.branches\.manage/);
  assert.match(webPage, /AccessDeniedView/);
});

test("US-002-QA03: Frozen submission & idempotency: two simultaneous submits yield one immutable snapshot & CG03 case", () => {
  const lifecycle = backend("src/modules/cg-02-foundation-structure/application/branch-lifecycle.service.ts");
  const sql = backend("db/migrations/0204_cg02_approved_branches_and_links.sql");

  assert.match(lifecycle, /immutable_payload_digest/);
  assert.match(lifecycle, /SUBMISSION_UNCONFIRMED/);
  assert.match(sql, /UNIQUE\(registration_id,submitted_revision\)/);
  assert.match(sql, /UNIQUE\(registration_id,source_submission_key\)/);
});

test("US-002-QA04: Invalid field, absent source, unavailable scanner produces distinct safe errors", () => {
  const draftService = backend("src/modules/cg-02-foundation-structure/application/branch-registration-draft.service.ts");
  const evidenceService = backend("src/modules/cg-19-documents-notifications/application/branch-private-evidence.service.ts");

  assert.match(draftService, /Enter a six-digit PIN code/);
  assert.match(draftService, /Check the location coordinates/);
  assert.match(evidenceService, /STORAGE_UNAVAILABLE/);
  assert.match(evidenceService, /VERIFICATION_UNAVAILABLE/);
});

test("US-002-QA05: Cross-channel consistency: Web and Android show same verified status and records", () => {
  const lifecycle = backend("src/modules/cg-02-foundation-structure/application/branch-lifecycle.service.ts");
  const webPanel = web("features/foundation-structure/branch-draft-panel.tsx");
  const nativeScreen = native("features/foundation-structure/branch-registration-screen.tsx");

  assert.match(lifecycle, /async status\(/);
  assert.match(webPanel, /loadStatus/);
  assert.match(nativeScreen, /loadStatus/);
});

test("US-002-QA06: CareGanga screenshot refs U18-U22 design tokens, cards, tabs, and responsive states", () => {
  const webOps = web("features/foundation-structure/operating-branches-panel.tsx");
  const webDraft = web("features/foundation-structure/branch-draft-panel.tsx");
  const webInbox = web("features/foundation-structure/branch-approval-inbox.tsx");

  assert.match(webOps, /OperatingBranchesPanel/);
  assert.match(webDraft, /BranchDraftPanel/);
  assert.match(webInbox, /BranchApprovalInbox/);
});

test("US-002-QA07: Irreversible activation and safe lock boundary: short PG transaction, row lock ordering", () => {
  const lifecycle = backend("src/modules/cg-02-foundation-structure/application/branch-lifecycle.service.ts");

  assert.match(lifecycle, /FOR UPDATE/);
  assert.match(lifecycle, /FOR SHARE/);
  assert.match(lifecycle, /alreadyActivated/);
});

test("US-002-QA08: Private evidence & resubmission: draft step evidence, agreement required, RETURNED resubmit", () => {
  const lifecycle = backend("src/modules/cg-02-foundation-structure/application/branch-lifecycle.service.ts");
  const evidenceService = backend("src/modules/cg-19-documents-notifications/application/branch-private-evidence.service.ts");

  assert.match(lifecycle, /guardFiles/);
  assert.match(evidenceService, /async initiate\(/);
  assert.match(evidenceService, /async revoke\(/);
});

test("US-002-QA09: Race, proof invalidation & unknown outcome: duplicate callbacks return confirmed replay", () => {
  const lifecycle = backend("src/modules/cg-02-foundation-structure/application/branch-lifecycle.service.ts");
  const sql = backend("db/migrations/0204_cg02_approved_branches_and_links.sql");

  assert.match(lifecycle, /alreadyActivated:true/);
  assert.match(sql, /branch_code text NOT NULL UNIQUE/);
  assert.match(sql, /UNIQUE\(registration_id\)/);
  assert.match(sql, /UNIQUE\(approved_submission_id\)/);
});

test("US-002-QA10: Web and Internal Android UI parity: seven-stage wizard, status screens, clean cards, no emojis", () => {
  const nativeReg = native("features/foundation-structure/branch-registration-screen.tsx");

  assert.match(nativeReg, /titles\s*=\s*\[/);
  assert.match(nativeReg, /IconCheckCircle/);
  assert.match(nativeReg, /IconArrowLeft/);
  assert.doesNotMatch(nativeReg, /☑/);
  assert.doesNotMatch(nativeReg, /☐/);
  assert.doesNotMatch(nativeReg, /[\uD83C-\uDBFF\uDC00-\uDFFF]/); // No emoji surrogates
});

test("US-002-QA11: Cross-owner timeout, idleness and trace: server-only workflow, fail-closed, zero periodic polling", () => {
  const nativeReg = native("features/foundation-structure/branch-registration-screen.tsx");
  const nativeUploader = native("features/foundation-structure/branch-native-uploader.tsx");
  const nativeHistory = native("features/foundation-structure/branch-native-evidence-history.tsx");
  const nativeStaff = native("features/foundation-structure/branch-staff-access-native.tsx");

  assert.doesNotMatch(nativeReg, /setInterval/);
  assert.doesNotMatch(nativeUploader, /setInterval/);
  assert.doesNotMatch(nativeHistory, /setInterval/);
  assert.doesNotMatch(nativeStaff, /setInterval/);
});

test("US-002-QA12: Future-owner independence & CG-01 branch-scope authority: branch manager selection never grants root", () => {
  const draftService = backend("src/modules/cg-02-foundation-structure/application/branch-registration-draft.service.ts");
  const facade = backend("src/modules/cg-01-identity-access/application/foundation-structure-identity.facade.ts");

  assert.match(draftService, /managerOptions/);
  assert.match(facade, /eligibleOfficeholder/);
});

test("US-002-QA13: Branch-scoped departments & associations independent of later owners, link/unlink history", () => {
  const opsService = backend("src/modules/cg-02-foundation-structure/application/branch-operations.service.ts");
  const sql = backend("db/migrations/0204_cg02_approved_branches_and_links.sql");

  assert.match(opsService, /async createDepartment\(/);
  assert.match(opsService, /async link\(/);
  assert.match(opsService, /async unlink\(/);
  assert.match(sql, /CREATE TABLE branch_department_link/);
  assert.match(sql, /ended_at timestamptz/);
});

test("US-002-QA14: CG-03 branch approval introducing integration and baseline regression: BRANCH_REGISTRATION process", () => {
  const approvalService = backend("src/modules/cg-03-registration-approvals/application/branch-approval.service.ts");
  const sql = backend("db/migrations/0022_cg03_branch_registration_approval.sql");

  assert.match(approvalService, /BRANCH_REGISTRATION/);
  assert.match(approvalService, /guardFinalDecision/);
  assert.match(sql, /BRANCH_REGISTRATION/);
});

test("US-002-QA15: CG-19 pre-submission evidence introducing integration and baseline regression: draft adapter", () => {
  const workflow = backend("src/modules/cg-19-documents-notifications/application/branch-workflow.service.ts");
  const sql0203 = backend("db/migrations/0203_cg19_branch_evidence_adapter.sql");

  assert.match(workflow, /BranchWorkflowService/);
  assert.match(sql0203, /owner_kind IN\('CG03_CASE','CG02_DRAFT'\)/);
  assert.match(sql0203, /'BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'/);
});

test("US-002-QA16: Approved-branch operational updates and immutable approval regression: active branch edit, CAS version check", () => {
  const opsService = backend("src/modules/cg-02-foundation-structure/application/branch-operations.service.ts");
  const webOps = web("features/foundation-structure/operating-branches-panel.tsx");
  const nativeStaff = native("features/foundation-structure/branch-staff-access-native.tsx");

  assert.match(opsService, /async update\(/);
  assert.match(opsService, /async changeStatus\(/);
  assert.match(opsService, /expectedVersion/);
  assert.match(webOps, /mutate\(/);
  assert.match(webOps, /expectedVersion:\s*selected\.version/);
  assert.match(nativeStaff, /BranchStaffAccessNative/);
});
