# CareGanga — Foundation → Finance → CMS/CG-19 local build and QA execution runbook
**18 November 2026 · canonical QA index, not a second case tracker**

**Branch:** `feature/careganga-cg09-finance-accounting-dev-20261117`. The original cases/statuses live in the same six module `tasks.md` files; this runbook only specifies **execution order and evidence**. Keep all 296 original IDs: CG-01 **51**, CG-02 **25**, CG-03 **31**, CG-09 **71**, CG-18 **76**, CG-19 **42**. Do not substitute source-presence for executed QA. Do not run CI/GitHub Actions or merge to `main` as a side effect.

## 1. Preflight, in order (fresh checkout, Node ≥22.13)

```bash
git fetch origin
git switch feature/careganga-cg09-finance-accounting-dev-20261117
git status --short
node --version
npm ci
python3 scripts/resolve-jasiq-harness.py
npm run verify:design-approvals
npm run verify:auth-source
npm run verify:cg18-source
npm run verify:core-source
npm run build -w apps/backend
npm run build -w apps/web
npx tsc --noEmit -p apps/android-internal/tsconfig.json
npx tsc --noEmit -p apps/android-public/tsconfig.json
```

Run the actual Harness resolver at the pinned **reviewed and current** SHA after confirming the installed sibling checkout; do **not** use a stale checkout. Set `apps/backend/.env` and Web/native backend URLs from the **client/local developer's approved private secrets**, never commit credentials. A failed command is a blocker. Do not silently skip failures and do not invent success.

### Disposable database and service checks

Take a backup before migrating an existing test DB, then use a *fresh disposable* PostgreSQL DB and execute `npm run db:migrate`. Assert ordered migration history through CG-09 **0931** and CG-18/19 **0941**, repeat migration as a no-op, and test backup/restore and a controlled failed migration rollback. Verify the actual final `cms_asset_placement_role_check` includes `CONTACT`, `IMPACT` and all previous roles; verify triggers and FK/indexes with SQL. Use the client-approved scanner/private storage sandbox (S3 or Firebase as configured), one Foundation root and at least two assigned branches, plus a second isolated root. Do not seed screenshot PAN/80G/partners/money, production donors, staff or patient records.

## 2. Positive, negative and error workflow trace

