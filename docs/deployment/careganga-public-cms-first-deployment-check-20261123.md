# CareGanga — Public website first-deployment diagnosis (23 November 2026)

## Incident and scope

Reported Render frontend: `https://careganga-frontend.onrender.com/` displays **"Our public homepage has not yet been published"** and expected public navigation/actions are unavailable. Staff login route supplied separately: `/admin/login`.

The exact fallback is rendered by `apps/web/src/app/page.tsx` ONLY when `publishedCmsPage("home")` returns `NOT_PUBLISHED`: the frontend received HTTP **404** from `BACKEND_URL/api/public/content/pages/home`, or the slug was invalid (not applicable to literal `home`). An absent `BACKEND_URL`, a non-404 upstream error, timeout or invalid response would instead result in **"temporarily unavailable"**. A 404 can represent either an *actual CMS_NOT_PUBLISHED* from the correct backend or a mismatched/stale backend route. **Do not infer database state from the screenshot alone.**

CMS source merged into main means its migrations/routes exist in source; it does **not** create or approve a client-owned homepage or publish a Hero by itself. CG18 requires a submitted Home revision, original CG03 CMS publication approval, rights-verified CG19 Hero media and an EFFECTIVE `cms_publication` plus `cms_page_effective` pointer. Never seed fake content, fabricate CG03 approval, turn on all menu links, or write directly to publication tables as a workaround.

## Non-destructive verification (developer at Render/local IDE)

1. Confirm Render frontend deployment commit and backend deployment commit both contain CG18 modules; verify frontend `BACKEND_URL` is the **private backend base origin**, NOT the frontend URL, not `/api` twice, and that the backend is up. Check secret values privately, never paste into tickets/logs.
2. On frontend or developer machine with appropriate access (substitute actual backend origin), run:
   ```bash
   curl -i --max-time 15 "https://careganga-frontend.onrender.com/"
   curl -i --max-time 15 "https://careganga-frontend.onrender.com/admin/login"
   curl -i --max-time 15 "https://<actual-backend-host>/api/public/content/pages/home"
   curl -i --max-time 15 "https://<actual-backend-host>/api/public/content/navigation"
   ```
   Replace `<actual-backend-host>` locally only. Do NOT expose authorization cookies, signed URLs, private media or API secrets. `GET /admin/login` should be 200 or an intentional session redirect, **not** a publication dependency. Compare backend JSON code carefully:
   - **404 + CMS_NOT_PUBLISHED:** no currently eligible effective Home publication (or publication withdrawn/expired/failed conditional source proof).
   - **404 generic route "Cannot GET"**: wrong backend version/URL or missing deployed CG18 controller.
   - **500/503/timeout:** backend database/migrations/provider/connectivity issue; check logs before altering content.
   - **200 + schemaVersion=1, slug=home, effectiveGeneration:** backend Home published; investigate frontend BACKEND_URL mismatch, SSR deployment, invalid DTO and caching.
3. Perform these **read-only** queries on the specific Render backend's connected database (not Neon development by mistake):
   ```sql
   SELECT r.realm_key, p.id AS page_id, p.slug, p.kind,
          p.archived_at, e.publication_id,
          pub.state AS publication_state, pub.effective_at, pub.expires_at
   FROM access_realm r
   LEFT JOIN cms_page p ON p.foundation_root_id = r.id
                       AND p.kind = 'HOME' AND p.archived_at IS NULL
   LEFT JOIN cms_page_effective e ON e.foundation_root_id = r.id
                                 AND e.page_id = p.id
   LEFT JOIN cms_publication pub ON pub.id = e.publication_id
                                AND pub.foundation_root_id = r.id
   WHERE r.realm_key = 'FOUNDATION_ROOT';
   ```
   A HOME page with no effective row is still **not public**. Also check migration history includes 0932–0941 and current backend deployment before acting. Do not manually update `cms_page_effective`, `cg03_case_decision`, or `cms_publication`.
