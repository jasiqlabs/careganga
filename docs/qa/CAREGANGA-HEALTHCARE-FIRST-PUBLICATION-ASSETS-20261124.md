# Healthcare first-publication assets and acceptance

Source-controlled CMS seed now supplies all nine reference categories. Library pack: `/CareGanga/CareGanga-Healthcare-CMS-Editorial-Illustrations-20261124.zip` (SHA-256 `34e350d5ec1adcf32e44a0a6bcfca33e0fb220c5c73c3e9d7e2152adf275cf28`). It includes the existing editorial healthcare hero and nine original neutral category pictograms, not provider photographs or evidence of actual care.

## First installation only
1. Initialize the existing CMS drafts using the new source initializer. Never overwrite a live or previously published healthcare page; use a reviewed next revision for existing installations.
2. Extract the Library pack locally. Create a private manifest with the exact current healthcare pageRef, revisionRef and expectedVersion, using the existing CMS author account.
3. Dry-run: `node scripts/import-healthcare-cms-illustrations.mjs --asset-dir <extracted-directory> --page-manifest <private.json>`. This validates all ten checksums without network writes.
4. With the existing authorized CMS author token and backend origin configured, repeat with `--apply`. The importer only accepts an unpublished empty-media original draft and confirms CG19 scan/rights before attaching. Obtain independent original CMS approval, then use the existing first-publication manifest and command; do not bypass approvals.
5. Existing first-publication readiness script now requires all nine exact reference categories, hero, and ten published media placements. Verify ordinary later CMS revision and withdrawal remain unaffected by this first-install gate.

## QA
Run `node --test scripts/verify-cms-first-publication.test.mjs scripts/deploy-cms-first-publication.test.mjs`, local source preflight, builds and screenshot/device comparisons. Verify missing/revoked media, reordered/renamed categories, unauthorized upload, public Web/native matching current media, and all category links. Runtime/live publication NOT_RUN. No new environment variable required.
