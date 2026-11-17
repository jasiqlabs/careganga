# CG-18 US-001 — original public-site implementation source review (17 Nov 2026)

**Branch:** `feature/careganga-cg09-finance-accounting-dev-20261117`. **Stage:** SOURCE WORK IN PROGRESS; this is a static source review, **NOT runtime QA, independent QA gate PASS, client exact-look PASS, or source completion**. No CI/GitHub Actions executed. Main was not changed.

**Source of truth:** Original client-owned `careganga.com` public website and Admin screenshots, not new greenfield source. The 10 original public website screenshots are saved privately in `/CareGanga/CareGanga-Original-Public-Website-Visual-Reference-20261117.zip`. Full reference map: `docs/research/CAREGANGA-CLIENT-PUBLIC-WEBSITE-SCREENSHOT-AUDIT-20261117.md`. Exact CSS/font/media bytes, full mobile layouts, dropdown/carousel motion, some page routes and source rights are not yet available.

## Actual code implemented and checked by reading current branch source

- **Database:** existing root-scoped CG-18 CMS revisions, sections, publication and audit. Added additive migration `0936_cg18_original_site_editorial_media_roles.sql` for ABOUT/PROMO/FEATURE CG-19 scanned image placements. PostgreSQL migration has **not been executed**.
- **Backend:** validated up to six ordered HERO slides, badges, copy, original split About copy/highlights, volunteer promo, three editorial feature cards, two join-information cards, site footer contact info and CG19-approved image placement. Strict limited internal links, text limits, section count and image validation retained; no second CMS/object store. **New section fields require a fresh DB/API test.**
- **Admin Web:** original C22 multi-slide add/remove/reorder controls, image attachment by slide/card, About, promo, feature, join and footer editors, current real CG01 authorization and CG03 review flow. Added source path for **authenticated, private/no-store CG19 image preview** (same approved source and SHA after-read recheck), including images in editor preview and reviewer detail; still unexecuted. Editor-only `cms-client-screenshot-reference.ts` offers exact visible screenshot text as an unpublished, editable starting draft; disputed impact/benefit claims remain subject to human source confirmation and independent approval.
- **Public Web:** original gold/green/cream visual hierarchy on responsive header/hero/sections/footer, accessible manually controlled hero slider, original menu wording, existing actual Home/About/Contact links, Healthcare Assistance in former Blood Donation menu slot; disabled missing route labels rather than fabricated CG04/05/07/14 navigation. Exact-original media not shipped; no screenshot reused as an actual hero asset.
- **Public Android:** same backend effective public DTO, ordered hero slides, screen-reader labels and native controls for editorial sections. No invented public registration or donation endpoint.
- **Ownership and fixes:** CG03 CMS approval source variable `frozen` is now bound to real reviewed revision. Reviewer now shows new editorial fields and CG19 image alt/position/current proof. Keep current CG03/19 ownership; no new branch created.

## Source-only QA trace, matching original 20 US-001 QA identifiers

