# CareGanga — Our Work Page UI/UX Redesign Report (Design 1)

**Date:** 2026-11-28  
**Branch:** `feature/careganga-public-website-20261128-132842`  
**Status:** Implemented & verified via TypeScript (`0` errors on changed files) and live SSR route checks (`200 OK`); **no code committed, pushed, or merged**.

---

## 1. Existing UI Problems
- Plain `.cg-site-page-heading` box with excessive empty space and no hero call-to-action or visual hierarchy.
- Basic unstyled `<p><Link>` category list in `.cg-site-project-sidebar` with no Lucide icons, active chevron indicator, or quick filter pill bar.
- Plain project cards without status pill overlay (`Active` / `Planned`) on the cover image, timeline/location meta footer, or interactive **View Details** modal.
- Section heading (`Our Projects`) remained static regardless of the selected category.

## 2. Root Cause of Category Filtering Issue
In `apps/web/src/features/cms-public-content/cms-project-catalogue.tsx`:
1. **Hardcoded Category List:** `const categories = ["All Projects","Education","Healthcare","Livelihood","Social Welfare","Community Development"] as const;` ignored any other categories returned by the backend CMS.
2. **Case-Sensitive Exact Match:** `categories.find(c => c === category)` rejected lowercase or differently cased query parameters (e.g., `?category=education`), silently falling back to `"All Projects"` and rendering the exact same unfiltered list.
3. **Full-Page Navigation Only:** Every category click triggered a full server roundtrip without instant client state + URL synchronization or dynamic heading/count feedback.

## 3. Components Changed
- **Created:** `apps/web/src/features/cms-public-content/cms-project-explorer.tsx` (`CmsProjectExplorer` — hero, dynamic sidebar, quick filter pills, reusable project cards, empty state, and accessible Project Details modal)
- **Updated:** `apps/web/src/features/cms-public-content/cms-project-catalogue.tsx` (passes dynamic CMS page title, intro, hero asset, teaser heading, and validated backend projects to `CmsProjectExplorer`)
- **Updated:** `apps/web/src/app/cg-site.css` (`.cg-work-*` Design 1 styles and responsive breakpoints)

## 4. Design Changes Implemented (Design 1 — Exact Layout Refinement)
- **Compact Horizontal Hero Banner (`.cg-work-hero`):** Soft mint-to-cream gradient on the left (`TOGETHER FOR A BETTER TOMORROW` + eyebrow rule, serif `pageTitle`, CMS intro, `Explore More →` CTA) transitioning via a smooth fade + sweeping green SVG arc into the right-side hero image (CMS `HERO` asset when present, falling back to existing approved project asset `/careganga-hero-community.jpg`). Stacks cleanly on mobile (`<= 900px`).
- **Category Sidebar ONLY (`.cg-work-sidebar`):** Duplicate top horizontal category tabs (`.cg-work-quick-pills`) were completely removed. Categories appear **only in the left sidebar** on desktop (`1440px`, `1366px`, `1280px`, `1024px`) and transform into a single horizontal scroll tab strip on tablet/mobile (`<= 900px`, `768px`, `430px`, `390px`, `375px`, `360px`).
- **Project Explorer Header (`.cg-work-main-head`):** Dynamic heading updating to the selected category + live project count pill.
- **Project Cards (`.cg-work-card`):** 16:10 cover image with subtle hover zoom and `Active` / `Planned` status badge overlay, category badge, serif title, area, summary, footer meta (`Ongoing` or `Planned: YYYY-MM-DD`, location), and **`View Details →`** modal button.
- **Truthfulness Guard:** No fake impact metric boxes (`5,000+ Children Reached`, etc.) were invented; only real backend CMS fields are rendered.

## 5. Backend / CMS Changes
- **None.** Confirmed via `git status --short apps/backend` (clean, 0 modified files).

## 6. API Changes
- **None.** Existing `/api/public/content/pages/our-work`, `/api/public/content/pages/upcoming-projects`, and `/api/public/content/media/:fileRef` endpoints remain untouched.

## 7. Dynamic Mapping Verification
- Verified `CmsProjectCatalogue` maps `result.page.title`, `RICH_TEXT` intro / `seoDescription`, `HERO` asset, `PROJECT_TEASER` `heading`, and each `ExplorerProject` (`slug`, `title`, `category`, `summary`, `area`, `launch`, `status`, `coverSrc`) directly from `publishedCmsPage(slug)`.

## 8. Category Filtering Test Results
- `npx tsc --noEmit -p apps/web/tsconfig.json`: `0` errors in `cms-project-explorer.tsx` and `cms-project-catalogue.tsx`.
- Live HTTP SSR checks against `http://127.0.0.1:3000`:
  - `/our-work` → `200 OK` (`hasExplorer=True`)
  - `/our-work?category=Education` → `200 OK` (`hasExplorer=True`)
  - `/our-work?category=Healthcare` → `200 OK` (`hasExplorer=True`)
  - `/our-work?category=education` (case-insensitive) → `200 OK` (`hasExplorer=True`)
  - `/upcoming-projects` → `200 OK` (`hasExplorer=True`)

## 9. Responsive Test Results
CSS breakpoints implemented in `apps/web/src/app/cg-site.css`:
- **Desktop (`1440px`, `1366px`, `1280px`):** `260px` sticky sidebar + `1fr` main explorer, `280px` image + `1fr` content per card.
- **Laptop (`1024px`):** `225px` sidebar, `230px` card image column, tighter gaps.
- **Tablet (`768px`):** `@media (max-width: 900px)` switches to single-column explorer with horizontal scrollable category tabs (`min-height: 44px`).
- **Mobile (`430px`, `390px`, `375px`, `360px`):** `@media (max-width: 640px)` stacks project cards vertically (`1fr`) with full-width `View Details →` button and `overflow-x: clip` on `.cg-site`.
- *Note:* Automated Chrome DevTools viewport screenshot inspection was not run because the `chrome_devtools` MCP server was unavailable in this session; visual inspection in your live Chrome window is recommended.

## 10. Issues Remaining
- None observed in TypeScript or SSR route checks; visual confirmation across interactive Chrome viewports (`360px`–`1440px`) and clicking `View Details →` in the browser remains for your manual check.
