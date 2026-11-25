# CareGanga — Separately Supplied Healthcare UI Screenshot References

**Reference family:** `CG-REF-HEALTHCARE-20261115` · **Source:** user-provided **separate healthcare UI screenshots** reviewed 15 November 2026, in addition to original 167-screen Foundation Admin ZIP and public website screenshots. Approximately 20 screenshots were supplied. The prior review explicitly enumerated **UI-06 through UI-24** (19 numbered IDs); the identity and layout of the remaining image are **not recoverable from the available source** and must not be invented.

**Evidence levels:** `USER_SUPPLIED_PREVIOUSLY` = separate healthcare screenshots genuinely existed in prior conversation. `TITLE_AND_MODULE_RECAP_RECOVERED` = screenshot screen purpose and module mapping can be recovered from previous reference review. `RAW_IMAGE_ACCESSIBLE` = **NO** in this current repository/available uploaded files; original screenshot filenames, pixels, typography, form positioning, button styles, motion, video timestamps and image checksums were not preserved alongside source. `ACTUAL_RENDERED_COMPARISON` = **NOT_RUN**. Do not claim exact pixel/mobile/client visual parity. Do not confuse the **Admin ZIP screenshots H01–Hxx** (shared admin shell/features) with this separate healthcare family `UI-06`–`UI-24`.

## 1. Healthcare screenshot-to-owner mapping

| Original screen reference | Recovered client screenshot screen purpose | Authoritative owning modules (do not duplicate) | CG-14 implementation and reference rule |
| --- | --- | --- | --- |
| UI-06 | **Doctor/Clinic Dashboard** | CG-14 current center/doctor source; CG-15 appointment counts; CG-17 contributions, CG-09 finance | In CG-14, show only actual approved doctor/center status and current source-derived fees; **no invented Today's Appointment, revenue, patient count, contribution or chart**. Future owners populate real dashboard cards. |
| UI-07 | **Doctor Registration & Profile** | **CG-14 US-003** | `DoctorOnboarding` (original one doctor ID, professional registration/jurisdiction, qualification, specialties, experience, safe bio), CG-19 licence scan, CG-03 independent verification. Match recovered form purpose and client visual identity; pixel layout NOT_VERIFIED. |
| UI-08 | **Doctor Schedule & Availability** | **CG-15** | CG-14 may show approved center opening days from its source but does **not** author slots, leave, booked/free calendars, or doctor availability. No dummy scheduling or enabled booking control. |
| UI-09 | **Consultation Fee & Contribution** | **CG-14 US-003** doctor-center immutable fee; **CG-17** Foundation benefit and patient payable calculation | `CenterDoctorFees` and `DoctorCenterManagement` manage real consultation/follow-up fees by actual center and effective date. CG-14 **must not show a claimed Foundation contribution or patient payable amount** before CG-17 provides a current approved outcome; source-directed fee read is allowed. |
| UI-10 | **OPD & Appointment Management** | **CG-15** booking/check-in, with clinical extensions owned separately | No CG-14 booking/OPD status/calendar simulation. |
| UI-11 | **OPD Clinical Records** | CG-15 patient record owner and future clinical record scope | No CG-14 patient medical data storage. |
| UI-12 | **Digital Prescription Management** | Future explicit clinical owner (not CG-14) | Reference retained; do not fabricate prescription builder. |
| UI-13 | **Diagnostic Referral & Lab Booking** | **CG-16** diagnostics + **CG-15** booking integration | Public CG-14 may show verified diagnostic-center *category*, not slots/orders. |
| UI-14 | **Lab Booking & Sample Collection** | **CG-16** | No lab collection status without installed source. |
| UI-15 | **Lab Report Upload & Verification** | **CG-16**, CG-19 document scan/storage adapter | Do not expose protected patient lab reports in public directory. |
| UI-16 | **Lab Tests & Pricing** | **CG-16** | Real CG-14 center service designation only; no speculative test pricing. |
| UI-17 | **Pharmacy Inventory Management** | **CG-22** optional ERP | CG-14 has only explicit fail-closed deployment/center permission; no inventory/stock routes or fake navigation. |
| UI-18 | **Medicine Sales & Dispensing** | **CG-22** optional ERP | Same ownership; no dispensing without proper ERP. |
| UI-19 | **Nursing Service Management** | **CG-23** optional ERP | Verified NURSING category may be listed; no nursing assignment/visit module in CG-14. |
| UI-20 | **OT Booking & Procedures** | **CG-24** optional ERP | No OT rooms/operational booking from CG-14. |
| UI-21 | **Finance & Accounts** | **CG-09** Foundation accounting, **CG-17** healthcare assistance/settlements | Real source-only CG-14 fee remains separate from finance postings. |
| UI-22 | **Title/content not recoverable from prior screenshot review** | **Undetermined; do not guess** | Preserve screenshot ID as unresolved reference. No new workflow from a guessed title. |
| UI-23 | **Approvals & Change Requests** | **CG-03** original cases, CG-14 request/revision source, CG-19 evidence | `HealthReviewInbox`, `CenterContentReviewInbox`, `CenterErpGrantReviews`; independent protected reviewer with separate Foundation publisher; no parallel approval master. |
| UI-24 | **Reports & MIS** | **CG-20** reports consuming real owner sources | No invented CG-14 chart or financial dashboard. |

