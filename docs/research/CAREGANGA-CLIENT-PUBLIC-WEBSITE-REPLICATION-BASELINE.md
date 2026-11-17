# CareGanga client LIVE website — replication source baseline

**Decision and source-of-truth clarification:** 17 November 2026. **Status: PARTIALLY VERIFIED / PUBLIC SITE VISUAL AND CONTENT CAPTURE PENDING.** This is the client-owned EXISTING website and admin panel, **not code supplied to JASIQ**. The code in \`jasiqlabs/careganga\` is a **new greenfield replacement**. Do not reverse-engineer the new repo to guess the original client's existing website.

## Client systems and exact-appearance requirement

- Original public website: https://careganga.com/ — preserve its existing public-facing look, content, branding, navigation, photos, typography, arrangements, wording, and user journeys as closely as approved evidence allows.
- Original admin interface: https://admin.careganga.com/login — use its previously supplied 167 original screenshots for the same recognizable sidebar, header, navigation, cards, filters, dialogs/drawers, CMS and operational screens. The original source-image Library pack is linked in repository \`AGENTS.md\` and \`docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md\`; do **not** mistake those Admin screenshots for actual screenshots of the client's public homepage.
- New delivery: public Next.js website, Admin Web, Public Android, Internal Android, shared API and PostgreSQL built **from scratch**. Only necessary responsive/native adaptation is permitted; do not swap in a generic NGO theme or write new marketing copy instead of real original content.
- Approved scope difference: **Healthcare Assistance replaces the former Blood Bank / Blood Management module and entry point**. Keep all other original website and Admin functions, published content, page hierarchy and journeys unless the owner has expressly approved a change. Healthcare uses the agreed shared backend and replaces the relevant menu/section; doctor consultation booking is the first public bookable healthcare service. Historic editorial content mentioning blood donation must not be silently deleted solely because the operational Blood Bank module is replaced; confirm any editorial change rather than rewriting a history.
- New healthcare-specific content is allowed only within its approved new section and source-backed workflows. Do not invent doctor cards, clinic data, prices, beneficiaries, claims, testimonials or treatment outcomes.

## Verification achieved on 17 Nov 2026

- The remote browser/text tools could not retrieve https://careganga.com/ page DOM or a screenshot; direct container networking also failed DNS lookup. An unrelated indexed 404 page is **not** homepage evidence. Consequently **no exact public-homepage pixels, copy, menu structure, font, photo inventory or layout are verified yet**.
- The original private CareGanga screenshot pack **was** reopened, including original Admin C20 (Website CMS dashboard), C22/C23 (Hero banners), and C50 (General Settings). These prove the original **Admin CMS** affordances, not the public-homepage rendering:
  - C20: branded dark-blue Admin sidebar and bright-blue selection, original CMS dashboard, Website Visibility switches, CMS pages/content status/activity/quick actions, tabs for Pages, Blog/Posts, Media Library, Menus, Sliders, Banners and Settings.
  - C22/C23: multiple ordered, independently visible hero banners; desktop/mobile image variants, title/tagline/description, type/weight/size/colour options, individual CTA labels/destinations, preview and editing tabs.
  - C50: independently controlled Frontend Login/Profile, Member Join and Volunteer Join visibility, not a licence to introduce different authentication from approved CG-01.
- The in-development CG-18 US-001 currently has working *source paths* for a single editorial Home/About with one HERO section and one optional mobile asset, private approval and public projection. **This is not yet the complete original multi-banner CMS or a faithful public-site replica.** The original C20 dashboard, C22 banner management and full page/navigation/content parity still require real source work.
- Existing screenshot values and labels may contain sample/demo figures, status counts or old Blood Bank promotional material. Do not seed screenshot demo metrics or private contact details as production data.

## How to obtain authoritative public source evidence

Use \`scripts/capture-client-website.mjs\` in a developer environment that can open the public site in a real browser. It is read-only, public-site-only, no cookies/login/admin/POST/payment submission. Capture desktop and mobile screenshots, screenshots by route, rendered visible copy and DOM structure, title/meta/canonical, navigation and CTAs, image src/alt/natural size, CSS font/colour/spacing samples and stylesheet URLs. Files stay under ignored \`.reference/careganga-live/\`, never committed to Git, never accidentally shipped.

Then inspect page-by-page with the original admin screenshots and make a brief verified inventory: original URL/path, exact visible text, HTML heading hierarchy, header/footer/navigation and sticky behaviour, images/assets/rights, styles, desktop/mobile states, CTA destination, forms, carousel behaviour, effects and owner for publication. Distinguish live source from demo screenshot values and from new healthcare-specific content. Public home/about/screens must be compared visually **against actual capture**, not against our own code.

## Acceptance / implementation mapping

| Original observed capability | New implementation owner | Current evidence and status |
| --- | --- | --- |
| Public Home/About copy, layout, images, header/footer | CG-18 public Web + Public Android, Admin CMS for editable content | New code source exists; **original public-site fidelity NOT_VERIFIED** |
| C20 Website CMS navigation, metrics, tabs and content pages | CG-18 | Screenshot verified; current simplified CMS incomplete against C20 |
| C22/C23 hero slide list, reordering, typography and mobile images | CG-18 | Screenshot verified; current single-HERO schema/editor incomplete |
| C25/C26 original team cards, drawer, permission/publication | CG-18 with source owner data | Screenshot audit available; screen/pixel and behaviour parity not passed |
| C50 login/member/volunteer switches | CG-18 visibility, CG-01 actual login, CG-04 actual join | Backend/public desired flags exist; no fabricated join destinations |
| Original public features unrelated to Blood Bank | Owning CG module, presented by CG-18 when published | **Preserve**, pending live public-site inventory |
| Blood Bank menu and functionality | Replace with Healthcare Assistance (CG-14/15/17 and approved CMS placement) | Exclude standalone blood-matching/old module; retain other menu sections |
| Backend permissions, safe media, approval, PostgreSQL integrity | CG-01/03/19/CG-18 | Source review and runtime QA remain separate gates |

## Non-negotiable implementation and QA rules

1. **Original CLIENT website = visual/content authority. New code = implementation to be checked, not a design reference.** No claim of exact replica until real desktop/mobile page captures and diffs exist.
2. Mirror original content with a controllable Admin CMS and approved media, not hardcoded replacement site copy. Preserve published source text and ordered sections; editable page fields. Do not reintroduce a Blood Bank module.
3. Do not over-engineer. Keep one actual backend, existing JASIQ authentication, permissions and foundation data model. Use source-owned links; no dead or fabricated routes.
4. Work only on \`feature/careganga-cg09-finance-accounting-dev-20261117\` for CG-18; proceed sequentially through US-001 → US-004 using JASIQ-dev implement → review → fix → re-review → source QA traces, with independent security/database/UI review and honest runtime NOT_RUN labels.
5. Do not mark US-001 source-complete until both original public fidelity reference gaps and all required source QA are resolved. Do not merge before owner authorizes the shared branch's final source gates.