4. If publication is missing: sign in at `/admin/login`, open `/admin/website`, create/review actual HOME content with a rights-cleared CG19 Hero image or an explicitly selected text-only Hero, submit under the **original CG03 approval workflow**, obtain authorized independent approval and publish now (or schedule the actual due worker). Then check `/api/public/content/pages/home` returns approved content; separately publish About/Gallery/Healthcare/Policy as needed.
5. Test public routes **separately**, without interpreting intentionally unpublished routes as nonworking: `/`, `/contact`, `/membership`, `/volunteer`, `/campaigns`, `/donate`, `/collaboration`, `/admin/login`. Joining depends on approved Home navigation flags; Campaigns/Donate depend on genuine CG07 publication/payment readiness; other editorial routes only appear if approved in `publishedRoutes`. Check login and public form submit in the browser and backend logs, not only a 200 document.
6. After fixes and developer approval: run `node scripts/verify-cg18-us001-source.mjs`, `npm run verify:local-build`, original CG18 QA for desktop/mobile/nav/fallback and native Public Android; execute authenticated publish/revoke/role and media-rights-negative cases on an **isolated test Foundation**, not live user data.

## Source fixes in existing CG13 feature branch (not yet deployed)

- `CmsEditorialService.publicNavigation`: forward only original currently effective, CG03-approved HOME `member_join_desired` → `/membership`, `volunteer_join_desired` → `/volunteer`. No publication, no fake approvals, no new rights.
- `CmsPublicPage.SiteFooter`: actual route-approved `/campaigns` and `/donate` links instead of inert text; inaccessible until original source eligibility exists.
- `PublicCmsContent` native: use canonical approved join routes, show Member join action only after matching approved flag; keep volunteer equality check.
- Public Home fallback now uses existing `CmsPublicShell` with published-only navigation and safe independent operational links, while remaining non-indexable and refusing unapproved screenshot content.
- `scripts/verify-cg18-us001-source.mjs`: non-executing source guards for these changes.

**Verification boundary:** GitHub source commits are verified. The connected Render workspace was accessible but lists only unrelated Anjuman services; **neither CareGanga frontend nor backend appears in that workspace**, so no CareGanga deployment, request logs or database were accessible. Direct live endpoint fetches were also unavailable in this session. No deployed-service or database-state claim, no local build/API/device PASS, no merge or production deployment.


## 24 November — explicit first-install editorial draft initialization (E2E-001/002)

From the existing CG11 integration branch, run `node scripts/initialize-cms-drafts.mjs` to preview the 15 default page slugs (Home, About, Healthcare, Contact, Partnerships, Impact, NGO Information, Gallery and seven policy draft shells). Dry run is the default and does not contact the backend. To create missing drafts only, set `CG_CMS_BACKEND_ORIGIN` and an authorized, current CMS staff bearer token in `CG_CMS_STAFF_TOKEN` privately in the local shell, then use `node scripts/initialize-cms-drafts.mjs --apply`. A private client-approved manifest can replace the starter entries via `--manifest <private-json>`; format is a JSON array of the existing CG18 create content objects. Never commit the manifest if it contains private data or unlicensed assets. Use only the intended isolated deployment and clear the token afterwards. No script output contains credentials or private content.

The command checks current pages, creates missing drafts via POST /api/cms/pages, preserves existing pages, stops on uncertain/conflicting outcomes and never sends submit/publish or direct SQL. Existing CG18 root permissions, unique slug and revision audit remain authoritative. A rerun after interruption checks the original records again. Existing archived/conflicting slugs are not recreated. The current starter includes general text suitable for independent review, an explicitly text-only Home banner, real-empty project, impact and media collections, and a non-verified NGO information state. Actual photos, legal wording, verified organization details, sourced impact values and owner-specific operational records remain subject to their original validation. Complete those through existing CMS editors, obtain independent CG03 approval and publish. No default sample providers, payments, members or reports. All operational modules remain owner-controlled. Use actual browser/public Android and backend QA after publish. This is not a deployment or full default-content closure.


