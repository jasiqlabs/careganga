# CG-BR-300 — CMS, Public Website and Application Channels

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Status:** Internal consolidated BR · 14 November 2026  
**Coverage:** CG-18 CMS/publication; presentation and permissions of CG-01–21 across all intended interfaces.

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
- **CG-18-BR03:** Manage publicly authorized team member profiles (name, designation, photograph, description, order and published/unpublished status), **referencing HR/employee records where appropriate**, without exposing full employee files.
- **CG-18-BR04:** Publish selected upcoming/current projects with media and descriptions derived from CG-05; a website teaser is not a second project master.
- **CG-18-BR05:** Maintain reusable website gallery and media library, including uploaded image/document metadata and permissions.
- **CG-18-BR06:** Create/manage blogs, articles, public news and updates with editorial publication controls.
- **CG-18-BR07:** Maintain website contact-message submissions, public enquiries and support record handling, with assigned responders/status and restricted personal details.
- **CG-18-BR08:** Enable authorized publishing/unpublishing and optionally review of supported content. The source includes preview/review/publish; detailed reviewer/publisher rights derive from CG-01/03.
- **CG-18-BR09:** Manage enabled public navigation and supported page availability. The source explicitly includes toggles for **Login**, **Membership registration/join**, and **Volunteer registration/join**.
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

- **CG-18-BR18:** Public Healthcare Assistance landing page shows approved hero, service categories, search entry, featured providers/doctors, centers and Foundation-benefit information under authorized CMS control.
- **CG-18-BR19:** Directory/search cards use **verified CG-14 center and doctor records**, status, current published services/facilities and prices. CMS configures headings and placement; does not manually maintain medical registration or scheduling.
- **CG-18-BR20:** Benefit banners use **applicable CG-17 policies** or clearly identified general promotional text. The admin controls whether the displayed percentage is eligible/current and how it is described (e.g., "up to").
- **CG-18-BR21:** Center staff may submit center-specific descriptive web content/photos through Center Portal where supported; publication remains subject to Foundation publishing authorization.
- **CG-18-BR22:** Public booking CTA availability is controlled by **actual service transaction scope**, provider eligibility and booking configuration, not merely by appearance of a prototype button.
- **CG-18-BR23:** Public health content cannot expose patient files, clinical consultations or detailed doctor/center internal financial information.

## 3. Public website navigation and page ownership

The newer UI references demonstrate an integrated top navigation around **Home, About Us, Our Work, Healthcare Assistance, Centers & Labs, Projects, Partners, Media & Resources, Join Now, Donate Now**, along with search and Login/Register.

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

**Visual elements requiring explicit scope decision:** Public **Book Lab Test**, **Order Medicine**, **Book Nursing/OT** actions; example benefit percentages; family-member workflows; prescriptions tab; review/rating creation; printed 100%-subsidized examples. They must be logged in CG-BR-900 before transactional PRDs are authorized.

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
| **Communications & Reports** | CG-19/20 | Notifications, notices, templates, MIS, export/schedules |
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
- **CG-300-BR04:** Support healthcare doctor/center discovery, verified patient registration, eligible booking, payment state, booking receipt/QR and appointment history to extent agreed in mobile PRD.
- **CG-300-BR05:** Support user notifications, applicable payment confirmations and contact/support actions.
- **CG-300-BR06:** Public application must not render internal admin functions merely because the same backend provides them.

## 8. Internal Android application

- **CG-300-BR07:** Internal application uses separate secure authorized login and a dashboard with assigned role, pending work, relevant alerts and permitted modules.
- **CG-300-BR08:** Authorized employees/volunteers/coordinators can manage assigned records and workflow decisions within their permitted scope: registrations, verification/approvals, projects, field visits with GPS/photo, beneficiary aid, tasks, attendance, leave, expenses/allowances, stock requests and applicable finance/healthcare coordination.
- **CG-300-BR09:** Apply the same backend authorization and business statuses as Foundation Web Admin; navigation hides inaccessible features but hiding alone is never enforcement.
- **CG-300-BR10:** Allow secure file capture/upload, field evidence and action feedback; preserve correct draft/submission state on interruption.
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

**PRD instruction:** Split public UI screens by **user journey**, not by static mockup number. Each website/Android/Center Portal PRD should reference the relevant owner-module CG-BRs and define screen-level validation, navigation, failure states, permissions, accessibility and live QA steps.
