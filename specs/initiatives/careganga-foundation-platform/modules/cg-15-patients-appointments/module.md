# CG-15 — Patients Appointments

**Authority:** [PRD](../../prd.md) FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, FR-053, FR-054, [HLD](../../hld.md), [source BR](../../../../../docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md) CG-15-BR01–CG-15-BR25, [visual audit](../../../../../docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) Healthcare BR/UI references; not Admin screenshot IDs.  
**Stage:** Harness Planning / GREENFIELD · **State:** DRAFT_NOT_APPROVED; revised PRD/HLD approval & authenticated Harness resolver NOT_RUN.

uiux_decision: REQUIRED
uiux_reason: New cross-channel business UI must follow original CareGanga theme, motion and role-sensitive workflows.
dld_decision: REQUIRED
dld_reason: Greenfield business model, authorization, transactional state and cross-owner contracts require scoped detailed design.
database_impact: CRITICAL
database_reason: New source-owned Patients and consent, schedules, slot holds, booking, reception queue state requires reliable relational constraints, concurrency and migration.
mobile_store_impact: ANDROID
mobile_store_reason: Approved native Android workflow uses maintained store-compatible baseline.
mobile_android_app_category: GENERAL
mobile_android_policy_api: 36
mobile_platform_baseline: For applicable Android, use approved Expo SDK 58/React Native 0.88/React 19.3/target API 36; verify exact compatible native dependency matrix and current Play requirements before Implementation.
mobile_policy_checked_on: 2026-11-14
mobile_policy_sources: https://docs.expo.dev/versions/v58.0.0/ ; https://support.google.com/googleplay/android-developer/answer/11926878
mobile_dependency_audit: SOURCE_BASELINE_ONLY; no verified APK/AAB/native QA.

## Business owner and isolation

**Owns:** Patients and consent, schedules, slot holds, booking, reception queue. **Delivery-critical, already-delivered owners:** CG-14 verified doctor-center fee/association, CG-01 protected patient identity, CG-19 real appointment slip/QR. **Later owned integrations, never required to fake this module's first working path:** CG-17 adds verified online payment, subsidy and refund settlement and must QA existing booking; until then CG-15 transparently allows full-fee DUE/pay-at-center without false payment confirmation. The first implemented workflow must use real source data and real authorized selectors; the later introducing owner supplies integration QA.

**State and invariant:** Slot free/held/booked/blocked; appointment confirmed/completed/cancelled/no-show. Doctor-wide overlap and center overcapacity prevented across clients; no fictitious subsidy. Every list/search/option/detail/export/write must validate actor action plus real geography/branch/center/patient scope, with privacy and truthful end-user states.

## Complete PRD and BR mapping

- **FR-047/A-15:** Doctor/center schedules availability — Configure doctor-center working days, time windows, capacity, consultation type, holidays, blocks and approved leave while preserving already confirmed bookings
- **FR-048/A-15:** Patient chooses doctor/visit — Support center-first or doctor/date/slot-first journey using one doctor-aware center-specific schedule that prevents overlapping in-person appointments across centers; show the requested center and available slot before payment; when multiple centers match the same time, present an explicit center choice rather than silently selecting one
- **FR-049/A-15:** New/existing patient identifies self — Register or securely locate patient with verified mobile, appropriate profile and consent, optional uploaded reports/identity; assign a unique patient ID without duplicates or unverified cross-linking
- **FR-050/A-15:** Patient/staff confirms appointment — Capture patient, doctor, center, slot, consultation type and reason; show editable summary, payment choice and current booking status without exceeding center capacity or overlapping the same doctor's in-person appointments at different centers
- **FR-051/A-15:** Booking is validly confirmed — Issue authentic reference/Booking ID, download/print/share and guarded QR/barcode verification and calendar export; protect identifiers and symptoms
- **FR-052/A-15:** Center serves patient — Manage reception check-in, queue/token, waiting/consultation/completed/canceled/no-show state with authorized updates and patient/center appointment history
- **FR-053/A-15:** Patient or authorized center changes booking — Reschedule/cancel when permitted; restore appropriate capacity, preserve history, update true due/refund and notify relevant parties
- **FR-054/A-15:** Patient opens account — See authorized own appointments, receipts, patient ID and permitted reports; patient and professionally uploaded report access are included; general dependent/family booking and electronic prescription authoring are not active initial-launch functions