## 24 November — first-publication completion workflow (supersedes draft-only limitation above)

The initializer contains eight editable, publishable general-content pages plus seven legal drafts. It uses client reference copy, not operational rows. A Home author can explicitly choose a text-only banner until real rights-cleared media is supplied. Existing media banners still require validated desktop media and source rights. Impact/media collections may be genuinely empty; actual entries retain provenance, media and consent checks. Home publishes an empty project directory placement, so the two original project routes can be available with truthful empty states. Confirm screenshot-derived organization contact details during review.

**One-time deployment gate, after migration and root setup:**

1. Use `node scripts/initialize-cms-drafts.mjs` (dry run) and `--apply` with the intended CMS editor token and backend origin to create missing drafts only. On an existing database the initializer preserves existing drafts; finish them in the original CMS rather than overwriting them.
2. In Admin CMS, inspect each exact revision, confirm client copy, add real rights-cleared assets where available, and submit Home, About, Healthcare, Contact, Partnerships, Our Impact, Gallery and NGO Information. Use the existing independent CG03 reviewer to approve each exact revision. Do not approve empty legal drafts, invent operational rows or claim verified NGO evidence.
3. Publish in the existing UI, or use the one-time explicit publisher `node scripts/publish-cms-baseline.mjs --manifest <private-json> --apply` with an authorized CMS publisher token. The manifest is an array of objects containing slug, pageRef, revisionRef, expectedVersion (current detail), caseRef and requestKey (unique UUID per exact publication). Keep it private; dry run omits --apply. The publisher checks the current submitted revision and existing public state before sending the original publish request. Backend enforces the independent final decision; this tool does not create approvals. If an uncertain outcome occurs, inspect the current record before retrying with the same request key. Do not run on routine redeploy or use to resurrect intentionally withdrawn content.
4. Run `CG_CMS_BACKEND_ORIGIN=<actual backend origin> node scripts/verify-cms-first-publication.mjs` privately. This is a read-only fail-closed first-install gate: all eight editorial routes, both real empty-or-populated project directory routes and public navigation must be effective. Do not declare go-live if it fails. On ordinary redeploy, intentional withdrawals remain authoritative.
5. Confirm anonymous Web home and navigation and Public Android actual screens against original screenshots, test edits/withdrawal and reinstallation preservation, source revocation, real join/enquiry and owner empty states. Publish the seven legal policies only after real approved text; publish actual proof and media only after client confirmation/rights. No dummy transactions, people, metrics, images or certifications.

**Evidence:** Four isolated readiness-function tests using mocked URL/HTTP responses returned exactly expected outcomes (all ready, Home missing, navigation missing, wrong content type). Actual Render database, credentials, full build, live publish, Web/device and original runtime QA NOT_RUN. Do not claim the production site is published.

## Current first-install release sequence (24 November, CG11 integration branch)

This supersedes the earlier photo-required starter note. The website must be published before go-live, but initial general editorial content is not an exception to the existing CG03 approval process. No automatic writes occur at every application start, and routine deployments never overwrite CMS changes or revive withdrawn content.

