# CG-22 — Pharmacy user stories & source-level manual QA

**Authority:** [module.md](module.md), [dld.md](dld.md), [uiux.md](uiux.md), [PRD](../../prd.md) FR-081/083/084 (conditional FR-087 only if an independent true service exists), [HLD](../../hld.md) §5.5, integrated Healthcare BR CG-22-BR01–05, decisions D-23/26–28 and original indexed H11/H12. Exact H11/H12 image bytes currently unavailable; original common CareGanga U01 screen visually inspected. The desktop H11/H12 visual comparison remains source-reference PENDING, rendered Web/Android QA NOT_RUN.
**Mandatory delivery:** Read root AGENTS.md, current Harness checked pin and [DEVELOPMENT_ORDER.md](../../DEVELOPMENT_ORDER.md); use newest artifact even if draft. Implement one dependency-ready story vertically: authentic PostgreSQL migration/invariant, typed NestJS CG-01/14/03/19 owner guards, real responsive Admin/Center/public Web as applicable, Public Android/Internal Android for same actual audience, independent source review→fix→re-review→trace **every** QA case with actual file:function evidence. Do not run CI/GitHub Actions, and do not call source-only tracing runtime/device/clinical PASS.
**Design gate:** owner-delegated SHA-bound source design approved separately in initiative approvals ledger after review; authenticated local Harness resolver, qualified independent CRITICAL DB/pharmacy privacy/safety review, code implementation, migration/backup/restore, render/Android/device/Play and performance/egress QA NOT_RUN. No production pharmacy activation.

## Current owner-delegated task definitions — source design only
### US-001 — Medicine master, reviewed center-specific pricing and public enquiry (ERP OFF)

**Outcome/acceptance:** Create one real approved brand/generic/form/strength/pack medicine and versioned effective per-pharmacy MRP/quoted price/discount. Foundation admin and eligible own-center operator can prepare and review sources, and genuine public Web/Public Android can discover published approved price and enquire with all four ERP flags OFF; no patient, sale, stock, checkout or CG-17 need.

**Requirements:** FR-083, FR-081 OFF baseline; CG-22-BR01/05; H12; CG-NFR-600 privacy, versioning, Web/native UX and regulated product risk.

**Full story implementation:** CG-22 medicine_master and center_medicine_price_revision, typed NestJS public-safe and private guarded APIs, real CG-14 pharmacy association, optional genuine CG-03 PHARMACY_PRICE_REVISION approval source adapter if independent review is required, Foundation Admin and Center Portal responsive Web, public Next.js & native Public Android and matching assigned-Foundation price review in native Internal Android. No inventory tables required for this story.

**True dependencies:** Real CG-01 root/accounts/roles and real CG-14 verified pharmacy location/published directory when public listing; not CG-15, CG-17, CG-19 files, CG-20 MIS or global ERP ON.

