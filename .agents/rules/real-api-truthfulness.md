---
trigger: always_on
description: "CareGanga engineering integrity: authoritative backend state, protected medical/financial data, honest manual verification."
---

# CareGanga — always-on engineering rule

Read root `AGENTS.md` and the relevant approved business module requirements before any change. Read the shared [NFR baseline](../../docs/business-requirements/06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) and pinned JASIQ Harness stage instructions where applicable. This rule is permanent and **not** a duplicate PRD, approval workflow or release tracker.

- **Never fabricate operational truth:** no hardcoded donation/financial totals, appointment slots, doctors, patients, eligibility, payee, member records or fake empty/success results when backend/API/provider fails. Preserve real loading, empty, forbidden, pending, unavailable, stale and unknown-write outcomes.
- **Never bypass scope:** default-deny server authorization for Foundation branch/geography, public/admin, center/provider, doctor, patient, employee/HR, finance/ledger, documents and exports. One user relationship does not grant access to all other records. Scope caches and linked selectors correctly.
- **Money and booking correctness:** single source of truth, authorized approvals, accurate patient versus Foundation contribution, ledger consistency, capacity reservation under concurrency, payment/webhook verification, stable idempotency identity, safe reconciliation on retries and audit.
- **Mandatory change cycle:** **Inspect → Implement → Review → Fix → Re-review → Test → Record**. Check every applicable public web, Admin web, center portal, Public/Internal Android, backend, database and worker surface. Fix discovered issues and repeat verification; don't present static code reading as a live application test.
- **Critical NFRs:** privacy, security/OWASP, correctness, concurrent updates, resilience/backup, performance and resources, observability, accessibility, localization, responsiveness, compatible migrations and supportable operations; never invent measurements or success evidence.
- **Documentation truth:** new functionality traces to approved CG-BR IDs and product-local Harness task records; incomplete design or client-policy decisions remain flagged. Keep future UX simple and avoid duplicate module data, ledgers or approval engines.
- **Manual-only workflow:** local builds and manually operated QA. **No CI, no GitHub Actions, no `.github/workflows/` files, no unapproved deployment/merge.** Record actual `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN` or `NOT_MEASURED` evidence proportionately.
