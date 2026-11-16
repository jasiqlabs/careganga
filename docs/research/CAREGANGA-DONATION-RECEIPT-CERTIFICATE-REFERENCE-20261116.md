# CareGanga — Existing Donation Receipt & Donor Certificate Reference

**Evidence date:** 16 November 2026. **Source:** Two owner-uploaded legacy output PDFs, visually reviewed and page-count checked. These are visual/business evidence, **not** verified financial, legal, registration or signatory master data.

## Original source inventory

| Exact uploaded filename | SHA-256 | Structural finding |
| --- | --- | --- |
| `Careganga_Donation_Invoice_REC-1794843289633.pdf` | `ba344adab8c3bd450e9b2fa45dab8a6500acbc4215b2f215abfd0b4366c5043b` | One landscape A4 page (842 × 595 pt) |
| `Careganga_Donor_Certificate_REC-1794843289633.pdf` | `55e276bd7f3d93e027be6fa5350eb5005ae471da71bca5a861ce274768b70809` | Two landscape A4 pages; **page 2 blank** |

The original PDFs are retained as user-provided private client material, **not copied into this Git commit**, because the receipt contains donor contact and transaction identifiers. Developer visual QA must retrieve the exact SHA-matched originals from the controlled client source rather than recreate or assume their pixels. This committed review deliberately omits individual contact and transaction identifiers.

## R-01: Existing donation receipt — visual structure

1. Thin pink/magenta rounded exterior border on white landscape A4; left official multi-colour logo; large blue/green `Careganga Foundation` heading and `EMPOWERING LIVES THROUGH EDUCATION AND HEALTHCARE` tagline; warm light-cream registered-address panel.
2. Rounded receipt number and date controls at upper right. Prominent wide amount ribbon showing currency figure **and** amount in words.
3. Two-column content: donor identity (name, address, mobile, email, PAN, GSTIN) on left; transaction/payment reference, purpose, provider and mode on right.
4. Bottom three blocks: CIN/PAN/TAN registration panel, payment mode, stamped/authorized-signatory area. Distinct warm-cream Section 8/legal and 80G disclosure strip.
5. Footer notes and lower-right QR labelled **Scan to visit our website**. The observed QR is presented as a site link, not proof of a verified financial transaction.
6. Receipt example shows **`80G: Not Yet Granted`**. Never replace with a tax-benefit assertion without authoritative validated evidence.

## C-01: Existing donor appreciation certificate — visual structure

1. Ornate full-page blue/green/gold landscape A4 border, decorative flourishes, CareGanga logo, organization heading, non-profit label, slogan and left column of Health/Education/Shelter/Livelihood/Community Development pictograms.
2. Large blue/gold `TO WHOM IT MAY CONCERN` banner, prominent donor name, `HAS DONATED`, bright green/gold INR amount band, acknowledgment text.
3. Bottom metadata: issue place/date, human-readable certificate number, `Valid From` and `Valid Upto`; two signatory blocks (Founder & CEO, National President), seal and bottom brand strip.
4. Actual PDF has an additional entirely blank second landscape page. The new renderer must generate **one** print-safe A4 page.

## Discrepancies and mandatory client verification

| Supplied evidence difference | Do not assume; implementation policy |
| --- | --- |
| Receipt website `www.careganga.com`, certificate website `www.careganga.org` | Confirm **one** official site; both documents read client-approved Foundation domain configuration. |
| Receipt Section 8/CIN/PAN/TAN details versus certificate sample `WB/2024/012345` NGO Registration No. | Require authentic client registration evidence and approved statutory wording; do not copy either source identifier as an already validated production record. |
| Receipt displays `Temporary Receipt Details` next to online payment | Never issue a **paid** receipt until authenticated provider/manual proof and original CG-09 ledger confirmation. Temporary acknowledgement, if any, must be separately named and labelled pending. |
| Certificate includes one-year `Valid Upto` date | A one-off donation does **not** automatically confer a one-year valid entitlement. Seek client policy; omit validity unless independently authorized. |
| Receipt says physical original is necessary yet also says computer-generated signature is unnecessary | Agree one consistent approved digital-receipt notice. |
| Sample signatory stamps, logos and scanned signatures | Use only Foundation-approved controlled assets, current authorization and issue version; sample appearance is not evidence of signing authority. |
| Receipt and certificate use different business-facing numbers | Keep **separate** immutable document references linked to **one** original CG-07 donation and CG-09 posted finance event. |
| Certificate is a recognition artifact | It is **not an 80G/tax deduction receipt** and should never imply verified tax eligibility. |

## Canonical implementation ownership (no extra module)

- **CG-07 US-003 / FR-019 / CG-07-BR04:** Once a genuine donor contribution is **verified and CG-09 posted**, display original donation receipt and separate donor recognition certificate in authorized donor/Admin history with **Preview / Download PDF / Print**. Donor name, INR amount/words, date, purpose and posted money are true source data, not hardcoded sample values; status stays pending until issuer succeeds.
- **CG-09:** The original verified Foundation financial posting and refund/reversal source only. A PDF or payment-link creation never creates cash.
- **CG-19 / FR-070:** Issue two versioned source-linked CG-07 document template types `DONATION_RECEIPT` and `DONOR_RECOGNITION_CERTIFICATE`. Preserve immutable issue/reissue/correction/revocation history, distinct human references, source version, PDF checksum, private signatory/logo assets and authorized downloads. **Do not add future CG-07 selectors or fake donation records to CG-19 initial CG-01/03 Foundation story.**
- **CG-18 / CG-21:** Approved branding, verified statutory notices/domain and safe legal publication settings. Do not grant automatic 80G benefits from sample text.
- **Privacy and QR:** Only the authorized donor/Finance user can view private donor/payment data. A public QR may resolve to verified minimal status or official homepage only, never raw medical/identity/financial details.

## Acceptance and QA: extend existing stories, do not invent executed tests

Extend **CG-07 US-003-QA01–QA20** and CG-19 downstream integration regression to trace both documents to the same verified CG-09 event, independently unique receipt/certificate numbers, exact INR arithmetic and amount-in-words, long donor names, Unicode rupee/font rendering, genuine configured brand/legal disclosures, first issue and duplicate retry, refund/correction/revocation, masked and unauthorized download, and missing template/signature/storage. Compare **both exact original PDFs** to generated desktop and mobile preview and A4 one-page landscape print. The certificate blank page must not recur. Original pixel, browser/native, DB and runtime QA are **NOT_RUN**.

**Open client confirmations for live use:** official domain, applicable company/NGO registration evidence, actual 80G status, approved signatories/seals, certificate validity meaning, and final receipt disclaimer.
