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
| Policies & Legal: Terms & Conditions, Privacy Policy, Cookie Policy, Disclaimer, Refund & Cancellation, Grievance Redressal, Copyright & Intellectual Property | **7 client-approved legal content pages**; CG-18 owns approved editorial page/SEO/visibility and footer links; legal wording and applicability must be supplied/approved by client, **never hallucinated**. Current code only renders non-clickable labels |
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