**Other references across the same original healthcare series:** original multi-module requirements include Center & Branch Management, approved website/service listings, patient registration, appointments, finance/settlements, real fees and communication. Map those features to the canonical owner modules; do not assume their visual screen IDs from recovered screenshot titles. Specifically, **CG-14 US-001/002/004/005** independently require center/provider registration, original verification/publication, public center/doctor listings, photos/FAQ and Center Portal support even where an exact UI-06–UI-24 image is not identifiable. These must follow original healthcare reference intent and CareGanga's Admin/public branding.

## 2. Mandatory UI design precedence (no conflict)

1. **Separate healthcare screenshots UI-06–UI-24** are the first visual/interaction reference for matching healthcare workflow pages (once raw source images are available); use their real screen anatomy, field labels, content density, form ordering, navigation and interactions where the relevant module genuinely implements the action.
2. **Original 167 Admin screenshot ZIP** governs *shared Foundation Admin shell* — branded logo/nav, blue active sidebar, searchable categorized navigation, header, labels, cards, filters, tables, right drawers, statuses, actions, confirmation and permission hiding. It does **not** supersede the dedicated healthcare screen's workflow anatomy.
3. **Existing public CareGanga website and screenshots** govern public site branding/content/header/footer, not private healthcare clinical actions; native Public Android uses adaptive mobile controls and same exact approved healthcare API projection.
4. **Approved BR→PRD→HLD→DLD and actual module source owner** govern feature availability, security, permissions, actual records, integration, transitions and response content. A screenshot is **not** authorization to invent patient data, availability, discounts, transactions, ERP stock or unpublished clinical capabilities. Use correct own module.
5. For conflicts or missing original frames, record the gap and preserve current client branding; do **not** claim pixel parity or substitute AI-generated screenshot as client evidence.

## 3. CG-14 explicit implementation trace

- `US-001`: Foundation `ProviderOnboarding` with own center drafts, CG-19 proof and `CenterDraftPortal` (responsive), original Admin shell.
- `US-002`: `HealthReviewInbox` plus current approved/suspended Foundation publication and separate CG-03 reviewer.
- `US-003` **UI-07/UI-09**: `DoctorOnboarding`, `DoctorCenterManagement`, `CenterDoctorFees` with real approved immutable fees, proof, cross-center association and no invented contribution.
- `US-004` **healthcare public site intent**: `apps/web/src/app/health-network/page.tsx`, doctor/center details, `apps/android-public/src/features/health-network/public-healthcare-directory.tsx`, published-only safe directory; no appointment action until CG-15 is actually implemented.
- `US-005` **UI-23 independent approval intent**: `CenterContentEditor`, `CenterPhotoUploader`, original CG-19 support/photos/attachments, actual protected CG-03 review and separately permitted Foundation publication, source-bound unpublished/withdrawn history; optional ERP center grants always nonoperational while absent.

## 4. Required reference validation when original images accessible

Record a row for each originally uploaded screenshot with **the image's actual filename/asset ID, screen ID, repository or accessible source URI, canonical module owner, expected original page, captured application screenshot (Web 390/768/1440 px and Android small/large device), visual differences, exact text/field/control differences, animation/accessibility, actions verified, responsible owner, corrected source/commit, reviewer disposition**. No screenshot filename/URI/checksum may be fabricated. Update UI/UX/DLD/QA trace after comparing **actual pixels**. Keep `HEALTHCARE_SCREEN_VISUAL_PARITY=PENDING_ORIGINAL_IMAGE_AND_RUNTIME_QA` until genuine source assets and running app are compared.