| # | Original QA owner IDs | Positive path to execute and record | Negative/error/source-withdrawal path |
| --- | --- | --- | --- |
| 1 | CG-01 US-001 QA01–18 | Bootstrap first Super Admin once, Admin creates ACTIVE staff, login by registered mobile or email plus password, password change/reset via real purpose-bound OTP, logout | Unknown/wrong mobile/email/password, inactive/locked account, brute force, invalid password, replay, expired session, duplicate bootstrap; clear Admin-editable user-facing errors, never technical IDs |
| 2 | CG-01 US-002–004 (11+14+8 QA) | Correct RBAC role dashboard, permissible menu/action/API/export/direct resource access on Admin Web/Internal Android and public session scope | Unauthorized menu not displayed, API direct deep link forbidden, role downgrade/revoked session, cross-tenant/branch record and protected operation proof rejected |
| 3 | CG-02 US-001/002 (9+16 QA) | Foundation registration, branches/structure, active branch assignment, legitimate authorized structure read and update | Foreign root/branch, disabled scope, invalid location and duplicate assignment; Team profile or legal-data public projection is **not** PASS without consent and actual source |
| 4 | CG-03 US-001–003 (10+10+11 QA) | Draft→submit→different reviewer approval→final action; current password, immutable decision, audit and unchanged original source | Self-review, stale revision, concurrent duplicate/replayed key, changed role/password/branch after submission, rejected/expired case; no side effect before approval |
| 5 | CG-19 US-001 (13 QA) | Real sanitized upload→virus/rights check→version pin→private authorized access and approved public media read | Unscanned/revoked/wrong-root/oversized/malformed file, direct guessed ID, old publication, object version/SHA mismatch and revocation during storage read |
| 6 | CG-09 US-001 (10 QA) | Finance setup, open financial year, chart of accounts and balanced opening journal with branch/root scope | Invalid dates/amounts, duplicate key, cross-branch account, closed year and unbalanced ledger entry |
| 7 | CG-09 US-002 (13 QA) | Create/submit/approve/post real balanced voucher or manual payment with genuine proof and different reviewer | Same reviewer, duplicate/concurrent post, stale source version, invalid account, missing proof, restricted branch, empty/error/toast copy |
| 8 | CG-09 US-003 (11 QA) | Enter real expense claim and receipt, submit and approve independently, post once | False or duplicate bill, revoked scanner document, denied role/branch, wrong amount, failed approval/replay; no phantom payable |
| 9 | CG-09 US-004 (13 QA) | Actual draft→review→issue invoice, real final unit rate, protected original PDF, verified partial receipts; full credit note, independent refund with original negative bank statement, replacement invoice | Cancel issued invoice improperly, collect after credit, duplicate refund, false bank reference, guessed PDF, wrong branch, mismatched bank item, missing document |
| 10 | CG-09 US-005 (12 QA) | Foundation/branch budget, one valid allocation, commitment and approved release | Closed/over-budget/stale branch, duplicate release, unauthorized source, unrelated project/supplier master |
| 11 | CG-09 US-006 (12 QA) | Root and branch ledger/day/cash/bank/trial/receivables; independent signed manual reconciliation and authorized bounded filtered CSV | Foreign branch report, CSV formula injection, mismatched bank statement, stale filters, reversal/credit timing, unauthorized export and exact boundary |
| 12 | CG-18 US-001 (20 QA) | Admin edits Home/About/hero/nav/footer, submits and independently publishes, Web/Android reflect effective original visual/copy/content | Draft invisible, invalid link/filename, wrong-role menu hidden, broken/stale media, withdrawn/expired page, keyboard/mobile/SEO/empty states |
| 13 | CG-18 US-002 (18 QA) | Approved original `/our-impact`, `/ngo-information`, PAN, registration and annual reports with actual verified source and per-year filter | Missing/expired tax proof, absent file link, invalid private PAN, fake metrics, wrong original URL or reversed pub; financial report NOT_PASS until CG-09/20 real safe projection |
| 14 | CG-18 US-003 and CG-19 US-002/003 (20+15+14 QA) | Original `/gallery`, `/videos`, `/publications`, `/notices`, `/contact`; real photo/video/PDF, search/priority/year/reset, private message; browser seek/206 range; Web and Android | Staff-only notice, expired/revoked notice/file, MP4 bad/unsatisfiable multi-range (416), PDF MIME mismatch, invalid map/social URL, unauthorized Contact photo, fake 24/7 chat/newsletter result |
| 15 | CG-18 US-004 (18 QA) | Top-level Healthcare Assistance neutral approved editorial page; original Our Work Healthcare category stays distinct | No invented doctor, appointment, price, service/benefit/claim or old Blood Donation feature; real booking/settlement remains owned by CG-14/15/17 |

**Cross-module receiving gaps are still blockers:** CG-04 genuine member/volunteer/team directory, CG-05 project, CG-07 donation and original donor receipt/certificate, CG-08 CSR/partners, CG-12 supplier source, CG-14/15/17 healthcare booking/settlement, CG-20 public-safe financial/impact exports, CG-19 live newsletter/chat where required. Test only after the real owner functionality is implemented; do not mark an original screenshot card/CTA working from CMS markup alone.

## 3. Original client visual and accessibility QA

Use the client's **47 unchanged public screenshots** and original Admin reference pack. See `docs/research/CAREGANGA-ORIGINAL-PUBLIC-SCREENSHOT-QA-TRACE-20261118.md` and `docs/research/CAREGANGA-ORIGINAL-PUBLIC-NAVIGATION-CONTRACT-20261118.md`. Verify original menu order and child groups, gold/emerald public appearance, blue Admin UI, original copy/media with rights, approved redirects, 1440 px desktop/tablet/narrow mobile, Android native and Web, keyboard/Back/tab/focus/screen-reader/reduced motion, accurate loading/empty/error states and editor version/review workflows. **Do not pass** copied screenshot numerical, statutory or provider claims; source must be current and approved.

## 4. Executable evidence protocol and gate

For **each original case ID** in its owning `tasks.md`, record actual code SHA, fixture/root/branch and role, request/operation, exact expected and observed status, DB assertion, client screenshot/device state and log or file evidence, reviewer and result `PASS`/`FAIL`/`NOT_RUN`. Fix each `FAIL` in its owning code, independently re-review, rerun that original case and adjacent affected negative cases. Evidence of one happy-path run is **not** a full QA result.