1. Migrate the intended isolated database and bootstrap the original Foundation/root and independent CMS author, reviewer, publisher access. Run `node scripts/initialize-cms-drafts.mjs` (dry run). With the private current authorized author token and correct backend origin, run `node scripts/initialize-cms-drafts.mjs --apply`. The initializer creates only missing drafts. Existing drafts require an authorized CMS edit to adopt any newer default text; do not replace them automatically.
2. In Admin Website CMS or authorized Internal Android, review the eight starter editorial pages (home, about, healthcare, contact, collaboration, our-impact, gallery, 80g). Confirm organization address/contact from the original screenshots, use authorized originals if supplied, retain a text-only hero otherwise, and publish no unverified legal/identity/financial claim. Real projects, staff, providers, campaigns, donations and reports remain owner records. Seven legal pages stay draft until actual client-approved text is supplied. Submit each exact revision and obtain genuine independent CG03 final approval. For newly approved pages, an authorized publisher can use the normal CMS Publish Now action or the one-time helper below.
3. Optional controlled batch publication: create a private JSON array of the exact approved entries with `slug,pageRef,revisionRef,expectedVersion,caseRef,requestKey` from authenticated CMS detail and a newly generated UUID request key per page. Keep it outside the repository; do not paste credentials, identifiers or private case details into logs or tickets. Run `node scripts/publish-cms-baseline.mjs --manifest private.json` for dry run, then with the private authorized publisher token and backend origin run the same command with `--apply`. It preflights all current submitted revisions, preserves currently effective pages, refuses previously published/withdrawn or scheduled pages and relies on CG18/CG03 exact independent approval and current media checks. Never rerun an outdated manifest to override the latest CMS state. Normal manual CMS publishing remains the only way to republish an intentionally withdrawn page after fresh approval.
4. Mandatory first-install release gate: `CG_CMS_BACKEND_ORIGIN=<correct backend origin> node scripts/verify-cms-first-publication.mjs`. No token is necessary. The command must exit zero for the eight editorial routes and both project directories plus effective public navigation. If not, do not declare the website ready. Run `node --test scripts/verify-cms-first-publication.test.mjs`, `npm run verify:cg18-source` and the local full build, then actual browser/public Android and staff editor/reviewer QA. Test direct URLs, permitted action/empty/unavailable states, responsive layout, original visuals and no dummy records. Run the gate against the deployed backend again before first public go-live. Do not run this as a mandatory routine redeploy check after an intentional withdrawal.

**Evidence boundary:** Readiness helper and its four deterministic mocked API unit tests were executed from copies with matching committed Git blob hashes, 4/4 passed (gate bed474254613e93ca65dbd13d2da0304c0c7f12b, test 595b1156e27c2e20b1847000ba2b459eab1953ca). No live endpoint, database migration, full build, approval, production write, browser/device or original story QA PASS is implied. No merge.

## 24 November — original screenshot baseline and generated media (supersedes text-only first-go-live assumption)
All 47 original website screenshots have been reviewed against editable CMS copy. See [page-by-page source and QA trace](../qa/CAREGANGA-PUBLIC-WEBSITE-CMS-BASELINE-20261124.md). The latest first-install manifest includes core Home sections, seven About route introductions, four Contact FAQs, and the original approved report/media content. The existing publication and non-destructive initialization requirements remain.

After creating missing drafts, extract the CareGanga Library asset pack `/CareGanga/CareGanga-CMS-Editorial-Illustrations-20261124.zip`. Use actual client-approved media if available; otherwise use these labelled generated illustrations. Prepare a private Home pin JSON with current `pageRef,revisionRef,expectedVersion` from authorized CMS detail. Dry run `node scripts/import-cms-baseline-illustrations.mjs --asset-dir <extracted-directory> --page-manifest <private-home.json>`; it verifies six file hashes and performs no network operations. With the correct private CG18 author token/backend origin and permission to publish these illustrations, append `--apply`. The command verifies the exact unpublished empty-media Home revision, creates original CG19 intents, uploads only to validated signed storage endpoints, requires clean scan proof, and attaches six validated assets in one version-checked CMS draft save. It refuses to overwrite existing assets or previously published pages. If a prior attempt is unconfirmed, inspect original media/draft state before any retry. Do not commit the private manifests or tokens. Existing drafts with other copy/media must be edited through normal CMS rather than force-reseeded.

Once independently approved, run the existing baseline publisher and readiness gate. The updated gate requires the seven route-specific introductions and six public Home media placements as well as ten public page DTOs and four Contact FAQs; an incomplete first installation is not ready. Text-only pages are still valid normal editorial publications, but are insufficient for this screenshot-aligned first-install gate. Verify the actual images in browser/native and actual public route functionality. All six latest isolated readiness tests passed on exact committed copies. No live database or storage writes have been performed in this review.
