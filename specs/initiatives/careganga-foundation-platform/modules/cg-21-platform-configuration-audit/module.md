# CG-21 — Platform Configuration Audit

### 2026-11-18 original client full website, Admin-managed field/visual and safe errors contract

**Authority:** [47 original screenshot page/route/content/UI reference](../../../../../docs/research/CAREGANGA-CLIENT-PUBLIC-WEBSITE-FULL-PAGE-PARITY-20261118.md) plus the approved pre-existing Admin screenshot audit. Requirement clarification for the **existing** CG-21 stories (no standalone visual builder or new business module).

**One Foundation Admin requirement:** Every authored public label/body/FAQ/SEO, approved visual banner/gallery/media placement, page/menu/footer CTA, validated contact/social/map links, newsletter explanatory copy, section ordering/visibility, and bounded colors/logo/theme variants is maintainable by a properly authorized Foundation Admin through **CG-18's existing editorial controls**. CG-21 only owns the platform-wide configuration policy, permissioned audit and editable safe field-level error-message catalog; don't reintroduce CG-18 website navigation settings into CG-21 or duplicate operational master data.

**Original UI/UX:** Match the real CareGanga gold/cream sticky header, green accents, orange Donate, original serif/sans editorial style, original distinct page layouts and branded nonblocking load/splash. Configuration must be limited to validated, accessible design tokens and rights-cleared media/links; no arbitrary Admin HTML, JavaScript or CSS execution. Preview must match actual published page, including mobile/narrow view, source-withdrawal and empty state, and observe reduced-motion preferences. Each Admin form produces accurate field-specific errors whose wording can be adjusted within CG-21 while keeping backend checks strict.

**QA/approval:** Test authorized editor vs reviewer/publisher roles, audit immutable change histories, forbidden toggle/permission escalation, invalid link/file/font/unsafe script rejection, override of editable error text without changing error code, source revocation, theme contrast/focus/responsiveness and 47 screenshot baseline. Runtime/mobile/visual, specialist security review and actual error-catalog mutation verification remain **NOT_RUN**; do not mark the previous CG-21 story/QA cases PASS.


**Canonical development order:** [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md) — required dependency/approval gate before selecting a story; a module may not import or rely on a later owner.

**Authority:** [PRD](../../prd.md) FR-075, FR-076, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md) CG-21-BR01–CG-21-BR06, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) C09, C10, C50, C51, C52, C53, C54, C55.  
**Stage:** Harness Planning / GREENFIELD · **Delegated design content decision (15 Nov 2026):** `DELEGATED_APPROVED` by **JASIQ AI Design Review Agent** under the owner's explicit "CG21 approved, mark it and move to next module" confirmation, after CG-01-benchmark source review/fix/re-review against latest PRD/HLD, Harness ec7c0b81 and C09/C10/C50–C55. All four CG-21 artifacts carry the same owner-confirmed content decision; 2 stories and 16 original QA IDs remain. **Formal development gate BLOCKED:** real CG-01 predecessor NOT_DELIVERED, latest PRD/HLD REVIEW_REQUIRED, authenticated local Harness resolver, independent CRITICAL DB review and runtime/visual QA NOT_RUN. No story READY.

uiux_decision: REQUIRED
uiux_reason: Privileged Foundation Admin Web settings, provider-readiness, central audit and backup/recovery views must preserve the CareGanga C09/C10/C50–C55 theme, motion, density, statuses and accessible responsive patterns. No separately owned Android screen.
dld_decision: REQUIRED
dld_reason: CRITICAL versioned setting+immutable history, root-scope credential reference and verification revisions, read-only owner-audit cursor, CG-01 current-password-confirmed recovery/idempotent external proof, index/migration/recovery obligations and scenario-based minimal pattern decisions require specific DLD; no duplicate identity, CG-01 audit or CG-03 approval authority.
database_impact: CRITICAL
database_reason: CRITICAL Foundation-root configuration and protected provider secret references require real uniqueness, immutable version history and account-scope guards; recovery requests can lead to irreversible destructive restore, so explicit authorization/verified external proof, concurrency-safe migration and independently reviewed recovery design are mandatory. CG-01 retains original access audit; CG-21 owns only its settings/recovery audit and permissioned source-federated presentation.
mobile_store_impact: NONE
mobile_store_reason: No owned native Android UI for this module; other consumers use the same backend.
mobile_dependency_audit: NOT_APPLICABLE; CG-21 does not change native app SDKs, plugins or store configuration. Existing Public/Internal Android only consume unchanged verified CG-01 protected identity/session contracts. A future mobile change must separately meet latest official store and dependency gates.

