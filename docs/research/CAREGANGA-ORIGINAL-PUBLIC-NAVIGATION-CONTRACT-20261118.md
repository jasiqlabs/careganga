# CareGanga — original public website navigation and page ownership contract
**Authority:** client-owned 10 screenshots (17 Nov 2026), original screenshot audit, approved BR/PRD/HLD and current CG-18 source. **Date of reconciliation:** 18 Nov 2026. **Gate:** screenshot-verified labels; original destination URL/DOM/mobile behaviour is **NOT_VERIFIED**. No fake routes or screenshot/demo data. This is an acceptance inventory, not a fifth CG-18 user story.

**Reference:** `docs/research/CAREGANGA-CLIENT-PUBLIC-WEBSITE-SCREENSHOT-AUDIT-20261117.md`. Ten original PNGs preserved privately at `/CareGanga/CareGanga-Original-Public-Website-Visual-Reference-20261117.zip`. The original client website is **not** the GitHub replacement. The intended only primary functional replacement is top-level **Blood Donation → Healthcare Assistance**. Preserve the separate original **Our Work → Healthcare** category.

## Visible original main navigation — 12/12 labels, but not 12/12 journeys
| # | Screenshot-visible item | Replacement route / disposition | Source owner | Actual implementation requirement and present gap |
|---|---|---|---|---|
| 01 | Home | `/` | CG-18 | Current SSR exists; original full sections, media, hero and mobile fidelity not accepted |
| 02 | About Us ▾ | `/about` for main page; **original submenu children UNKNOWN** | CG-18 / optional CG-02/10 | Original top-level item has a dropdown chevron, while current header is a flat About link. Obtain child names and real target URLs from client; do not invent them |
| 03 | Our Work ▾ | Genuine CG-05 projects/category filter | CG-05 listing & safe data; CG-18 header/visual | Six exact children below; current replacement has text-only disabled entries |
| 04 | NGO Information | `/impact` is **temporary editorial mapping, not verified as original URL/content** | CG-18 / CG-09 or CG-20 for real reports | May also include NGO profile, transparency, registration, 80G; verify original destination and page hierarchy |
| 05 | Campaigns | CG-07 approved public listing/details; exact original URL UNKNOWN | CG-07; CG-18 header | Current header placeholder; no invented donation intent or paid claims |
| 06 | Upcoming Projects | Genuine planned/approved projects; URL UNKNOWN | CG-05; CG-18 header | Current header placeholder; future-source receiving integration only |
| 07 | Partnerships | Approved partners/collaborators + relevant enquiry; URL UNKNOWN | CG-08 for verified operational partners; CG-18 for editorial/logo/visual | Current header placeholder. Milaap/Ketto names/logos appear in screenshots but do not prove active approved partnerships or asset rights |
| 08 | Events | Genuine published events/calendar/details; URL UNKNOWN | CG-05 event owner; CG-18 placement | Current header placeholder; do not create a shadow event master |
| 09 | Media & Resources ▾ | `/gallery`, `/blog` and approved media-type filters | CG-18 + CG-19 originals | Five exact children below; Videos and Publications/Reports need accessible navigable filtered views, not dead labels |
| 10 | Join Now ▾ | Actual public join links only after ready | CG-04 member/volunteer forms; CG-18 versioned visibility | Two exact children below; no fabricated public registration form |
| 11 | **Blood Donation** | **Healthcare Assistance**: `/healthcare` editorial, optional live directory/consultation | CG-18 editorial; CG-14/15/17 actual services | Exactly one approved functional/menu replacement, retain previous unrelated historic editorial records |
| 12 | Contact Us | `/contact` | CG-18 public shell; CG-19 private enquiry | Original CG-19 form/receipt, no duplicate inbox; screenshot-matched page pending |

### Original Our Work submenu — exactly 6 captured entries
| Item | Real owner / linked destination rule |
|---|---|
| All Projects | CG-05 published projects, filter ALL |
| Education | CG-05 published projects filtered by true Education category |
| Healthcare | CG-05 Healthcare category, **not** the standalone Healthcare Assistance module |
| Livelihood | CG-05 genuine Livelihood filter |
| Social Welfare | CG-05 genuine Social Welfare filter |
| Community Development | CG-05 genuine Community Development filter |

