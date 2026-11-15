# CG-22 — User stories and 48 source-specific manual QA scenarios

**Planning authority:** integrated healthcare BR CG-22-BR01–05; PRD FR-083/084; HLD §5.5; original H11/H12; module, DLD and UI/UX above. All FOUR stories design-only; implementation BLOCKED while current PRD/HLD/QA/critical DB/harness gates remain NOT_RUN. Development one vertical at a time with backend/owned SQL → Admin/Center Web/public-safe channel → manual source review/fix/re-review → every QA file:function result; no CI/GitHub Actions, no false live QA.

### US-001 — Medicine master, partner price and discount (ERP OFF independent)

**Outcome/acceptance:** Publish real approved medicine/pack/generic and effective dated MRP/quoted price/discount. No stock promise, sale or medical prescription. **Predecessor:** Actual approved CG-14 partner center only; no CG-15 patient, CG-17 benefit or ERP stock source. **DB:** medicine_master, center_medicine_price_revision. **API:** GET/POST /api/v1/pharmacy/catalog; GET /api/v1/public/pharmacy/approved-medicines. **Screens:** H12 Admin medicine pricing/Center Portal own approved pricing; public pharmacy enquiry only.

**Manual QA cases (each currently PLANNED / NOT_RUN):**
- **US-001-QA01:** Generic and branded medicine unique code/form/strength/pack with duplicate alias rejection.
- **US-001-QA02:** Verified pharmacy Center A approved price revision, MRP vs quoted amount, expiry and reset after date.
- **US-001-QA03:** Foundation reviewer accepts price but Center A staff cannot auto-approve, old revision immutable.
- **US-001-QA04:** Center B cannot edit or view private Center A quote, guessed medicine ref denied.
- **US-001-QA05:** Wrong-root doctor/patient role cannot list private price approval/export.
- **US-001-QA06:** Public price-only pharmacy enquiry with ERP OFF, no stock status/cart/checkout/dispense.
- **US-001-QA07:** H12 original filter/table/right pricing drawer responsive, validation/pending/approved states.
- **US-001-QA08:** Changed price concurrent revisions CAS, one effective price and historical snapshot.
- **US-001-QA09:** Invalid negative/MRP discount/overflow/currency/date/unsafe medicine text blocked.
- **US-001-QA10:** CG-17 optional benefit policy not treated as medicine discount automatically.
- **US-001-QA11:** Catalog active while all ERP flags false and no CG-15/17/20 owner code exists.
- **US-001-QA12:** Source trace DB/index/security/Admin/Center Portal/public; actual runtime/visual NOT_RUN.

**Verification:** Full scoped backend/source transaction/SQL/permission/current Web and applicable native public trace for US-001-QA01–QA12; actual runtime/SQL/migration/device/visual/clinical-lab tests NOT_RUN.

### US-002 — Per-center batches, stock and immutable movement (ERP ON only)

**Outcome/acceptance:** Receive initial verified batch and adjust/issue/reserve exact stock via unique idempotent transactions; never negative available or expired dispensing. **Predecessor:** US-001 real approved medicine, CG-14 authorized pharmacy center and global Pharmacy ERP enabled, current CG-01 permission. **DB:** pharmacy_batch, pharmacy_stock_movement, pharmacy_balance. **API:** POST /api/v1/pharmacy/batches; POST /api/v1/pharmacy/stock-adjustments; GET /api/v1/pharmacy/stock. **Screens:** H11 medicine inventory, stock/batches, low/near-expiry and right panel; no Public Android stock editor.

**Manual QA cases (each currently PLANNED / NOT_RUN):**
- **US-002-QA01:** Global Pharmacy ERP false or malformed denies inventory endpoints/jobs/navigation even to Super Admin.
- **US-002-QA02:** Approved active Center A + current role and true global flag writes one batch, Center B excluded.
- **US-002-QA03:** Exact expiry/batch/pack/quantity units and same-root composite FK constraints.
- **US-002-QA04:** Concurrent two last-stock reservations cannot oversell; row lock and balance invariants.
- **US-002-QA05:** Duplicate stock adjustment/issue retry one movement via unique original source digest.
- **US-002-QA06:** Out-of-stock, expired, quarantined or unapproved medicine cannot be issued.
- **US-002-QA07:** H11 right panel available/reserved/reorder level reconciles to immutable movement.
- **US-002-QA08:** Staff permission revoked after initial page load: direct write/read denied backend.
- **US-002-QA09:** Wrong-root fake center id, manipulated available balance or negative adjustment denied.
- **US-002-QA10:** No CG-12 Foundation item ledger or CG-09 expense changes from partner balance.
- **US-002-QA11:** Turning global OFF retains historical batch/movement for authorized audit, zero workers.
- **US-002-QA12:** Source trace DB migration/backup/explain, responsive Center Web and failure; runtime NOT_RUN.

**Verification:** Full scoped backend/source transaction/SQL/permission/current Web and applicable native public trace for US-002-QA01–QA12; actual runtime/SQL/migration/device/visual/clinical-lab tests NOT_RUN.

