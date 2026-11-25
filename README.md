# CareGanga Foundation

Unified Foundation Operations and Integrated Healthcare Assistance platform.

## Current business requirements

The authoritative, consolidated requirements baseline is maintained in **[docs/business-requirements/README.md](docs/business-requirements/README.md)**.

It links the single Master BR, Foundation and Healthcare module requirements, CMS/Admin and application-channel responsibilities, shared NFR quality gates, and the remaining client business decisions.

**Reference evidence** is kept separately from the BR: the 61-page client source mapping, healthcare reference screens and the detailed 167-screenshot Foundation Admin UI/UX audit.

PRDs are created from these requirements in dependency order. All interfaces share the same backend, permissions and module-owned business records.

**Current status (16 November 2026):** Five Foundation modules (CG-01, CG-21, CG-03, CG-19 and CG-02) are source-merged to main via PR #4/#5/#7/#8. They have 14 source-integrated story workstreams and **165 defined QA cases**, not 165 executed tests. Current CG-01 password/SMS recovery source gaps, the one-time Foundation build, real PostgreSQL migration/restore, Web and both Android device QA, original Admin visual comparison and qualified independent security/database review remain OPEN. Refer to the [canonical development order](specs/initiatives/careganga-foundation-platform/DEVELOPMENT_ORDER.md) and [consolidated Foundation F0–F5 local QA handoff](specs/initiatives/careganga-foundation-platform/FOUNDATION_F0_F5_LOCAL_VALIDATION_HANDOFF.md). Client-policy decisions and formal approvals remain separate.

**Development sequencing clarification (17 November 2026):** The five source-integrated Foundation owners unblock separately authorized, dependency-ready P1–P7 **source implementation** without first finishing consolidated Foundation runtime QA. Each story still needs real predecessor code, independent manual source review/fix/re-review and scenario-by-scenario source QA traces; a source-traced case is **not** an executed test. Foundation builds/DB/device/provider QA and qualified security review proceed independently and remain mandatory before deployment/release. Follow the canonical `DEVELOPMENT_ORDER.md`; no automatic authorization to start a new module.

## Developer and AI-agent setup

Read **[AGENTS.md](AGENTS.md)** before every planning, design, development, review, handoff or QA stage. It mandates a **fresh check of the latest `jasiqlabs/jasiq-harness/main` SHA before every new stage**, a reviewed exact commit for the stage, one-task execution, manual verification, privacy/financial integrity, and **no CI / no GitHub Actions**. An upstream Harness update must never go unnoticed or silently change an in-progress approved artifact.

- Run `python3 scripts/resolve-jasiq-harness.py` (Windows: `py -3 scripts/resolve-jasiq-harness.py`). It checks the live remote Harness `main` and the product-reviewed SHA; no manual environment variable is required. If the pin is stale, review the upstream diff and update the pin in the product feature branch **before continuing**. After a reviewed update, `--sync` can safely refresh a clean local Harness checkout.
- Treat the [always-on agent rule](.agents/rules/real-api-truthfulness.md) and [shared NFR baseline](docs/business-requirements/06-NON-FUNCTIONAL-BUSINESS-REQUIREMENTS.md) as mandatory quality gates.
- The repo includes `.gitignore`, `.editorconfig`, a root npm workspace and tracked lockfile, the NestJS backend, Next.js Web, Public/Internal Expo Android and shared contracts/tokens. Use `npm ci` locally before asserting buildability.
- **Verification is local/manual.** Do not introduce `.github/workflows/`, CI pipelines or automated GitHub Actions; do not claim tests were executed unless they were.

## Greenfield DB feature branch (24 November 2026)

For the database simplification child branch, use the committed single PostgreSQL 17 baseline and [Hostinger deployment guide](docs/deployment/hostinger-greenfield-database.md). No historical replay on installation or startup; actual developer acceptance is described in the [database test handoff](docs/qa/CAREGANGA-GREENFIELD-DB-DEVELOPER-HANDOFF-20261124.md).