| Original QA | Source observation | Status |
| --- | --- | --- |
| QA01 | Editor, multi-banner, draft/approval/publish controls and public renderer present; actual author→reviewer journey unexecuted | PARTIAL SOURCE |
| QA02 | Existing CG01 action gates and root-scoped backend queries retained; cross-role adversarial API tests unexecuted | PARTIAL SOURCE |
| QA03 | Existing version checks and request key replay retained; competing-writer API/DB tests unexecuted | PARTIAL SOURCE |
| QA04 | Bounded fields, media type/rights, safe local routes in parser; error-copy UX and malformed request tests unexecuted | PARTIAL SOURCE |
| QA05 | Public Web + native consume effective content, with public no-store/foreground refresh; actual revision revocation sync unexecuted | PARTIAL SOURCE |
| QA06 | Screenshot-driven original client gold/green public shell and Admin C22 editor, not exact pixel/motion or original licensed photos | PARTIAL SOURCE |
| QA07 | CMS controls retain three desired public flags; no real CG04 Join routes on current branch; no fake links | PARTIAL SOURCE |
| QA08 | Public navigation uses source flag, limited existing routes; stale browser/native deep-link security tests unexecuted | PARTIAL SOURCE |
| QA09 | CG03 CMS original approval case and reviewer; fixed undefined frozen title; actual full case trace unexecuted | PARTIAL SOURCE |
| QA10 | CG19 scanned private media and rights adapter reused; newly allowed roles need actual storage tests | PARTIAL SOURCE |
| QA11 | Normalized revision/pointer/approval DB source present; concurrency, current indexes, foreign-root and revocation race tests unexecuted | PARTIAL SOURCE |
| QA12 | Homepage can draft without CG04/05/14 data; non-existent join/project/provider routes do not become working buttons | PARTIAL SOURCE |
| QA13 | CMS editor expanded to banner/story/cards; original C20 dashboard, typography controls, visual narrow-screen comparison still incomplete | PARTIAL SOURCE |
| QA14 | Next SSR SEO source preserved; sitemap/ETag/private-preview actual HTTP testing unexecuted | PARTIAL SOURCE |
| QA15 | Public Android native slides and sections implemented; actual devices, safe-area/focus/asset QA unexecuted | PARTIAL SOURCE |
| QA16 | CG18→CG03 owner approvals and CG19 owner image validations retained; full API trace requires local execution | PARTIAL SOURCE |
| QA17 | SQL role constraint migration present; real migrate/backup/restore/EXPLAIN unexecuted | NOT RUN RUNTIME |
| QA18 | Existing due worker and withdrawal logic present; restart/scheduling/races/performance measurements unexecuted | NOT RUN RUNTIME |
| QA19 | Real CG05 active project source not integrated yet; no fabricated project model created in CMS | NOT COMPLETE |
| QA20 | CG05 project withdrawal integration unavailable and no actual CG19 revocation/device integration test | NOT COMPLETE |

## Critical remaining source acceptance gaps (not silently deferred)

1. **Client original fidelity:** obtain original DOM/asset bytes, source logo/font and approved images. Current CSS approximates screenshots; cannot claim exact pixel/motion, all original content or working external integrations. Original multi-banner typography controls and CMS C20 metrics/page menu configuration still differ from screenshots.
2. **Real links:** CG04 Join, CG05 operational project, CG07 Donations and CG14–17 Healthcare deep links must come only from implemented and permission-safe owner routes. Do not replace whole original site with generic content; the standalone Blood Donation operational module must not be reintroduced.
3. **Admin preview:** authenticated CG19 preview bytes, Web no-store proxy and submitted reviewer image comparison are implemented in source, with post-storage rights/hash revalidation. Actual original media bytes, complete C20–C26 visual preview, browser upload/API/storage flow and animation comparison remain unexecuted. No public/draft leak PASS claim.
4. **Full JASIQ source QA:** run actual TypeScript builds and PostgreSQL migration/restore; independently inspect security, DB/locking, UI/UX, CG03 owner workflow, CG19 media, native safe area, UX error copy. Only source-presence assertions were checked in this interaction; **none of the 20 acceptance cases can be marked fully PASS**.
5. **CG18 remaining stories:** US-002, US-003, US-004 still not started. Their scope remains original requirements; do not mark this module or shared CG09 branch complete.

## 17 November continuation — security, database and Admin UX source fix/re-review

**Source commits on the same shared branch:** `eff5c956` (editor/reviewer rejected-command recovery), `e4b2cb3` (initial static guard), `5d983781` and `094cef0e` (authored media validation and public DTO recheck), `96b5b01` (CG-19 public URL current-section checks before/after storage read), `a123592c` (additional source guards). These are **code-source changes**, not executed PostgreSQL, browser or native Android QA.

