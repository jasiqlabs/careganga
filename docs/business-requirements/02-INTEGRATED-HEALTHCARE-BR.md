# CG-BR-200 — Integrated Healthcare Assistance

**Part of:** [CareGanga Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)  
**Status:** Internal consolidated BR · 14 November 2026  
**Business domains:** CG-14 Healthcare Network, CG-15 Patients and Appointments, CG-16 Diagnostics and Center Services, CG-17 Assistance/Billing/Settlement  
**Audience:** Foundation leadership, healthcare network administrators, partner center operators, doctors/authorized staff, patients and public website/app users.

## 1. Business scope and operating model

CareGanga operates a centrally supervised network of clinics, doctors, hospitals, nursing homes, diagnostic laboratories and other approved healthcare provider categories. The public can discover approved services and centers; eligible patients can book doctors at center-specific slots with disclosed CareGanga financial assistance. Healthcare centers carry out authorized patient and diagnostic operations and record collections; the Foundation controls provider verification, benefit policy, governance, network-wide reporting and settlement.

Healthcare is **one first-class domain inside the CareGanga Foundation platform**, sharing identity, authorization, payment/accounting, media/documents, notifications, approval workflow, CMS and reports. A healthcare center has isolated operational scope within the common backend. This is **not** an independent product data silo.

**Documented public transaction boundary:** The written requirements explicitly provide public **doctor consultation appointments** initially. Lab tests, checkups, camps and other services have publicly displayed information and appropriate **center-side administrative operations**. Newer UI references show buttons for lab test booking, medicine ordering and nursing/OT booking: those are captured as **open functional scope decisions**, not silently presumed live public transactions. See [CG-BR-900](04-TRACEABILITY-DECISIONS.md).

## 2. Domain model and responsibility boundaries

| Business entity | Owner / boundary | Business meaning |
| --- | --- | --- |
| Provider organization / center | **CG-14** | Hospital, polyclinic, diagnostic/lab, nursing home, clinic or other approved provider type, with verification/status |
| Center branch / location | **CG-14** | Operating location, contacts, facilities, services, authorized staff; may be linked to parent center |
| Doctor | **CG-14** | One professional profile/registration/qualifications with associations to multiple centers |
| Doctor-at-center arrangement | **CG-14** | Center association, accepted fees, consultation modes, availability and publication eligibility |
| Slot / schedule / doctor leave | **CG-15**, using CG-14 doctor-center associations | One live availability record for all manual/automatic selection and center operations |
| Patient | **CG-15** | Verified personal identity, unique patient/virtual ID, consent, address and authorized health records |
| Appointment | **CG-15** | Unique booking ID, doctor, center, slot, patient, appointment/visit lifecycle and payment/assistance links |
| Lab investigation / package | **CG-16** | Test master, sample type, price, package composition and availability at approved centers |
| Lab order / sample / report | **CG-16** | Internal patient order, collection, processing and approved report access |
| Benefit rule / entitlement | **CG-17** | Foundation policy (fixed amount, percentage, max cap, eligibility, valid period) applied to a service |
| Financial document / collection / provider settlement | **CG-17**, posted to **CG-09** | Patient payable and received, Foundation contribution, provider/doctor/lab receivable and settlement |
| Public provider/content publication | **CG-18** referencing CG-14 | Descriptions and publicity, not independent doctor, fee or booking truth |

**Core constraint:** A doctor associated with three centers is **one doctor**, not three copies. A consultation at Center A and the same doctor at Center B may have different day/time/fee/support policies. A patient has **one patient profile** and multiple bookings/reports within permitted care contexts.

## 3. CG-14 — Healthcare Network and Provider Directory

### 3.1 Provider onboarding and verification