**Manual source QA — planned, NOT executed:**
- **US-001-QA01 —** With real CG-14 approved Pharmacy Center A and CG-01 authorized catalogue editor, create normalized medicine generic, brand, form, strength, correct pack/base-unit and display identity; one source row appears in permitted Admin and own Center Portal without an ERP stock table.
- **US-001-QA02 —** Attempt duplicate same normalized product+pack code, invalid control chars, confusing duplicate alias, wrong generic/strength or unbounded text → server rejects/returns safe conflict; a legitimately distinct pack remains a distinct actual SKU.
- **US-001-QA03 —** Approve Center A 10-tablet pack priced from an actual MRP and quoted amount; show same pack/currency and mathematically consistent fixed or percentage discount in persisted revision, no float rounding mismatch or price on a different pack basis.
- **US-001-QA04 —** Create Center A and Center B separately reviewed rates for the same legal medicine → preserve independent per-center amounts and validity; never overwrite a global master price or leak Center B's private pending rate to A.
- **US-001-QA05 —** Create overlapping approved effective price windows at identical root/center/medicine/unit scope concurrently → DB exclusion/guarded revision allows one unambiguous effective rate; loser receives business conflict and old active accepted history stays immutable.
- **US-001-QA06 —** Edit an approved price after a real quote has been published → new DRAFT/PENDING revision with expected version, old historic revision remains intact and current published rate changes only after actual valid effective approval.
- **US-001-QA07 —** Price proposer tries to approve own protected revision despite required separation, forges CG-03 decision or applies stale decision digest → owner finalizer denies; only genuine CG-03 current-case approval or explicitly permitted independent CG-22 reviewer publishes once.
- **US-001-QA08 —** Enter negative money, overflow, discount greater than consistent MRP base, contradictory fixed/percentage arithmetic, unsupported currency, invalid valid_from/to or expired source → field-level rejection without mutated published data.
- **US-001-QA09 —** Current CG-01 operator without pharmacy grant, expired/suspended role, wrong Foundation root or unrelated Center B requests private create/list/detail/review/selector/export → backend denies; hidden UI alone is not permission.
- **US-001-QA10 —** Only real CG-14 PUBLISHED/VERIFIED pharmacy and CG-22 PUBLISHED effective medicine price appear on public website and native Public Android; unpublished provider, suspended center, draft/expired quote and protected supplier/batch details remain absent.
- **US-001-QA11 —** Revoke Center A publication or withdraw current price while public Web/native cache is stale → public price/enquiry invalidates/rechecks source and cannot promise the revoked discount or leak historical private price.
- **US-001-QA12 —** Run with all four ERP global flags OFF, no optional CG-15/17/20 service, no stock schema/module and only real CG-14 center → user completes medicine+price+public enquiry with no false disabled-cart or stock-select dependency.
- **US-001-QA13 —** Public source has verified pharmacy but no approved medicine/price → honest empty and price-unavailable message, not ₹0, fake sample medicine, stock Available or dummy Enquire success.
- **US-001-QA14 —** Public Enquire uses only the current real CG-14 published center contact or actual CG-19 support contact when implemented; an unverified/outdated contact or unavailable form cannot fabricate submitted ticket or pharmacy order.
- **US-001-QA15 —** Attempt to infer pharmacist prescription access or CG-17 20% medicine contribution from sample H12 price → prohibit unsupported clinical/sale/subsidy/benefit copy and any Foundation CG-09 receipt; lawful dispensing verification is separately gated.
- **US-001-QA16 —** Compare original H12 indexed controls and authentic U01 CareGanga shell with Foundation Admin H12 list/filter/right price detail, Center Portal own-center form/history, role-hidden action, loading/empty/pending/conflict and narrow responsive states; exact H12 pixels/motion NOT_RUN.
- **US-001-QA17 —** For same authorized Foundation price reviewer, native Internal Android supplies equivalent review/list/filters/history/approve/return or explicitly records an approved exception; Public Web and native Public Android have identical allowed search/detail/enquiry and accurate Back/keyboard/screen-reader statuses.
- **US-001-QA18 —** Trace SQL unique/FK/price interval index, short concurrent approval, current source-scope search limit, original CG-14 publication, retry/idempotency digest, audit/redacted logs and migration/restore; actual source code, DB device and Play review NOT_RUN.

**Verification rule:** On real source change trace every exact QA ID through actual UI/navigation → current CG-01/14 effective grant and owner facade → typed NestJS API/transaction → own PostgreSQL/current CG-03 or CG-19 source result → same authorized Web/native state. Record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE and fix/re-review; independent DB/race/clinical/device execution must remain NOT_RUN until separately performed.

### US-002 — Opening batch receipt, available/reserved stock and internal movements (ERP ON)

**Outcome/acceptance:** Under true current global ON, original approved CG-14 PHARMACY_ERP center grant and current qualified operator, receive verified opening batch stock without supplier/GRN predecessor, maintain auditable on_hand/reserved/available with immutable source effects and block negative or expired internal issue.

**Requirements:** FR-084, FR-081; CG-22-BR02/05; H11 and CG-NFR safety, DB CRITICAL, idle workers, rights.

**Full story implementation:** CG-22 pharmacy_batch, pharmacy_balance, pharmacy_stock_movement, pharmacy_reservation original data/transactions; typed stock/read/reserve/release/issue/adjust APIs; responsive Center Portal operational list+batch history and Foundation Admin guarded oversight/review, eligible Internal Android Foundation oversight; no public stock screens. No CG-12 or CG-09 partner accounting.

**True dependencies:** US-001 current actual approved medicine; real CG-14 qualified center+PHARMACY_ERP grant, true backend global flag and original CG-01 role. US-003 supplier/GRN NOT required for protected opening-stock proof.

