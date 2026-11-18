# CG-BR-300 — CMS, Public Website and Application Channels

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Status:** Consolidated business requirements · Delegated default policies recorded in CG-BR-900  
**Coverage:** CG-18 CMS/publication; presentation and permissions of canonical CG-01–CG-24 across the five approved interfaces, with optional healthcare ERP functions disabled by default and subject to the original owning-module permissions.

## 1. Core operating principle

The **Foundation Admin** is the central business administration environment. **CMS** is the **editorial and public-publishing capability inside that Admin**, not a replacement for Foundation finance, membership, healthcare operations or HR systems.

A public page can display information coming from two sources:

1. **Editorial content managed by CMS:** Headings, paragraphs, banners, photographs, links, About Us, stories, blog entries, notices, published compliance documents, layout order and on/off display.
2. **Published business data selected from its owning module:** Membership tiers, campaigns, approved project summaries, donation progress, provider centers/doctors, prices, appointments/availability and reviewed achievements.

The CMS can set visibility, narrative and display order for an **approved business record**, but must not maintain an independent editable copy of its prices, application status, medical registration, booking slots, bank balances or employee employment status.

**The same public content and approved business data** should feed the website and relevant public Android app. Private member/volunteer/patient self-service consumes authenticated owner records, not generic CMS content.

## 2. CG-18 — Website CMS and controlled publication

### 2.1 Content management

- **CG-18-BR01:** Provide a web-based authorized content dashboard with supported pages/sections, their status, preview and publication controls.
- **CG-18-BR02:** Create, edit, preview and publish homepage hero banners, text, CTA labels/links, images, display order and applicable page visibility.
- **CG-18-BR03:** CG-18 initially owns consented editorial public team biography/name/designation/photo/order/preview/published status without CG-10 employee prerequisite. **CG-10 US-001** later introduces optional current real employee identity/consent/public safe-field link; private HR fields never copied or assumed public.
- **CG-18-BR04:** CG-18 owns public teaser placement/visual and can initially show truthful empty/neutral editorial initiative. **CG-05 US-001** introduces actual approved project name/status/dates/financial reference via its own public projection and QA after real source exists; CMS never creates an operational project master.
- **CG-18-BR05:** Maintain reusable website gallery and media library, including uploaded image/document metadata and permissions.
- **CG-18-BR06:** Create/manage blogs, articles, public news and updates with editorial publication controls.
- **CG-18-BR07:** Own public website **contact form presentation and approved page/route publication only**, using the genuine CG-19 public-contact submit/receipt/status API. The **single original contact enquiry/support record, private contact details, responder assignment, replies, status and history are owned by CG-19**, not a second CG-18 CMS table. CG-19 Foundation contact works before CG-18 website is published.
- **CG-18-BR08:** Enable content preview, submit-for-review, approve/reject, authorized publishing/unpublishing and **scheduled publication** where supported, with author/reviewer/publisher rights from CG-01/03, public visibility/status and an audit trail.
- **CG-18-BR09:** Own three separate, versioned **Login/Profile**, **Membership registration/join**, and **Volunteer registration/join** visibility/publication controls. Authorized CG-18 preview/review/publish controls their effective navigation on the public website and Public Android; actual Login stays CG-01 and member/volunteer registration stays CG-04 when delivered. A desired enabled flag is not permission to show a link to an absent registration route; never duplicate these switches in CG-21.
- **CG-18-BR10:** Maintain editable public menu, heading, CTA, images, SEO metadata and page publication where supported; public channels reflect saved state, not UI hardcodes.

### 2.2 Foundation information, NGO transparency and compliance pages

- **CG-18-BR11:** Publish Foundation profile, mission/work, team information and other selected NGO information with correct editorial visibility.
- **CG-18-BR12:** Provide the 80G information page editor for section enablement, ordering, title/subtitle/badge/description, hero/organization imagery, legal/approval numbers, PAN, dates/validity, issuing authority, attached approval documents, donation CTA and preview/publish.
- **CG-18-BR13:** Maintain published PAN, registration documents, annual reports, financial reports and transparency/compliance content via authorized uploads and review.
- **CG-18-BR14:** Do not treat editable public certificates/reports as proof of continuing statutory validity: document authenticity and current validity remain client-controlled obligations.