- **CG-14-BR01:** Foundation administrators can register and manage healthcare provider organizations and applicable branches/locations, including clinics, hospitals, nursing homes, diagnostic centers and labs.
- **CG-14-BR02:** Center profile includes name/code/type, operating address with geography and PIN, phone/email, map coordinates, photographs/logo, description, services, facilities, working hours, relevant licensing/registration documents and contact/settlement information.
- **CG-14-BR03:** Center representatives can submit or update their own permitted profile and center documents using center login, subject to provider verification/publication rules.
- **CG-14-BR04:** Foundation verifies center authenticity, submitted documents/facilities and decides approve/reject/return-for-correction with remarks/history through CG-03.
- **CG-14-BR05:** Foundation can activate, suspend, deactivate or block center login and public discoverability according to approved policy; suspended providers must not receive new public bookings.
- **CG-14-BR06:** A parent center can have multiple registered operating locations/branches; center staff permissions must be restricted to their authorized locations.
- **CG-14-BR07:** Center services/facilities are configurable, including consultation, lab/diagnostics, health checkups and applicable published center services. A provider's category is not itself a booked procedure.
- **CG-14-BR08:** Provider administration stores bank and settlement details under restricted finance permissions and does not disclose them publicly.

### 3.2 Doctors and center association

- **CG-14-BR09:** Foundation and permitted center staff can register one doctor with name, contacts, qualifications, specialties, experience, registration number/verification documents, biography, photographs and relevant public profile details.
- **CG-14-BR10:** Foundation verifies professional registration/identity/qualifications and manages doctor approved/pending/suspended/inactive states with decision history.
- **CG-14-BR11:** A verified doctor can be associated with multiple verified centers; associated center services, fee schedules, consultation modes, working location and availability are maintained without duplicating identity.
- **CG-14-BR12:** Manage center-specific consultation fees, follow-up charges and any approved fee categories, with change history and validity where required.
- **CG-14-BR13:** Center and Foundation operators can manage permitted professional profile updates, assigned-center changes and authorized status, not other centers' restricted records.

### 3.3 Provider discovery and public profile

- **CG-14-BR14:** Public website/app offers published healthcare center categories, doctor search, center search and geographic filters including state/district/block/PIN where available.
- **CG-14-BR15:** Search doctors by name, specialty, qualification, experience, consultation fee and availability; support apply/reset filters, list/grid results, sorting and pagination, and display published professional profile, verified state where valid, associated centers and relevant prices/benefits.
- **CG-14-BR16:** Search/list centers by name, state/district/block/PIN, category/type, services, facility and supported benefit; support list/grid and map/directions views, published contact, working/OPD hours, galleries, doctors and facilities. Mockups illustrate filterable *published capability flags* including online booking, home sample collection, medicine delivery, 24×7 service and cashless/insurance; displaying a flag does not authorize an end-to-end delivery or insurance-claims workflow.
- **CG-14-BR17:** Display approved verification/partner status, applicable CareGanga support eligibility and reviews/ratings **only where grounded in a permitted, validated source**. Mockup review counts and badges are examples, not production facts.
- **CG-14-BR18:** Only approved/published center and doctor records are searchable by the public; internal account status and public listing status remain controlled independently.
- **CG-14-BR19:** Center staff can submit permitted center website content, service descriptions, images, FAQs, support requests and operating preferences, subject to Foundation review/publication and shared CG-18/19 ownership. The Center Portal cannot publish unverified clinical credentials or independently change Foundation assistance.

**Admin controls:** Provider/branch types, verified status, professional documents, affiliations, service catalogs, center/doctor publication, staff access, fees, benefit-rule association, visibility.  
**Foundation Admin:** Network-wide controls and comparisons. **Center Portal:** Own-center registration, doctors/services, operational updates and documents. **Public:** Search, filters, maps, profiles and published services.

## 4. CG-15 — Patients, Scheduling, Appointment Booking and Visits

### 4.1 Scheduling and center selection

