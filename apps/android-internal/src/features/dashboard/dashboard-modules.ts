import type { CG01SessionView } from "@careganga/api-contracts";

export type ModuleCategory =
  | "DASHBOARD"
  | "USER & ACCESS MANAGEMENT"
  | "ORGANIZATION MANAGEMENT"
  | "HEALTHCARE ASSISTANCE"
  | "FINANCE & ACCOUNTING"
  | "PLATFORM & COMMUNICATIONS";

export interface DashboardModuleItem {
  key: string;
  title: string;
  shortLabel: string;
  description: string;
  category: ModuleCategory;
  iconName:
    | "user"
    | "home"
    | "users"
    | "shield"
    | "lock"
    | "approvals"
    | "documents"
    | "notifications"
    | "mail"
    | "send"
    | "support"
    | "coins"
    | "receipt"
    | "file-text"
    | "wallet"
    | "sliders"
    | "bar-chart"
    | "building"
    | "key";
  iconBg: string;
  iconColor: string;
  onOpen: () => void;
}

export interface BottomNavTabItem {
  id: string;
  label: string;
  iconName: "home" | "user" | "users" | "approvals" | "coins" | "building" | "receipt" | "notifications" | "support" | "shield" | "more";
  badge?: number;
  onPress: () => void;
}

export interface ModuleActionHandlers {
  openDashboard: () => void;
  openAccount: () => void;
  openAccounts: () => void;
  openRoles: () => void;
  openPolicy: () => void;
  openApprovals: () => void;
  openPatientQueue: () => void;
  openPatientBooking: () => void;
  openDoctorLeaveReviews: () => void;
  openHealthReviews: () => void;
  openDocuments: () => void;
  openNotifications: () => void;
  openCommunications: () => void;
  openNoticeAdmin: () => void;
  openSupport: () => void;
  openFinanceReview: () => void;
  openVoucherOnly: () => void;
  openFinanceClaimReviews: () => void;
  openFinanceClaims: () => void;
  openInvoice: () => void;
  openInvoiceReview: () => void;
  openBudget: () => void;
  openBudgetReview: () => void;
  openReports: () => void;
  openFinance: () => void;
  openBranches: () => void;
  openChangePassword: () => void;
}

/**
 * Resolves the authorized modules for the current session based strictly on effective role permissions.
 * Aligned with Web Foundation navigation structure, naming, grouping, and RBAC rules.
 * Never displays unauthorized modules.
 */
