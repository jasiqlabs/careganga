# CareGanga — Client's existing donation receipt and donor certificate

**Source authority:** Two client-provided existing-system PDFs, dated 16 November 2026:
- `Careganga_Donation_Invoice_REC-1794843289633.pdf` — **donation receipt**, despite the "Invoice" in its filename.
- `Careganga_Donor_Certificate_REC-1794843289633.pdf` — **donor certificate**.

**Owner mapping:** CG-07 owns the original donation/payment fact and donor context; CG-19 owns private/generated receipt/certificate template, file verification and authorized distribution; CG-09 supplies only the original posted/settled financial evidence where relevant. **Do not replace CG-09's unrelated U39/U40 general Finance invoice with the CG-07 donation receipt.** CG-07/CG-19 integration must use the actual source, not hardcoded test data.

## Observable sample layout and copy authority

**Donation receipt:** CareGanga Foundation masthead and education/healthcare tagline; receipt number/date, registered address, website and contact; prominent INR amount and amount in words; donor details; donation purpose; payment method, payment reference and clearly labeled paid proof; corporate registration details; authorized signatory area; Section 8 and charitable-use note, numbered conditions, website QR. The sample's footer explicitly says **80G: Not Yet Granted**. Never replace this with an unverified tax-exemption claim; the legally applicable live status and organization details must come from controlled configuration, not sample literals.

**Donor certificate:** donor name, donation amount, CareGanga Foundation name, location, issue date, certificate number and validity dates. Reproduce the client reference's composition during CG-07/CG-19 rendered PDF acceptance, not by displaying unrelated accounting balances.

**Payment integrity:** a payment link, order created or donation submitted is not a settled donation. Issue a paid donation receipt/certificate only from a verified original payment record and appropriate reviewer/provider policy; idempotent issuance, correction/revocation and status checks must not produce duplicate legally represented receipts.

**Data hygiene:** the PDFs include a real-looking sample donor name/contact and payment reference. This note intentionally omits those values. Do not put the sample donor's mobile, email, payment ID or company keys in source, fixtures, logs, public PDF templates or UI. Load actual legally approved corporate metadata from the client-configured source.

**Verification:** textual layout/field mapping recorded from provided PDFs; no claim of an exact CSS/PDF pixel match or original PDF binary being committed. A manual side-by-side rendered-document test remains required. Store the two original PDFs in the project's restricted client-reference location and keep them accessible to the responsible local developer.