### 2.3 Our Impact — ten required content groups

The source explicitly enumerates **ten** editable content groups:

| ID | Content group | Required editable/display capability |
| --- | --- | --- |
| IMP-01 | Header | Intro/eyebrow, primary heading, highlights, quote, subtitle, hero image, mobile CTA |
| IMP-02 | Foundation Pillars | Icon/label/description cards, add/remove and ordering |
| IMP-03 | Impact Statistics | Value/label cards; distinguish manually maintained vs derived statistics |
| IMP-04 | Impact Growth Chart | Title, date range, description and year-wise values |
| IMP-05 | Geographic Reach | Geographic statistics, tabs, legend, state highlights and map pins |
| IMP-06 | Impact by Category | Category/percentage/value/color and chart descriptions |
| IMP-07 | Key Impact Areas | Cards/images/descriptions supporting Foundation's work |
| IMP-08 | Success Stories | Approved stories/media with appropriate personal-information consent |
| IMP-09 | Latest Updates | Selected announcements and program changes |
| IMP-10 | Call to Action | Heading/subtitle, button label/link and supporting badges |

- **CG-18-BR15:** Admin can edit, preview and publish each required Impact section.
- **CG-18-BR16:** Where possible, draw counts from verified project/beneficiary/donation/center reporting. Where the business specifically requires editorial figures, preserve clearly identified source/date and authorized updates rather than implying automatically audited numbers.
- **CG-18-BR17:** A story about a beneficiary, donor, patient or volunteer is *not* permission to disclose their private operational records. Public photo/name/testimonial requires a legitimate approved publication basis.

### 2.4 Healthcare-specific publication

- **CG-18-BR18:** CG-18 US-004 independently owns approved Healthcare Assistance editorial hero/general categories/neutral informational CTA and existing page shell with no provider prerequisite. Genuine provider/doctor search and cards are introduced by **CG-14 US-004**, actual booking by **CG-15 US-002/004** and source-backed support copy by **CG-17 US-007**; no fake online directory or numerical discount in original CMS.
- **CG-18-BR19 — transferred delivery to CG-14 US-004:** Real center/doctor directory, status, service/facility/fees and public Web/Public Android search/card UI/API/QA are delivered by CG-14 with genuine approved records; CG-18 owns only editorial headings/placement/revision and never duplicates provider or fee source.
- **CG-18-BR20 — transferred delivery to CG-17 US-007:** Real benefit percentage/cap/eligible policy-based public badge and current provider/service applicability are created and verified by CG-17, which introduces its approved public-safe content into CG-18 placement. CG-18 initial copy is nonnumeric editorial text and cannot promise an unverified percentage.
- **CG-18-BR21 — transferred delivery to CG-14 US-005:** Only a real verified center operator uses CG-14 Center Portal to submit own services/description/CG-19-validated photos/FAQs, then source-safe approved content is introduced into CG-18 publication. CG-18 does not create center records or a second center profile.
- **CG-18-BR22 — transferred delivery to CG-15 US-002/004:** Actual enabled Book Appointment route, provider/doctor/center/slot eligibility and public Web/Public Android CTA are CG-15 source integrations into CG-18/CG-14 presentation, not a CG-18 mockup or a booking master. First CG-18 healthcare page has no bookable button.
- **CG-18-BR23:** Public health content cannot expose patient files, clinical consultations or detailed doctor/center internal financial information.
- **CG-18-BR24 — transferred operational delivery to CG-05 US-002:** Actual operational event/activity/date/status and approved public event view are introduced and QA-tested by CG-05 into CG-18 editorial placement. CG-18 US-003 independently publishes news/editorial updates but cannot maintain fake operational events or paid seats.
- **CG-18-BR25:** Homepage hero/banner administration includes draft/active/publication state, order, desktop and optional mobile images, heading/tagline/description, accessible typography/visual treatment, optional overlay, primary/secondary CTA labels and targets, and a realistic desktop/mobile preview. These are editorial presentation controls; configuration is stored once and reflected in applicable public channels.
- **CG-18-BR26:** Public team cards and upcoming-project teasers can be configured by authorized editors with display order, image, title/role/category/location/summary, published status and approved additional public biography/recognition fields. Where linked to a member, employee or project, the owning module remains authoritative.
- **CG-18-BR27:** CG-18 owns approved public **publication/order/metadata** of gallery, articles, reports and selected notices; **CG-19 owns file/media bytes and original operational notice/audience/delivery/source**. Public notices consume a permissioned CG-19 safe approved projection and separate CG-18 publish state, never duplicate CG-19 notice rows. Contact requests and replies stay entirely in CG-19's protected single source.
- **CG-18-BR28 — split by true owner:** CG-18 owns editorial slot/page publication. CG-14 US-004/005 introduces actual center/doctor/service/status/fees; CG-15 US-002/004 introduces enabled booking CTA; CG-17 US-007 introduces verified eligible percentage/cap copy. Each later owner integrates real public-safe projection and QA, not duplicate CMS health masters.