No formal `SOURCE_COMPLETE`, `BUILD_VERIFIED`, `QA_PASS` or merge to `main` may be inferred from this document, static preflight, or the existence of a committed source file. The branch must first pass independent source/security/CRITICAL DB review, live Harness approval gate, original current-hash design checks, typecheck/build, disposable ordered migration/restore, real Web/API/Android QA and original visual acceptance. No CI/GitHub Actions.

## 5. Source-review fixes and privacy regression execution

The following are **additional steps inside existing canonical QA IDs**, not another tracker or extra case numbers. Their backend/Web/Internal Android paths were inspected and patched in the existing authorized feature branch. All actual observed results remain **NOT_RUN** until the local developer executes them with disposable roots/branches and real providers.

| Existing owner QA | Positive execution with evidence | Negative/error + source withdrawal and direct-access check |
| --- | --- | --- |
| **CG-01 US-001**, **CG-21 US-002** | Authorized Admin edits the safe `IDENTITY_LOGIN_INVALID` catalog wording (16–220 plain-language chars); Web and native Internal Android display same current generic approved 401 text for a wrong password; default wording works if custom configuration unavailable. Save full API `{status,code,message}`, screenshot, actor/revision and catalog DB row. | Unknown username/mobile, wrong password, disabled/locked/roleless account must not expose existence or distinct user status. Do not echo password/token/contact in logs. Check invalid password/identifier 400 field binding, 429 throttling, concurrent change and stale copy cache refresh; never claim login success. |
| **CG-18 US-001** | Existing approved HOME/About page without Team members still publishes; original Team section heading may remain with honest no-profile state; current original 47-screenshot/Client Admin reference used for section layout and filters when a real CG-04/CG-10 safe source becomes available. | Attempt to submit CMS-authored `TEAM.members` containing name, bio or `consentConfirmed:true`: expected server-side 400 `CMS_TEAM_SOURCE_NOT_READY` with safe editable message/field `members`; editor explains need to remove manual team entries. Previously effective Team page may not emit names, biography or TEAM image/alt in anonymous JSON, Web or native. |
| **CG-19 US-001**, **CG-18 US-001/003** | Public approved non-Team gallery, hero, PDF and MP4 continue to read current SHA/version/rights and 206/416 Range as supported. Record exact source file, revision, rights and response bytes. | Direct guessed or previously shared `/api/public/content/media/<fileRef>` for TEAM placement must 404, even with a previously approved CMS checkbox. Revoke rights, end publication or change version during in-flight media read; private bytes must never be served after authorization fails. Verify both backend direct URL and same-origin Web proxy, cache no-store and no object storage public redirect. |
| **CG-02 US-001/002**, **CG-09 US-001–006** | Protected Foundation admin and assigned branch manager can see/post only current authorized root/branch finance records; real ledger account year/period and posting proofs match DB. | Cross-branch voucher/budget/journal/statement/receipt ID, role downgrade midflight, revoked manager branch, Foundation-wide write by ordinary finance manager, concurrent same request key, unbalanced posting, closed year and reversal must be rejected without information disclosure or partial posting. |
| **CG-18 US-001–004**, **CG-19 US-002/003** | Compare original screenshot layout and usable routes for Team Directory, impact, 80G/PAN/Registration/annual/financial reports, Media, Contact, policies, Healthcare; source owner data only, client-verified typography/assets. Test desktop, narrow Web, Internal/Public Android where applicable, Back/filter/reset/empty state and role-hidden control. | No public unverified legal identifier, fake benefit/doctor, invented report/partner/member, disabled CTA that appears active, or inaccessible mobile menu. If owner CG-04/05/07/08/10/14/15/17/20 has not delivered a real approved source, mark matching visual/data journey **BLOCKED_BY_OWNER** (not PASS). |

**Failure handling:** implement in the same original owner path; run source review → fix → separate re-review → rerun the affected original case and adjacent negative/error scenarios. Capture original commit SHA, full status, SQL assertion, root/branch, role, screenshot/device, original reference ID, reviewer and executed result. Do not conflate a static 12/12 source predicate read-back with passing 296 manual QA or independent qualified PostgreSQL/clinical certification. Keep runtime, restore and pixel comparison **NOT_RUN** unless evidence has actually been produced.