**Rule:** preserve all six names and hierarchy. Activate only with a real root-scoped approved CG-05 public URL/list/filter and matching accessible page. Unknown original path remains documented as unknown. No static fake project cards.

### Original Media & Resources submenu — exactly 5 captured entries
| Item | Genuine CG-18/19 reader outcome |
|---|---|
| News & Updates | Current approved news/articles listing; actual source-kind/category only, not mock news |
| Gallery | `/gallery` — only CG-19 verified, rights-cleared approved media |
| Videos | A distinct selectable VIDEO view of the real approved gallery; reusing `/gallery?type=VIDEO` is a *replacement implementation choice*, not a verified client URL |
| Publications / Reports | A distinct selectable PUBLICATION view of approved media, plus `/80g` verified reports where applicable; `/gallery?type=PUBLICATION` is a replacement implementation choice |
| Blog | `/blog` and current approved `/blog/[slug]` |

### Original Join Now submenu — exactly 2 captured entries
**Become a Member** and **Become a Volunteer**. Actual CG-04 canonical published destinations only; CG-18 owns versioned menu visibility and does not create competing join records. C50 public join controls cannot make unimplemented routes active.

## Footer, social, sticky actions — screenshot 10
| Visible original label/control | Acceptance and owner |
|---|---|
| Quick Links: About Us, Campaigns, Donate, Contact | About/Contact current route; Campaigns/Donate only genuine CG-07 public entry and payment confirmation |
| Policies & Legal (seven original Footer Policies & Legal: Terms & Conditions, Privacy Policy, Cookie Policy, Disclaimer, Refund & Cancellation, Grievance Redressal, Copyright & Intellectual Property) | **7 client-approved legal content pages**; CG-18 owns approved editorial page/SEO/visibility and footer links; legal wording and applicability must be supplied/approved by client, **never hallucinated**. Current code only renders non-clickable labels |
| Newsletter email and SUBSCRIBE | CG-18 owns original presentation. CG-19 owns any real opt-in receipt, unsubscribe and notification delivery; no fake subscribed success or contact-list duplication. Current code only states unavailable |
| Facebook / Instagram / YouTube / CONNECT social icons | Show as links only when real Foundation-owned verified URL is configured; current glyphs are visual placeholders, not verified social destinations |
| Floating DONATE NOW | CG-07 real enabled donation destination; preserve original position/shape in CG-18; never claim money received when clicking |
| Floating WhatsApp | Only validated Foundation contact destination; do not hardcode screenshot contact as authoritative verified production data |
| Separate floating circular graphic | Screenshot-visible, function unknown: preserve as evidence; never invent an action |
| Footer logo, address, phone, email, mission and legal copyright | CG-18 editable, client-verified original content and CG-19-approved media, not sample seed values |

## Per-item definition of done (apply to owning module, no new duplicate stories)
1. **Screenshot/BR ownership:** exact visible title, hierarchy, original URL if verified; annotate UNKNOWN otherwise; no made-up path claim.
2. **Actual backend source:** original owner manages operational data, state and permissions. CG-18 manages editorial display, verified media and versioned approval only.
3. **Admin:** role-permitted editing/preview/status/visibility; CG-21 editable error messages; no technical IDs; default to simplest working version.
4. **Public Web and native Android:** working accessible destinations when genuinely ready, truthful disabled/not-published state otherwise, matching effective publication/revocation/SEO, no unsafe external redirects.
5. **QA:** original screenshots desktop/mobile/hover/dropdown/footer; link click, browser Back, native Android Back; stale publish/disable; unavailable source; active original route; no fabricated business data; record source trace separately from executed runtime/pixel QA.
6. **Release proof:** real source owner is implemented; client authorizes legal text, partner identities, social handles and imagery where required. Original DOM/mobile/animations and original About submenu remain **NOT_VERIFIED** until captured.