## 3. Public website navigation and page ownership

**Original-client screenshot navigation acceptance (18 Nov):** The *actual* existing public desktop header has **12 primary entries**, including **About Us ▾**, **Our Work ▾** (six exact category children), **Media & Resources ▾** (five exact children), and **Join Now ▾** (two children), plus the seven original Footer Policies & Legal links, newsletter, social channels and floating actions. Exact inventory, source-owner decisions, known route gaps and non-fabrication rules are in [canonical original public navigation contract](../../docs/research/CAREGANGA-ORIGINAL-PUBLIC-NAVIGATION-CONTRACT-20261118.md). **The top-level Blood Donation slot alone becomes Healthcare Assistance**; the original Our Work → Healthcare remains a project category. The 10 screenshots do not prove About dropdown children, original URL targets, live mobile states or legal policy text; do not invent them. This screenshot-verified structure supersedes any generic suggested header labels below, without adding a new module or duplicate business lifecycle. Public Web and Public Android must use only current approved source-backed destinations; CG-18 owns presentation/approval while CG-04/05/07/08/14/15/17/19 retain operational owners.



The newer UI references demonstrate an integrated top navigation around **Home, About Us, Our Work, Healthcare Assistance, Centers & Labs, Projects, Partners, Media & Resources, Join Now, Donate Now**, along with search and Login/Register. The reference label **Register** means only genuine published membership/volunteer/patient business-application entry points; it does not authorize public creation of a CG-01 login account.

These labels are **design references**; final copy and routing remain editable under the approved navigation model. The following page ownership is the proposed requirement structure:

| Public page / journey | Data owner | What authorized admin configures | Public interaction |
| --- | --- | --- | --- |
| Home | CG-18 + selected modules | Hero, featured cards, CTA links, published sections/order | Navigate to Foundation and healthcare services |
| About Us / Team | CG-18, CG-02/10 references | Editorial mission/about/team and visibility | Read Foundation background and permitted team |
| Our Work / Programs / Impact | CG-05/06/20 + CG-18 | Published projects, stories, aggregates, Impact sections | Browse approved work, achievements, geographic reach |
| Campaigns / Donate | CG-07 + CG-09/18 | Campaign content/status, eligible payment link/configuration | Donate and get proper payment/receipt status |
| Join as Member | CG-04/03/09 + CG-18 | Active plans/benefits, registration-page content/visibility | Apply, pay, track, see approved member ID |
| Join as Volunteer | CG-04/03 + CG-18 | Form intro, program choices and public visibility | Register, upload documents, track and manage own participation |
| CSR Partners | CG-08 + CG-18 | Approved partner descriptions, CSR enquiry/registration publishing | Discover partners/apply where enabled |
| Healthcare Assistance | CG-14/15/17 + CG-18 | Hero, category list, marketing copy, featured doctors/centers, permitted service CTAs | Discover providers, eligible doctor booking |
| Centers & Labs | CG-14/16 + CG-18 | Approved provider/service information and filtering/display controls | Search/list/map provider centers and investigate services |
| Doctor Profiles | CG-14/15/17 + CG-18 | Publish status and profile editorial text; owner manages fees/schedules | View specialties, locations, availability, price/support |
| Appointment Booking | CG-15/17/09 | Booking/payment policies, assistance rules; editorial help text | Choose doctor/center/slot, verify patient, book and pay |
| My Healthcare | CG-15/16/17 | Authenticated patient rights, document templates/notifications | Appointments, slips, receipts and permitted reports |
| Media, Gallery, Blog, Notices | CG-18/19 | Content, image rights, editorial approval/publishing | Browse content and announcements |
| NGO Information / 80G / Reports | CG-18 + CG-09/20 where linked | Relevant legal details, reports/documents, validity and visibility | Read and download approved public documents |
| Contact / Help | CG-18/19 | Contact details, form fields, help content, support assignment | Submit enquiry and receive permitted response |