- **CG-15-BR01:** For each doctor-center association, authorized users configure consultation days, times, slot duration, applicable consultation mode and schedule exceptions.
- **CG-15-BR02:** Doctor leave applications, authorized approval/rejection, center holidays, manually blocked slots and capacity changes affect actual booking availability; center operators and authorized Foundation administrators can inspect leave history and booked/available/blocked dates/slots. A pending leave request does not silently cancel confirmed bookings.
- **CG-15-BR03:** Public patients can use **center-first booking**: choose doctor → select associated center → choose available date and slot.
- **CG-15-BR04:** Public patients can use **slot-first booking**: choose doctor → date and available time → assigned center based on the underlying doctor's published center schedule. The selected center must be visible **before final confirmation/payment**.
- **CG-15-BR05:** Both journeys consume the **same center-specific slot inventory**, fee and policy. Never show a free slot on one path when it is booked or blocked on another.
- **CG-15-BR06:** Prevent simultaneous/duplicate confirmed reservations for a constrained doctor-center-slot/capacity, including website, public app and center front desk bookings.
- **CG-15-BR07:** Disclose center location, price, Foundation benefit, payable amount, available time and patient-facing rules clearly before booking finalization.
- **CG-15-BR08:** Changes to schedule or fees do not silently rewrite already confirmed historic booking fee/assistance; the booking retains the relevant accepted price/policy snapshot.

### 4.2 Patient registration, identity and records

- **CG-15-BR09:** New patients can register from the public booking flow or authorized center reception, while existing patients can be located using verified identifiers/phone under access controls.
- **CG-15-BR10:** Patient details include name, verified mobile/OTP for public access, optional email, date of birth/age, gender, optional blood group as health profile attribute, emergency contact, state/district/block, PIN and address as applicable.
- **CG-15-BR11:** Optional uploaded personal identity documents, patient photo and medical report/prescription files have appropriate file validation and access controls.
- **CG-15-BR12:** Generate a unique patient identifier/virtual patient ID on the approved patient lifecycle and provide a patient profile/ID view. Mockups show a 12-digit ID format; exact numbering scheme requires PRD approval.
- **CG-15-BR13:** Detect potential duplicate patient registrations and support appropriately reviewed correction/merging without losing appointment or medical history.
- **CG-15-BR14:** Authorized clinical/center staff can see relevant patient visit history, medical documents and lab reports only under permitted care/access conditions; public access is limited to the verified patient or approved authorized representation.
- **CG-15-BR15:** Patient portal mockups include My Appointments, Reports, Prescriptions, Receipts, Patient ID and Family Members. Establish actual creation/authorization workflows for prescriptions and family-dependent access before their PRDs; do not infer a complete electronic medical record system from navigation labels alone.
- **CG-15-BR16:** Present patient consent, policy terms and data-sharing choices in the relevant registration/booking journey and preserve evidence where required.

### 4.3 Booking, check-in and verification

- **CG-15-BR17:** Public and center staff can create permitted doctor appointments with doctor, center, slot, patient, consultation mode, purpose/symptom note and monetary/benefit reference.
- **CG-15-BR18:** Patient reviews and may correct details prior to confirmation. Online/pay-at-center payment choices are passed to CG-17/CG-09.
- **CG-15-BR19:** Generate unique Booking ID, booking reference, confirmation page and downloadable shareable appointment slip with patient/doctor/center/date/time/amount/payment status.
- **CG-15-BR20:** Support booking retrieval through verified mobile/account or Booking ID with appropriate secondary verification; never disclose private booking details from an unverified arbitrary identifier.
- **CG-15-BR21:** Generate QR/barcode verification on the appointment slip; scanning checks authentic appointment state and exposes only the minimum permitted verification details.
- **CG-15-BR22:** Center can check in patients, generate/manage queue tokens, move patients through waiting/scheduled/in-consultation/completed and record canceled/no-show states as approved.
- **CG-15-BR23:** Permit authorized cancellation/rescheduling/status adjustment consistent with center capacity and financial/refund policy, with reasons/history.
- **CG-15-BR24:** Issue appointment confirmations/reminders and send/share permitted records via configured email/SMS/WhatsApp/push. Include **Add to Calendar** from confirmed appointment details with actual doctor/center/date/time; exported calendar details must follow patient visibility rules.
- **CG-15-BR25:** Provide center-wise and Foundation-wide scoped booking lists, appointment summaries, patient history and reporting.

