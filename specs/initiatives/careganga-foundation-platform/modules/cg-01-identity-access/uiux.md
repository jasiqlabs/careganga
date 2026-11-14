# CG-01 — UI/UX: Accounts, Roles & Access

**Applies to:** Foundation Admin Web, authorized Internal Android, authentication for Public Web/Android and Center Portal.  
**Source:** [module.md](module.md) · [PRD](../../prd.md) FR-001–003/080 · [HLD](../../hld.md) · [CG-01 DLD](dld.md)  
**Design state:** Rebuilt for source review; rendered Web/native QA NOT_RUN.

## 1. Experience principles

Clean, modern and task-first. An authorized administrator understands **who has access, what they can do, and where the access applies** without knowing database IDs or technical permission codes. Avoid a crowded all-in-one settings page.

- Foundation Admin navigation: **People & Access → Accounts** and **People & Access → Roles & Permissions**; **Access History** is a restricted supporting view.
- Show Foundation-root as the only current verified operating context. **Do not show disabled/fake branches, employee categories, centers, or doctor pickers** until their real owning modules deliver records and scoped option APIs.
- Permissions always come from the backend; hiding navigation is helpful UX, never the security boundary.
- One shared language catalog and API outcomes for Web and Android; desktop's grid becomes grouped task screens on Android. Include readable focus, accessibility labels, touch targets and adaptive layouts.

## 2. Screen contract

| Screen | Main content and actions | Empty/denied/changed state |
| --- | --- | --- |
| Sign in & recover | Contact/identity, secure credential, sign in, recover, verify; contextual help | Neutral invalid-account/error wording, no enumeration, session expiry clears protected screen |
| Accounts | Name/contact, account status, assigned roles, filter by **real** CG-01 status/role, search, invite, suspend/reactivate, open details | No results vs unavailable; no user found never reveals protected accounts |
| Account detail / access | Display name, verified contact, account state, role(s), Foundation-root context, effective permissions summary and change history; assign/change/revoke allowed roles | Revoked state updates promptly; role cannot be chosen automatically |
| Roles & Permissions | Role name/description/optional color; active/protected status; assigned account count; create/edit/copy/retire | Protected role actions hidden or disabled with explanation; empty permitted grant set is valid |
| Role editor | Grouped **View / Create / Edit / Delete (where permitted) / Approve / Export / Publish / Sensitive** controls for currently available business actions; count enabled grants and review changes before saving | Clear errors for duplicate name, removed capability, stale revision; no confusing raw codes |
| Access History | Actor, affected account/role, changed permissions/access, timestamp and searchable relevant context | Only authorized history; no secret, opaque ID or raw system exception shown |

**Role copy:** opens a fresh editable role with copied **assignable** permissions only; does not copy people, scope, or protected Super Admin privileges. Saving requires a new unique name. Grant changes/revocation affect the shared backend immediately and old clients must refresh/exit restricted content.

**Account invite:** authorized administrator enters real full name, contact and permitted role, verifies intended Foundation-root scope, and confirms invitation. Pending provider delivery is labelled **Pending**, never “Invitation sent” unless confirmed.

## 3. Layout by channel

**Foundation Web (desktop/tablet/phone):** compact list with search/filter above it; mobile widths use stacked account cards or horizontally controlled lists, never clipped role controls. Role editor uses accordion groups and a sticky/save action only if it does not hide content; show permission count and change confirmation. Support keyboard navigation and readable zoom.

**Internal Android:** secure native login plus **Accounts → Search → Account → Assign role** and **Roles → Create/Edit/Copy → Permission groups → Review/Save**. No WebView substitute. Searchable single-select roles with context labels; permission groups use generous touch controls and progress/save feedback. Android Back warns about unsaved changes; keyboard/insets/large text and rotation preserve valid draft values without leaking cached previous-account data.

**Public Web/Android:** visitors can browse genuinely public information without staff login; show only verified self-service auth where a real domain journey is present. No role editor or private account directory.

**Healthcare Center Portal:** secure sign-in but no functional center switch/center staff directory before CG-14 exposes real authorized centers. Never silently choose an arbitrary first center.

## 4. Exact feedback expectations

| Situation | User-visible example | Actual action |
| --- | --- | --- |
| New role saved | “Role created.” | Wait for confirmed backend commit and refresh catalog |
| Duplicate role | “That role name is already in use.” | Retain safe draft, focus role name |
| Permission revoked | “Your access has changed. Sign in again to continue.” | Clear restricted caches/session and re-evaluate permissions |
| Missing authorization | “You don't have permission to do this.” | Never call forbidden background list/selector or expose data |
| Invitation awaiting provider | “Account created. Invitation delivery is pending.” | Record actual account state and safe retry, no fake sent state |
| Network/unknown write result | “We couldn't confirm that change. Check its current status before trying again.” | Refresh authoritative record before another mutation |
| Empty account list | “No accounts match these filters.” | Only after successful filtered response; not on HTTP/API failure |
| Failed server call | “Something went wrong. Try again or contact support.” | Show safe support reference if available, restrict details to operator logs |

Never display a UUID, SQL/HTTP error, permission key, internal stack, raw error.message, fake employee/branch/center, or financial/clinical data solely for a picker. Show valid business references only where required.

## 5. Accessibility, privacy and interaction checklist

- Label every field, search, group and toggle; accessible error summaries, semantic status announcement and stable focus; readable contrast and 360px Web adaptation.
- Display only current actor's permitted actions. A stale screen or deep link must receive a secure denial and remove cached sensitive content.
- Root Super Admin cannot accidentally be cloned, retired or reassigned from ordinary controls. Require explicit confirmation for access removal and irreversible actions.
- Safe name/context dropdowns are searchable and show empty/disabled/loading states distinctly; never default to the first privileged role.
- Missing employee, geography or center integrations do **not** appear as broken CG-01 screens; their actual UI experiences belong to CG-10, CG-02 or CG-14 design and QA when introduced.

**Review gate:** Review intended flows against each case in [tasks.md](tasks.md), then the latest revision. Web/browser/device rendering remains VISUAL_NOT_RUN; implementation source and live QA remain NOT_RUN.