- **Admin Web / QA01, QA04, QA09, QA13:** A definite HTTP 4xx from create/save/submit/publish or reviewer decision previously left the single pending request locked, preventing a corrected action. A typed rejected-response path now clears that pending lock and retains the configured human-facing error. A network error or 5xx still preserves the same request key and requires state reconciliation before retry. Re-review: both author and reviewer catches differentiate definitive rejection versus ambiguous completion; actual 400/403/409/500/disconnect browser runs remain NOT_RUN.
- **Backend / QA04, QA10, QA11:** `parseContent` now rejects a photo placement without its exact authored HERO, RICH_TEXT split, CTA, TEAM person or FEATURE card target. `publicPage` uses the same rule when returning the approved image DTO, including older source rows. This is required to avoid exposing scanned, rights-cleared but unused images in the public projection. Re-review: all six original CG-19 placement roles are matched; no new table, approval process, image store or login factor was introduced.
- **CG-19 image bytes / QA02, QA08, QA10, QA20:** Previously, direct GET of a published image could qualify a non-HERO media role without checking whether its target visual block still existed. Both the initial query and the post-object-fetch eligibility query now require a live matching section and public TEAM consent. This prevents bypass via a known `fileRef` URL, including legacy placements. Revocation, active publication and verified SHA checks remain in place. Re-review: the role predicate is the same constant in both SQL queries. The PostgreSQL query plan, SQL syntax/execution, concurrent revoke race and object-store integration are **NOT_RUN**, so this is **not a runtime security PASS**.

**Original story QA dispositions are unchanged.** QA01/02/04/08/09/10/11/13/20 gain reviewed source evidence but remain SOURCE_GAP/PARTIAL until all acceptance clauses, independent reviewer gate and real API/DB/device tests are satisfied. QA17/18 require executable DB/scheduler evidence; QA19 depends on genuine CG-05 owner source. The four-story CG-18 total remains **0/76 runtime QA executed** and US-001 stays **IN_PROGRESS / SOURCE_ONLY**. Live `careganga.com` remains inaccessible to this agent; client screenshots provide partial desktop evidence, not complete CSS/DOM/assets/mobile/animation parity.

## Original C20/C22/C23/C25 visual re-inspection — 17 November continuation

The verified private owner screenshot ZIPs were reopened in the current session: original public `01-home-hero-project-spandan.png` and `02-about-intro-heading-image.png`; original Admin `C20.webp` (CMS summary), `C22.webp`/`C23.webp` (hero list and four-tab editor), and `C25.webp` (team-member administration). These are **client-owned reference images**, not the greenfield public website or executable browser/device screenshots. Original exact media files, public site DOM/CSS/animations and live route targets are still unverified.

**Visual source finding:** C22/C23 has a list of individual ordered banner cards with image previews, individual visible/hidden state and a **selected** banner editor with Basic/Images/Buttons/Preview tabs. The previous Web source rendered multiple banner forms consecutively and did not expose a compact selectable banner overview. Fix `993523e3` adds a list derived from the current authored slides, CG-19-protected screenshot thumbnails, per-banner visible/mobile asset state, selected edit target and add/move/remove tracking. CSS fix `c8bcc0f7` adds original Admin-style cards, outlines, responsive density and keyboard focus. Static guard `758c311b` records the new source wiring. These checks do not prove matching original pixel dimensions or screen-reader/device usability.

**Independent gap retained:** Original C25 shows an operational Team Members list, filters, status, permissions and actions. The present CG-18 public editorial biography form is **not** a replacement for that operational member management owner, and is not evidence of source parity with C25. Do not fabricate a second member master or copy demonstration staff. C20 content-count panels are only partially implemented from real owned CMS page rows; Blog, Gallery, Media Library and full settings are still other owned work rather than fake KPI cards. Thus original UI QA06/QA13 remain SOURCE_GAP, while C22 banner source coverage has advanced.

## Local verification handoff

In the local IDE on the active feature branch, run backend/web/type checks and database migration on a disposable backed-up database; exercise screenshot-based CMS author→review→publish→withdraw with two roles, 3 ordered slides including one phone image, all sections, invalid links, restored permissions, CG19 scan/consent rechecks, responsive desktop/mobile browser and Public Android. Compare screenshots at original page scroll positions and log measured differences and original licensed asset provenance. Only after **all 20 original QA** are traced and source reviews fixed, update US-001 source gate; retain separate real runtime QA.