**Important meeting requirement:** An internal Foundation branch is *not* automatically a public branch page. Approved healthcare centers are intended for the **published provider directory** once verified and eligible.

## 4. Center search, provider display and healthcare booking UI references

The screenshots supplied in November 2026 illustrate these design reference screens. They are **not independent modules**; each draws from CG-14/15/16/17:

| Reference concept | Business source and behaviour |
| --- | --- |
| Healthcare service categories landing | CMS manages visible categories and copy; CG-14/16 own real provider/services |
| Service listing and partner center search | CG-14 verified centers; filters by provider category, geography, facility and benefit; list/grid/map |
| Center details | CG-14 profile/facilities/doctor associations; CG-17 published valid fees/assistance; CG-18 editorial wrapper |
| Doctor search/profile, multi-center availability | CG-14 doctor/professional and associated center fees; CG-15 live schedule |
| Center-first date/time booking | CG-15 center association, date/slot; CG-17 fee breakdown |
| Slot-first auto-center booking | CG-15 chooses center from actual doctor schedule/time; patient sees assignment before confirming |
| Patient registration and review | CG-15 verified patient identity, medical-doc upload/consent and booking details |
| Booking summary and online/pay-at-center choice | CG-15 booking; CG-17 patient/Foundation amounts; CG-09 verified collection |
| Payment screen | Configured Razorpay (provider-hosted payment state), safe verification and retry |
| Booking confirmation and PDF slip | CG-15 booking/QR and patient/doctor/center; CG-17 payment and contribution; CG-19 template/generation |
| My Appointments and verification | CG-15 authenticated history, QR/ID lookup with access control; CG-16/17 permitted reports/receipts |

**Initial publication policy:** Extra public lab/medicine/nursing/OT buttons are informational/enquiry-only, not active checkout. Do not publish sample support percentages or review counts as facts, and do not show unavailable family/prescription functionality as enabled. Current provider and appointment data come from their authoritative modules; see [CG-BR-900](04-TRACEABILITY-DECISIONS.md).

## 5. Admin Panel operating model: one control point per capability

Administrators should not see numerous duplicated settings for one business result.

| Admin navigation grouping | Business owner modules | Controls available in that grouping |
| --- | --- | --- |
| **Dashboard & Approvals** | CG-20/03 | KPIs, actionable pending queues, approval route, quick actions |
| **Organization** | CG-02/01 | Branches, departments, committees, location, scoped users/roles |
| **People & Membership** | CG-04/03/13 | Member/volunteer registrations, plans, referrals, ranks and rewards |
| **Projects & Programs** | CG-05/06/07/08/12 | Projects, tasks, visits, beneficiaries, campaigns, CSR, inventory |
| **Finance** | CG-09/11/17 | Vouchers, accounts, budgets, payroll finance links, healthcare collections/settlements |
| **Human Resources** | CG-10/11 | Employee records, attendance, leave, payroll, letters, lifecycle |
| **Healthcare Network** | CG-14 | Provider/branch/doctor directory, verification, services, affiliations |
| **Healthcare Operations** | CG-15/16 | Slots, appointments, patients, queues, internal lab orders/reports |
| **Healthcare Financial Assistance** | CG-17 | Benefit eligibility/policy, funded amounts, billing, dues and settlement |
| **Website & Content** | CG-18 | Banners, pages, Impact, published projects, team, NGO information, provider publicity, SEO |
| **Communications & Reports** | CG-19/20 | Notifications, notices, templates, support tickets/FAQs, MIS, export/schedules |
| **System & Security** | CG-01/21 | Access, audit, integrators, backups and general configuration |

