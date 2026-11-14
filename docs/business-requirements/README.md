# CareGanga Foundation — Business Requirements Package

**Branch:** \`feature/careganga-master-business-requirements-20261114\`  
**Status:** Business-analyst consolidated draft for client review and subsequent modular PRDs  
**Prepared by:** JASIQ Labs · 14 November 2026

## Start here

1. **[00 — Master Business Requirements](00-MASTER-BUSINESS-REQUIREMENTS.md)**: vision, complete 21-module map, single-source-of-truth boundaries, dependencies, cross-module workflows, public/private access and PRD order.
2. **[01 — Foundation and Operations BR](01-FOUNDATION-OPERATIONS-BR.md)**: organization, roles, approvals, members/volunteers, projects/events/field activities, beneficiaries, donation/CSR, finance, HR/payroll, inventory, referrals/rewards, communications, reporting and governance.
3. **[02 — Integrated Healthcare BR](02-INTEGRATED-HEALTHCARE-BR.md)**: healthcare network, multi-center doctors, provider verification, scheduling, patient, doctor booking, lab operations, Foundation financial assistance, payments, collections and settlements.
4. **[03 — CMS, Admin and Channels BR](03-CMS-CHANNELS-BR.md)**: how Foundation Admin controls every business domain and publication; public pages, impact/NGO information, center portal, public website, public Android and internal Android.
5. **[04 — Source Traceability and Decisions](04-TRACEABILITY-DECISIONS.md)**: 61-page source-section mapping, new UI references, identified conflicts, documented gaps, decision register and PRD acceptance/handoff checklist.

## Source and scope principles

- This is one **integrated CareGanga Foundation platform**. Healthcare is built into the Foundation's operating model and common backend.
- **Original screenshot/video designs** represent functional reference and UI direction, not an instruction to replicate a legacy schema or sidebar. Older original admin video files were not re-accessible at time of this draft and remain an explicit verification gap.
- **Public vs internal:** An organization branch, an approved healthcare partner center, an employee and a public patient do not have the same publication/access rules.
- **Admin control ≠ separate data storage:** A CMS entry may publish a program or center but its source master is maintained by the responsible operational module.
- **Confirmed public booking:** Written baseline initially covers doctor consultations; additional service actions illustrated by new mockups remain explicit business decisions (D-01).
- **Contract scope has not been phased away.** Development dependency order is not a statement that later modules are out of scope.

## How to create PRDs safely

Each owning module (\`CG-01\`–\`CG-21\`) is a potential parent PRD, with smaller PRDs only when a business workflow is genuinely independently testable. PRDs should cite exact CG-BR IDs, source page references and relevant UI screenshots; cover Foundation Admin / Center Portal / Public Site / Public Android / Internal Android / backend implications; and specify lifecycle, configuration, roles and access scopes, errors, performance/privacy, accounting implications and **manual QA scenarios**.

**No implementation or technical design is completed by this documentation.** After client business confirmation, proceed through JASIQ Harness PRD → HLD → module DLD → ordered tasks → implementation/review/fix → manual QA/code-trace and live verification.

## Review checklist

- [x] Integrated business module and source-of-truth ownership map
- [x] Detailed Foundation requirements and processes
- [x] Detailed healthcare requirements and center/public workflows
- [x] CMS/publication/admin/channel mapping
- [x] Source-to-module mapping and unresolved business decisions
- [x] No hidden independent duplicate payment, approvals or operational directories
- [ ] Original prior admin video/screenshot archive reinspection
- [ ] Client confirmation of the documented decision register
- [ ] Client sign-off of master BR scope