### US-003 — Partner supplier, purchase/GRN and in-network stock transfer (ERP ON only)

**Outcome/acceptance:** Approve supplier purchase, match partial GRN, reserve dispatch and accept transfer at legitimate destination with two linked immutable stock movements, not Foundation expense. **Predecessor:** US-002 posted pharmacy stock; genuine approved same partner-center locations. CG-12 Foundation inventory not a prerequisite. **DB:** pharmacy_supplier, pharmacy_purchase, pharmacy_grn, pharmacy_transfer. **API:** POST /api/v1/pharmacy/purchases; POST /api/v1/pharmacy/grns; POST /api/v1/pharmacy/transfers; POST /api/v1/pharmacy/transfers/:ref/receive. **Screens:** H11 Purchase & GRN, Supplier, Stock Transfer submenu; own-center ERP portal.

**Manual QA cases (each currently PLANNED / NOT_RUN):**
- **US-003-QA01:** Partner pharmacy supplier real own-center identity and protected bank/contract scope.
- **US-003-QA02:** Wrong root or Center B supplier lookup, purchase update, invoice evidence denied.
- **US-003-QA03:** Purchase request/approved/ordered state and genuine optional CG-03 approval.
- **US-003-QA04:** GRN matched to correct purchase/medicine/batch/quantity/expiry, partial receipt possible.
- **US-003-QA05:** Two simultaneous GRNs cannot over-receive remaining approved quantity.
- **US-003-QA06:** Repeat GRN callback idempotent, original movement and stock increment once.
- **US-003-QA07:** Stock transfer reserves source quantity; destination must belong to permitted same partner.
- **US-003-QA08:** Transit and destination receive split, loss/cancel/reconcile do not duplicate balance.
- **US-003-QA09:** Duplicate delivery/late acceptance creates at most one destination receipt movement.
- **US-003-QA10:** H11 supplier, purchase/GRN, transfer Admin and Center Portal actions with source status.
- **US-003-QA11:** No automatic Foundation voucher/CG-12 stock purchase; external accounting unavailable truthfully.
- **US-003-QA12:** ERP OFF denies new suppliers/receipts/transfers, retains authorized historical source trace.

**Verification:** Full scoped backend/source transaction/SQL/permission/current Web and applicable native public trace for US-003-QA01–QA12; actual runtime/SQL/migration/device/visual/clinical-lab tests NOT_RUN.

### US-004 — Expiry, quarantine, recall and pharmacy ERP operation reports (ERP ON only)

**Outcome/acceptance:** Quarantine/release with permitted reviewer, block expired/flagged batch issues and show source-derived scoped low-stock/expiry/recall without perpetual poll. **Predecessor:** US-002 real stock/batches and US-003 for real source transfer reports; no future CG-20 MIS prerequisite. **DB:** pharmacy_batch_status_event, existing immutable movement projections. **API:** POST /api/v1/pharmacy/batches/:ref/quarantine; POST .../release; GET /api/v1/pharmacy/reports/expiries. **Screens:** H11 stock/expiry/recall details and H12 effective price history; Foundation authorized audit.

**Manual QA cases (each currently PLANNED / NOT_RUN):**
- **US-004-QA01:** Original batch near-expiry/expired and quarantined eligibility at server current date.
- **US-004-QA02:** Authorized quarantine records reason/reviewer/event, stock issue blocked immediately.
- **US-004-QA03:** Release from quarantine requires current policy and cannot release already expired lot.
- **US-004-QA04:** Recall affected stock across center locations, current pending transfers handled safely.
- **US-004-QA05:** Bulk action scoped to verified center with count preview and audit, no mass tenant update.
- **US-004-QA06:** Two reviewers race status/version; one accepted immutable event, other conflict.
- **US-004-QA07:** Expiry/reorder alerts bounded indexed due work, zero eligible jobs means zero scans.
- **US-004-QA08:** H11 low/near expiry counts reflect genuine batch and stock not sample screenshots.
- **US-004-QA09:** Price change H12 never secretly clears stock quarantine or alters posted movement.
- **US-004-QA10:** Export includes source stock/expiry/recall with masked commercial evidence by role.
- **US-004-QA11:** Global switch OFF stops new alert jobs/commands but retained reviewable history.
- **US-004-QA12:** Source QA original CG-14 center, pharmacy DB, API, responsive Web, NFR/restore NOT_RUN.

**Verification:** Full scoped backend/source transaction/SQL/permission/current Web and applicable native public trace for US-004-QA01–QA12; actual runtime/SQL/migration/device/visual/clinical-lab tests NOT_RUN.

## Execution progress
- US-001: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source cases designed; formal harness/runtime/SQL/visual QA NOT_RUN.
- US-002: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source cases designed; formal harness/runtime/SQL/visual QA NOT_RUN.
- US-003: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source cases designed; formal harness/runtime/SQL/visual QA NOT_RUN.
- US-004: BLOCKED | PLANNING_DRAFT_ONLY; implementation NOT_STARTED; 12 source cases designed; formal harness/runtime/SQL/visual QA NOT_RUN.
