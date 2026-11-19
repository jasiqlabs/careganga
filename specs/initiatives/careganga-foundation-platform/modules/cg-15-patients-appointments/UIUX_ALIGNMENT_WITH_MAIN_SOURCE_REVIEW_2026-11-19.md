# CareGanga CG-14/CG-15 — UX alignment with the latest `main` design

**Branch:** `feature/careganga-cg14-healthcare-network-dev-20261118`  
**Baseline:** `main` at `4e7c1c9bcb9b8e6e94c2f03bada52445041090d6`  
**Review type:** Web + Public Android + Internal Android **source review**; not device, browser, pixel-diff, accessibility audit, or executed regression QA.  
**Scope:** Presentational and navigation alignment for existing healthcare journeys. No new healthcare business use cases, permissions, API contracts, database migrations, or user story completion claims.

## Source findings and resolutions

| Observed source mismatch | Resolution on the existing feature branch | Verification still needed |
| --- | --- | --- |
| Admin H07 Doctor Schedules bypassed the premium `main` sidebar/topbar, while H15 and some older healthcare routes already used it | Reused the actual `FoundationAdminNav` through an authorized `HealthcareAdminShell`; added a role-filtered Doctor Schedules link, preserved the latest dashboard, sidebar resizing, menu search, responsive drawer and identity header | Desktop/mobile viewport browser review, keyboard navigation, sign-out, permission refresh |
| CG-14 Content Reviews, ERP Permission Reviews, Doctor Leave Reviews, and the center portal had legacy standalone headers | All now use the premium authorized admin shell. The existing center-edit permission controls the new **My Healthcare Center** link. Existing route-level permission checks and original action components remain authoritative | Real limited-role accounts, protected API failures and session expiration |
| H07/H15 content did not visually follow the new `main` admin UI: unstyled generic forms, very plain appointment list, mismatched KPI tiles | Added scoped healthcare styles for panel surfaces, navy headings, blue accents, six live KPI tiles, responsive filters, selected record list, and existing tab/weekly schedule/print layouts. No fake numbers or seeded provider/patient records | Compare supplied client H07/H15 screenshots against live Web, 1440/1280/768/390 widths, print/privacy checks |
| CG-14/CG-15 public directory, doctor, center, private patient, appointment detail and QR verification routes did not reuse `main`'s current CMS site chrome | Reused existing `CmsSiteHeader` and `SiteFooter` through `HealthcarePublicChrome`. Only published CMS navigation and footer content are used; public theme remains distinct from the admin blue UI | Browser responsive screenshots, published/unpublished CMS behavior, public-page performance |
| Healthcare native screens looked denser and more utilitarian than current mobile login and shared design tokens | Aligned the existing internal queue, assisted booking, doctor leave, provider reviews, public directory, private patient profile, and public healthcare entry cards with existing `careGangaTheme`: consistent spacing, larger section hierarchy, responsive tablet content widths, card radii and 48px minimum action targets | Build Expo native bundles, Android emulator/device QA, Back handling, keyboard overlap, screen reader/touch testing |

## Preserved controls and boundaries

- CG-14 and CG-15 ownership, current verified doctor/center data, existing appointment actions and consent gates remain unchanged.
- RBAC remains server-authoritative. The sidebar is an affordance only, and every protected route still verifies account and permissions; it does not unlock new APIs.
- H07 scheduling, weekly times, leave review, operational queue, assisted booking and H15 original history/report print restrictions are not rewritten.
- Public navigation/footer are derived from published CG-18/CG-19 CMS sources, not invented URLs, contact values or fake campaigns.
- Existing `main` admin authentication presentation, dashboard and global CSS remain intact. Healthcare CSS is locally scoped; native apps retain shared design tokens.

## Independent source-review checklist

- [x] Confirm `main` source remains an ancestor of feature branch after synchronization
- [x] Inspect latest `main` premium admin navbar/dashboard/auth and public website design language
- [x] Identify four unwrapped healthcare admin review/schedule routes and the center portal
- [x] Add actual permission-bound healthcare routes to the existing admin navigation
- [x] Scope admin/public healthcare CSS without changing the original site styles
- [x] Reuse published-CMS header/footer for the existing public healthcare routes
- [x] Align native screen typography, card geometry, spacing and touch targets without changing actions
- [ ] Run Web production build and local browser screenshot comparison
- [ ] Run Android Public/Internal builds and check actual native device screenshots
- [ ] Execute regression QA on login, appointment creation, H07, H15, patient permissions, native Back and consent flows
- [ ] Independently test browser print restrictions and private document links after styling changes
- [ ] Compare against original separate healthcare screenshots with the images actually open; pixel/motion parity **not verified**

**Gate:** Source/UI structural alignment is prepared, but real render/design QA, local builds and functional tests remain **NOT_RUN**. The current CG-15 tracker statuses must not be upgraded based on a visual source review. No `main` merge or production approval is implied.