**Document reference notes:** UI designs show (a) center-first and (b) automatically selected center; (c) patient and center copies on one A4 portrait page for online-paid cases and a single patient copy for pay-at-center; (d) printed QR/barcode. Preserve as design references for the document PRD, subject to final approved layout and privacy controls.

**Center Portal:** Staff book walk-in/offline appointments, manage arrivals, appointments and patient records within scope. Provide scoped service tickets, FAQs and assistance requests via shared CG-19 support capability (rather than a separate center-specific ticket platform).  
**Public site/app:** Verified registration, doctor search, booking, payment, history, slip, status.  
**Foundation Admin:** Network-wide oversight, authorized corrections and policy.

## 5. CG-16 — Diagnostics, Lab and Other Healthcare Services

**Scope distinction:** This domain has definite **center-side** business functionality, even while public direct booking for services other than doctor appointments is unresolved.

- **CG-16-BR01:** Define a diagnostic test master with unique code, name, category, sample type, investigation details/parameters, description and active status.
- **CG-16-BR02:** Permit authorized center-specific test prices and relevant support/discount policy references, including validity/history.
- **CG-16-BR03:** Create lab and health checkup packages by selecting included tests, code/name/category, base price, discount, active status and validity.
- **CG-16-BR04:** Authorized center staff can register internal tests/packages for a patient, retain source of request, test details and initial payment/billing references.
- **CG-16-BR05:** Track lab workflow: order → sample collection/processing → result/report upload → authorized release/completion with relevant times/status history.
- **CG-16-BR06:** Make reports available to appropriate patient and clinical users with permission; do not publish diagnostic reports through the public center directory.
- **CG-16-BR07:** Center portal and Foundation Admin can inspect internal lab orders, processing, utilization, test collection and authorized reports by scoped location and date.
- **CG-16-BR08:** Public center profiles can show published test/service menus, pricing and approved Foundation discounts; public checkout of labs, medication, nursing and other services requires explicit scope decision.
- **CG-16-BR09:** Service catalogs may cover categories illustrated by the mockups: polyclinic, diagnostic center, dental clinic, medical laboratory, hospital/nursing home, pharmacy, orthopedic, homeopathy and Ayurvedic centers. Listing a category does not automatically imply a dedicated pharmacy stock/sales or hospital-OT operating system.
- **CG-16-BR10:** Non-bookable health camps/checkups and other applicable support offerings may be displayed as information with clear contact/enquiry actions as approved.

**Center Portal:** Lab master, packages, internal orders, samples, reports, pricing, approved service information.  
**Foundation Admin:** Central verification/pricing oversight, test/package standards and lab performance.  
**Public:** Published catalog and provider discovery; transaction scope per approved PRD.

## 6. CG-17 — Foundation Healthcare Assistance, Billing, Dues and Settlements

### 6.1 Benefit policy and eligibility

- **CG-17-BR01:** Foundation defines assistance policies by eligible service type, provider/center and optionally doctor, with fixed amount or percentage, limits, effective period and eligibility criteria.
- **CG-17-BR02:** **Standard documented consultation model:** Foundation contributes **50%** for *eligible* appointments, patient pays remaining **50%**, subject to approved support policy. It is not blanket entitlement without eligibility.
- **CG-17-BR03:** Allow authorized modifications to applicable percentages, fixed amount, maximum support, center/doctor-specific policy and patient eligibility/validity limits with historical visibility.
- **CG-17-BR04:** Record requested and approved healthcare assistance; eligible patient/doctor/center/service, reviewed amount, reviewer and approval state are traceable where approvals apply.
- **CG-17-BR05:** When a patient views or confirms a service, show **gross fee, approved contribution, patient payable** separately. Record relevant monetary policy snapshot on confirmation.
- **CG-17-BR06:** Screen examples of up to **40% diagnostic discount**, **20% medicine contribution**, and **30% nursing/OT discount** are **illustrative marketing/service rules** until client confirms enablement, eligibility, operating model and settlement. A sample slip also shows **100% CareGanga contribution**; full coverage must be permitted only through an explicitly approved policy.
- **CG-17-BR07:** Show accurate public contribution messaging. Avoid advertising discounts that are not configured or applicable to the selected provider/service/patient.