**Manual source QA — planned, NOT executed:**
- **US-002-QA01 —** Set CAREGANGA_ERP_PHARMACY_ENABLED absent, malformed, string variation, or explicit false → backend stock/options/write/export/jobs fail closed; Center Portal/Foundation unauthorized ERP menu and direct guessed API unavailable, while US-001 public price works.
- **US-002-QA02 —** Set true in backend but no migrated module, suspended CG-14 pharmacy, expired license, missing current PHARMACY_ERP center grant or incorrect actor role → effective capability remains OFF/denied; no inherited Super Admin or generic employee stock right.
- **US-002-QA03 —** With true active licensed Center A, verified CG-01 operator and independent center grant, accept documented initial batch/opening source once; other independently OFF Center B still has no active ERP data or commands.
- **US-002-QA04 —** Persist actual manufacturer, lot, medicine, exact expiry and package/base-unit conversion; duplicate true manufacturer+lot+expiry+center maps existing same batch or rejects, while distinct manufacturer or location does not collide.
- **US-002-QA05 —** Enter a 2-pack opening count with pack_size=10 base units → exactly 20 base units on_hand, zero reserved; incompatible unit, fractional base count, overflow, negative or manipulated total rejected before DB effect.
- **US-002-QA06 —** US-003 not yet implemented and zero pharmacy suppliers exist → authorized opening stock proof remains independently usable without fabricated purchase/GRN or supplier ID, and current stock detail shows original opening provenance.
- **US-002-QA07 —** Reserve 7 of 20 actual base units by original operational purpose → available=13, reserved=7 and on_hand=20, one pharmacy_reservation and source-linked append-only movement; no patient e-commerce cart inferred.
- **US-002-QA08 —** Release 3 and later issue the exact allowed reserved amount → stock/reservation/movement obey on_hand≥reserved≥0 and available≥0, with one linked purpose and clear current Center Portal values.
- **US-002-QA09 —** Race 20 independent requests against the last 1 available base unit and two different approved operators → scoped lock/CAS accepts only permitted quantity once, other requests accurately return insufficient/conflict with no negative balance.
- **US-002-QA10 —** Retry lost acknowledgement for opening/adjustment/reservation/issue with same source line/effect key and digest → exactly one posted movement/balance; changed digest with reused idempotency key conflicts.
- **US-002-QA11 —** Adjustment down or up requires original actor reason and permitted reviewer where required; attempt to edit balance directly, delete movement, modify accepted lot or bypass approval → rejected/audit preserved.
- **US-002-QA12 —** Batch already expired at center-local day boundary, quarantined, recalled, not approved or unsuitable → current stock issue/reserve/transfer source method denies even if stale UI shows positive available; internal stock issue is NOT patient prescription/sale.
- **US-002-QA13 —** Actor previously approved moves center or loses role after opening Center Portal form → every options/stock/private history/detail/direct API rechecks CG-01+CG-14 scope and denies/revokes stale cache, leaving inventory unchanged.
- **US-002-QA14 —** While ERP ON, unauthorized Center B or other Foundation root guesses Center A batch/stock/export/history ref → query itself scoping prevents reading private lot/qty/supplier evidence, no broad role-derived selector leakage.
- **US-002-QA15 —** Disable ERP globally after posted stock: inventory history remains immutable for separately authorized protected audit, new stock commands/active search/workers denied; reactivation requires current grants and migration readiness, never reset balance to zero.
- **US-002-QA16 —** One partner stock change creates no CG-12 Foundation stock movement, CG-09 purchase voucher/expense, CG-17 patient charge or Foundation revenue; protected reconciliation is only CG-22 source.
- **US-002-QA17 —** Verify source H11 stock/batch/filter/detail and separate on_hand/reserved/available, expiry, current Center Portal/Authorized Admin Web, Internal Android Foundation-only permitted oversight; no public native inventory, exact H11 pixels NOT_RUN.
- **US-002-QA18 —** Disposable PostgreSQL original FK/CHECK/UNIQUE/CAS and movement-to-balance reconcile, last-unit stress, disable/restart/restore, bounded cursor/EXPLAIN, privacy logs, egress and no idle worker; code/device/SQL/perf execution NOT_RUN.

**Verification rule:** On real source change trace every exact QA ID through actual UI/navigation → current CG-01/14 effective grant and owner facade → typed NestJS API/transaction → own PostgreSQL/current CG-03 or CG-19 source result → same authorized Web/native state. Record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE and fix/re-review; independent DB/race/clinical/device execution must remain NOT_RUN until separately performed.

### US-003 — Partner supplier, verified purchase and partial goods receipt / GRN (ERP ON)

**Outcome/acceptance:** A real verified partner pharmacy can maintain its own lawful supplier, versioned purchase lines and genuine partially received GRN with batch provenance, while stock increments once and remains entirely outside Foundation procurement and accounting.

**Requirements:** FR-084, CG-22-BR03/05; H11 supplier and Purchase & GRN; CG-NFR finance isolation, privacy, DB/safety/concurrency.

**Full story implementation:** CG-22 pharmacy_supplier, pharmacy_purchase/purchase_line, pharmacy_grn/grn_line and original US-002 GRN_RECEIPT movement; original CG-19 protected invoice/evidence adapter registered by this owner where required, original CG-03 approval case when configured. Own Center Portal supplier/purchase/GRN and Foundation Admin restricted review, matching Internal Android review for same Foundation staff rights. No direct CG-12/09 file or journal.

**True dependencies:** Actual US-002 stock/movement, US-001 medicine, real authorized CG-14 pharmacy center/global ERP ON and current actor. No US-004 transfers, CG-17 patient or CG-20 MIS.

