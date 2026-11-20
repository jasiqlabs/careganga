# CG-14 — exact local implementation and runtime QA handoff

**Owner-approved source branch:** `feature/careganga-cg14-healthcare-network-dev-20261118` from `main`. Do not merge, cut a fix branch, run CI/GitHub Actions, or claim source-complete/runtime QA until the actual gates below are complete. Apply fixes on the same authorized branch. Follow JASIQ-DEV: **build → review → fix → re-review → original QA trace → update canonical `tasks.md`**.

**Truth at handoff:** US-001 through US-005 have authored cross-owner backend, PostgreSQL, Foundation/Center/public Web and applicable Public/Internal Android source. They are **DRAFT_SOURCE_ONLY**, 0 executable QA passed. The 94 original QA IDs and exact latest counts live in `tasks.md`: 79 SOURCE_VERIFIED, 2 SOURCE_GAP (US-005-QA20/Q22 require actual CG-22/16/23/24 operational modules), 13 NOT_VERIFIABLE. Current-head JASIQ Harness, qualified independent security/DB specialists, actual SQL, build/device/pixel/benchmark and production deployment are not independently certified.

## 1. Local build preflight (record command/exit code/commit hash)

On the exact GitHub branch checked out in the developer's IDE:

```bash
git status --short --branch
git rev-parse HEAD
node --version       # Node >=22.13.0
npm ci
npm run verify:cg14-source
npm run verify:cg14-us004-us005-source
npm run build -w apps/backend
npm run build -w apps/web
npx tsc --noEmit -p apps/android-public/tsconfig.json
npx tsc --noEmit -p apps/android-internal/tsconfig.json
```

Any failed command is **FAIL/BLOCKED** (not "source-verified"). Fix in original owning file on the same branch, re-review, rerun. Do not alter dependencies/predecessors to hide real failures. Keep screenshots/source failure evidence attached to the specific original QA ID.

## 2. Original PostgreSQL migration, constraints and concurrency

Use a **temporary PostgreSQL database restored from a verified safe backup**, never run an exploratory migration against a production database or a tenant's live records. Configuration uses a direct `DATABASE_MIGRATION_URL` in `apps/backend/.env` (not a pooled connection); original runner `npm run db:migrate` validates SHA256 of previously applied files. Compare a clean empty DB and an upgrade copy of actual predecessor modules. Save sanitized start/end `schema_migration` filenames/hashes, migrations 1401–1419, schema and constraints.

```bash
npm run db:migrate
```

Required DB assertions: original CG-01/02/03/19 tables preserved; `uq_cg14_center_root_provider_identity` exists before 1419 FK; all 1412–1419 indexes, original CG-03 process/status/check constraints, frozen revision/command/event triggers, CG-19 file owner classification and composite support case/file FK; incorrect same-root/Center B IDs, nonexistent provider, stale source, direct case decision forgery and deleted/revoked licence/consent rejected. Probe 2-actor concurrent save, decision, apply, publish, revoke, read and suspend paths with timeouts; prove no SQL deadlocks, orphan rows, duplicated final outcomes or reactivated accounts. Run `EXPLAIN (ANALYZE, BUFFERS)` on realistic index/cardinality and track p95, not invented performance figures. Test safe backup and restore. Maintain no raw PII in logs.

## 3. Real configured backend/Web and private object storage

Start Nest and Next in the developer environment with real credentials and a configured original CG-19 **private object store** (Google/Firebase Cloud Storage or S3 as client chooses) plus a real malware scanner. Missing scanner means **UNAVAILABLE**, not success; file thumbnails must be stripped of metadata, source-bound and revoked. With the existing CG-21 safe-error editor, change a simple validation error and confirm the user sees that exact approved human-friendly text and not raw SQL/technical IDs. Verify both authorized and unauthorized direct API calls; BFF menu hiding alone is not authorization.

For `HealthPublicRequestThrottleService`, test actual signed proxy proof (if configured), forged `x-cg14-proxy-*`, raw peer fallback, no X-Forwarded-For trust, 429 with safe editable copy, request recovery after 60 seconds and SQL bucket expiry. Verify behind reverse proxy / WAF that many genuine public clients do not share an impractical hot bucket. No raw client addresses stored.

## 4. Five original US acceptance journeys

- **US-001**: Foundation creates provider and center draft; valid geography, types, secure masked finance, current Center A staff and edit permissions; Center B guessing denied; responsive original Admin/Center design.
- **US-002**: CG-19 private licence scan/expiry/revoke; independent original CG-03 reviewer with current password; role A cannot self-approve; Foundation activates/enables/publishes separately; suspend/reopen/reapprove and revoked staff not revived; audit event replay.
- **US-003**: One verified professional identity, original CG-03 doctor proof, Center A/B affiliation request/reviewer and history, immutable fee effective ranges, no overlapping approved fees, future approved fee/expired fee, doctor/center suspension and read-only fee history; Web and Internal Android reviewer parity.
- **US-004**: Public Next and Public Android show only current approved center/doctor and same center-specific fee; all 9 illustrated category types, genuine area/service/facility/weekday/experience/search filters, cursor page 21→20, maps/contact, SEO/404/sitemap current-only, photos rights and offline/back/reset/rotation; no invented slot, booking, review, stock or benefits.
- **US-005**: Center A scoped content/FAQs/safe photos and original CG-19 scanned support case/attachments, protected independent CG-03 approval, fresh Foundation publication/unpublish and frozen before/after preview, stale edits and revoked consent fail closed. Original center ERP capability grant is a **permission request only**; four global ERP switches OFF by default, optional Center A grant independently approved, Center B denied, suspend/withdraw CAS, and `effective:false` while owner modules are absent. Keep **US-005-QA20 and QA22 as cross-owner SOURCE_GAP** pending actual optional ERP source and worker integration — do not write a fake operational pharmacy ERP or claim installed functionality.