## Business owner and isolation

**Owns:** One versioned platform/system settings source, integration credential **references** and verified-readiness states, restricted audit **presentation** over genuine earlier owner events, own setting/recovery audit events, and privileged backup/recovery request/proof records. **Required real predecessor:** CG-01 completed account/session/current-password confirmation/permission and authoritative access audit, not merely a design. CG-01 independently owns password/session/current-password confirmation policy, its editor, grants, last-root protection **and the protected read facade of its original access audit**. CG-21 consumes only current authorization/current-password confirmation and permitted source-audit reads; it does not render CG-01's policy editor, status or controls. **Future owners:** CG-03/09/14/15/17/18 add genuine domain events/integrations when delivered; CG-18 controls actual public Login/Join/Volunteer visibility; no CG-03 approval case, CG-02 branch, future merchant/provider, CMS record or fake log may be needed to complete CG-21 initial work. Later owner supplies its cross-module QA. Unavailable external integration stays DISABLED/NOT_VERIFIED rather than falsely ready.

**State and invariant:** Configuration has one effective typed value per allow-listed key and real Foundation root; every accepted expected-version update writes an append-only source revision and redacted audit atomically. Integration status DISABLED/CONFIGURED_NOT_VERIFIED/VERIFIED/FAILED/UNAVAILABLE is bound to the current credential revision and actual check time; no check means NOT_VERIFIED, not payment/notification readiness. CG-21 central audit is a bounded permissioned read projection of actual CG-01 and CG-21 owner events, with unavailable feeds clearly disclosed; future owners contribute only when delivered. Recovery REQUESTED → PRIVILEGED_AUTHORIZED → RUNNING → VERIFIED_SUCCEEDED/FAILED/UNKNOWN requires a real secured backup/procedure and independently verifiable proof; no real facility yields NOT_AVAILABLE and no fictitious operation. CG-01 enforces root authority and fresh current-password confirmation; CG-21 only verifies required current CG-01 root authority and current-password confirmation; password/session/current-password confirmation configuration belongs in CG-01's own Web/Internal Android editor; no CG-03 approval dependency. All query/export/options/write calls are server scope-checked, redacted, conflict-guarded and fail closed.

## Scope and genuine prerequisite

**CG-21-owned capability only:** Allow-listed versioned nonsecret operational settings and historical revision; optional provider secret references and real on-demand readiness; only CG-21's own setting/recovery audit plus a protected read-only bounded projection of existing CG-01/CG-21 events; guarded recovery availability/request/status when an actual secured facility exists. The **sole real preceding module** is delivered CG-01 account/session/role/current-password confirmation/access audit. CG-21 US-001 precedes US-002. Core settings/audit remains independently testable with unconfigured optional providers.

**Owner exclusions, not CG-21 requirements:** CG-01-BR11/US-004 owns password/session/current-password confirmation policy and its Web/Internal Android editor; CG-02 owns legal Foundation identity; CG-18-BR09/US-001 owns three public Login/Member Join/Volunteer Join visibility controls; CG-19-BR03/US-002 owns messaging/delivery; financial owners own their actual financial effects. CG-21 has **no copies** of those tables, controls, stories, adapters or later-owner QA. Each later owner delivers and verifies its own audit projection when implemented.

**Independent done condition:** With only genuine CG-01 + CG-21 records, a current authorized root changes **audit.default_page_size** (default 25, allowed 10–100), sees one effective setting/revision and its actual effect on CG-21's capped central audit list, reads permitted CG-01 source-audit events via CG-01's already delivered reader, and sees truthful invalid/conflict/unavailable/partial states and (only for a genuine secured facility) an authorized recovery request. No future business owner, fake merchant/message/branch, optional provider account or unexecuted restore proof is needed.

## Complete PRD and BR mapping

- **FR-075/A-21:** Manage only typed versioned CG-21 operational settings and optional protected provider references/readiness; do not implement Foundation identity, public visibility, message delivery or payment effects
- **FR-076/A-21:** Show original delivered CG-01 + CG-21 events through an authorized bounded audit view; authorize actual backup/recovery availability/requests using current CG-01 Super Admin and fresh current-password confirmation