## Gap allocation, without overengineering
- **CG-18 US-001**: exact header 12 + About dropdown pending evidence, Our Work and Join menu hierarchy, footer branding/quick/legal link visibility, source-backed original CTAs, mobile behaviour.
- **CG-18 US-002**: NGO Information/Impact mapping, proof-backed 80G, approved policy/report linking where genuinely available.
- **CG-18 US-003**: Media five children including explicit video/publication filters, partner editorial cards with permissioned originals, Contact page shell, newsletter UI plus actual CG-19 opt-in owner contract.
- **CG-18 US-004**: replace only top-level Blood Donation slot, keep separately existing Our Work/Healthcare, neutral source-based healthcare page.
- **CG-04**: Member/Volunteer real registrations. **CG-05**: Our Work six filters/Upcoming Projects/Events. **CG-07**: Campaigns/Donate. **CG-08**: current real partnerships. **CG-14/15/17**: real healthcare directory/booking/benefits. **CG-19**: enquiry, media and optional real newsletter subscription consent/delivery. Source owner must make its link available when built and approved, without a duplicate CG-18 business master.

**Status as of 18 November:** screenshot navigation inventory COVERED IN THIS FILE; actual full page/route/parity **OPEN**. Static source review is not runtime/pixel QA. This document must be used with PRD, HLD, CG-18 UIUX/DLD/tasks and receiving-owner task definitions; `main` remains untouched.


## Source implementation checkpoint — 18 November (not runtime completion)

- Original 12 primary labels, six Our Work labels, five Media, two Join and seven footer policy names are in the replacement source; this **does not** mean all pages work.
- CG-18 Media **Videos** and **Publications / Reports** now link to real query-selected, currently approved Gallery filters (`/gallery?type=VIDEO` / `/gallery?type=PUBLICATION`); no invented original URL is claimed. Static source checks only, runtime and original pixel comparison NOT_RUN.
- Seven original policy page types, draft authoring, strict nonempty-source submission, CG-03 approval, new migration `0940`, protected Next.js routes `/policies/[slug]`, publication-gated footer links and Public Android legal navigation are implemented **in source**. The client must provide/approve actual legal content, and each must be published before a link can become live. No policy text seeded, no existing policy URL verified from live original.
- Newsletter email/button currently **display but intentionally disabled** until CG-19 real opted-in subscription intake, receipt and unsubscribe source is available. That is an identified **OPEN business gap**, not a hidden success.
- CG-05 Our Work and Upcoming Projects/Events, CG-07 Campaigns/Donate, CG-08 verified Partnerships and CG-04 Member/Volunteer destinations remain owner-dependent; original About dropdown child items, social URLs and original policy bodies are still unobserved.
- **Source-only preflight 16/16** narrowly selected original navigation/typed policy/media guard checks evaluated against the current GitHub source through read-only retrieval on 18 Nov. This is **not** `npm run verify:cg18-source`, a TypeScript build, Postgres migration, browser/mobile test or independent security review. **0/76 executable CG-18 QA**.

## 18 November 2026 — approved receiving-owner allocation and public-source safety

**Owner direction:** Original client public/Admin screenshots are the reference for layout, labels, routing and editorial content. The JASIQ replacement is greenfield. All business records belong to their already-approved original domain; **CG-18 owns ONLY source-authorized editorial composition, navigation, public rendering and publication controls**. This is a receiving-owner decision within existing stories, **not a new module/story/duplicate source**, and makes no unverified client legal or financial fact public.

