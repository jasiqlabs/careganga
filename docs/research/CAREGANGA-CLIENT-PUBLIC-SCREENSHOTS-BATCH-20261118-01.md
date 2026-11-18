# CareGanga — original public website screenshots, 18 November 2026, Batch 01

**Evidence status: RECEIVED, ARCHIVED, CONTENT NOT YET FULLY AUDITED.** Client-owned public website references supplied in conversation while the client is sending additional screenshots. This is a **source inventory**, not an implementation or QA pass. Do not start duplicate modules or declare any CG-18 user story complete from this record.

## Private originals

- **Persistent private CareGanga Library:** `/CareGanga/CareGanga-Original-Public-Website-Additional-Reference-20261118-Batch01.zip`
- **ZIP SHA-256:** `764e141b9395b464cdb5aa1031806ba8540758fc104fbebfcdac62e4c0c7a7ea`
- **Contents:** 12 unmodified screenshot PNGs in `originals/`, `manifest.json`, `manifest.csv`, `README.md`.
- Each manifest entry includes the **exact original incoming filename**, SHA-256, original URL shown in browser, and observation. Screenshots are **not** tracked in Git or distributed as deployable brand assets.
- **Prior original references remain separately preserved** as `/CareGanga/CareGanga-Original-Public-Website-Visual-Reference-20261117.zip` (10 earlier public screenshots), `/CareGanga/CareGanga-Original-Admin-Screenshots-Verified-20261115.zip` and `/CareGanga/CareGanga-UIUX-Golden-Reference-Pack-20261115.zip`. Do not overwrite or lose these.

## Page-by-page original screenshots

| Original client URL in browser | Incoming screenshot filenames | Screenshot-visible content, not verified operational behaviour |
|---|---|---|
| `/about/team` | `image(20261118-020435).png`, `image(20261118-020449).png`, `image(20261118-020504).png` | Leadership Directory hero, Team Directory search by name/member ID; State, District, Sub-Division, Block and Designation filters; dependent filter guidance; Search and Reset; initial empty prompt, approved/published-profile disclaimer, teamwork content, Join/Volunteer/Donate CTAs |
| `/our-impact` | `image(20261118-020524).png`, `image(20261118-020538).png`, `image(20261118-020554).png` | Original Impact page sections, growth and geographical reach, categories, key areas, success stories, updates, donation/footers; six original Our Work dropdown options captured open |
| `/ngo-information` | `image(20261118-020634).png` | Original NGO Information subnavigation and 80G Registration main page; statute/verification imagery and card layout are screenshot evidence **only**, not independent certification |
| `/ngo-information/pan-details` | `image(20261118-020650).png` | Separate PAN Details screen, registration card and tax-profile panel; official identifiers in screenshot must not be copied into code as production facts |
| `/ngo-information/registration-certificate` | `image(20261118-020708).png`, `image(20261118-020959).png` | Multiple certificate cards, issuing authority, status, document actions, scroll continuation; valid data/documents require original verified source |
| `/ngo-information/annual-reports` | `image(20261118-021020).png` | Separate Annual Reports page, year filter, report table, genuine empty state and transparency banner |
| `/ngo-information/financial-reports` | `image(20261118-021040).png` | Separate Financial Reports page, year and report-type filters, Export Report action, result empty state and accountability banner |

**NGO Information original sidebar visible:** 80G Registration; PAN Details; Registration Certificate; Annual Reports; Financial Reports; Transparency & Compliance; Policies & Documents; additionally Join Us and Campaigns. The latter sidebar destinations **were not captured** in this batch, so their original URLs are unknown. The top horizontal navbar still contains the old Blood Donation label in the client original; only that destination becomes Healthcare Assistance in our approved replacement.

## Reconciliation notes for the next complete source audit

- This establishes **original URL facts** that were previously unknown: `/our-impact` is **not** the same original path as the replacement's current `/impact`; `/ngo-information` has a **real multi-page left navigation hierarchy**, not only a flat Impact or 80G card.
- The original `/about/team` is **a searchable Team Directory**, with location and designation-dependent controls. It cannot be accepted solely by rendering the existing CG-18 static editorial Team cards. Determine the real existing owner of published person/profile data and reuse that owner, without introducing a shadow people master.
- Real 80G approval status, registration certificates, PAN information, annual/financial reports and source documents must come from authentic, approved source data. The screenshot labels `VERIFIED`/`ACTIVE` are **visual examples**, not proof that the replacement has validated the information.
- Preserve original typography, colours, layouts, sidebars, controls, empty states, navigation and mobile adaptation as references; **pixel, function and device QA NOT_RUN**.
- This is **Batch 01**; the user explicitly said more evidence is coming. Keep accepting subsequent batches and do not treat this as the exhaustive original website map. Once the user finishes supplying screenshots, reconcile original-page URLs and ownership into the canonical original navigation contract, BR/PRD/HLD/DLD, the **existing** CG-18 QA story definitions and the appropriate operational source owners. No new module, no implementation claims, no unapproved merge.

**Branch:** `feature/careganga-cg09-finance-accounting-dev-20261117`. No code changed by this reference-only addition.
