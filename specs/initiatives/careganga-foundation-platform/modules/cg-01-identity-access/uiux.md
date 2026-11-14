# CG-01 — Identity and Access UI/UX design (conditional REQUIRED)
**Source:** approved PRD FR-001–003/080, CG-01-BR01–10, module.md, platform HLD §4.1/§4.3, CG-NFR-UX01–08/UI09–12/MSG01–06/LOG01–06.  
**Status:** SOURCE_DESIGN_DRAFT · manual source review only · screen/device preview VISUAL_NOT_RUN.  
**Applicable experiences:** Foundation Admin Web, Healthcare Center Portal, Public Website, Public Android, Internal Android. One business backend, context-dependent navigation.

## 1. Visual direction and information design
**Experience:** Calm, professional and trustworthy Foundation operations, with a well-spaced but information-efficient admin workspace. Public pages are welcoming and task-first. Healthcare center login/navigation prioritizes current center, reception and patient confidentiality. Android is native-feeling, not a compressed admin website.

**Consistent visual system (final brand values remain product-identity input):**
- Restrained neutral surfaces, one approved brand accent; semantic green/amber/red only for status or action meaning. Sufficient contrast, focus and disabled differences; do not invent brand logo or colors from a third-party screenshot.
- Typography: readable page heading, section title, labeled form field, secondary helper/status hierarchy; aligned field widths and table columns; no microscopic gray caption substitutes for real labels.
- Spacing: consistent compact-to-comfortable 4/8-point rhythm, intentional grouping and only necessary panels. Role matrix uses table/accordion sections rather than nested decorative cards.
- Controls: existing maintained accessible semantic components where possible; one primary CTA per state, subordinate secondary/stop actions, clear destructive confirmation and keyboard focus return; no unnecessary animations or libraries.
- Information: start from user task, not module code. Names, roles, centers/branches and readable dates appear in UI; invisible backend IDs never appear as visible selector labels/required inputs. Only real business references such as Employee ID or Support reference when appropriate.

## 2. Role-sensitive navigation
| Channel | First-level task and navigation | Explicitly hidden/unavailable |
| --- | --- | --- |
| Foundation Admin | “People & Access” → Staff Directory, Roles & Permissions, Access Assignments, permitted audit. Common selected Foundation scope is visible and changeable only among authorized options. | Unrelated payroll/clinical settings; raw permission tokens; unapproved approvals |
| Center Portal | Own center name and location clearly visible; own permitted staff/access actions if assigned. Reception/doctor flows provided by owner modules later, not duplicated here. | Other centers, patient record cross-search, unrestricted Foundation account editor |
| Public Website | Simple “Sign in” or “Continue” on applicable donation/membership/booking journeys; public browsing without forced internal account. | Internal staff role selector or admin dashboard |
| Public Android | Compact verified access/profile with relevant public tasks, straightforward back navigation, no internal-role nav. | Foundation-wide employee listing |
| Internal Android | **When the actor has role-management authority:** People & Access → Roles → New/Edit/Copy Role → grouped permission toggles; Staff → Select role and permitted location by name → Save. Same backend truth as Web, compact screens/accordion groups and Android Back/keyboard behavior. All other actors get task shortcuts/current scope only. | Giant desktop matrix forced onto phone; unrestricted cross-branch/center grants; internal menus for public accounts |

**Copy rule:** “Role,” “Permissions,” “Team member,” “Assigned location,” “Access level,” “Active,” “Suspended,” not `roleId`, `resource_key`, `scopeType`, `can_read`, internal UUID or HTTP 403. For two users with identical names, show permitted department/designation/contact summary, not database keys.

## 3. Primary screens and user tasks
### A. Staff Directory (Foundation Admin Web)
- Header: **People & Access**; one plain-language summary; primary authorized **Add staff member**.
- Compact visible filters: Name/phone/email search (privacy limited), Role, Status, Assigned Foundation area/branch, Department; advanced filters collapse until needed. Show actual counts from scoped backend, not hardcoded summary cards.
- Table/list shows name, approved employee business ID where issued, role, branch/location, status, last meaningful access/assignment if permitted. Row menu: View, Edit permitted fields, Reset access, Suspend/Reactivate subject to confirmation. For compact Web width, show accessible stacked rows with role and status; do not squeeze a 10-column table.
- New staff form: Name, authorized role, verified phone/email, permitted scope selection by **name**, optionally link existing CG-10 employee via secure search. Real user relationship not inferred by phone. Account setup via expiring invitation/verification.
- Empty states: “No team members match these filters” with clear/reset filter. API error: “We couldn't load team members. Try again.” Never pretend failed request is an empty list.

### B. Roles & Permissions
- Role directory: protected built-in role separately distinguished; user-created roles with readable name, description, active status, assigned staff count and actions. **Role creation, permission editing, copying and deletion (when safe) are actual UI tasks**, not merely backend setup. “Create role” opens focused form with optional **Start without permissions** or **Copy permissions from...** (copies grants, never people). Same workflow is offered to authorized Internal Android operators in a native layout.
- Permission editor: named sections by real business capability (e.g. Staff, Membership, Projects, Finance, Healthcare). Each section has grouped **View, Add, Edit, Approve, Export, Publish, Manage** actions only when the capability supports them. Show applied count, accessible checkbox state, and a plain-language explanatory description for sensitive grants. Avoid hundreds of default toggles visible at once; expand only needed sections, search capabilities.
- Dangerous changes (approve payout, access protected health, manage roles) explain the effect before submission; owner/last-protected-root changes require server rejection or controlled confirmation. No save if there are unapproved invalid privileges; after save show “Role updated” only after authoritative commit.
- Scope assignment panel: search permitted Foundation geographic/branch or center name based on actual owner records, with clearly shown “Applies to” and current scope. **A user must be able to assign and later change a role and scoped locations in Web and authorized Internal Android**, without entering raw IDs or being forced to grant unrelated list/finance permissions. Do not conflate Foundation branch with healthcare center.
- Assignment history shows actor, human user/role/scope, time and result; never backend enum keys or raw audit identifiers.

