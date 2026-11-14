# CareGanga Foundation — AI Agent and Developer Entry Point (JASIQ Harness v2)

**Product ID:** `careganga`  
**Product repository:** `jasiqlabs/careganga`  
**Central Harness:** `jasiqlabs/jasiq-harness` (private, **not copied** into this repository)  
**Current project status:** Requirements and planning; do not assume an application stack, implemented features, API endpoints or existing deployments.

## 1. Authority and source of truth

1. Read [the current CareGanga BR index](docs/business-requirements/README.md), [Master BR](docs/business-requirements/00-MASTER-BUSINESS-REQUIREMENTS.md), [module BRs](docs/business-requirements/01-FOUNDATION-OPERATIONS-BR.md), [Healthcare BR](docs/business-requirements/02-INTEGRATED-HEALTHCARE-BR.md), [CMS/channels BR](docs/business-requirements/03-CMS-CHANNELS-BR.md) and [shared NFRs](docs/business-requirements/06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) before planning related work. The [decision register](docs/business-requirements/04-TRACEABILITY-DECISIONS.md) contains policy questions requiring client confirmation.
2. Treat the client requirements, the 167-image [Admin screenshot audit](docs/research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md) and the supplied healthcare screen references as **source evidence**. Screenshots show intended UI/UX, not confirmed working backend logic. Never copy demo records, personal details, sample amounts, diagnoses or fictional ratings into production.
3. Healthcare Assistance is an original, integrated part of this **one Foundation platform**. Keep its privacy and role isolation, and reuse Foundation identity, approvals, finance, notifications, documents and reporting. **Do not create obsolete or unapproved modules from historical screenshots.**
4. **One business capability owns each record**. PRDs must use the approved CG-01–CG-21 business module map and provide clear source references. The Foundation Admin, public website, healthcare-center portal, Public Android, Internal Android and centralized backend are **channels**, not competing copies of business data.
5. For new work, keep **one canonical initiative** under `specs/initiatives/<slug>/` in **this product repository**. Its approved PRD/HLD/module planning and single combined `tasks.md`, conditional UI/UX and DLD, QA evidence and approvals stay together. No duplicate tracker/stories registry or independently versioned BR.

## 2. Mandatory JASIQ Harness v2 bootstrap

- Pin the **reviewed Harness v2 commit** used by BrickOps and Anjuman:
  `JASIQ_HARNESS_EXPECTED_SHA=0308fbd9e332c51955c7d0da7a8023f87cbf1fe5`. Default `JASIQ_HARNESS_REF=main`; use another ref only with explicit reviewed authority.
- Run `python3 scripts/resolve-jasiq-harness.py` (Windows: `py -3 scripts/resolve-jasiq-harness.py`). It validates a sibling Harness checkout, its original remote, clean worktree, complete SHA and expected v2 files; it **fails closed** on mismatch. Do not silently use moving Harness revisions or unreviewed drafts.
- Read the pinned Harness `AGENTS.md`, `docs/V2_GUIDE.md`, `jasiq-asdlc/workflow-manifest.yaml`, `standards/ENGINEERING_STANDARD.md` and only relevant `.agents/skills/jasiq-*/SKILL.md`. If needed, install local discovery with the Harness skill installer after version validation; the shared Harness remains the authority for **how**, product-local approved artifacts govern **what**.
- New work follows **PRD → HLD → Planning (business modules, dependency-ordered approved tasks; UIUX/DLD only when required) → task-by-task Development → independent QA/Release**. Only proceed after each relevant review/approval. If a user explicitly authorizes delegated approval, record the identity and scope honestly; do not fabricate client sign-off.
- Use `jasiq-asdlc/tools/resolve_product.py --product-root . --project-id careganga --mode GREENFIELD --initiative <slug> --stage <stage>` with an appropriate stage per the pinned Harness manifest; use the task-specific modes once development starts. No unapproved work or automatic scope expansion.
- `/jasiq-dev` handles **one approved, dependency-ready task at a time**; `/jasiq-handoff` can cover an explicitly authorized maintenance/build/UAT request without redundant planning documents.

## 3. Permanent engineering contract — all changes

**Implement → Review → Fix → Re-review → Test → Record.** This applies to every code change; planning and documentation changes receive proportional source/link/consistency checks.

- **Never hide backend failure:** no invented business data, fake success, empty arrays/zeroes for API errors, false payment confirmation or sample patient/doctor/fund records. Distinguish real loading, confirmed-empty, denied, offline, failed, partial, stale and unknown-write states.
- **Authorization and privacy first:** default-deny backend permission, Foundation hierarchy/branch scope, healthcare-center isolation, patient and medical-file access, employee salary/bank data, beneficiary and donor privacy; avoid authorization based solely on hidden UI. Public endpoints expose only specifically approved published information.
- **Correct money and capacity:** verified payment events, accurate gross/patient/Foundation contribution, double-entry financial posting, no duplicate accounting or payroll, idempotent retries/refunds, slot locking/capacity, auditable settlement and approval. An unverified payment request is not cash received.
- **NFRs are acceptance gates:** use [CG-BR-600](docs/business-requirements/06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md). Evaluate data isolation, security/OWASP, concurrency, recovery, performance, observability, accessibility, responsive web and Android usability, localization, integration reliability, safe migration and compatibility. Numerical SLA targets remain **proposed** until formally approved.
- **One end-to-end functional slice:** implement and review every **applicable** surface of the approved story—Foundation Web Admin, public website, center portal, public/internal Android, backend/API/database, jobs/integrations—using shared authoritative logic. Not every module needs every surface; list and justify nonapplicable ones.
- **Clean UI/UX:** modern, responsive, navigable, role-sensitive and usable by nontechnical Foundation/center staff. Keep common controls reusable and avoid recreating every screenshot's crowded sidebar. Every required workflow must be accessible and show trustworthy success/error feedback.
- **Truthful evidence:** code inspection ≠ live test; a build ≠ end-to-end QA; screenshots/mock responses ≠ production integration. Record affected source, reviewed paths, tested environment, exact local commands and PASS/FAIL/BLOCKED/NOT_RUN/NOT_MEASURED outcomes. Review and retest after each fix. Human/manual QA and actual runtime verification are mandatory before release.
- **No overengineering:** choose a coherent, business-owned modular design; prefer simple maintainable server and shared frontend contracts. No invented microservices, event buses, extra infrastructure, duplicate modules, unnecessary approval screens or misleading workflow automation.

## 4. Git and delivery policy

- Work on an approved **feature branch** from the current agreed base (currently `main`); protect `main` until explicit user-authorized merge.
- **No CI pipelines. No GitHub Actions. Do not add `.github/workflows/`, workflow YAML, CI badges or automated PR gates; do not trigger or rely on CI/GH Actions for verification.**
- Review code/document diff manually, use suitable local builds/tests and device/browser/API/DB QA. Never claim completion of a test not executed.
- No live payment, real patient data mutation, production migration, deployment, destructive database action, secret exposure or merge without explicit owner authorization and applicable release safeguards.
- Report scope, branch, paths, review findings, corrections, evidence and unresolved decisions concisely. A document-only configuration setup must not claim that a mobile app, healthcare flow or deployed system works.

**Agent-specific always-on rule:** [`.agents/rules/real-api-truthfulness.md`](.agents/rules/real-api-truthfulness.md) reinforces these standards but is **not a second approval process**.
