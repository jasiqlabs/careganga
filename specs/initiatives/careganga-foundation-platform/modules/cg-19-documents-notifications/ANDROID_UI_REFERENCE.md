# CG-19 — Internal Android visual reference only

**Status:** Retained reference; not approved implementation.  
**Reference:** Nakul Kumar's Android redesign at immutable commit [`21fbca6`](https://github.com/jasiqlabs/careganga/commit/21fbca67ef1def04f1770a9fec80bd1cc4c3f348).  
**Functional baseline:** merged `main` at `b87cd66` and subsequent reviewed changes.  
**Scope:** Internal Android only. The existing Web UI remains unchanged.

## Screen-by-screen visual reference

| Existing screen | Visual reference to retain | Source |
|---|---|---|
| Support | Header, two-column KPI cards with readable labels, search/filter bar, status pills, ticket list, detail modal, audit timeline and resolution layout | [Design source](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/support/foundation-support-screen.tsx#L281) · [Styles](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/support/foundation-support-screen.tsx#L621) |
| Recipient notifications | Header, readable cards, responsive two-column layout, horizontal tabs and inbox list presentation | [Design source](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/communications/notifications-screen.tsx#L423) · [Styles](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/communications/notifications-screen.tsx#L1503) |
| Authorized notice administration | History/composer presentation, cards, actions, delivery summary and review/template modal styling | [Design source](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/communications/foundation-notice-admin-screen.tsx#L266) · [Styles](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/communications/foundation-notice-admin-screen.tsx#L691) |
| Private evidence | Navigation/header, evidence tab and upload card presentation | [Design source](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/documents/private-case-evidence-screen.tsx#L375) · [Styles](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/documents/private-case-evidence-screen.tsx#L673) |
| Private letters | A4-inspired preview presentation, issued history cards and review modal styling | [Design source](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/documents/native-private-letter-panel.tsx#L270) · [Styles](https://github.com/jasiqlabs/careganga/blob/21fbca67ef1def04f1770a9fec80bd1cc4c3f348/apps/android-internal/src/features/documents/native-private-letter-panel.tsx#L594) |

## Mandatory boundary for future Android implementation

- Treat the historical source as a visual/layout reference only. Do not cherry-pick the screen rewrites or copy their API logic, data, credential examples, permission checks or security-sensitive handlers.
- Keep the latest working Android source as the functional authority: existing routes and payloads, independent recipient/admin permissions, contact consent and verification, request idempotency, status/revision checks, upload SHA-256 and backend scan verification, and authorized PDF download/revocation.
- Use only meaningful, real API-backed data. Do not add administrative actions to recipient screens or present unverified previews as issued documents. No fabricated statistics or nonfunctional controls.
- Preserve existing icon/dropdown components where suitable. Reapply visual hierarchy, spacing, typography, cards and responsive layout without changing the public Web or Android public application.
- Verify role-based visibility and functional parity, device rendering, no truncation/overflow, loading/empty/error states and accessibility before acceptance. Run existing CG19 source checks, Android build and real device/API QA. Record actual evidence against existing canonical QA IDs.

This record links to immutable historical source; it does not reproduce historical credentials or claim screenshot/device validation. No Android runtime code changes are authorized by this reference-only checkpoint.