| Original screenshot/page family | Authoritative source owner | Rendering and verification | Public-data contract / open requirement |
| --- | --- | --- | --- |
| **About → Team / Leadership Directory** `/about/team` | CG-10: active employee, assignment/designation, current revocable public-profile consent. CG-04: actual eligible approved member/volunteer profile and revocable consent. CG-02: authorized State → District → Sub-Division → Block geography. | CG-18 owns original hero, approved intro/order/cards/name search/dependent location+designation selectors/reset/empty states; CG-19 validates published photo file/version/rights and direct URL eligibility. | No manually asserted CMS consent as sole evidence, public internal employee/member ID, private HR contact/KYC/salary/bank or stale/withdrawn profile. Until real owner-approved projection exists, no public Team person cards or direct TEAM media; this is an explicit fail-closed source boundary, **not completed Team Directory**. |
| **Our Impact / Our Work / upcoming projects / Events** | CG-05 for actual project, field work, approved categories, project/event lifecycle; CG-20 for independently reviewed, public-safe impact aggregates. | CG-18 page hierarchy, approved narrative/media/navigation; CG-19 cleared originals. | No screenshot/demo statistics as verified facts, no fabricated project cards, donor claims or upcoming event links. Real owner publishes current safe data before CTA activation. |
| **NGO Information: PAN, 80G, Registration/Registrar and statutory identity** | CG-02 Foundation identity and current legal facts/evidence status. | CG-19 holds genuine scanned versioned authorized proof; CG-18 owns separate original NGO subsections and approved metadata/page filters. | No private PAN values, expired tax eligibility, fake registration data, or stock screenshot number released without authorized original/current verification. |
| **NGO Information: Annual Reports, Financial Reports / Publications** | CG-09 owns actual general ledger and source finance statements; CG-20 owns independent public-release selection and safe reporting projection. | CG-19 owns original approved report PDF/storage/scan and rights; CG-18 owns yearly filter, report list/table, download destination and source status. | Report existence and visibility require actual authorized approved owner source. Do not treat a CMS publication card or screenshot-only amount as an executed public financial statement. |
| **Member / Volunteer join, Team eligible volunteer** | CG-04 owns registration, eligibility and revocable member/volunteer source. | CG-18 renders original Join hierarchy/links and approved public profiles only. | No duplicate CMS member master; disabled/unpublished CTA until CG-04 real route and permissions exist. |
| **Campaigns / Donate** | CG-07 owns campaign, donor receipt/payment and verified outcome. | CG-18 header/footer/donate CTA; CG-19 receipt, certificate, approved file template. | No pretend payment completion, public donor record, or anonymous donor PII; only real published campaign flow. |
| **Partnerships / CSR** | CG-08 operational partner agreements and approved current collaborators. | CG-18 approved logo/card/CTA; CG-19 license/right-cleared assets. | Screenshot brand placement does not prove current partnership or copyright authorization. |
| **Healthcare Assistance** (replaces ONLY original top-level Blood Donation slot) | CG-14 verified partner catalogue; CG-15 appointment/patient process; CG-17 approved Foundation benefit/settlement. | CG-18 public intro/categories, route and navigation; CG-19 genuine rights-cleared media. | Keep separate Our Work → Healthcare category CG-05, avoid invented doctor/price/appointment/settlement, medical/identity data or old removed feature. |
| **Notices, Contact, Media, Newsletter** | CG-19 owns private contact case/notice distribution, source media bytes, scan and rights; newsletter consent/opt-out if implemented. | CG-18 approved public cards/filter/order and publication; CG-21 safe editable UI error copy. | No public private notice recipients, no 24/7 support or newsletter confirmation until real service; old direct media URL checked on each read. |

**Cross-owner implementation decision (current source):** A CMS editor's `TEAM.members[].consentConfirmed` checkbox alone does not verify current employment/membership or revocable public consent. Current CG-18 save and public projection are source-hardened to reject manual team-member publication and strip earlier public team fields/photo placement; CG-19 rejects direct public `TEAM` media URL access. The respective CG-04/CG-10 source owners must later introduce safe profile projections; CG-18 then activates the original `/about/team` filters and rendering, without taking ownership of HR records. Existing approved editorial and other non-Team media remain unaffected by intent. **Runtime behavior and the rendered comparison still NOT_RUN.**

**Minimal original-navigation routing:** Preserve known original page hierarchy and titles; an unverified original child URL, About dropdown content, exact pixel/animation or approved financial/legal value remains **UNKNOWN** until original site/client confirmation. Prefer an unavailable state over an invented link. CG-18 US-001/002/003/004, CG-19 US-001/002 and receiving CG-02/04/05/07/08/09/10/14/15/17/20 existing QA scenarios must include current vs revoked source, two Foundation roots, direct media access, desktop/mobile/native view, empty/error/Back/focus, and source owner approvals. No new QA IDs, source-complete signoff, merge or runtime PASS is implied.