### 6.2 Patient payment and invoice/receipt

- **CG-17-BR08:** Doctor booking supports **online payment through configured Razorpay** (UPI, cards, net banking and supported wallets) and **pay at healthcare center**, according to provider/policy configuration.
- **CG-17-BR09:** Track payment initiated/pending/succeeded/failed/refunded/partially paid or due states relevant to the actual service, with verified transaction references and reconciliation evidence.
- **CG-17-BR10:** Booking confirmation must correctly distinguish **booking state** from **payment state**; for pay-at-center, an appointment may be confirmed but the patient amount remains due.
- **CG-17-BR11:** Center staff can record in-person collections by cash/UPI/card/bank/configured payment methods, issue receipts and update outstanding status under controlled permissions.
- **CG-17-BR12:** Support payable/part-paid/due, overdue aging and payment follow-up records, permitted corrections and refunds/adjustments with audit and approval where required.
- **CG-17-BR13:** Produce patient payment receipts and booking documents from the same authoritative booking + collected/assistance amount, never from independently edited totals.
- **CG-17-BR14:** Maintain appropriate provider/center invoice/receipt and financial history, referring to shared CG-09 financial records.

### 6.3 Center/doctor/lab settlement

- **CG-17-BR15:** Distinguish the patient's payment, the Foundation's committed or approved assistance, and what is owed or has been paid to doctor/center/lab.
- **CG-17-BR16:** Maintain provider/doctor/lab settlement records and due, approved, settled, refunded and adjusted balances with traceable service references.
- **CG-17-BR17:** Foundation Admin has network-wide settlement oversight; Center Portal has restricted own-center collection, assistance, outstanding and reconciliation views.
- **CG-17-BR18:** Post final money/accounting events to CG-09 exactly once using linked source transactions; no duplicate per-center general ledger.
- **CG-17-BR19:** Generate center/doctor/period/service reports on gross charges, patient collections, Foundation support, unresolved dues and settlement outcomes.
- **CG-17-BR20:** Financial ownership and payment routing (Foundation gateway vs center merchant account; who receives or disburses each amount) is a **client decision requiring a definitive approved settlement flow** before PRD lock.

### 6.4 Payment/business examples

| Scenario | Gross fee | Foundation contribution | Patient payable | Booking/payment implication |
| --- | ---: | ---: | ---: | --- |
| Standard eligible consultation in written BR | ₹1,000 | ₹500 (50%) | ₹500 | Online payment **or** pay at center; amount and due reflect actual collection |
| Full-support illustrative appointment slip | ₹1,000 | ₹1,000 (100%) | ₹0 | Requires eligible approved full-support policy; no false ₹500 collection |
| Patient chooses pay at center | ₹1,000 | ₹500 (50%) | ₹500 due | May be confirmed but remains outstanding until center records receipt |
| Diagnostic/medicine/OT benefit examples | Depends on service/center | Configured if included | Gross minus eligible support | Public transactional availability and who funds discount **not yet confirmed** |

The above examples are **business demonstrations**, not defaults for all doctor/center/service combinations.

## 7. Healthcare role and visibility matrix

| Actor | Can operate | Cannot assume |
| --- | --- | --- |
| **Foundation Super Admin** | Provider/doctor approval, benefit policies, center oversight, finance, network reports, publication controls | Public access to private medical information outside justified authorized purpose |
| **Foundation Healthcare Administrator** | Delegated verification, directory, schedule oversight, assistance/settlement permissions | Super Admin protected actions without grant |
| **Center Administrator** | Own centers/branches, doctors, staff, schedules, appointment queue, collections, tests, own reports | Other centers' records or global rules |
| **Center Reception/Booking Staff** | Patient registration, walk-in appointment, check-in, own-center collection where granted | Global medical, finance or HR records |
| **Doctor/Diagnostic Professional** | Assigned patients/visits/test results and permitted report issuance | Unrelated patients or arbitrary cross-center access |
| **Patient** | Own verified profile, bookings, slips, permitted reports/receipts and consented dependents | Other patients' health/finance |
| **Public visitor** | Published providers/doctors, prices/policies and available booking options | Patient data, provider private bank data, internal approvals |