This is a **logical navigation proposal**, not a demand to create a different application for each group. Keep the final experience premium, clear, responsive and role-sensitive.

## 6. Healthcare Center Portal — what the Foundation controls vs the center

| Concern | Foundation Admin | Healthcare Center Portal | Public |
| --- | --- | --- | --- |
| Center registration, status, license | Verify, approve, suspend, publish | Submit/update permitted own-center data | View approved public information |
| Center doctor listing | Verify doctor, network-wide oversight | Add/request association and manage own assigned doctor links | Browse published doctors |
| Doctor schedule | Override/monitor within authority | Maintain own center-wise availability/leave | See live bookable slots |
| Fees / contribution | Approve policies, caps and center rules | Configure permitted fees, view applicable policy | See gross/benefit/payable |
| Patient/appointments | Authorized network reporting/corrections | Own-center registration, check-in, queue and visits | Own appointments and documents |
| Diagnostics | Master oversight and lab reports | Own-center test catalog/prices/order/sample/report | Published information; own permitted reports |
| Payment/settlement | Network-wide help, dues, provider settlement, reconciliation | Own-center collection, refunds/adjustments within grant and statements | Own receipt and due |
| CMS/publicity | Final public publication authority | Propose center content and media where enabled | Approved center profile only |
| Staff access | Create/approve accounts, scopes and privileged roles | Manage permitted own-center users | No internal access |
| Reporting | Organization-wide authorized views | Own-center/branch reporting | Own booked service/receipt only |

**Portal usability:** Center operators should not need to understand the entire Foundation ERP to check in a patient or record payment. Show only relevant operational functions. A Center Portal login cannot be used to browse another center's patients.

## 7. Public Android application

- **CG-300-BR01:** Public application reproduces applicable public information and key member/volunteer/donation/healthcare self-service of the responsive site using same current source data.
- **CG-300-BR02:** Support public homepage, Foundation content, published programs/campaigns, impact, news and announcements.
- **CG-300-BR03:** Support member/volunteer registration, verified login, status, approved identity documents, payment/receipt and referral/reward data for eligible users.
- **CG-300-BR04:** Support healthcare doctor/center discovery, verified patient registration, eligible doctor booking, payment state, booking receipt/QR, calendar export and appointment history to extent agreed in mobile PRD. Public browsing of additional services and their transactional buttons must follow the approved CG-16 scope; do not infer delivery/order checkout from a mockup CTA.
- **CG-300-BR05:** Support user notifications, applicable payment confirmations and contact/support actions.
- **CG-300-BR06:** Public application must not render internal admin functions merely because the same backend provides them.

## 8. Internal Android application

- **CG-300-BR07:** Internal Android presents its own native sign-in screen using the same CG-01 mobile/email + password credentials and revocable session/role authority as Admin Web, then shows a dashboard with assigned role, pending work, relevant alerts and permitted modules.
- **CG-300-BR08:** Authorized employees/volunteers/coordinators can manage assigned records and workflow decisions within their permitted scope: registrations, verification/approvals, projects, field visits with GPS/photo, beneficiary aid, tasks, attendance, leave, expenses/allowances, stock requests and applicable finance/healthcare coordination.
- **CG-300-BR09:** Apply the same backend authorization and business statuses as Foundation Web Admin; navigation hides inaccessible features but hiding alone is never enforcement.
- **CG-300-BR10:** Allow secure file capture/upload, field evidence and action feedback; preserve correct draft/submission state on interruption. This is safe interruption/retry handling; a full offline synchronization capability must not be presumed without an approved business requirement.
- **CG-300-BR11:** Heavy back-office settings such as full ledger management, custom report builder, payroll policy and complex role matrix require a **role-by-feature mobile screen mapping** in PRD. Do not silently assume full web UI duplication, and do not omit capabilities explicitly assigned to internal mobile in the written scope.

## 9. Foundation Web Admin and responsive public web