**Manual source QA — planned, NOT executed:**
- **US-003-QA01 —** Create genuine Center A scoped partner supplier with permitted name/license evidence/current status; reject normalized duplicate or unverified supplier for protected purchasing, no inferred CG-12 Foundation supplier.
- **US-003-QA02 —** Foundation or Center B operator without supplier.read/authorized center tries list/options/details/edit/export of Center A supplier, bank/license documents → server denies or safe-minimal labels, no data in logs/UI.
- **US-003-QA03 —** Attach actual validated supplier invoice/licence through original CG-19 protected source adapter when required; pending scan, revoked original document, unsupported MIME, wrong-root file or forged download is not accepted proof.
- **US-003-QA04 —** Create one purchase with multiple actual medicine SKUs, same pack/base unit and real supplier; quantity/price/currency per line, source version and original actor captured, no empty fake medicine options.
- **US-003-QA05 —** Submit and approve purchase under current configured review policy; proposer cannot self-approve protected amount, stale CG-03 case/source digest or replay cannot change pending purchase to approved.
- **US-003-QA06 —** Purchased unit_cost/MRP/valued inventory are partner's own operational numbers; creating or approving purchase must not write CG-09 Foundation voucher/cash or CG-17 patient/benefit, no made-up GST/tax.
- **US-003-QA07 —** Authorized own Center A operator enters first partial GRN (e.g. 4 of 10 base units) matched to approved original purchase line and manufacturer+lot+expiry; exactly one GRN_RECEIPT and own stock +4, remaining 6 accurate.
- **US-003-QA08 —** Receive final 6 in separate valid GRN → total accepted 10, purchase line Received and true two receipt history items; valid multiple lines in one GRN use distinct source_line IDs, never collision on generic GRN ID.
- **US-003-QA09 —** Two operators concurrently accept 7+7 on remaining approved 10 → one accepted or safe controlled partial only, total accepted never >10 and matching source movements once; no extra stock despite retries.
- **US-003-QA10 —** Replay duplicate same GRN line/event/callback/source digest after network lost → one receipt, one movement, one balance change and original success lookup; changed payload with reused event key conflicts.
- **US-003-QA11 —** Attempt receipt against wrong supplier, canceled purchase, unapproved line, foreign center batch, different medicine, negative qty, expired lot or manufactured-after-expiry date → validation/eligible quarantine and no sellable stock, original evidence retained safely.
- **US-003-QA12 —** Reject/return quantity or correct prior erroneous GRN with a new audited linked disposition/negative adjustment, not silent overwrite of original accepted movement or unapproved supplier credit.
- **US-003-QA13 —** CG-19 original protected invoice proof fails after accepted draft → show Evidence Pending/Rejected not stock Received, and never report successful attachment from a UI toast without server file confirmation.
- **US-003-QA14 —** Operator's role or pharmacy grant revoked after initial purchase screen loaded → new supplier/GRN/write and full private invoice lookup deny backend, previously confirmed valid original records survive audit.
- **US-003-QA15 —** Real multi-line partial invoice amount can be shown in own Center Portal and Foundation authorized oversight, but never counted as Foundation finance utilized/paid or automatic medicine-sale/patient receipt.
- **US-003-QA16 —** Review H11 Supplier → Purchase/GRN structured list, real status, own center filters, partial accepted vs outstanding, protected evidence and safe conflict/errors in responsive Center Portal/Admin; same Foundation-authorized approval/action in native Internal Android if offered to same audience.
- **US-003-QA17 —** With only actual US-002 batches, start-and-complete supplier/GRN story independently of future US-004 transfers/US-005 recall/C20; no mock missing master, guaranteed stock and old US-002 opening stock still works.
- **US-003-QA18 —** Inspect PostgreSQL same-root/center composite FKs, unique GRN line+effect, purchase-line locking, indexes, receipt-to-balance reconciliation/restore and privacy source trace; SQL/clinical/runtime/Web/native/AAB execution NOT_RUN.

**Verification rule:** On real source change trace every exact QA ID through actual UI/navigation → current CG-01/14 effective grant and owner facade → typed NestJS API/transaction → own PostgreSQL/current CG-03 or CG-19 source result → same authorized Web/native state. Record SOURCE_VERIFIED/SOURCE_GAP/NOT_VERIFIABLE and fix/re-review; independent DB/race/clinical/device execution must remain NOT_RUN until separately performed.

## Execution progress

- US-001–005: PLANNING_REVIEW_IN_PROGRESS, no source implementation on planning branch. Full five-story definitions will be SHA-reviewed after QA completion.
- Authenticated local Harness resolver, independent CRITICAL pharmacy/DB/legal review, migrations/restore, Web/native runtime/pixel/motion/Play, measured NFRs: NOT_RUN/NOT_MEASURED.
