# CG-22 — Partner Pharmacy Catalog & Optional Operations ERP

**Authority:** Integrated Healthcare BR §12 CG-22-BR01–05, PRD FR-083/084, HLD §5.5, decision D-23/26–28, Admin visual H11/H12. **Planning stage:** DESIGN_SOURCE_REVIEW_REQUIRED; user-approved scope but code/SQL/device/runtime/independent clinical/legal QA NOT_RUN. Default global ERP disabled; Foundation partner functions remain active. No GitHub Actions.

uiux_decision: REQUIRED; dld_decision: REQUIRED; database_impact: CRITICAL; mobile_store: NO_NEW_INTERNAL_ANDROID_ERP_APP.

## Business ownership and independent build slices

CG-22 uniquely owns one approved medicine display master, versioned partner pharmacy pricing, and (only with ERP ON) partner batch/movement/GRN/supplier/transfer/recall. **Never own** CG-14 provider/center/service/licensing, CG-15 patient, CG-17 patient contributions/settlement, CG-09 Foundation journal, CG-12 Foundation inventory/supplier, CG-19 file bytes, or CG-01 role/identity. CG-22 is one modular-monolith domain, one PostgreSQL history, one typed NestJS API, reused CareGanga original design tokens. Pharmacy price catalog is meaningful with inventory ERP OFF; remaining stories operate only with global default OFF switched ON and approved actual center grant. No sale/medicine delivery/insurance claims engine is inferred.

### US-001 — Medicine master, partner price and discount (ERP OFF independent)

**Outcome:** Publish real approved medicine/pack/generic and effective dated MRP/quoted price/discount. No stock promise, sale or medical prescription.

**Predecessor:** Actual approved CG-14 partner center only; no CG-15 patient, CG-17 benefit or ERP stock source.

**Backend/DB:** medicine_master, center_medicine_price_revision; **API:** GET/POST /api/v1/pharmacy/catalog; GET /api/v1/public/pharmacy/approved-medicines; **UI/UX:** H12 Admin medicine pricing/Center Portal own approved pricing; public pharmacy enquiry only. Full story acceptance and 12 QA are in [tasks.md](tasks.md).

### US-002 — Per-center batches, stock and immutable movement (ERP ON only)

**Outcome:** Receive initial verified batch and adjust/issue/reserve exact stock via unique idempotent transactions; never negative available or expired dispensing.

**Predecessor:** US-001 real approved medicine, CG-14 authorized pharmacy center and global Pharmacy ERP enabled, current CG-01 permission.

**Backend/DB:** pharmacy_batch, pharmacy_stock_movement, pharmacy_balance; **API:** POST /api/v1/pharmacy/batches; POST /api/v1/pharmacy/stock-adjustments; GET /api/v1/pharmacy/stock; **UI/UX:** H11 medicine inventory, stock/batches, low/near-expiry and right panel; no Public Android stock editor. Full story acceptance and 12 QA are in [tasks.md](tasks.md).

### US-003 — Partner supplier, purchase/GRN and in-network stock transfer (ERP ON only)

**Outcome:** Approve supplier purchase, match partial GRN, reserve dispatch and accept transfer at legitimate destination with two linked immutable stock movements, not Foundation expense.

**Predecessor:** US-002 posted pharmacy stock; genuine approved same partner-center locations. CG-12 Foundation inventory not a prerequisite.

**Backend/DB:** pharmacy_supplier, pharmacy_purchase, pharmacy_grn, pharmacy_transfer; **API:** POST /api/v1/pharmacy/purchases; POST /api/v1/pharmacy/grns; POST /api/v1/pharmacy/transfers; POST /api/v1/pharmacy/transfers/:ref/receive; **UI/UX:** H11 Purchase & GRN, Supplier, Stock Transfer submenu; own-center ERP portal. Full story acceptance and 12 QA are in [tasks.md](tasks.md).

### US-004 — Expiry, quarantine, recall and pharmacy ERP operation reports (ERP ON only)

**Outcome:** Quarantine/release with permitted reviewer, block expired/flagged batch issues and show source-derived scoped low-stock/expiry/recall without perpetual poll.

**Predecessor:** US-002 real stock/batches and US-003 for real source transfer reports; no future CG-20 MIS prerequisite.

**Backend/DB:** pharmacy_batch_status_event, existing immutable movement projections; **API:** POST /api/v1/pharmacy/batches/:ref/quarantine; POST .../release; GET /api/v1/pharmacy/reports/expiries; **UI/UX:** H11 stock/expiry/recall details and H12 effective price history; Foundation authorized audit. Full story acceptance and 12 QA are in [tasks.md](tasks.md).

## Global guard and acceptance

CAREGANGA_ERP_PHARMACY_ENABLED defaults false; only global enabled + code/migrations/QA ready + real CG-14 active center PHARMACY_ERP grant + current CG-01 permission/scope + verified prerequisites permits US-002–004 operations. False: no ERP screens/commands/workers/export, price-only Core US-001 still works, no data deletion; Center A may be ON while Center B OFF. Financial charges only via actual CG-17 optional policy and any original CG-09 Foundation posting; partner purchases are never Foundation income/expense. UI reference H11/H12 theme, status, current KPIs and responsive original; pixel/video NOT_VERIFIED. Manual QA plans 4 × 12 = **48**.
