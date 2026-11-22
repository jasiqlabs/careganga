# CG-10 original client Admin visual parity review

Authority: [CG-REF-ADMIN-001](../research/CAREGANGA-ADMIN-PANEL-SCREENSHOT-UIUX-AUDIT.md), B20–B51, [CG-10 UI/UX](../../specs/initiatives/careganga-foundation-platform/modules/cg-10-human-resources/uiux.md). Audited 167 screenshot inventory; original PNG ZIP is not accessible in this session (audit explicitly says binary screenshots were not committed). No rendered replacement images available. **SOURCE_REVIEW_ONLY; visual approval NOT_RUN.**

## Confirmed corrections
- Web: ten HR components use exact established CG-01 CSS accent/text/muted/border tokens (32f8cb6).
- Internal Android: ten HR views use shared careGangaTheme tokens (81ecaaa). No fabricated status colors or access changes.
- B20: dedicated HR dashboard (67546b8), scope-filtered real headcount, onboarding/exit/approved and pending leave metrics as permitted, status distribution and real workflow shortcuts; admin landing page.
- B27–28: distinct Personal information, Employment details and Account and role proposal sections; protected evidence step after confirmed draft on both clients; narrow Web viewport grid; stage guidance is not a fabricated independent approval sequence.

## Original screen evidence versus remaining acceptance
| Reference | Source findings and remaining visual check |
| --- | --- |
| B20 | KPIs and status distribution implemented. Department distribution, trend graphs, recent leave records and precise toolbar/shortcut layout still require source verification and matching; do not fabricate counts. |
| B21/24/25 | Leave and policy workflows present; original overview/balance/distribution/upcoming panels, status tabs, list/drawer placement and responsive layouts require visual comparison. |
| B22/23 | Attendance matrix and settings present; calendar/matrix density, colors, correction panel placement and mobile interaction must be checked with actual rendered data. |
| B26 | Web and Android management present; verify KPI/table/slider/panel placement; native uses numeric inputs/step actions instead of original desktop sliders. Do not assume scoring weights. |
| B27/28 | Grouped registration, private details/evidence, approval and activation. Original audit also shows parents' names, DOB, gender, blood group, email, geographic/address fields, proposed salary and extended bank fields; current private details DTO is narrower. Review exact approved BR/DLD and ownership before claiming all these fields are available. |
| B29 | Original CG03 workflow reviewer; compare actual configured stages and history, private document previews, action layout. No fake six-stage pipeline. |
| B30/31 | Actual employee directory/scope filters and pagination; geographic/role filter and table layout parity require confirmation. |
| B32/33 | ID lifecycle and private card PDF previews; original integrated front/back preview, list/detail layout and field visibility must be compared. |
| B34 | CG01 role assignment owner; do not duplicate editor. |
| B35–40 | Letter/memo lifecycle, approved signature/seal and received copy action present. Original WYSIWYG/full A4 live preview and memo drawer/register layout remain different; safe heading/bullet text editor is not full rich text. |
| B41/42 | Shared CG19 staff card; original member/volunteer options depend on CG04. Exact card layout/preview and field visibility controls require comparison. |
| B43 | CG11 payroll setup owner; no fake payroll. |
| B44/45 | Employment change flow present; compare original stepper/current-versus-proposed layout and order list; only actual approval states. |
| B46–48 | Exit workflow source present; original drawer/clearance detail/history and action placement need actual comparison. |
| B49–51 | Original CG09 claim-integrated allowance UI; verify KPI/filter/status tabs, request drawer and breakdown/bill journey with rendered source statuses. B49 filename is not the visible screen title. |

## Final gate
Restore original B20–B51 PNGs from the client ZIP in the local IDE (private reference only). Capture the replacement screens in permitted test roles and seeded non-production data. Compare desktop, tablet, narrow Web and Internal Android, including empty/loading/error/denied states. Compare layout/typography/color/spacing/card/toolbar/table/drawer/control placement as well as action journeys. Native adapts desktop layout to touchscreen rather than rendering a desktop WebView. Any visual differences must be fixed and recaptured; do not claim pixel-perfect or exact animation parity until supported. Keep the original 100 QA IDs and existing canonical progress rows. This report is evidence/acceptance notes, not a new execution tracker.
