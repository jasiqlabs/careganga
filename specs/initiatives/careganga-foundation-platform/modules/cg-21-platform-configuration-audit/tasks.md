# CG-21 — User Stories & Manual QA

**Mandatory developer sequence:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — check completed predecessor modules and current Harness approvals before executing any story.

**Stage:** Harness Planning DRAFT aligned to corrected PRD/HLD v1.1; [module](module.md), [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), required [UIUX](uiux.md), [DLD](dld.md).  
**Development gate:** CG-21 source review and corrections COMPLETED (self-review disclosed); canonical PRD/HLD v1.1 current approval REVIEW_REQUIRED, authenticated pinned Harness resolver and current-hash module/task/UIUX/DLD delegated approvals NOT_RUN. Stories remain BLOCKED. Single executor implements one approved vertical task with manual expert source review/fix/re-review and each QA trace; no CI/GH Actions.

## Approved task definitions

**Approval truth:** These are still PROPOSED / NOT_YET_APPROVED despite the Harness-required heading. Do not mark READY until authenticated resolver and current-hash PRD/HLD/Planning/UIUX/DLD approval gates pass.

### US-001 — Manage versioned platform settings and verified integrations

Outcome: CG-01-authorized Foundation operator updates versioned typed platform settings, configures optional provider secret references and sees honest on-demand provider readiness; CG-02 Foundation profile and CG-18 public publication remain future-owned.
Requirements: FR-075, CG-21-BR01, CG-21-BR03, CG-21-BR05; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: Responsive Foundation Admin Web and one NestJS CG-21 owner/API/DB with genuine CG-01 root access and audit. Only typed settings, credential references and on-demand provider checks belong here; no native Android editor. CG-02/03/14/17/18 are not prerequisite masters or approval processes.
Acceptance: Authorized root actor saves real setting with expected-version CAS, one source audit and safe success; competing stale change fails with explicit CONFLICT. Provider readiness is VERIFIED only after genuine bounded on-demand verification, otherwise NOT_VERIFIED/FAILED/UNAVAILABLE. Secrets never appear in API, Web or logs. No future owner blocks root settings.
QA cases:
- **US-001-QA01:** On actual CG-01 root account with scope/grant, save and reread one typed CG-21 setting; verify version, single owner audit and accurate Web feedback without CG-02/03/18 records.
- **US-001-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-001-QA03:** Competing expected-revision writes/replay after lost response produce one accepted change and audit; losing write returns CONFLICT and refresh, never duplicate effect.
- **US-001-QA04:** Unknown key, wrong type, unconfigured optional provider or failed verification returns distinct VALIDATION/NOT_CONFIGURED/UNAVAILABLE; no fake VERIFIED status or unsafe retry of an unknown write.
- **US-001-QA05:** Protected typed API returns same effective version to authorized consumers; denied users receive no secrets. CG-18 publication and CG-02 legal profile remain unavailable until their actual owner delivers.
- **US-001-QA06:** Original CareGanga screenshot refs C09, C10, C50, C51, C52, C53, C54, C55, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-001-QA07 — owner-specific regression:** CG-01 root login/role/MFA/audit authority remains unchanged; secret rotation invalidates VERIFIED; false ready and stale setting conflicts fail without creating a second auth or audit ledger.
- **US-001-QA08 — secret and idle-cost:** Provider credential reference save succeeds but actual check fails → Configured/Not Verified, no secret exposed on reread/log/export, no fake checkout readiness. Zero pending checks cause zero CG-21 per-provider/tenant periodic scans on multiple instances; runtime egress remains NOT_MEASURED.
Verification: On actual implementation source-trace US-001-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

### US-002 — View source-owned audit and administer protected recovery

Outcome: Privileged root operator views redacted CG-01 and CG-21 original audit events through one protected read view and manages real CG-01-MFA-gated recovery requests with truthful provider/restore status; future modules provide events only after implementation.
Requirements: FR-076, CG-21-BR02, CG-21-BR04, CG-21-BR06; PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13.
Scope: Protected CG-21 Audit/Recovery responsive Foundation Admin Web, CG-01 access audit facade and active Super Admin/MFA, CG-21 owner audit and recovery record/API/DB. No native Android Admin screen and no dependence on future CG-03 approvals, CG-02 branches or nonexistent backup provider.
Acceptance: Read actual CG-01 and CG-21 events without copying CG-01 access audit to another table, paginate/export only authorized redacted projections and show missing future feeds as unavailable/partial. Fresh CG-01 Super Admin MFA gates recovery-request authorization. Without a real secured backup provider show NOT_AVAILABLE; verified restore success requires separate actual drill evidence.
QA cases:
- **US-002-QA01:** Generate genuine CG-01 role/session event and CG-21 setting event; authorized root sees them in one scoped read-only view with correct source/history. No second CG-01 audit ledger or invented CG-03/finance events.
- **US-002-QA02:** Wrong role, revoked user or out-of-scope actor attempts deep link, direct API, selector or export → backend denies with no protected data leak or unauthorized write; UI uses clear wording.
- **US-002-QA03:** Concurrent privileged recovery requests/authorizations and replay after ambiguous response result in one versioned authorized transition, not two restore effects; read current owner state first.
- **US-002-QA04:** Missing backup provider or actual restore evidence shows NOT_AVAILABLE/UNKNOWN; transient CG-01 audit source failure shows partial/unavailable feed, not an empty complete history or fake verified restore.
- **US-002-QA05:** Repeated root-authorized audit read is consistent; forbidden actor/export denied; nonexistent future owner audits not fabricated. Bound filter/sort/page and show partial feed accurately.
- **US-002-QA06:** Original CareGanga screenshot refs C09, C10, C50, C51, C52, C53, C54, C55, consistent existing palette, form/drawer/tab/table/motion tokens and responsive/native accessible states; exact rendered PNG/video comparison NOT_RUN.
- **US-002-QA07 — owner-specific regression:** Expired-MFA/revoked root, foreign-scope export and forged provider recovery proof are rejected. CG-01 original protected audit and revocation persist; no false RPO/RTO PASS.
- **US-002-QA08 — recovery and worker cost:** Ordinary staff direct restore and Super Admin absent recent MFA both fail with safe messages. Without real backup mechanism a root request returns NOT_AVAILABLE; actual isolated restore drill/runtime QA NOT_RUN. Audit is paged and has no idle full-table/owner fanout or unnecessary provider calls; billing/egress NOT_MEASURED.
Verification: On actual implementation source-trace US-002-QA01–QA08 UI→request→guard→DB/owner/provider→user feedback and record file:function and SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE per case. No live build/tests/screenshots.
Dependencies: None

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED, source/live/visual QA NOT_RUN, formal approval BLOCKED.
