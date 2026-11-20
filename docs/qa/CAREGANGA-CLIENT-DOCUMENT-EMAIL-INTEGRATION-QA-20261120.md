# CareGanga — 20 Nov 2026 client document/email acceptance and source-gap register

**Evidence:** [five source JPGs + checksums](../research/CAREGANGA-CLIENT-DOCUMENTS-REFERENCE-20261120.md); [52 client email templates](../research/CAREGANGA-CLIENT-MASTER-EMAIL-V2-COVERAGE-20261120.md). This is **cross-owner acceptance detail within existing canonical stories/tasks**, not a duplicate tracker, new development module, test execution, approval, or retroactive PASS. Actual asset comparisons use client-provided restricted JPG/DOCX originals.

## Verified as already in main vs actual gaps

| Area | Grounded code already present | New source gap / current disposition |
| --- | --- | --- |
| CG-19 documents | Scoped protected files, approved private access letter, some finance/appointment PDFs | Client's member certificate+welcome+ID, volunteer two-sided card+full three-document pack, HR offer letter and donation receipt layout are **NOT IMPLEMENTED** as these concrete templates; wait on owner records/approvals |
| CG-19 messaging | Generic approval-event/notice outbox, SendGrid/Twilio adapter, attempts and support | 52 distinct client template IDs/triggers, event-specific attachments + suppression, role/expiry/corrections, complete delivery tracking not shown; add after owner event integration |
| CG-04 | PRD/DLD/UIUX/story QA for member and volunteer | No CG-04 backend module currently in main; client ID/tier/fee/validity/benefits/QR and approval email/pack requirements remain to implement |
| CG-07 | PRD/DLD/UIUX/story QA and older donation receipt PDF reference mapping | No CG-07 backend donation owner currently in main; provider-confirmed unique paid receipt, duplicate/refund and source joins remain to implement |
| CG-10 | HR specs/QA and current CG-01 account roles | No CG-10 backend HR owner currently in main; actual offer/appointment/joining/promotion/designation document states remain to implement |
| CG-11 | Payroll specs/QA and existing generic CG-09 finance | No CG-11 payroll owner currently in main; payslip versus paid salary notifications still owner dependent |
| CG-03, CG-09, CG-21, CG-01 | Approval, finance, configuration and identity fundamentals | Add adapters only; don't infer applicant approval from document verification or provider accepted status; resolve credential setup rule conflict before changing auth |

## Acceptance cases to trace into existing owner story QA (add as supplemental criteria, not new counted scenarios)

| ID | Owners | Source-first acceptance and later runtime negative case |
| --- | --- | --- |
| DOC-01 | CG-04/CG-19 | Approved member, known tier, one stable ID; certificate and welcome letter visually match client layout and share current true membership/issue/term |
| DOC-02 | CG-04/CG-03/CG-19 | Three member PDFs are issued and emailed **only** after final decision and successful generation; missing one blocks full approval email |
| DOC-03 | CG-04/CG-19 | Free volunteer application through receive/verify/approve; two-sided ID, term and three-file pack; QR safe and original card superseded after reissue |
| DOC-04 | CG-07/CG-09/CG-19 | Provider failed/pending/duplicate callbacks never create paid receipt; one verified original payment creates one correct landscape receipt with accurate source/amount in words |
| DOC-05 | CG-07/CG-09/CG-19 | Distinct duplicate-payment/refund phases; only provider-processed refund gets “processed”; no repeated receipt for same transaction |
| DOC-06 | CG-10/CG-03/CG-19 | Offer, approval, appointment and joining states distinct; real title/contract/salary/letter number/signatory; unapproved/stale docs cannot be mailed |
| DOC-07 | CG-10/CG-01/CG-19 | Designation/promotion/access-change effective date, new approved ID/cert and superseded old version; no plaintext passwords; wrong-branch scope denied |
| DOC-08 | CG-11/CG-09/CG-19 | Employee-only salary slip after payroll approval; only provider-confirmed disbursement gets payment-success email, including out-of-order callbacks |
| DOC-09 | CG-19 | 52 template IDs versioned with exact event map, required source placeholders, organization-approved preview, no raw sensitive data or sample values |
| DOC-10 | CG-19/CG-01 | Event+template+recipient+document-version dedup; retry, timeouts, bounce, provider accepted vs delivered log; cross-root recipient denied |
| DOC-11 | CG-19 | Support ticket ID, statuses, privacy-safe status email, verified registered requester and authorized approved PDF/expiring link before resend |
| DOC-12 | CG-21/CG-19 | No unverified 80G or corporate claims; official verified address/legal identity/signature/contact/QR branding across all five PDFs |
| DOC-13 | CG-01/CG-19 | Resolve client setup-link vs current Admin-created password flow; no plaintext password, no unapproved credential change |
| DOC-14 | CG-19, all owners | Web preview and relevant authorized Android download/share are readable, keyboard/touch accessible, server-permission consistent; compare original visual JPG vs rendered generated PDF and QR validity |
| DOC-15 | all | Single event ownership and no duplicate journal/document master; simultaneous retries/edits/expiry/revoke safe; migrations/rollback/indexes and recovery actually executed |

## Evidence status

- **Reviewed:** original 5 JPG content and 22-page 52-template document; current main folder topology and selected CG-19 notification/storage source, and existing original donation reference. Additional new client-source requirements are mapped to existing modules.
- **NOT_RUN:** compilation, migrations, API/runtime, PDF rendering/pixel-diff, QR scan, sender-domain verification, actual provider/refund testing, Web/Android end-to-end parity, independent qualified DB/security review. No PASS or source-implementation claim follows from this documentation commit.
- **Next:** Implement missing owner-specific source under separately authorized JASIQ-dev delivery; add precise `file:function` evidence and results to each existing `tasks.md` case, preserve their counts and approval hash history, and validate against actual restricted reference images.

No new client-facing feature, module, workflow, data seed, exposed sample signature, CSS theme, or payment policy was unilaterally enabled by this source alignment.