Detailed authoritative clauses:
- **CG-21-BR01:** Only versioned platform operational settings and optional protected integration configuration references (never CG-02 legal profile or CG-01 security policy).
- **CG-21-BR02:** Read-only protected owner audit projection; persist only CG-21 original setting/provider/recovery audit, not future owner events.
- **CG-21-BR03:** Provider configuration references and on-demand readiness, not CG-19 communication delivery or CG-09/17 payment transactions.
- **CG-21-BR04:** Provide controlled backup/restore access and a recovery operation model; restoration must not be available to routine staff.
- **CG-21-BR05:** Provide human-readable errors, status and operational controls that avoid silently swallowing backend failures.
- **CG-21-BR06:** Restrict recovery to currently authorized CG-01 protected Super Admin with fresh current-password confirmation and independent operations evidence; CG-01-BR11 separately owns password/session/current-password confirmation policy.

**Implementation/story dependency:** CG-21 US-001 owns the first real settings, credential-reference and source operation-audit persistence; CG-21 US-002 depends on US-001 for the CG-21 audit projection and recovery records. Both require delivered CG-01 root identity/current-password confirmation/CG-01 original access-audit facade, **not** later CG-03/02/CMS/center. No business-module parallel development is authorized before actual F0–F5 foundation delivery gates.

### 2026-11-16 authentication-proof update (owner-directed, pending design re-review)

CG-21 owns nonsecret versioned operational settings, external provider-reference/readiness and independent protected backup/recovery requests; CG-01 owns credential security and requires a current protected Super Admin with fresh current-password confirmation for authorized CG-21 changes. Restore also requires independent operations proof and version checks. CG-21 neither issues password reset OTP nor creates user accounts.

## First usable vertical contract and regression

**Concrete acceptance:** A permitted CG-01 Foundation Super Admin changes **audit.default_page_size** (integer 10–100, default 25) at an expected revision; the actual CG-21 Audit page uses the committed value while server-side max remains 100. Show one persisted effective version plus immutable history/CG-21 audit, and safely reject a conflicting write. Optional provider credentials use secret references only, invalidating old VERIFICATION when rotated; explicit check returns a real observed status or honest unavailability. Root-authorized audit pages/exports merge **original** CG-01 events with CG-21's own source events without copying sensitive audit; source feed outages are partial, not empty-success. A fresh current-password confirmation-protected recovery request/authorization may be recorded only with real policy/backup status; verified restoration requires separately authorized operational proof. CG-01 alone owns its password/session/current-password confirmation policy UI, backend enforcement, original event records and authorized reader; CG-21 never displays or edits those policy controls. No later module data or runtime-PASS claims are needed for this design.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: C09, C10, C50, C51, C52, C53, C54, C55. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.

## 18 November 2026 — original website receiving acceptance
Original visitor/admin routes: **all original public and Admin forms, including /membership /volunteer /contact**. Screenshots: **Batch02 021604–021739, Batch03 021809–022004, 167 original Admin screenshots**. Owner: one protected editable error/copy catalog shared by every source-owning API, Web and Android. See [47-screen original source contract](../../../../../docs/research/CAREGANGA-ORIGINAL-PUBLIC-SCREENSHOT-QA-TRACE-20261118.md). Existing US-001/002 retained; screenshot controls are not backend operation proof.


## 20-Nov-2026 client document/email v2 source-owner reconciliation

**Authority:** [five original designs](../../../../../docs/research/CAREGANGA-CLIENT-DOCUMENTS-REFERENCE-20261120.md) and [52-template email master](../../../../../docs/research/CAREGANGA-CLIENT-MASTER-EMAIL-V2-COVERAGE-20261120.md). Existing module stories and historic QA status unchanged; this is new client acceptance evidence, not delivered functionality.

CG-21 is the protected source for verified Foundation current Section 8/legal entity, PAN/CIN/TAN, 80G status, registered office(s), official phone/email/domain, logo versions, approved signer/seal and transactional sender configuration feeding CG19 PDF/email output. Client source has different office addresses and **Registered Trust** stamp vs Section 8 Company text: no sample should be treated as approved legal fact. Do not cut sample signature/logo/person out of personal artwork for public assets.

**Implementation gate:** Re-review changed module specification hashes; target genuine source owner, CG-19 issued PDF/delivery recipient and exact current role scope. Real integration / provider tests NOT_RUN.