export function getAuthorizedModules(
  roleActions: string[],
  actor: CG01SessionView | null,
  handlers: ModuleActionHandlers
): DashboardModuleItem[] {
  if (!actor) return [];

  const list: DashboardModuleItem[] = [];

  // ----------------------------------------------------
  // SECTION 1: DASHBOARD
  // ----------------------------------------------------

  // 1. Dashboard (Always authorized for authenticated staff)
  list.push({
    key: "dashboard",
    title: "Dashboard",
    shortLabel: "Dashboard",
    description: "Foundation management command center and operational overview.",
    category: "DASHBOARD",
    iconName: "home",
    iconBg: "#E0F2FE",
    iconColor: "#0284C7",
    onOpen: handlers.openDashboard
  });

  // 2. My account (Always authorized for authenticated staff)
  list.push({
    key: "account",
    title: "My account",
    shortLabel: "My account",
    description: "Admin user profile, credentials, security scope and active session.",
    category: "DASHBOARD",
    iconName: "user",
    iconBg: "#F1F5F9",
    iconColor: "#475569",
    onOpen: handlers.openAccount
  });

  // ----------------------------------------------------
  // SECTION 2: USER & ACCESS MANAGEMENT
  // ----------------------------------------------------

  // 3. Users Management
  if (
    roleActions.includes("accounts.view") ||
    (roleActions.includes("accounts.create") && roleActions.includes("roles.assign"))
  ) {
    list.push({
      key: "accounts",
      title: "Users Management",
      shortLabel: "Users",
      description: "Manage Foundation staff accounts, assignments and status.",
      category: "USER & ACCESS MANAGEMENT",
      iconName: "users",
      iconBg: "#E0F2FE",
      iconColor: "#0284C7",
      onOpen: handlers.openAccounts
    });
  }

  // 4. Roles & permissions
  if (roleActions.includes("roles.view")) {
    list.push({
      key: "roles",
      title: "Roles & permissions",
      shortLabel: "Roles",
      description: "Inspect system roles, permission matrices and action mappings.",
      category: "USER & ACCESS MANAGEMENT",
      iconName: "shield",
      iconBg: "#F3E8FF",
      iconColor: "#7C3AED",
      onOpen: handlers.openRoles
    });
  }

  // 5. Registration & Approval
  if (roleActions.includes("approvals.view") || roleActions.includes("approvals.propose")) {
    list.push({
      key: "approvals",
      title: "Registration & Approval",
      shortLabel: "Approvals",
      description: "Review pending organizational proposals and status submissions.",
      category: "USER & ACCESS MANAGEMENT",
      iconName: "approvals",
      iconBg: "#FFEDD5",
      iconColor: "#EA580C",
      onOpen: handlers.openApprovals
    });
  }

  // 6. Security Policy
  if (roleActions.includes("identity.security-policy.manage")) {
    list.push({
      key: "policy",
      title: "Security Policy",
      shortLabel: "Security",
      description: "Inspect and update foundation security and session policies.",
      category: "USER & ACCESS MANAGEMENT",
      iconName: "lock",
      iconBg: "#FEE2E2",
      iconColor: "#DC2626",
      onOpen: handlers.openPolicy
    });
  }

  // ----------------------------------------------------
  // SECTION 3: ORGANIZATION MANAGEMENT
  // ----------------------------------------------------

  // 7. Branches & registration
  if (roleActions.includes("foundation.branches.view")) {
    list.push({
      key: "branches",
      title: "Branches & registration",
      shortLabel: "Branches",
      description: "Manage foundation physical offices, centers and facilities.",
      category: "ORGANIZATION MANAGEMENT",
      iconName: "building",
      iconBg: "#FEF3C7",
      iconColor: "#D97706",
      onOpen: handlers.openBranches
    });
  }

  // ----------------------------------------------------
  if (roleActions.includes("health.visits.manage")) {
    list.push({
      key: "healthVisitQueue",
      title: "My Consultation Queue",
      shortLabel: "Consultations",
      description: "Manage authorized visits and check-in for assigned healthcare centers.",
      category: "HEALTHCARE ASSISTANCE",
      iconName: "receipt",
      iconBg: "#E0F2FE",
      iconColor: "#0284C7",
      onOpen: handlers.openPatientQueue
    });
  }

  if (roleActions.includes("health.patients.intake")) {
    list.push({
      key: "healthPatientBooking",
      title: "Book for a Verified Patient",
      shortLabel: "Patient Booking",
      description: "Book an existing center consultation with patient authorization.",
      category: "HEALTHCARE ASSISTANCE",
      iconName: "user",
      iconBg: "#DCFCE7",
      iconColor: "#15803D",
      onOpen: handlers.openPatientBooking
    });
  }

  if (roleActions.includes("approvals.review") && roleActions.includes("health.schedules.view")) {
    list.push({
      key: "healthDoctorLeave",
      title: "Doctor Leave Reviews",
      shortLabel: "Doctor Leave",
      description: "Review approved doctor schedule exceptions and leave requests.",
      category: "HEALTHCARE ASSISTANCE",
      iconName: "approvals",
      iconBg: "#FFEDD5",
      iconColor: "#C2410C",
      onOpen: handlers.openDoctorLeaveReviews
    });
  }

  if (roleActions.includes("approvals.review") && (roleActions.includes("health.doctors.verify") || roleActions.includes("health.providers.verify"))) {
    list.push({
      key: "healthReviews",
      title: "Healthcare Verification Reviews",
      shortLabel: "Verification",
      description: "Review verified provider and doctor applications.",
      category: "HEALTHCARE ASSISTANCE",
      iconName: "shield",
      iconBg: "#F3E8FF",
      iconColor: "#7C3AED",
      onOpen: handlers.openHealthReviews
    });
  }

  // SECTION 5: FINANCE & ACCOUNTING
  // ----------------------------------------------------

  // 8. Accounts
  if (roleActions.includes("finance.accounts.view")) {
    list.push({
      key: "finance",
      title: "Accounts",
      shortLabel: "Accounts",
      description: "Manage general ledger chart of accounts and fiscal year periods.",
      category: "FINANCE & ACCOUNTING",
      iconName: "coins",
      iconBg: "#DCFCE7",
      iconColor: "#059669",
      onOpen: handlers.openFinance
    });
  }

  // 9. Voucher Drafts (Aliged with Web: authorized whenever finance.vouchers.view is granted)
  if (roleActions.includes("finance.vouchers.view")) {
    list.push({
      key: "financeVouchers",
      title: "Voucher Drafts",
      shortLabel: "Vouchers",
      description: "Create and prepare operational payment vouchers for review.",
      category: "FINANCE & ACCOUNTING",
      iconName: "file-text",
      iconBg: "#E0E7FF",
      iconColor: "#4F46E5",
      onOpen: handlers.openVoucherOnly
    });
  }

  // 10. Voucher Reviews
  if (
    roleActions.includes("approvals.review") &&
    roleActions.includes("finance.vouchers.view") &&
    roleActions.includes("documents.files.view")
  ) {
    list.push({
      key: "financeReviews",
      title: "Voucher Reviews",
      shortLabel: "Voucher Reviews",
      description: "Audit, verify evidence and approve pending finance vouchers.",
      category: "FINANCE & ACCOUNTING",
      iconName: "receipt",
      iconBg: "#DBEAFE",
      iconColor: "#2563EB",
      onOpen: handlers.openFinanceReview
    });
  }

  // 11. Expense Claims
  if (
    roleActions.includes("finance.claims.view") ||
    roleActions.includes("finance.claims.create") ||
    roleActions.includes("finance.claims.manage")
  ) {
    list.push({
      key: "financeClaims",
      title: "Expense Claims",
      shortLabel: "Claims",
      description: "Submit expense claims and manage reimbursement documentation.",
      category: "FINANCE & ACCOUNTING",
      iconName: "receipt",
      iconBg: "#FEF3C7",
      iconColor: "#D97706",
      onOpen: handlers.openFinanceClaims
    });
  }

  // 12. Claim Reviews
  if (
    ["finance.claims.review", "approvals.review", "documents.files.view"].every(x =>
      roleActions.includes(x)
    )
  ) {
    list.push({
      key: "financeClaimReviews",
      title: "Claim Reviews",
      shortLabel: "Claim Reviews",
      description: "Inspect submitted reimbursement receipts and authorize payment.",
      category: "FINANCE & ACCOUNTING",
      iconName: "receipt",
      iconBg: "#EDE9FE",
      iconColor: "#6D28D9",
      onOpen: handlers.openFinanceClaimReviews
    });
  }

  // 13. Invoices & Receipts
  if (roleActions.includes("finance.invoices.view")) {
    list.push({
      key: "financeInvoices",
      title: "Invoices & Receipts",
      shortLabel: "Invoices",
      description: "Issue billing invoices and track customer payment receipts.",
      category: "FINANCE & ACCOUNTING",
      iconName: "file-text",
      iconBg: "#CFFAFE",
      iconColor: "#0891B2",
      onOpen: handlers.openInvoice
    });
  }

  // 14. Invoice Reviews
  if (roleActions.includes("finance.invoices.review") && roleActions.includes("approvals.review")) {
    list.push({
      key: "financeInvoiceReviews",
      title: "Invoice Reviews",
      shortLabel: "Invoice Reviews",
      description: "Conduct dual-control review on high-value billing invoices.",
      category: "FINANCE & ACCOUNTING",
      iconName: "shield",
      iconBg: "#F3E8FF",
      iconColor: "#7C3AED",
      onOpen: handlers.openInvoiceReview
    });
  }

  // 15. Budgets
  if (roleActions.includes("finance.budgets.view")) {
    list.push({
      key: "financeBudgets",
      title: "Budgets",
      shortLabel: "Budgets",
      description: "Track departmental budget allocations and expenditures.",
      category: "FINANCE & ACCOUNTING",
      iconName: "wallet",
      iconBg: "#FFE4E6",
      iconColor: "#E11D48",
      onOpen: handlers.openBudget
    });
  }

  // 16. Budget Reviews
  if (roleActions.includes("finance.budgets.review") && roleActions.includes("approvals.review")) {
    list.push({
      key: "financeBudgetReviews",
      title: "Budget Reviews",
      shortLabel: "Budget Reviews",
      description: "Conduct fiscal review and approve modified budget allocations.",
      category: "FINANCE & ACCOUNTING",
      iconName: "sliders",
      iconBg: "#FAE8FF",
      iconColor: "#C026D3",
      onOpen: handlers.openBudgetReview
    });
  }

  // 17. Ledger & Reports
  if (roleActions.includes("finance.reports.view")) {
    list.push({
      key: "financeReports",
      title: "Ledger & Reports",
      shortLabel: "Ledger",
      description: "Generate financial statements, journal audits and trial balances.",
      category: "FINANCE & ACCOUNTING",
      iconName: "bar-chart",
      iconBg: "#E0F2FE",
      iconColor: "#0284C7",
      onOpen: handlers.openReports
    });
  }

  // ----------------------------------------------------
  // SECTION 5: PLATFORM & COMMUNICATIONS
  // ----------------------------------------------------

  // 18. Private Case Documents
  if (
    roleActions.includes("documents.files.view") &&
    roleActions.includes("documents.files.manage") &&
    (roleActions.includes("approvals.view") || roleActions.includes("approvals.propose"))
  ) {
    list.push({
      key: "documents",
      title: "Private Case Documents",
      shortLabel: "Documents",
      description: "Access and manage case-related documents securely.",
      category: "PLATFORM & COMMUNICATIONS",
      iconName: "documents",
      iconBg: "#CCFBF1",
      iconColor: "#0D9488",
      onOpen: handlers.openDocuments
    });
  }

  // 19. Notices & Notifications (Web parity: unified communications capability check)
  if (
    [
      "communications.notifications.view",
      "communications.notices.manage",
      "communications.notices.approve",
      "communications.delivery.view",
      "communications.delivery.process"
    ].some(k => roleActions.includes(k))
  ) {
    list.push({
      key: "communications",
      title: "Notices & Notifications",
      shortLabel: "Notices",
      description: "View alerts, foundation announcements and recipient delivery.",
      category: "PLATFORM & COMMUNICATIONS",
      iconName: "notifications",
      iconBg: "#E0F2FE",
      iconColor: "#2563EB",
      onOpen: handlers.openNotifications
    });
  }

  // 20. Contact Messages & Help
  if (roleActions.includes("support.cases.view") || roleActions.includes("support.faq.manage")) {
    list.push({
      key: "support",
      title: "Contact Messages & Help",
      shortLabel: "Support",
      description: "Review help requests, inquiries and support communications.",
      category: "PLATFORM & COMMUNICATIONS",
      iconName: "support",
      iconBg: "#CCFBF1",
      iconColor: "#0D9488",
      onOpen: handlers.openSupport
    });
  }

  return list;
}

