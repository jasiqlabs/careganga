# CG-16 US-003 / US-004 — public test offers and lab contact: source QA trace

Date: 20 November 2026. Branch: feature/careganga-cg16-cg17-healthcare-dev-20261120.
Evidence SHA before this document: 4be8642504e6bfcb030af9c5a3d39b3604376da9. No main merge.

## Verification boundary

Executor performed source inspection and GitHub SHA-based commits, NOT an independent clinical/security/DB review. Source test scripts committed but NOT EXECUTED in this remote environment. Actual PostgreSQL migration, real test data, authorization misuse, browser/Web/Android rendering, network/ingress, load, accessibility, contact dialing, license-calendar expiry and practical mobile parity all NOT_RUN. ZERO manual/runtime QA cases are PASS. No medical or financial approvals granted.

After current original-source re-review, US-003 has 14 SOURCE_TRACED, 0 SOURCE_GAP, 2 NOT_VERIFIABLE (await US002 lawful patient report source). US-004 has 13 SOURCE_TRACED, 0 SOURCE_GAP, 3 NOT_APPLICABLE (16 original cases). These are source-presence dispositions, NOT QA execution results.

### Original US-003 acceptance cases

| Case | Source-only disposition | Evidence / remaining limitation |
|---|---|---|
| US-003-QA01 | SOURCE_TRACED | PublicOffersController.offers -> DiagnosticsPublicCatalogService.offers; lab-tests/page.tsx and PublicLabOfferDirectory; no ERP flag |
| US-003-QA02 | SOURCE_TRACED | Public catalogue uses only original CG14/CG03/CG19 validity and CG16 tariff joins; no CG15, CG17, order or patient joins |
| US-003-QA03 | SOURCE_TRACED | One mapping per CG14 center; prices/validFromUtc/validUntilUtc and commercial saving drawn from real price row |
| US-003-QA04 | SOURCE_TRACED | Query requires PUBLISHED generation, active mapping/test/category/package, current APPROVED effective price; no cached fallback |
| US-003-QA05 | SOURCE_TRACED | Backend allowlist q/category/center/page, bounded length/page, escaped ILIKE; fresh facets; no clinical-private output |
| US-003-QA06 | NOT_VERIFIABLE | Authenticated own-patient report-empty contract belongs to not-yet-implemented US-002 |
| US-003-QA07 | NOT_VERIFIABLE | Actual professionally released CG19/CG15 report integration belongs to US-002 |
| US-003-QA08 | SOURCE_TRACED | Anonymous controller only GET offers/facets, no order/report ref route or private joins |
| US-003-QA09 | SOURCE_TRACED | Web lab-tests route and native PublicLabOfferDirectory offer safe filters, source center, tariff, validity, empty/unavailable; actual pixel/device NOT_RUN |
| US-003-QA10 | SOURCE_TRACED | Original `/admin/health-network/page.tsx` includes `FoundationLabOfferOverview` (actual H08 source-backed listed approved lab tests/current prices/CG14 original center), and H09 `/diagnostics` has source totals; no invented popularity ranking or screenshot counts; browser and screenshot QA NOT_RUN |
| US-003-QA11 | SOURCE_TRACED | Partner commercial discount only; no Foundation assistance/paid/CG09 claims or writes |
| US-003-QA12 | SOURCE_TRACED | Informational description and contact; no diagnosis/analyzer interpretation |
| US-003-QA13 | SOURCE_TRACED | CG14 directory/page remains standalone; no CG16 offer creates no catalogue card |
| US-003-QA14 | SOURCE_TRACED | Protected Foundation/own-center H09 preview links use current CG14 publicSlug and separately rechecked public endpoint |
| US-003-QA15 | SOURCE_TRACED | Public GET rechecks actual CG14/CG16 source each request. Current CG16 `ClinicalLabOrderService.quote/create` rechecks source-approved mapping/price and freezes accepted original price version/line in `lab_order_line` guarded by 1604; SQL race/expired live tests NOT_RUN |
| US-003-QA16 | SOURCE_TRACED | Controller -> CG14 throttle -> CG16 allowlisted query with original publication/CG03/CG19 and mapped tariff -> Web/native; runtime NOT_RUN |

### Original US-004 acceptance cases