Detailed authoritative clauses:
- **CG-15-BR01:** For each doctor-center association, authorized users configure consultation days, times, slot duration, applicable consultation mode and schedule exceptions.
- **CG-15-BR02:** Doctor leave applications, authorized approval/rejection, center holidays, manually blocked slots and capacity changes affect actual booking availability; center operators and authorized Foundation administrators can inspect leave history and booked/available/blocked dates/slots. A pending leave request does not silently cancel confirmed bookings.
- **CG-15-BR03:** Public patients can use **center-first booking**: choose doctor → select associated center → choose available date and slot.
- **CG-15-BR04:** Public patients can use **slot-first booking**: choose doctor → date and available time → assigned center based on the underlying doctor's published center schedule. The selected center must be visible **before final confirmation/payment**.
- **CG-15-BR05:** Both journeys consume the **same center-specific slot inventory**, fee and policy. Never show a free slot on one path when it is booked or blocked on another.
- **CG-15-BR06:** Prevent simultaneous/duplicate confirmed reservations for constrained doctor-center slots/capacity across website, public app and center front desk, **and prevent overlapping in-person appointments for the same doctor across different centers** unless an explicitly approved remote/parallel-capacity mode permits them.
- **CG-15-BR07:** Disclose center location, price, Foundation benefit, payable amount, available time and patient-facing rules clearly before booking finalization.
- **CG-15-BR08:** Changes to schedule or fees do not silently rewrite already confirmed historic booking fee/assistance; the booking retains the relevant accepted price/policy snapshot.
- **CG-15-BR09:** New patients can register from the public booking flow or authorized center reception, while existing patients can be located using verified identifiers/phone under access controls.
- **CG-15-BR10:** Patient details include name, verified mobile/OTP for public access, optional email, date of birth/age, gender, optional blood group as health profile attribute, emergency contact, state/district/block, PIN and address as applicable.
- **CG-15-BR11:** Optional uploaded personal identity documents, patient photo and medical report/prescription files have appropriate file validation and access controls.
- **CG-15-BR12:** Generate a unique patient identifier/virtual patient ID on the approved patient lifecycle and provide a patient profile/ID view. Mockups show a 12-digit ID format; exact numbering scheme requires PRD approval.
- **CG-15-BR13:** Detect potential duplicate patient registrations and support appropriately reviewed correction/merging without losing appointment or medical history.
- **CG-15-BR14:** Authorized clinical/center staff can see relevant patient visit history, medical documents and lab reports only under permitted care/access conditions; public access is limited to the verified patient or approved authorized representation.
- **CG-15-BR15:** Patient portal mockups include My Appointments, Reports, Prescriptions, Receipts, Patient ID and Family Members. Establish actual creation/authorization workflows for prescriptions and family-dependent access before their PRDs; do not infer a complete electronic medical record system from navigation labels alone.
- **CG-15-BR16:** Present patient consent, policy terms and data-sharing choices in the relevant registration/booking journey and preserve evidence where required.
- **CG-15-BR17:** Public and center staff can create permitted doctor appointments with doctor, center, slot, patient, consultation mode, purpose/symptom note and monetary/benefit reference.
- **CG-15-BR18:** Patient reviews and may correct details prior to confirmation. Online/pay-at-center payment choices are passed to CG-17/CG-09.
- **CG-15-BR19:** Generate unique Booking ID, booking reference, confirmation page and downloadable shareable appointment slip with patient/doctor/center/date/time/amount/payment status.
- **CG-15-BR20:** Support booking retrieval through verified mobile/account or Booking ID with appropriate secondary verification; never disclose private booking details from an unverified arbitrary identifier.
- **CG-15-BR21:** Generate QR/barcode verification on the appointment slip; scanning checks authentic appointment state and exposes only the minimum permitted verification details.
- **CG-15-BR22:** Center can check in patients, generate/manage queue tokens, move patients through waiting/scheduled/in-consultation/completed and record canceled/no-show states as approved.
- **CG-15-BR23:** Permit authorized cancellation/rescheduling/status adjustment consistent with center capacity and financial/refund policy, with reasons/history.
- **CG-15-BR24:** Issue appointment confirmations/reminders and send/share permitted records via configured email/SMS/WhatsApp/push. Include **Add to Calendar** from confirmed appointment details with actual doctor/center/date/time; exported calendar details must follow patient visibility rules.
- **CG-15-BR25:** Provide center-wise and Foundation-wide scoped booking lists, appointment summaries, patient history and reporting.

## Independently deliverable vertical flow

**Concrete acceptance:** Create/verify a real patient, display same available doctor slots in center-first/date-first journeys, reserve one cross-center last slot atomically and show genuine confirmation/queue; do not double-book or expose another patient's records. Only current/prerequisite owner data may be used to mark story QA complete. Future integrations remain explicit pending dependencies and must be tested by the later owning module when available.

## UI/UX, NFR and Planning acceptance

Preserve the exact verified CareGanga color, typography, spacing, icons, sidebar/header, cards/tables, modal/drawer/form, statuses and source-supported animation—not a replacement theme. Original audit references: Healthcare BR/UI references; not Admin screenshot IDs. The screenshot/video is the source of actual token values, and no exact animation speed/easing may be guessed from still images. Responsive/native accessibility and reduced-motion adaptations keep the same brand. Actual visual QA comparison is VISUAL_NOT_RUN.

All applicable PRD N-01/N-04/N-05/N-09/N-11/N-12/N-13 and CG-NFR-600 controls apply: data uniqueness, migration/rollback, races/replay, failure/recovery, privacy-safe logging, bounded queries/workers and human-readable validated/pending/denied/empty/failed states. The module provides required [UIUX](uiux.md), [DLD](dld.md) and one [tasks](tasks.md) file with per-story QA; no duplicate stories or CI. Review/fix/re-review are source-based; formal design approval and runtime/device proof remain pending.