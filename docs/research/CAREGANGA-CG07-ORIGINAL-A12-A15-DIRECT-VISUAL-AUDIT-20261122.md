# CareGanga CG-07 — original A12–A15 direct visual re-review

**Date:** 22 November 2026
**Source:** Actual client-owned `/CareGanga/CareGanga-Original-Admin-Screenshots-Verified-20261115.zip` in ChatGPT Library, extracted from `careganga_features_screenshot/CareGanga_Admin_Page_Screenshots/`, cross-checked with `CareGanga-UIUX-Golden-Reference-Pack-20261115.zip`.
**Note:** We actually opened and visually inspected the original four PNGs. ZIP binaries and images remain in the client Library, not duplicated in GitHub. Earlier claim of inaccessible screenshots was mistaken.

## A12 — `12_Campaigns_Overview.png`
Dark navy sidebar with blue active Campaigns nested under Donations & Finance; white top shell and light gray canvas. Five *scope-wide* KPI cards: Total, Active, Draft, Completed, Cancelled. Advanced search/filter panel for keyword, status, leader, featured, state/district, created dates. Tabs All/Active/Drafts/Completed/Cancelled, green Launch New Campaign on the list toolbar, right-side Campaign Overview, Funding Overview (₹), Recent Activities cards. Existing CG07 UI was a linear card-only list with page-local count: **source UI mismatch**. Numeric values and donation totals must come from actual owner source, not the screenshot zeros or a single page.

## A13 — `13_Campaign_Details_Top.png`
Dedicated Create New Campaign heading with Back to Campaigns, prominent **horizontal six-stepper** (Basic Details → Project & Category → Team & Assignment → Budget & Targets → Documents & Media → Review & Submit). Multi-column workspace: large main form, campaign preview/quick actions, steps/team summary/help rail. Basic panel shows Campaign Title*, auto-generated non-editable Code, Organizer/Initiative Tag, Short Description*, Detailed Description, Type, Draft Status, optional cover image, Tags, Next. Existing CG07 Web UI had conditional forms in a full-width vertical panel: **geometry and preview mismatch**. Business code only after genuine backend save; do not fabricate.

## A14 — `14_Campaign_Details_Middle.png`
Persistent wizard with section cards Project, Category & Location (real project/program/category/state/district/location/beneficiary estimate), and Campaign Details (dates/goal/leader/volunteer); two-column fields; back/next. Retain real CG02/04/05 eligibility and display labels, not IDs. Screenshot section-scroll behavior must not be mistaken for independent transaction steps.

## A15 — `15_Campaign_Details_Bottom.png`
Budget summary cards Goal/Target, Beneficiaries, Duration; Documents & Media dashed optional banner uploader and supporting documents; Review & Submit two-column summary; Previous, Save as Draft, Submit for Verification. Current CG07 has genuine draft/CG03 actions but lacks original CG19 verified image upload: **source gap**. Do not show fake-upload success, CG18 publication or donated money before owner verification.

## Independent review / QA gate
Use exact client reference appearance for layouts while simplifying only repetitive controls. Ensure responsive usability, dark sidebar and current CG01 role-based menu visibility, form errors, loading/empty states and source-accurate KPIs. A direct visual review **of reference images** is completed. A side-by-side comparison **against a locally rendered replacement UI**, actual Nest/Next/Expo builds, PostgreSQL migration execution and device testing are **NOT_RUN**. Any similarity claim beyond source-only layout changes requires screenshots from a running local build.

**Original QA mapping:** US001-QA01/02/04/05/06/08/09/10/11/12/13/14/15/16/18/19/20; especially QA06, QA14 and QA18 visual parity remain OPEN pending runtime comparison.


## 22 November 2026 — precise original A13/A15 media evidence correction

Reopened the actual original resolution A13 and A15 PNGs, not only the written audit. **A13 Basic Details** contains a separately labeled **Cover Image (Optional)** with supported `JPG, PNG (Max 2 MB)`. **A15 Documents & Media** contains a different **Hero Banner (Optional)** with supported `PNG, JPG or WEBP up to 5MB`, and a separate **Supporting Documents** column. These are **two independently uploaded/verified fields**, not one campaign image reused twice; supporting documents are additional private files. Exact screenshot labels, MIME and size restrictions are mandatory UI/CG19 server validation. Source files changed within the original CG07 US001/CG19 boundary: `campaign-draft-input.ts` (`media.coverRef`, `media.fileRef`, `media.supportingFileRefs`), `3304_cg19_campaign_verified_media.sql` (distinct `CAMPAIGN_COVER`, `CAMPAIGN_BANNER`, `CAMPAIGN_DOCUMENT`), CG19 upload/scan service, Admin Web Step 1/5 and Internal Android Step 1/5. Direct image inspection is SOURCE_REFERENCE_REVIEWED; rendered screenshot parity and actual binary-provider tests are still NOT_RUN.