### C. Android role editor and staff assignment — mandatory parity for authorized Internal Android actors
- **Roles:** Role list with readable name, protected role status, assignment count; “New role,” “Edit permissions,” “Copy role” and protected deletion only where permitted. Group related activities using accessible expandable rows and concise explanations. Saving uses the **same backend role-and-grants API and invariant checks** as the Web editor.
- **Assign people:** Staff search → select human name and role → select permissible Foundation area/branch or assigned healthcare location by readable name → confirm and save. The backend uses immutable internal IDs invisibly; scope options depend on the actual authorized parent owner and role. Never default an elevated role just because it appears first.
- **Scope and revocation:** No role-management navigation without active effective grants. If another admin removes access while a screen is open, disable mutation and show a safe “Your access has changed” state; clear stale permission/people/location query caches when user, branch, center, role or session changes.
- **Parity, not pixel copy:** The Android app supports creating/editing/copying roles and assigning staff+authorized locations, but breaks complex Web grids into focused step-by-step screens with grouped toggles, proper touch targets, native Back, accessible confirmation and preserved non-sensitive draft state. Public Android never exposes internal role creation.
- **Required supporting options:** An authorized selection of doctor, branch, staff, beneficiary or payment account (in the owning workflows) must have a purpose-limited options endpoint returning only name and safe context; no unrelated financial amounts, clinical notes, contact secrets or restricted list query. Picker failure shows retry, not false “no records”.

### D. Account invitation and recovery
- Staff creation never shares a plaintext initial password in UI, notification or logs. “Invite sent” only after the authoritative invitation state is accepted; secondary delivery failure is shown as “Account created; invitation delivery is pending” with safe retry.
- Sign-in/verification screen uses clear identity field based on configured account policy, appropriate input keyboard, resend cooldown, password/OTP recovery as actually supported, and neutral account-enumeration-safe responses. On expiration, show “Your session has expired. Please sign in again,” preserve non-sensitive draft work if safe.
- Public applications reuse the approved account flow without showing internal roles or revealing whether a protected account exists.

## 4. States and user-facing message examples
| State | User-visible result and action | Backend/source truth |
| --- | --- | --- |
| Saved | “Role updated.” / “Access changed.” | Confirmed transaction and audit |
| Submitted/review required | “Access change submitted for approval.” | Still pending, **not effective access** |
| Validation | “Enter a role name.” / “Select an assigned location.” | Invalid field keys mapped to human labels |
| Duplicate | “A role with that name already exists here.” | Scoped uniqueness, no duplicate row |
| Forbidden | “You don't have access to make this change.” | No write and no protected record details |
| Stale/revoked | “Your access has changed. Refresh or sign in again.” | Session/grant invalidation, no stale privilege |
| No results | “No matching team members.” | Confirmed authorized zero results |
| Network/server | “We couldn't save the changes. Please try again.” | Failed/unknown state distinguished by status fetch |
| Uncertain write | “We're checking whether the change was saved. Refresh the role before trying again.” | Prevent second protected write |
| Delivery pending | “Access saved. Invitation delivery is pending.” | Account commit separate from notification |
| Unexpected incident | “Something went wrong. Contact support if it continues.” optional **Support reference** | Restricted correlation trace and sanitized exception, not raw server message |

## 5. Layout/adaptation and accessibility acceptance
- Foundation/Center Web: readable workspace at narrow 360px, mid-width tablet 768–1024px and desktop 1280px+; side nav collapses on compact width, form controls remain reachable, role matrix scrolls within an understandable section without hidden destructive CTA, sticky actions never cover keyboard. No technical-ID columns. **Full role creation/editing/assignment is supported in responsive Web** for properly authorized actors.
- Android: compact phone, larger screen and tablet layout as applicable; content respects system bars/insets, Android Back, focus/keyboard and offline state. Touch controls generally ≥48dp; dynamic type/accessibility labels for every action; do not design hover-only interactions. **Authorized Internal Android users can create/edit/copy roles, toggle applicable grants and assign staff scope; complex matrix content is broken into mobile-appropriate sections.**
- Keyboard/web: tab/focus logical, escape/back dismisses dialog without losing unsaved content silently, accessible error association and live region for result message, WCAG 2.2 AA target where applicable.
- Every meaningful flow is specified for loading, empty, unauthorized, conflict, pending review, unknown write, success and external delivery failure—not a universal success toast.
- Main acceptance is **source-reviewable UI logic and design intent**. Actual rendered polish is **VISUAL_NOT_RUN** until separately authorized QA/Release; no screenshots or browser/emulator were generated.

## 6. Ownership and design decisions
- HLD remains authoritative for security, ownership, branch vs center and five channels. Module DLD owns typed contracts and session semantics. UIUX does not invent an iOS app, patient clinical access, provider search or mandatory mobile role editor.
- Theme and product identity are deliberately not invented. Product-approved typography/colors and official artwork remain an implementation/design input; choosing sensible reusable tokens during implementation must not change business scope.
- A single semantic component family may be shared where appropriate, but web/admin density and native mobile navigation differ. Do not force a generic high-card dashboard onto every workflow.
- **Review:** compared source FR-001–003, FR-080 and BR/UX/NFRs; no actionable design omissions identified at the source level. This is disclosed self-review; local stage resolver and rendered quality are NOT_RUN.