| Case | Source-only disposition | Evidence / remaining limitation |
|---|---|---|
| US-004-QA01 | SOURCE_TRACED | Original CG14 center page and native center details show test-specific phone/view CTA only after current CG16 offers |
| US-004-QA02 | SOURCE_TRACED | Existing CG14 center page, doctors and services do not depend on CG16 rows |
| US-004-QA03 | SOURCE_TRACED | `CmsEditorialRoute({slug:'healthcare'})` retains original CG18 published editorial and appends optional current CG16 live-offer CTAs only for READY+nonempty approved CG14/CG03/CG19/CG16 output; unavailable/unpublished offers show NO stale/test CTA and CMS content remains independent; browser/native screenshot QA NOT_RUN |
| US-004-QA04 | SOURCE_TRACED | CG14 public center slug required; Web filtered URL and native initialCenterSlug preserve exact center contact/price |
| US-004-QA05 | SOURCE_TRACED | Fresh public offer reader checks CG14 published generation/current price; Web CTA only READY+items, native check first; runtime withdrawal races NOT_RUN |
| US-004-QA06 | SOURCE_TRACED | Only currently published CG14 contact phone; no persisted order, checkout, payment or booking |
| US-004-QA07 | NOT_APPLICABLE | Contact-only enquiry mode chosen; no persisted helpdesk enquiry is created; if later introduced CG19 owns durable request |
| US-004-QA08 | NOT_APPLICABLE | No WhatsApp/email send or delivered claim; original public CG14 phone is the only contact action |
| US-004-QA09 | SOURCE_TRACED | Web c.publicPhone and native centerDetails.publicPhone from current original CG14 public profile |
| US-004-QA10 | SOURCE_TRACED | Public allowlist projects price/name/contact/center only; no proof file, bank, patients, specimens or reports |
| US-004-QA11 | SOURCE_TRACED | Web and native center details both navigate live test prices and use direct original phone; pixel/native execution NOT_RUN |
| US-004-QA12 | SOURCE_TRACED | Existing CG14 Foundation `/admin/health-network` embeds `FoundationLabOfferOverview` with original provider+center+current CG16 test, commercial tariff and original provider-profile link; H09 live preview separately. It does not clone provider editor or claim patient booking counts; actual H08 pixel/selection UX NOT_RUN |
| US-004-QA13 | NOT_APPLICABLE | Internal Android public lab enquiry/global Admin controls intentionally not required under D-17 |
| US-004-QA14 | SOURCE_TRACED | Contact/read endpoints contain no Lab ERP grant dependency and no H10 operation exposed |
| US-004-QA15 | SOURCE_TRACED | CG14 verified slug and current phone validation, lab query parameter allowlist; no external URL/host or forged sender |
| US-004-QA16 | SOURCE_TRACED | Web/native original CG14 page -> current CG16 public projection -> CG14 phone; CG18 optional, CG19 no stored request, CG17/CG15 not touched |

## Owned implementation and source contracts

- CG-16 Nest backend: apps/backend/src/modules/cg-16-healthcare-diagnostics/application/diagnostics-public-catalog.service.ts (offers, facets) and http/diagnostics-public-catalog.controller.ts. Anonymous GET only; bounded filters, original CG14 published center generation/revision with completed CG03 approval and current CLEAN_VERIFIED CG19 license, active CG16 mapping and effective APPROVED commercial tariff. Reuses CG14 public ingress throttle.
- Public Web: apps/web/src/features/diagnostics/public-lab-offers.ts and app/health-network/lab-tests/page.tsx. The existing /health-network page links to the catalog without overwriting the client-owned /healthcare CMS route.
- Native Public Android: apps/android-public/src/features/health-network/public-lab-offer-directory.tsx is reachable through original public-healthcare-directory.tsx and uses the SAME backend public projection and source filters; the provider detail CTA checks live approved offers first.
- Original provider centre: apps/web/src/app/healthcare/centers/[slug]/page.tsx continues to render independent CG14 details, includes at most five live lab offers and only uses original public CG14 telephone for actual enquiry; no new provider master or persisted enquiry.
- Protected preview: apps/backend/.../diagnostics-catalog.service.ts eligibleCenters carries original CG14 public slug with current scope; Foundation H09 and own-center lab pricing Web link to the SAME public center-filtered projection. This is not a private draft publication.
- Source-only local commands: npm run verify:cg16-us001-source, npm run verify:cg16-us003-source, npm run verify:cg16-us004-source, npm run verify:design-approvals. Do NOT mark these run until an executor records actual output.

## Remaining development / integration gates

CG-16 US001 now has original CG03 source-pinned price review and CG14 real unexpired lab license source, 1603 test-component expiry and US002 actual frozen accepted-order source. US-003 H08 verified offer overlay and US-004 H08 original CG14 provider+CG16 price overlay are source-present. Original CG18 healthcare page has live current-offer optional CTA, not a duplicated catalogue. Two US003 public-own-medical-report cases remain NOT_VERIFIABLE until CG16 US002 qualified medical release and lawful patient reader are developed. Public patient released reports are US-002 only, not fabricated by catalog. CG-16 US-002/US-005 optional Lab ERP and quality, all CG-17 stories, independent signoffs and real-device/SQL QA remain incomplete. Owner policy: NO MERGE TO MAIN until BOTH modules' 12 stories, 148 original QA traces, review/runtime gates and final explicit approval are complete.