- **CG-300-BR12:** The main Foundation Admin presents role-specific dashboards, quick actions, pending approvals and contextual record search without clutter.
- **CG-300-BR13:** Administrators can configure each module's approved settings and operate within grants; settings affecting public website/app are reflected consistently after publication.
- **CG-300-BR14:** Public website and Center Portal are usable on desktop/tablet/mobile browsers with appropriate responsive adaptation.
- **CG-300-BR15:** All channels must show human-readable success, pending and error states, and not mask a failed backend action as successful.
- **CG-300-BR16:** Navigation between public marketing, healthcare search, member registration and authenticated self-service should be cohesive, while protecting restricted routes.

## 10. Publication lifecycle and authority

Recommended common business flow:

**Author/edit CMS content OR select an approved business record → preview → submit for publication approval if required → publish → website/app display → update/unpublish with history.**

For published business records, two independent gates normally apply:

1. **Operational eligibility** — e.g., center verified, active doctor association and valid fees; project/campaign approved for publication.
2. **Public visibility** — editorial/display authorization and enabled section.

**Publication is never an alternate path to business approval.** A CMS editor cannot approve a doctor by publishing a profile. A center admin cannot alter Foundation support by changing a discount banner. A payment status on public receipt comes from verified financial processing, not user-entered CMS text.

## 11. Reporting and communications through public interfaces

- **CG-300-BR17:** Public notices and announcements use approved CMS content or notification audience controls.
- **CG-300-BR18:** Private transaction notices (membership approval, appointment confirmation, expense decision, payroll notification) use event-appropriate recipient and template through CG-19.
- **CG-300-BR19:** Public donation/campaign progress, impact cards and healthcare availability use the authorized business source; dashboards and external exports use CG-20 filters.
- **CG-300-BR20:** Admin must know what is publicly visible: preview the public view of a section/provider/plan/campaign before publishing and see its current publication status.
- **CG-300-BR21:** Foundation Admin provides navigable, role-sensitive sidebar/menu groups and both a module-navigation search and an authorized cross-record search by appropriate name/reference/contact. Search results, linked selection lists and quick actions are constrained to permitted record scopes.
- **CG-300-BR22:** List/detail/work-queue patterns support meaningful empty/loading/error/permission-denied states, configurable filters, pagination and contextual approvals. For mobile widths, dense tables and multi-step forms adapt to readable card/detail or step views rather than shrinking full desktop grids.
- **CG-300-BR23:** A person with a permitted workflow must be able to select necessary related records (for example assigned staff, branch, authorized payment account, doctor or center) without being granted unrelated management rights; backend authorization still validates the action.

## 12. CMS and channel acceptance checks for future manual QA

1. Admin disables public membership registration; the website and public app hide/disable entry and backend registration policy is applied as agreed.
2. Newly approved project is **not** publicly shown until its publication controls allow it; editing a public teaser does not overwrite the project master.
3. Changing a verified center's name/photo/fee in the correct owner and publishing reflects in public center cards, doctor profile, slot summary and PDF generation where appropriate.
4. Changing CMS banner text does not change Foundation assistance policy; changing the authorized assistance policy updates eligible future quotes consistently.
5. Internal Foundation branches never appear as public provider centers merely because they share a geographic location.
6. Staff-only and center-only views remain inaccessible from public and other center accounts even by direct links or exported files.
7. Appointment fees/status match backend transactions and QR verification does not disclose confidential patient data.
8. Public Android and website show the same approved project/campaign/healthcare records; internal Android handles only assigned operational duties.
9. CMS previews, publication status and visibility toggles obey permissions and never leak draft content.
10. Impact charts and statistics have an explicit authoritative data source or documented editorial data owner.

**Shared quality baseline:** All published, mobile and center workflows must satisfy [CG-BR-600](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md), especially backend access scoping, safe drafts, truthful payment/booking states, responsive UX, media security, WCAG-oriented accessibility, cache invalidation and permitted public indexing.

**PRD instruction:** Split public UI screens by **user journey**, not by static mockup number. Each website/Android/Center Portal PRD should reference the relevant owner-module CG-BRs and define screen-level validation, navigation, failure states, permissions, accessibility and live QA steps.
