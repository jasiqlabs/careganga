# CareGanga Foundation — Business Requirements

**Status:** Single consolidated BR baseline · Internally reviewed · Client decisions and sign-off pending  
**Product:** One Foundation operations and Integrated Healthcare Assistance platform  
**Branch:** `feature/careganga-master-business-requirements-20261114`

## Read these documents in order

| Document | Purpose | Type |
| --- | --- | --- |
| **[00 — Master BR](00-MASTER-BUSINESS-REQUIREMENTS.md)** | Business objectives, 21 module owners, shared boundaries, users, end-to-end processes and PRD dependency order | **Business requirement** |
| **[01 — Foundation & Operations BR](01-FOUNDATION-OPERATIONS-BR.md)** | Organization, accounts, approvals, members, volunteers, projects, beneficiaries, funding, finance, HR/payroll, inventory, referrals, communications and reporting | **Business requirement** |
| **[02 — Integrated Healthcare BR](02-INTEGRATED-HEALTHCARE-BR.md)** | Provider centers, professionals, patients, center-specific availability, appointments, diagnostics, Foundation assistance, payments and settlements | **Business requirement** |
| **[03 — CMS & Application Channels BR](03-CMS-CHANNELS-BR.md)** | Foundation Admin controls, public CMS, healthcare-center portal, public website, Public Android and Internal Android | **Business requirement** |
| **[06 — Shared NFR Baseline](06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md)** | Security, privacy, financial/booking integrity, concurrency, scalability, usability, accessibility, resilience, audit and operational acceptance | **Business requirement** |
| **[04 — Open Business Decisions](04-TRACEABILITY-DECISIONS.md)** | Only unresolved client policy/transaction-scope questions that could materially change PRDs | **Decision register** |

## Supporting evidence (not additional BR versions)

- **[PDF Source Coverage Appendix](05-SOURCE-TO-BR-COVERAGE-AUDIT.md)** — main Foundation requirement sections and all **75 healthcare features** mapped to business ownership.
- **[167-Screenshot Foundation Admin UI/UX Audit](../research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md)** — individual screen references A01–A19, B01–B51, C01–C55 and U01–U42; menus, controls, fields, actions, statuses and complete reconciliation of 26 UI observations.
- **Healthcare UI screenshots supplied in the conversation** — provider discovery, center/doctor details, manual and slot-driven center allocation, patient registration, eligibility, payment, receipts/QR and patient account.

## Source of truth

1. **One integrated product:** Healthcare Assistance is an original part of the CareGanga Foundation business scope and shared backend.
2. **One owner per business record:** Organization, membership, application, finance, project, provider, patient, appointments and CMS content each have clear ownership. Different views and mobile applications reference those records rather than making duplicates.
3. **Foundation Admin governs:** Provider verification, approvals, money rules, memberships, roles, official documents and public publication are configurable through the correct authorized module.
4. **Public content is controlled:** CMS writes editorial copy and public visibility, not doctor schedules, member entitlements, financial balance or healthcare eligibility.
5. **All channels share backend rules:** Foundation Admin, public website, Center Portal and two Android applications have distinct audiences with consistent permissions, records and outcomes.
6. **Quality gates are mandatory:** Applicable P0 NFR requirements must be satisfied in PRD, design, implementation and manual QA. Proposed SLA and timing numbers require workload/budget confirmation.
7. **Screenshots are evidence, not implementation proof:** All 167 Admin images are indexed; screenshot-only controls appear in the UI/UX audit. Approved written requirements still govern when screens are incomplete. Business questions stay in one decision register.

## PRD handoff

Create PRDs for CG-01–CG-21 in the dependency order identified in the Master BR. For each use case, cite the source PDF/screenshot reference, CG-BR ID, actors/permissions, owner data, validation/configuration, Admin/public/Android/center applicability, state transitions, financial/document/reporting effects, relevant NFR IDs and manual QA scenarios.

Keep module PRDs clean: **refer to the single source BR and shared NFR baseline** rather than copying the whole specification into every PRD. Do not add a new business module for each Admin menu item or static mockup.

**Business decisions requiring confirmation:** See [CG-BR-900](04-TRACEABILITY-DECISIONS.md). Requirements that are already confirmed may proceed to PRD drafting; uncertain transaction/eligibility/settlement policies must be resolved before approving the affected PRD.