/**
 * Priority ordering for primary bottom navigation tabs based on user authorization.
 * Position 1 is always Dashboard.
 * Other tabs prioritize authorized modules without hardcoding role names.
 */
const BOTTOM_NAV_PRIORITY_KEYS = [
  "account",
  "accounts",
  "approvals",
  "healthVisitQueue",
  "healthPatientBooking",
  "finance",
  "branches",
  "financeClaims",
  "financeReviews",
  "documents",
  "communications",
  "support",
  "roles",
  "policy"
];

export function getBottomNavTabs(
  authorizedModules: DashboardModuleItem[],
  onOpenDashboard: () => void,
  onOpenMore: () => void
): { tabs: BottomNavTabItem[]; moreModules: DashboardModuleItem[] } {
  // Position 1 is ALWAYS Dashboard
  const tabs: BottomNavTabItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      iconName: "home",
      onPress: onOpenDashboard
    }
  ];

  // Modules excluding dashboard for subsequent tabs
  const candidateModules = authorizedModules.filter(m => m.key !== "dashboard");

  // Sort candidate modules according to priority list
  const sortedCandidates = [...candidateModules].sort((a, b) => {
    const idxA = BOTTOM_NAV_PRIORITY_KEYS.indexOf(a.key);
    const idxB = BOTTOM_NAV_PRIORITY_KEYS.indexOf(b.key);
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  function mapIcon(iconName: DashboardModuleItem["iconName"]): BottomNavTabItem["iconName"] {
    switch (iconName) {
      case "user":
        return "user";
      case "users":
        return "users";
      case "approvals":
        return "approvals";
      case "coins":
      case "file-text":
      case "wallet":
        return "coins";
      case "building":
        return "building";
      case "receipt":
        return "receipt";
      case "notifications":
      case "mail":
      case "send":
        return "notifications";
      case "support":
        return "support";
      case "shield":
      case "lock":
        return "shield";
      default:
        return "more";
    }
  }

  // If 4 or fewer candidate modules exist, show all of them (up to 5 tabs total) without "More"
  if (sortedCandidates.length <= 4) {
    for (const mod of sortedCandidates) {
      tabs.push({
        id: mod.key,
        label: mod.shortLabel,
        iconName: mapIcon(mod.iconName),
        onPress: mod.onOpen
      });
    }
    return { tabs, moreModules: [] };
  }

  // Otherwise, take the top 3 modules, and 5th position is "More"
  const topThree = sortedCandidates.slice(0, 3);
  const remaining = sortedCandidates.slice(3);

  for (const mod of topThree) {
    tabs.push({
      id: mod.key,
      label: mod.shortLabel,
      iconName: mapIcon(mod.iconName),
      onPress: mod.onOpen
    });
  }

  // 5th position: "More"
  tabs.push({
    id: "more",
    label: "More",
    iconName: "more",
    onPress: onOpenMore
  });

  return { tabs, moreModules: remaining };
}

/**
 * Organizes authorized modules into the exact 5 Web sections for the Navigation Drawer.
 * Exact match with Web FoundationAdminNav grouping and hierarchy.
 */
export function groupModulesByCategory(
  authorizedModules: DashboardModuleItem[]
): { category: ModuleCategory; modules: DashboardModuleItem[] }[] {
  const categories: ModuleCategory[] = [
    "DASHBOARD",
    "USER & ACCESS MANAGEMENT",
    "ORGANIZATION MANAGEMENT",
    "HEALTHCARE ASSISTANCE",
    "FINANCE & ACCOUNTING",
    "PLATFORM & COMMUNICATIONS"
  ];

  const result: { category: ModuleCategory; modules: DashboardModuleItem[] }[] = [];

  for (const cat of categories) {
    const mods = authorizedModules.filter(m => m.category === cat);
    if (mods.length > 0) {
      result.push({ category: cat, modules: mods });
    }
  }

  return result;
}

/**
 * Resolves the primary featured dashboard cards aligned directly with the Web Foundation Dashboard.
 * Displays only the relevant 4-6 primary operational modules based on effective permissions and scope.
 */
export function getDashboardFeaturedModules(
  roleActions: string[],
  actor: CG01SessionView | null,
  handlers: ModuleActionHandlers
): DashboardModuleItem[] {
  if (!actor) return [];

  const allAuthorized = getAuthorizedModules(roleActions, actor, handlers);
  const isFoundationScope = actor.scope === "Foundation";

  // Priority set of primary modules featured on the Web Foundation Dashboard:
  // 1. My account (account)
  // 2. Users Management (accounts)
  // 3. Roles & permissions (roles)
  // 4. Registration & Approval (approvals)
  // 5. Accounts (finance) or Voucher Reviews
  // 6. Security Policy (policy)
  const foundationFeaturedKeys = [
    "account",
    "accounts",
    "roles",
    "approvals",
    "finance",
    "policy"
  ];

  // Priority set for Trust or local organization scopes:
  // 1. My account (account)
  // 2. Branches & registration (branches)
  // 3. Registration & Approval (approvals)
  // 4. Expense Claims (financeClaims)
  // 5. Notices & Notifications (communications)
  // 6. Contact Messages & Help (support)
  const trustFeaturedKeys = [
    "account",
    "branches",
    "approvals",
    "financeClaims",
    "communications",
    "support"
  ];

  const targetKeys = isFoundationScope ? foundationFeaturedKeys : trustFeaturedKeys;

  // Select authorized modules matching the role's featured keys
  const featured = allAuthorized.filter(m => targetKeys.includes(m.key));

  // If fewer than 3 modules matched the target keys, fallback to top authorized modules up to 5
  if (featured.length < 3) {
    return allAuthorized.slice(0, 5);
  }

  return featured;
}
