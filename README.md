# CareGanga Foundation

Unified Foundation Operations and Integrated Healthcare Assistance platform.

## Current business requirements

The authoritative, consolidated requirements baseline is maintained in **[docs/business-requirements/README.md](docs/business-requirements/README.md)**.

It links the single Master BR, Foundation and Healthcare module requirements, CMS/Admin and application-channel responsibilities, shared NFR quality gates, and the remaining client business decisions.

**Reference evidence** is kept separately from the BR: the 61-page client source mapping, healthcare reference screens and the detailed 167-screenshot Foundation Admin UI/UX audit.

PRDs are created from these requirements in dependency order. All interfaces share the same backend, permissions and module-owned business records.

**Current status:** Business requirements internally consolidated and source-aligned; client policy decisions and formal approval remain to be completed. No application implementation is represented by these planning documents.

## Developer and AI-agent setup

Read **[AGENTS.md](AGENTS.md)** before planning, development, review or QA. It defines the pinned JASIQ Harness v2 workflow, one task at a time, manual code review and end-to-end verification, privacy and financial integrity, and the **no CI / no GitHub Actions** policy.

- Run `python3 scripts/resolve-jasiq-harness.py` with the full approved `JASIQ_HARNESS_EXPECTED_SHA` shown in AGENTS.md. On Windows, use `py -3`.
- Treat the [always-on agent rule](.agents/rules/real-api-truthfulness.md) and [shared NFR baseline](docs/business-requirements/06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) as mandatory quality gates.
- The repo includes `.gitignore` and `.editorconfig`; app-specific dependency/stack configuration will be added only after the HLD selects an implementation stack.
- **Verification is local/manual.** Do not introduce `.github/workflows/`, CI pipelines or automated GitHub Actions; do not claim tests were executed unless they were.