## 5. Client reference and independent sign-off

Manually compare Foundation Admin, Center Portal, public Web desktop/mobile/tablet and both Android journeys with the approved CareGanga admin ZIP/public screenshots and healthcare references; test widths, touch/keyboard/Back, actual text/content, animation and human error/success feedback. Record real visual differences, responsive/accessibility and screenshot references. Conduct **independent qualified human security, database, NFR and UI/UX reviews** on actual built commit; fix and re-review each CRITICAL/HIGH issue.

Only after **all applicable original QA executable scenarios** are traced (real PASS/FAIL/BLOCKED, exact evidence, dates/actor) and the formal JASIQ Harness current-hash gate is met may the source-complete and merge decision be escalated for the user's explicit authorization. No automated GitHub workflows. All ordinary CG-14 core paths must work when the 4 ERP switches are OFF.


## 18 November 2026 — Required retests added by independent AI source review

On top of all original 94 tests, explicitly run and record:

1. **Build/lint source verifier:** `npm run verify:cg14-us004-us005-source` must execute the newly rebuilt JavaScript verifier (the prior generated version was malformed; now syntax-validated but NOT_RUN). Verify no syntax error, all assertions, build/bundle/backend/Expo. The local command outcome must be recorded; source-only GitHub reads are not PASS.
2. **Exact Center A/B DB FK:** on a disposable PostgreSQL migration-1417 DB attempt attaching a Center B `cg19_support_case` to Center A `cg19_upload_intent`, `cg19_stored_file`, and audit. All must fail at **database FK** level; valid same-center source must succeed; legacy FOUNDATION_PUBLIC cases remain nullable and must not break.
3. **Published center CAS:** publish revision 1, start a reviewer using old source, approve/publish revision 2, then submit old withdraw `{currentPassword,expectedGeneration,approvedRevisionRef}`. It must fail with CG-21-editable `HEALTH_CONTENT_PUBLICATION_CHANGED`; revision 2 must remain public. Current withdrawal must succeed once and disappear from reviewer/publisher UI. Test two concurrent withdraws.
4. **Different reviewer/publisher permissions:** use user A with `approvals.review` + `health.providers.verify` but no publish; user B with `health.centers.publish` but no approvals.review. A records original CG-03 decision but cannot publish; B sees only approved safe case metadata and can publish/withdraw with fresh root password. Neither may gain the other's private case evidence/decision API. Repeat separately for original `HEALTH_CENTER_CONTENT_REVIEW` and `HEALTH_CENTER_ERP_GRANT`.
5. **Mobile genuine navigation:** Public Android first shows search and compact filters; opening a doctor then one center then hardware Back returns to the **current fetched doctor**, then Back to directory, then Back to app entry. Test no stale cached fees, closed/expired center, filter reset, PIN+state/district/block hierarchy, narrow screen, font size, keyboard, offline and TalkBack.
6. **Public Web progressive geography:** changing state removes incompatible old district/block, a district only shows current state's choices, a block only shows current district; filters collapse, remain discoverable, keyboard/assistive technology works; genuine current results and safe no-store data.
7. **Source-order lock races:** original CG-03 ERP and center-content review detail/decision versus protected Foundation apply and withdrawal in two sessions with short `lock_timeout`; no deadlock, duplicate grant/publication or orphan original case. Repeat with revoked CG-19 photo rights.
8. **Security/NFR:** anonymous public request SQL HMAC throttle under genuine reverse proxy and multiple clients; no XFF trust; forged trusted header blocked; no raw IP persisted; CG-19 private scanner inaccessible to public; Foundation and Center A/B IDOR denial; CG-21 error wording editable and safe. Collect EXPLAIN, p95 and real client-branded UI screenshot evidence.

**Review artifact:** `INDEPENDENT-AI-SPECIALIST-SOURCE-REVIEW-20261118.md` is the scoped AI reviewer report (marked finished for source inspection only). Independently qualified **human** DB/security/UX specialists must separately review the actual built commit and resolve new CRITICAL/HIGH issues. The canonical tracker must not call these scenarios passed without developer evidence.


## 19 Nov 2026 — Recover *separate* healthcare screenshot pixels before visual sign-off

Do **not** use the original 167-screen Foundation Admin ZIP as the sole visual reference. A **separate healthcare UI screenshot batch (~20 images)** was supplied earlier; the recovered original screen mapping is in `docs/research/CAREGANGA-HEALTHCARE-SEPARATE-UI-SCREENSHOT-REFERENCE-MAP.md`. For CG-14 compare actual rendered provider/center/doctor/fee/approval/public pages, especially **UI-07 doctor registration**, **UI-09 center-specific fee** and **UI-23 independent approval**. Use the other screenshot IDs to test correct owner boundaries rather than invent appointment, lab, pharmacy, nursing or OT features in CG-14.

**Blocking evidence gap:** actual original healthcare image bytes are not available in this branch or current accessible files; the previous user uploads are confirmed from project history but exact filename/pixels cannot yet be inspected. Restore/relink the original uploaded screenshots as client-approved image files, capture running Web 390/768/1440 and native Android physical-screen output, annotate layout/field/icon/color/text/spacing/action/motion differences per UI reference ID, fix on the existing branch, then approve or explicitly mark remaining discrepancies. An indexed screen title alone is **NOT screenshot parity**. Never invent client screenshots or hashes.
