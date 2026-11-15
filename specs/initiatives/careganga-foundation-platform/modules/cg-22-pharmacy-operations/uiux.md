# CG-22 — UI/UX: Partner Pharmacy Price Catalog and Optional Operations

**Original evidence:** H11 Pharmacy & Medicine Management, H12 Medicine Pricing & Discount, H02/H05 approved center service, H23 system. Reuse original CareGanga nav/blue selected state/navy sidebar, KPI cards, center/category/status filters, table/pagination, right-side medicine panel, tabbed stock/batch/pricing/history, original responsive and accessible status/motion tokens. Actual visual pixel/video/motion QA NOT_RUN.

**US-001 always available for approved pharmacy partner:** Foundation Admin price master, versioned approvals, center mapping and current verified priced catalog in scoped Center Portal. Public Web/Public Android show only verified priced service information and enquiry, not medicine checkout/stock availability. No invented clinical prescription.

**US-002 under ERP flag:** Show H11 per-medicine batch stock and available/reserved/reorder/expiry, stock-movement detail, human-safe batch code. Disable Create/Adjust/Transfer if global flag OFF, center grant denied, role denied or migration not ready; backend rejects direct calls, no native private inventory menus.

**US-003 under ERP flag:** Scoped supplier, purchase/GRN, transfer action/status and read-only historical audit; confirm irreversible receive with source reference and in-transit/cancel states, show pending reconciliation truthfully.

**US-004 under ERP flag:** Low stock, near expiry, recalled/quarantined badge, safe reviewer decisions and indexed source-derived counts, not screenshot mock figures. Only verified authorized view/export, no perpetual notifications when OFF.

**Across all cases:** Current Center A vs B denial, real loading/empty/unavailable/conflict/partial commit/role revoked, text scaling/accessibility/keyboard, narrow responsive right panel and original brand; no sample counts/hero stock allowed as real data; no new Internal Android ERP application. Story QA in tasks.md; runtime/device/PNG animation checks pending.
