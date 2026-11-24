# CareGanga Healthcare Manual QA Suite

Automated executable manual QA scripts for verified healthcare foundation modules:
- **CG-14 Healthcare Network:** `04-qa-cg14-network.mjs` (Scenarios B01–B08)
- **CG-15 Patients & Appointments:** `05-qa-cg15-appointments.mjs` (Scenarios C01–C12)
- **CG-17 Healthcare Assistance & Settlements:** `06-qa-cg17-assistance-settlements.mjs` (Scenarios D01–D09)
- **CG-16 Diagnostics (ERP OFF):** `07-qa-cg16-diagnostics.mjs` (Scenarios E01–E03)

## Running the Suites
```bash
# Run all healthcare test suites sequentially:
node tests/healthcare-manual-qa/run-all-healthcare-qa.mjs
```
Prerequisites: Live PostgreSQL database, running NestJS backend on `:4000`, and running Next.js web frontend on `:3000`.