**Current reviewed evidence:** Prior-conversation screen titles and 20-image reference batch are recoverable; original healthcare PNG/video file bytes are **not available** in the currently accessible GitHub tree, current conversation or personal CareGanga file folder (which has only the Admin ZIP). Original image-by-image layout/pixel matching is **NOT VERIFIED**. This reference map fixes source priority and module ownership now without pretending the historical images were rendered.

## 24 November 2026 — durable original-reference recovery

Private ChatGPT Library folder `/CareGanga/` is the first lookup location. All six original/derived archive bytes were materialized, ZIP contents inspected, and the following SHA-256 values computed locally:

| Private Library archive | SHA-256 |
|---|---|
| CareGanga-Original-Admin-Screenshots-Verified-20261115.zip | 8d077f8e1101ef7de73f65965730eb9058bed1b188cf075cd6968289202925fe |
| CareGanga-UIUX-Golden-Reference-Pack-20261115.zip | 727029fe1797180fec889b29f5ccd98ef52949e13044d09c7a5ba7dbabe0cb7d |
| CareGanga-Original-Public-Website-Visual-Reference-20261117.zip | 4a54e1b87ed82476b8a2c63cdc80e2d82900b9cf40f1cb0aab4200e05e555a4a |
| CareGanga-Original-Public-Website-Additional-Reference-20261118-Batch01.zip | 764e141b9395b464cdb5aa1031806ba8540758fc104fbebfcdac62e4c0c7a7ea |
| CareGanga-Original-Public-Website-Additional-Reference-20261118-Batch02.zip | e72131b80e1bbeaab84377f17bf3ef7dae1ce4807b6cc2c66dc2137825d68f2e |
| CareGanga-Original-Public-Website-Additional-Reference-20261118-Batch03.zip | 56c4582b49444ff8bdcacfc649a2fb6ab1bd50ab4354d8fa2eee130df84c1c89 |

The Golden pack manifest indexes exactly 167 source previews (A/B/C/U); U01–U10 and B34 include original critical PNGs. Four public archives contain 47 original captures. Admin/public contact sheets were visually inspected: white compact KPI/table workspaces, navy/blue navigation, drawers and public green/gold/cream brand. These are shared design evidence, not UI-06–UI-24 healthcare-specific originals. Prior 15/18 Nov history recovered the distinct healthcare titles but no accessible original file/URI; do not relabel Admin images as healthcare originals. `HEALTHCARE_SCREEN_VISUAL_PARITY=PENDING_ORIGINAL_IMAGE_AND_RUNTIME_QA`. Keep originals private, never bundle client sample information or generate fake evidence.


## 24 November 2026 — newly supplied original public healthcare references (supersedes earlier evidence-blocked status)

The user supplied the final public healthcare reference set, 13 original JPGs. All original archive entries were checked against their SHA-256 manifests. Both ZIPs are saved in the private ChatGPT Library under /CareGanga/:
- CareGanga-Original-Healthcare-UIUX-Reference-20261124-Batch01.zip — 10 originals; SHA-256 5d544a83e5b5a5f392fb12d45a8055ba3c1f50d9cf88d13c822e5016f078e6bf.
- CareGanga-Original-Healthcare-UIUX-Reference-20261124-Batch02.zip — 3 originals; SHA-256 6f82d5e95e2c3a630ba189d7a0c5e23413a5d380fd978820e3db5a0f617f3a79.

HUX-01.01: EVIDENCE_RECOVERED for the user-confirmed final public set; remove screenshot-access blocker for this implementation. These public references carry UI04–11 numbering distinct from the older recovered internal healthcare title map. Do not conflate the two. The earlier internal raw images remain unverified; use original Admin reference archive and authorized existing internal flows rather than halt source work. HUX-16.01: integrated rendering, actual payment/booking/database/Android execution and independent review remain NOT_RUN. Source-based comparison found material presentation differences; no exact visual match claimed. See docs/research/CAREGANGA-HEALTHCARE-PUBLIC-VISUAL-REFERENCE-REVIEW-20261124.md for 13-image mapping, source evidence and remaining acceptance. No production use of sample names/portraits, rates, QR, contact details or transactions; approved data and current module boundaries remain controlling.