## 8. Required healthcare dashboards and reporting

- Foundation-wide: number of approved/pending providers, doctors, patients, bookings; center/service utilization; lab processing; total gross charges and patient collections; Foundation support, pending dues and provider settlement; trends and exception queues.
- Center-scoped: today's appointments, queue, patients, doctors, test orders/samples, collections, approved support, receivables, outstanding dues, own financial reports and operational alerts.
- Doctor/professional (if granted): assigned schedule, appointments, relevant visits and service/consultation statistics.
- Patient: upcoming/completed appointments, payment status, downloadable booking slips, receipts, permitted test reports and patient virtual ID.

All figures must derive from booking, diagnostic and financial owners using actor-appropriate scopes. Center dashboards do not establish separate accounting sources. Doctor activity/performance reports cover consultations, patients served, gross fee/revenue and Foundation contribution utilized, with access appropriately scoped.

**Cross-cutting quality gates:** Apply [CG-BR-600](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) for patient/center data isolation, secure identity and documents, schedule concurrency, gateway idempotency, settlement consistency, API/search performance, monitoring and recovery. Relevant P0 requirements are not optional in healthcare PRDs.

## 9. Required cross-domain integration

1. **CG-01:** Shared identity and separately scoped provider staff access.
2. **CG-03:** Provider, doctor and Foundation support/settlement approval history.
3. **CG-09:** Accounting ledger and cash/bank/payment posting for collections, assistance and settlements.
4. **CG-18:** Editorial/publication controls for verified healthcare profiles, banners, marketing copy and service benefits.
5. **CG-19:** OTP, confirmations, reminders, QR-verifiable appointment documents, reports, receipts and permitted communications.
6. **CG-20:** Center-wise/doctor-wise/period-wise MIS, comparisons and exports.
7. **CG-02:** Organization geography available for mapping/reporting; operational Foundation branch and healthcare provider center remain distinct entities.
8. **CG-06:** Foundation beneficiary relationships may reference healthcare assistance only under approved privacy/eligibility policy; do not silently merge all beneficiary and medical case data.

## 10. Healthcare business acceptance tests to derive in PRDs

The PRDs must define manual QA scenarios with backend-data tracing and public/site/Android/portal impacts as relevant:

- A verified doctor listed at multiple centers displays the correct **center-specific fees and slots**.
- Center-first and slot-first booking resolve to exactly one valid doctor-center-slot and block duplicate concurrent reservation.
- Provider deactivation, doctor leave, center holiday and blocked slots prevent new bookings without corrupting past appointments.
- Existing patient reused from verified identity without duplicate records; protected report not revealed by Booking ID guessing.
- Eligible 50/50 consultation displays and stores correct gross, support, patient payable; full support only if authorized.
- Online gateway success/failure/retry and pay-at-center follow correct booking/payment states with no duplicate receipt or accounting transaction.
- Printed patient/center copies, barcodes and QR match real booking/payment and verify safely.
- Center front desk sees only its authorized center/branch patients and collections; Foundation sees authorized network overview.
- Lab internal order progresses through sample/report and reaches only authorized viewers.
- Assistance and provider settlement reconcile with finance; refund/cancellation updates obligations according to approved rule.
- Public website and public Android consume same live authorized center, doctor and booking data.
- A general public user cannot access provider bank details, patient medical records, internal verification files or other center's operational data.

## 11. Healthcare decisions before PRD approval

These are centralized in [CG-BR-900](04-TRACEABILITY-DECISIONS.md), especially **D-01–D-09**. No PRD should silently implement unsupported public lab checkout, e-pharmacy fulfillment, nursing/OT booking, prescription generation, dependent/family authorization or automated medical services merely because a prototype shows a button or navigation item.
