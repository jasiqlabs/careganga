"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SignOutButton } from "../features/identity-access/signout-button";

export type FoundationAdminNavProps = {
  active:
    | "dashboard"
    | "account"
    | "roles"
    | "accounts"
    | "policy"
    | "settings"
    | "audit"
    | "recovery"
    | "approvals"
    | "documents"
    | "communications"
    | "support"
    | "foundation"
    | "branches"
    | "hr"
    | "projects"
    | "payroll"
    | "beneficiaries"
    | "campaigns"
    | "csr"
    | "referrals"
    | "fieldVisits"
    | "activities"
    | "tasks"
    | "inventory"
    | "membership"
    | "volunteers"
    | "finance"
    | "financeVouchers"
    | "financeReviews"
    | "financeClaims"
    | "financeClaimReviews"
    | "financeInvoices"
    | "financeInvoiceReviews"
    | "financeBudgets"
    | "financeBudgetReviews"
    | "financeReports"
    | "mis"
    | "cms"
    | "healthNetwork"
    | "healthCenter"
    | "healthDoctors"
    | "healthDiagnostics"
    | "healthLabPricing"
    | "healthLabOrders"
    | "healthLabEquipment"
    | "healthAssistancePolicies"
    | "healthLiabilities"
    | "healthSettlements"
    | "healthSchedules"
    | "healthPatientIntake"
    | "healthVisitQueue"
    | "healthClinicianActivity"
    | "healthPatientAdmin";
  displayName: string;
  roleName: string;
  canViewRoles: boolean;
  canViewAccounts: boolean;
  canManageSecurityPolicy?: boolean;
  canViewSettings?: boolean;
  canViewAudit?: boolean;
  canViewRecovery?: boolean;
  canViewApprovals?: boolean;
  canViewDocuments?: boolean;
  canViewCommunications?: boolean;
  canViewSupport?: boolean;
  canViewFoundation?: boolean;
  canViewBranches?: boolean;
  canViewFinance?: boolean;
  canViewVouchers?: boolean;
  canReviewFinance?: boolean;
  canViewClaims?: boolean;
  canReviewClaims?: boolean;
  canViewInvoices?: boolean;
  canReviewInvoices?: boolean;
  canViewBudgets?: boolean;
  canReviewBudgets?: boolean;
  canViewFinanceReports?: boolean;
  canViewCms?: boolean;
  canViewHealthNetwork?: boolean;
  labERPEnabled?: boolean;
  canViewCenterPortal?: boolean;
  canViewDoctors?: boolean;
  canViewSchedules?: boolean;
  canViewPatientIntake?: boolean;
  canViewVisitQueue?: boolean;
  canViewPatientAdmin?: boolean;
  /** Source-verified role actions for consistent first-render navigation; revalidated on mount. */
  initialActions?: readonly string[];
};

/**
 * Clean SVG Navigation Icons matching CareGanga Foundation enterprise hierarchy
 */
function getNavIcon(key: string) {
  switch (key) {
    case "dashboard":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "account":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "healthNetwork":
    case "healthCenter":
    case "healthDoctors":
    case "healthDiagnostics":
    case "healthLabPricing":
    case "healthLabOrders":
    case "healthLabEquipment":
    case "healthAssistancePolicies":
    case "healthLiabilities":
    case "healthSettlements":
    case "healthSchedules":
    case "healthPatientIntake":
    case "healthVisitQueue":
    case "healthPatientAdmin":
      return <svg width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21V7l9-4 9 4v14M3 13h18M9 10v7m6-7v7M7 21h10"/>
      </svg>;
    case "accounts":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "roles":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case "approvals":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      );
    case "policy":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "branches":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "fieldVisits":
    case "activities":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M13 17h3"/></svg>;
    case "tasks":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 12l3 3 5-6"/></svg>;
    case "referrals":
    case "csr":
    case "campaigns":
    case "payroll":
    case "beneficiaries":
    case "projects":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18v15H3zM8 6V3h8v3M3 11h18"/></svg>;
    case "volunteers":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2 21v-3c0-6 12-6 12 0v3M15 15c4 0 7 2 7 6"/></svg>;
    case "membership":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h5"/></svg>;
    case "inventory":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/></svg>;
    case "foundation":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
      );
    case "cms":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "finance":
    case "mis":
    case "financeReports":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "financeVouchers":
    case "financeInvoices":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "financeClaims":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "financeBudgets":
    case "financeBudgetReviews":
    case "financeInvoiceReviews":
    case "financeClaimReviews":
    case "financeReviews":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "documents":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "communications":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "support":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "settings":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "audit":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "recovery":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

function formatNotificationDate(isoString?: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    return `${day} ${month}`;
  } catch {
    return "";
  }
}

function deriveNotificationCategory(item: { title?: string; body?: string; status?: string }): string {
  const combined = `${item.title || ""} ${item.body || ""} ${item.status || ""}`.toLowerCase();
  if (
    combined.includes("approval") ||
    combined.includes("awaiting") ||
    combined.includes("verify") ||
    combined.includes("voucher") ||
    combined.includes("claim")
  ) {
    return "APPROVAL";
  }
  if (combined.includes("notice") || combined.includes("policy")) {
    return "NOTICE";
  }
  return "UPDATE";
}

/**
 * Premium Controllable Foundation Admin Navigation Shell
 * - User-adjustable resizable sidebar with drag handle (persisted in localStorage)
 * - Header hamburger and sidebar << collapse control
 * - Responsive mobile drawer with backdrop overlay
 * - Pill-shaped search bar with Ctrl+K shortcut indicator
 * - Super Admin profile header dropdown (My Profile, Global Settings, Sign Out)
 * - Strict preservation of all 25 navigation routes, ordering, permissions & bottom Super Admin footer
 */
export function FoundationAdminNav({
  active,
  displayName,
  roleName,
  canViewRoles,
  canViewAccounts,
  canManageSecurityPolicy = false,
  canViewSettings = false,
  canViewAudit = false,
  canViewRecovery = false,
  canViewApprovals = false,
  canViewDocuments = false,
  canViewCommunications = false,
  canViewSupport = false,
  canViewFoundation = false,
  canViewBranches = false,
  canViewFinance = false,
  canViewVouchers = false,
  canReviewFinance = false,
  canViewClaims = false,
  canReviewClaims = false,
  canViewInvoices = false,
  canReviewInvoices = false,
  canViewBudgets = false,
  canReviewBudgets = false,
  canViewFinanceReports = false,
  canViewCms = false,
  canViewHealthNetwork = false,
  labERPEnabled = false,
  canViewCenterPortal = false,
  canViewDoctors = false,
  canViewSchedules = false,
  canViewPatientIntake = false,
  canViewVisitQueue = false,
  canViewPatientAdmin = false,
  initialActions
}: FoundationAdminNavProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Search state
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarSearchRef = useRef<HTMLInputElement>(null);

  // Sidebar controllable state
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Profile header dropdown state
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  // Dynamic notification items & dropdown state (from existing inbox API)
  const [notificationItems, setNotificationItems] = useState<Array<{
    notificationRef: string;
    title: string;
    body: string;
    channel?: string;
    status?: string;
    receivedAt?: string;
    read: boolean;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState<boolean>(true);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<"ALL" | "UNREAD">("ALL");
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);

  // Framer motion reduced motion accessibility setting
  const shouldReduceMotion = useReducedMotion();

  // Dynamic unread notifications from existing communications inbox API
  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const response = await fetch("/api/communications/inbox?limit=30", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!active) return;
        if (response.ok) {
          const data = (await response.json()) as {
            items?: Array<{
              notificationRef: string;
              title: string;
              body: string;
              channel?: string;
              status?: string;
              receivedAt?: string;
              read: boolean;
            }>;
          };
          if (Array.isArray(data?.items)) {
            setNotificationItems(data.items);
            const unread = data.items.filter(item => !item.read).length;
            setUnreadCount(unread);
          } else {
            setNotificationItems([]);
            setUnreadCount(0);
          }
        } else {
          setNotificationItems([]);
          setUnreadCount(0);
        }
      } catch {
        if (active) {
          setNotificationItems([]);
          setUnreadCount(0);
        }
      } finally {
        if (active) {
          setIsNotificationsLoading(false);
        }
      }
    }

    void loadNotifications();
    return () => {
      active = false;
    };
  }, []);

  // Restore sidebar preferences on mount
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("cg_admin_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 200 && parsed <= 400) {
          setSidebarWidth(parsed);
        }
      }
      const savedCollapsed = localStorage.getItem("cg_admin_sidebar_collapsed");
      if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === "true");
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Sync sidebar width and collapsed class to parent .shell element
  useEffect(() => {
    const shell = document.querySelector(".shell") as HTMLElement | null;
    if (shell) {
      if (isCollapsed) {
        shell.style.setProperty("--sidebar-current-width", "4.5rem");
        shell.classList.add("sidebar-collapsed");
      } else {
        shell.style.setProperty("--sidebar-current-width", `${sidebarWidth}px`);
        shell.classList.remove("sidebar-collapsed");
      }
    }
  }, [sidebarWidth, isCollapsed]);

  // Lock body scroll on mobile when drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileDrawerOpen]);

  // Global Ctrl + K search shortcut
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Outside click & Escape dismissals for profile dropdown
  useEffect(() => {
    if (!profileDropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node) &&
        profileTriggerRef.current &&
        !profileTriggerRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileDropdownOpen(false);
        profileTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileDropdownOpen]);

  // Outside click & Escape dismissals for notification dropdown
  useEffect(() => {
    if (!notificationDropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(e.target as Node) &&
        notificationTriggerRef.current &&
        !notificationTriggerRef.current.contains(e.target as Node)
      ) {
        setNotificationDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotificationDropdownOpen(false);
        notificationTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationDropdownOpen]);

  // Drag resize handler for controllable sidebar width
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(moveEvent.clientX, 200), 400);
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      try {
        localStorage.setItem("cg_admin_sidebar_width", String(sidebarWidth));
      } catch {
        // Storage restricted
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Toggle collapsed state
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("cg_admin_sidebar_collapsed", String(next));
      } catch {
        // Storage restricted
      }
      return next;
    });
  }, []);

  // Effective actions revalidation
  const [currentActions, setCurrentActions] = useState<Set<string>|null>(() =>
    initialActions ? new Set(initialActions) : null
  );
  useEffect(() => {
    let live = true;
    void fetch("/api/access/effective", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Access unavailable");
        return response.json() as Promise<unknown>;
      })
      .then(result => {
        if (!live) return;
        if (!result || typeof result !== "object" || !("actions" in result) || !Array.isArray(result.actions))
          throw new Error("Access incomplete");
        setCurrentActions(
          new Set(
            result.actions.flatMap((item: unknown) =>
              item && typeof item === "object" && "key" in item && typeof item.key === "string" ? [item.key] : []
            )
          )
        );
      })
      .catch(() => {
        if (live) setCurrentActions(new Set());
      });
    return () => {
      live = false;
    };
  }, []);

  const allowed = (key: string, initial: boolean) => (currentActions ? currentActions.has(key) : initial);

  const foundationAccess = currentActions
    ? ["foundation.profile.view", "foundation.geography.view", "foundation.departments.view"].some(key =>
        currentActions.has(key)
      )
    : canViewFoundation;
  const branchAccess = allowed("foundation.branches.view", canViewBranches);
  const hrAccess = currentActions ?
    (currentActions.has("hr.applications.view")||currentActions.has("hr.employees.view")) :
    Boolean(initialActions?.some(a=>a==="hr.applications.view"||a==="hr.employees.view"));
  const accountsAccess = currentActions
    ? currentActions.has("accounts.view") ||
      (currentActions.has("accounts.create") && currentActions.has("roles.assign"))
    : canViewAccounts;
  const rolesAccess = allowed("roles.view", canViewRoles);
  const policyAccess = allowed("identity.security-policy.manage", canManageSecurityPolicy);
  const settingsAccess = allowed("platform.settings.view", canViewSettings);
  const auditAccess = allowed("platform.audit.view", canViewAudit);
  const recoveryAccess = allowed("platform.recovery.view", canViewRecovery);
  const approvalAccess = currentActions
    ? ["approvals.view", "approvals.propose"].some(key => currentActions.has(key))
    : canViewApprovals;
  const documentAccess = currentActions
    ? ["documents.files.view", "documents.files.manage"].every(key => currentActions.has(key)) && approvalAccess
    : canViewDocuments;
  const communicationAccess = currentActions
    ? [
        "communications.notifications.view",
        "communications.notices.manage",
        "communications.notices.approve",
        "communications.delivery.view",
        "communications.delivery.process"
      ].some(key => currentActions.has(key))
    : canViewCommunications;
  const supportAccess = currentActions
    ? ["support.cases.view", "support.faq.manage"].some(key => currentActions.has(key))
    : canViewSupport;

  const financeAccess = allowed("finance.accounts.view", canViewFinance);
  const voucherAccess = allowed("finance.vouchers.view", canViewVouchers);
  const claimsReviewerAccess = currentActions
    ? ["approvals.review", "finance.claims.review", "documents.files.view"].every(k => currentActions.has(k))
    : canReviewClaims;
  const claimsAccess = currentActions
    ? ["finance.claims.view", "finance.claims.create", "finance.claims.manage"].some(k => currentActions.has(k))
    : canViewClaims;
  const invoiceAccess = currentActions ? currentActions.has("finance.invoices.view") : canViewInvoices;
  const reportAccess = currentActions ? currentActions.has("finance.reports.view") : canViewFinanceReports;
  const misAccess = currentActions ?
    (currentActions.has("mis.dashboard.view") || currentActions.has("mis.reports.view")) :
    Boolean(initialActions?.some(x => x==="mis.dashboard.view" || x==="mis.reports.view"));
  const cmsAccess = allowed("cms.content.view", canViewCms);
  const healthNetworkAccess = allowed("health.providers.view", canViewHealthNetwork);
  // Reviewer-only and publisher-only staff must have a visible, authorized
  // entry point; never send them to the provider directory without view access.
  const healthReviewerAccess = currentActions
    ? currentActions.has("approvals.review") &&
      (currentActions.has("health.providers.verify") || currentActions.has("health.doctors.verify"))
    : false;
  const providerReviewerHomeAccess = currentActions
    ? currentActions.has("approvals.review") && currentActions.has("health.providers.verify")
    : false;
  const healthPublisherAccess = currentActions
    ? currentActions.has("health.centers.publish") : false;
  const healthHomeHref = healthNetworkAccess || providerReviewerHomeAccess
    ? "/admin/health-network"
    : healthReviewerAccess ? "/admin/health-network/reviews"
    : "/admin/health-network/content-reviews";
  const healthCenterAccess = allowed("health.centers.draft.edit", canViewCenterPortal);
  const doctorAccess = allowed("health.doctors.view", canViewDoctors);
  const diagnosticsAccess = allowed("diagnostics.catalog.view", false);
  const labPricingAccess = allowed("diagnostics.pricing.view", false);
  const labOrderAccess = allowed("lab.orders.view", false)||allowed("lab.orders.create", false);
  const equipmentAccess = labERPEnabled && allowed("lab.equipment.view", false);
  const liabilityAccess = allowed("healthcare.assistance.liabilities.view",false);
  const settlementAccess = allowed("healthcare.assistance.settlements.view",false) &&
    allowed("health.providers.finance.view",false);
  const assistancePolicyAccess = allowed("healthcare.assistance.policies.view", false)||
    (allowed("healthcare.assistance.policies.review", false)&&allowed("approvals.review", false));
  const scheduleAccess = allowed("health.schedules.view", canViewSchedules);
  const patientIntakeAccess = allowed("health.patients.intake", canViewPatientIntake);
  const visitQueueAccess = allowed("health.visits.manage", canViewVisitQueue);
  const clinicianActivityAccess = allowed("health.visits.clinical.manage",false);
  const patientAdminAccess = allowed("health.patients.admin.view", canViewPatientAdmin);
  const budgetAccess = currentActions ? currentActions.has("finance.budgets.view") : canViewBudgets;
  const budgetReviewAccess = currentActions
    ? ["finance.budgets.review", "approvals.review"].every(k => currentActions.has(k))
    : canReviewBudgets;
  const invoiceReviewAccess = currentActions
    ? ["finance.invoices.review", "approvals.review"].every(k => currentActions.has(k))
    : canReviewInvoices;
  const reviewerAccess = currentActions
    ? ["approvals.review", "finance.vouchers.view", "documents.files.view"].every(k => currentActions.has(k))
    : canReviewFinance;

  // Strict preservation of all existing navigation items
  const links = [
    { key: "dashboard" as const, label: "Dashboard", href: "/admin/dashboard" },
    { key: "account" as const, label: "My account", href: "/admin" },
    ...(accountsAccess ? [{ key: "accounts" as const, label: "Users Management", href: "/admin/accounts" }] : []),
    ...(rolesAccess ? [{ key: "roles" as const, label: "Roles & permissions", href: "/admin/roles" }] : []),
    ...(foundationAccess ? [{ key: "foundation" as const, label: "Foundation Structure", href: "/admin/foundation" }] : []),
    ...(branchAccess ? [{ key: "branches" as const, label: "Branches & registration", href: "/admin/foundation/branches" }] : []),
    ...((allowed("campaigns.view",false)||allowed("campaigns.review",false)&&allowed("approvals.review",false))?[{key:"campaigns" as const,label:"Campaigns",href:"/admin/campaigns"}]:[]),
    ...((allowed("csr.partners.view",false)||(allowed("csr.partners.review",false)&&allowed("approvals.review",false)))?[{key:"csr" as const,label:"CSR & Partnerships",href:"/admin/csr"}]:[]),
    ...((allowed("referrals.programmes.view",false)||allowed("rewards.catalog.view",false))?[{key:"referrals" as const,label:"Referral Programme & Rewards",href:"/admin/referrals"}]:[]),
    ...(allowed("projects.view",false)?[{key:"projects" as const,label:"Projects",href:"/admin/projects"}]:[]),
    {key:"payroll" as const,label:allowed("payroll.compensation.view",false)?"Payroll & Salary":"My Pay",href:"/admin/payroll"},
    ...(allowed("beneficiaries.view",false)?[{key:"beneficiaries" as const,label:"Beneficiaries",href:"/admin/beneficiaries"}]:[]),
    ...(allowed("projects.visits.view",false)?[{key:"fieldVisits" as const,label:"Field Visits",href:"/admin/field-visits"}]:[]),
    ...(allowed("projects.activities.view",false)?[{key:"activities" as const,label:"Activities & Events",href:"/admin/activities"}]:[]),
    ...(allowed("projects.tasks.view",false)?[{key:"tasks" as const,label:"Tasks & Assignments",href:"/admin/tasks"}]:[]),
    ...((allowed("membership.tier.manage",false)||allowed("membership.members.view",false)||allowed("membership.applications.review",false))?[{key:"membership" as const,label:"Membership",href:"/admin/membership"}]:[]),
    ...((allowed("volunteers.view",false)||allowed("volunteers.applications.review",false))?[{key:"volunteers" as const,label:"Volunteers",href:"/admin/volunteers"}]:[]),
    ...(allowed("inventory.catalog.view",false)?[{key:"inventory" as const,label:"Requests & Inventory",href:"/admin/inventory"}]:[]),
    {key:"hr" as const,label:hrAccess?"Human Resources":"My employment",href:"/admin/hr"},
    ...(cmsAccess ? [{ key: "cms" as const, label: "Website CMS", href: "/admin/website" }] : []),
    ...(healthNetworkAccess || healthReviewerAccess || healthPublisherAccess
      ? [{ key: "healthNetwork" as const,
           label: healthNetworkAccess ? "Healthcare Providers"
             : healthReviewerAccess ? "Healthcare Reviews" : "Center Content Reviews",
           href: healthHomeHref }]
      : []),
    ...(healthCenterAccess ? [{ key: "healthCenter" as const, label: "My Healthcare Center", href: "/center" }] : []),
    ...(doctorAccess ? [{ key: "healthDoctors" as const, label: "Doctor Registrations", href: "/admin/health-network/doctors" }] : []),
    ...(diagnosticsAccess ? [{ key: "healthDiagnostics" as const, label: "Lab Test Master & Pricing", href: "/admin/health-network/diagnostics" }] : []),
    ...(labPricingAccess ? [{ key: "healthLabPricing" as const, label: "My Lab Pricing", href: "/admin/health-network/lab-pricing" }] : []),
    ...(labOrderAccess ? [{ key: "healthLabOrders" as const, label: "Lab Orders & Samples", href: "/admin/health-network/lab-orders" }] : []),
    ...(equipmentAccess ? [{ key: "healthLabEquipment" as const, label: "Lab Equipment & Quality", href: "/admin/health-network/equipment" }] : []),
    ...(assistancePolicyAccess ? [{ key: "healthAssistancePolicies" as const, label: "Foundation Contribution Policies", href: "/admin/health-network/assistance-policies" }] : []),
    ...(liabilityAccess ? [{ key: "healthLiabilities" as const, label: "Foundation Healthcare Obligations", href: "/admin/health-network/liabilities" }] : []),
    ...(settlementAccess ? [{ key: "healthSettlements" as const, label: "Healthcare Provider Settlements", href: "/admin/health-network/settlements" }] : []),
    ...(scheduleAccess ? [{ key: "healthSchedules" as const, label: "Doctor Schedules", href: "/admin/health-network/schedules" }] : []),
    ...(patientIntakeAccess ? [{ key: "healthPatientIntake" as const, label: "Register Patient", href: "/admin/health-network/patient-intake" }] : []),
    ...(visitQueueAccess ? [{ key: "healthVisitQueue" as const, label: "Consultation Queue", href: "/admin/health-network/queue" }] : []),
    ...(clinicianActivityAccess ? [{ key: "healthClinicianActivity" as const, label: "My Consultations", href: "/admin/health-network/my-clinical-activity" }] : []),
    ...(patientAdminAccess ? [{ key: "healthPatientAdmin" as const, label: "Patient & Booking Management", href: "/admin/health-network/patients" }] : []),
    ...(financeAccess ? [{ key: "finance" as const, label: "Accounts", href: "/admin/finance" }] : []),
    ...(voucherAccess ? [{ key: "financeVouchers" as const, label: "Voucher Drafts", href: "/admin/finance/vouchers" }] : []),
    ...(claimsAccess ? [{ key: "financeClaims" as const, label: "Expense Claims", href: "/admin/finance/claims" }] : []),
    ...(invoiceAccess ? [{ key: "financeInvoices" as const, label: "Invoices & Receipts", href: "/admin/finance/invoices" }] : []),
    ...(budgetAccess ? [{ key: "financeBudgets" as const, label: "Budgets", href: "/admin/finance/budgets" }] : []),
    ...(reportAccess ? [{ key: "financeReports" as const, label: "Ledger & Reports", href: "/admin/finance/reports" }] : []),
    ...(misAccess ? [{ key: "mis" as const, label: "Reports & MIS", href: "/admin/mis" }] : []),
    ...(budgetReviewAccess ? [{ key: "financeBudgetReviews" as const, label: "Budget Reviews", href: "/admin/finance/budget-reviews" }] : []),
    ...(invoiceReviewAccess ? [{ key: "financeInvoiceReviews" as const, label: "Invoice Reviews", href: "/admin/finance/invoice-reviews" }] : []),
    ...(claimsReviewerAccess ? [{ key: "financeClaimReviews" as const, label: "Claim Reviews", href: "/admin/finance/claim-reviews" }] : []),
    ...(reviewerAccess ? [{ key: "financeReviews" as const, label: "Voucher Reviews", href: "/admin/finance/voucher-approvals" }] : []),
    ...(policyAccess ? [{ key: "policy" as const, label: "Security Policy", href: "/admin/security-policy" }] : []),
    ...(settingsAccess ? [{ key: "settings" as const, label: "General Settings", href: "/admin/settings" }] : []),
    ...(auditAccess ? [{ key: "audit" as const, label: "Audit Logs", href: "/admin/audit" }] : []),
    ...(recoveryAccess ? [{ key: "recovery" as const, label: "Backup & Restore", href: "/admin/backup-recovery" }] : []),
    ...(approvalAccess ? [{ key: "approvals" as const, label: "Registration & Approval", href: "/admin/approvals" }] : []),
    ...(documentAccess ? [{ key: "documents" as const, label: "Private Case Documents", href: "/admin/documents" }] : []),
    ...(communicationAccess ? [{ key: "communications" as const, label: "Notices & Notifications", href: "/admin/communications" }] : []),
    ...(supportAccess ? [{ key: "support" as const, label: "Contact Messages & Help", href: "/admin/support" }] : [])
  ].filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  const titles: Record<FoundationAdminNavProps["active"], string> = {
    dashboard: "Dashboard",
    account: "Admin User Profile & Credentials",
    roles: "Roles & Permissions",
    accounts: "Users Management",
    policy: "Security Policy",
    settings: "General Settings",
    audit: "Audit Logs",
    recovery: "Backup & Restore",
    approvals: "Registration & Approval",
    documents: "Private Case Documents",
    communications: "Notices & Notifications",
    support: "Help & Support",
    foundation: "Departments / Committees",
    branches: "Branches / Locations",
    cms: "Website CMS",
    healthNetwork: "Healthcare Providers",
    healthCenter: "My Healthcare Center",
    healthDoctors: "Doctor Registrations",
    healthDiagnostics: "Lab Test Master & Pricing",
    healthLabPricing: "My Lab Pricing",
    healthLabOrders: "Lab Orders & Samples",
    healthLabEquipment: "Lab Equipment & Quality",
    healthAssistancePolicies: "Foundation Contribution Policies",
    healthLiabilities: "Foundation Healthcare Obligations",
    healthSettlements: "Healthcare Provider Settlements",
    healthSchedules: "Doctor Schedule & Availability",
    healthPatientIntake: "Patient Registration",
    healthVisitQueue: "Consultation Queue",
    healthClinicianActivity: "My Consultations",
    healthPatientAdmin: "Patient & Booking Management",
    finance: "Finance & Accounting",
    financeReports: "Ledger & Reports",
    mis: "Reports & MIS",
    financeBudgets: "Budgets",
    financeBudgetReviews: "Budget Reviews",
    financeInvoices: "Invoices & Receipts",
    financeInvoiceReviews: "Invoice Reviews",
    financeClaims: "Expense Claims",
    financeClaimReviews: "Expense Claim Reviews",
    financeVouchers: "Finance Voucher Drafts",
    financeReviews: "Finance Voucher Reviews",
    campaigns: "Campaigns",
    csr: "CSR & Partnerships",
    projects: "Projects",
    payroll: "Payroll & Salary",
    beneficiaries: "Beneficiaries",
    fieldVisits: "Field Visits",
    activities: "Activities & Events",
    tasks: "Tasks & Assignments",
    inventory: "Requests & Inventory",
    membership: "Membership",
    volunteers: "Volunteers",
    hr: "Human Resources"
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/session/logout", { method: "POST", credentials: "same-origin" });
      startTransition(() => {
        router.replace("/admin/login");
        router.refresh();
      });
    } catch {
      router.replace("/admin/login");
    }
  };

  const avatarInitial = (displayName?.trim().slice(0, 2) || roleName?.trim().slice(0, 2) || "SA").toUpperCase();

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <motion.div
            className="sidebar-backdrop"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>

      {/* Controllable Sidebar */}
      <nav
        className={`sidebar ${isCollapsed ? "is-collapsed" : ""} ${isMobileDrawerOpen ? "mobile-open" : ""}`}
        aria-label="Foundation navigation"
      >
        {/* Resize Handle on Right Edge (Desktop only) */}
        {!isCollapsed && (
          <div
            className={`sidebar-resize-handle ${isResizing ? "is-resizing" : ""}`}
            onMouseDown={handleResizeStart}
            title="Drag to resize sidebar width"
            aria-hidden="true"
          />
        )}

        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-left">
            <img alt="CareGanga Foundation" src="/careganga-mark.png" width="38" height="38" className="sidebar-logo-img" />
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  className="sidebar-brand-name"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <strong>CareGanga</strong>
                  <span>FOUNDATION</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Collapse << Button (Desktop) & Close Button (Mobile) */}
          <div className="sidebar-brand-actions">
            <button
              type="button"
              className="sidebar-collapse-btn desktop-only"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {isCollapsed ? (
                  <polyline points="13 17 18 12 13 7" />
                ) : (
                  <>
                    <polyline points="11 17 6 12 11 7" />
                    <polyline points="18 17 13 12 18 7" />
                  </>
                )}
              </svg>
            </button>
            <button
              type="button"
              className="sidebar-close-btn mobile-only"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-label="Close menu drawer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar Menu Filter */}
        {!isCollapsed ? (
          <div className="sidebar-filter">
            <label htmlFor="foundation-menu-filter" className="sr-only">Search menu</label>
            <div className="sidebar-filter-input-wrap">
              <svg className="sidebar-filter-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={sidebarSearchRef}
                id="foundation-menu-filter"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search menu..."
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          <div className="sidebar-filter-collapsed">
            <button
              type="button"
              className="sidebar-search-icon-btn"
              onClick={toggleCollapse}
              title="Click to search menu items"
              aria-label="Search menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        )}

        {/* Navigation Links Preserving Groups & Permissions */}
        <div className="sidebar-links">
          {([
            { name: "DASHBOARD", keys: ["dashboard", "account"] },
            { name: "USER & ACCESS MANAGEMENT", keys: ["accounts", "roles", "approvals", "policy"] },
            { name: "ORGANIZATION MANAGEMENT", keys: ["branches", "foundation", "hr", "cms"] },
            { name: "PAYROLL & SALARY", keys: ["payroll"] },
            { name: "MEMBERSHIP & VOLUNTEERS", keys: ["membership", "volunteers"] },
            { name: "PROJECT & FIELD OPERATIONS", keys: ["projects", "beneficiaries", "fieldVisits", "tasks", "activities", "inventory"] },
            { name: "CAMPAIGNS & FUNDRAISING", keys: ["campaigns", "csr", "referrals"] },
            { name: "HEALTHCARE", keys: [
              "healthNetwork", "healthCenter", "healthDoctors", "healthDiagnostics", "healthLabPricing", "healthLabOrders", "healthLabEquipment", "healthAssistancePolicies", "healthLiabilities", "healthSettlements", "healthSchedules", "healthPatientIntake",
              "healthVisitQueue", "healthPatientAdmin"
            ] },
            {
              name: "FINANCE & ACCOUNTING",
              keys: [
                "finance",
                "financeVouchers",
                "financeReviews",
                "financeClaims",
                "financeClaimReviews",
                "financeInvoices",
                "financeInvoiceReviews",
                "financeBudgets",
                "financeBudgetReviews",
                "financeReports",
                "mis"
              ]
            },
            {
              name: "PLATFORM & COMMUNICATIONS",
              keys: ["documents", "communications", "support", "settings", "audit", "recovery"]
            }
          ] as const).map(group => {
            const permitted = links.filter(item => (group.keys as readonly string[]).includes(item.key));
            return permitted.length ? (
              <div key={group.name} className="sidebar-group">
                {!isCollapsed ? (
                  <p className="sidebar-section">{group.name}</p>
                ) : (
                  <div className="sidebar-collapsed-divider" aria-hidden="true" />
                )}
                {permitted.map(item => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    aria-current={active === item.key ? "page" : undefined}
                    title={isCollapsed ? item.label : undefined}
                    className={`sidebar-link ${active === item.key ? "selected" : ""}`}
                  >
                    <span className="sidebar-link-icon">{getNavIcon(item.key)}</span>
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.span
                          className="sidebar-link-text"
                          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {item.key === "communications" && (
                      isNotificationsLoading ? (
                        <span className={`sidebar-skeleton-badge ${isCollapsed ? "collapsed-badge" : ""}`} aria-hidden="true" />
                      ) : unreadCount > 0 ? (
                        <span className={`sidebar-badge-count ${isCollapsed ? "collapsed-badge" : ""}`}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null
                    )}
                  </Link>
                ))}
              </div>
            ) : null;
          })}
          {links.length === 0 && (
            <p className="sidebar-empty">No matching permitted menu item.</p>
          )}
        </div>

        {/* BOTTOM SUPER ADMIN SECTION — MANDATORY PRESERVED AS-IS */}
        <div className={`sidebar-footer ${isCollapsed ? "footer-collapsed" : ""}`}>
          <div className="sidebar-footer-avatar" aria-hidden="true">
            {avatarInitial}
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                className="sidebar-footer-role-wrap"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <span className="sidebar-footer-role" title={roleName?.trim() || "Staff Member"}>
                  {roleName?.trim() || "Super Admin"}
                </span>
                <span className="sidebar-footer-sub">System Administrator</span>
                {displayName && (
                  <span className="sidebar-footer-user" title={displayName}>
                    {displayName}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <SignOutButton variant="icon" />
        </div>
      </nav>

      {/* Responsive Dashboard Header */}
      <header className="admin-topbar">
        {/* Left Section: Sidebar Hamburger (Tablet/Mobile) + Dynamic Page Title */}
        <div className="admin-topbar-left">
          <button
            type="button"
            className="topbar-hamburger-btn"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                setIsMobileDrawerOpen(prev => !prev);
              } else {
                toggleCollapse();
              }
            }}
            aria-label="Toggle navigation sidebar"
            title="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="admin-topbar-title">
            <div className="topbar-heading-row">
              <h1 title={titles[active] || "Dashboard"}>{titles[active] || "Dashboard"}</h1>
              <span className="topbar-verified-pill" title="Verified Foundation Control Panel">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </div>
            <p title="Complete Command Center & Control Panel">Complete Command Center &amp; Control Panel</p>
          </div>
        </div>

        {/* Center Section: Pill-shaped Rounded Global Search */}
        <div className="admin-topbar-center">
          <div className="topbar-search-pill-wrapper">
            <label htmlFor="admin-topbar-module-search" className="sr-only">
              Search by Name, ID, Mobile, Email
            </label>
            <svg className="topbar-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              id="admin-topbar-module-search"
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by Name, ID, Mobile, Email..."
              autoComplete="off"
              className="topbar-search-input"
            />
            <kbd className="topbar-search-kbd" aria-hidden="true">Ctrl K</kbd>
          </div>
        </div>

        {/* Right Section: Tools + Dynamic User Profile Dropdown */}
        <div className="admin-topbar-tools">
          {/* Help / Contact */}
          <Link className="topbar-icon-action-btn" href="/contact" title="Help & Support" aria-label="Help and Support">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </Link>

          {/* Notifications Bell & Dropdown with Dynamic Data */}
          <div className="topbar-notifications-container">
            <button
              ref={notificationTriggerRef}
              type="button"
              className={`topbar-icon-action-btn with-badge ${notificationDropdownOpen ? "is-active" : ""}`}
              onClick={() => {
                setNotificationDropdownOpen(prev => !prev);
                setProfileDropdownOpen(false);
              }}
              aria-haspopup="true"
              aria-expanded={notificationDropdownOpen}
              aria-label={`View notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              title="Notifications"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {isNotificationsLoading ? (
                <span className="topbar-skeleton-badge" aria-hidden="true" />
              ) : unreadCount > 0 ? (
                <span className="topbar-counter-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>

            {/* Notification Dropdown Panel matching Reference Screenshot */}
            <AnimatePresence>
              {notificationDropdownOpen && (
                <motion.div
                  ref={notificationDropdownRef}
                  className="topbar-notification-dropdown"
                  role="region"
                  aria-label="Notifications panel"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <div className="notification-dropdown-header">
                    <span className="notification-dropdown-title">Notifications</span>
                  </div>

                  <div className="notification-dropdown-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={notificationTab === "ALL"}
                      className={`notification-tab-btn ${notificationTab === "ALL" ? "is-active" : ""}`}
                      onClick={() => setNotificationTab("ALL")}
                    >
                      All ({notificationItems.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={notificationTab === "UNREAD"}
                      className={`notification-tab-btn ${notificationTab === "UNREAD" ? "is-active" : ""}`}
                      onClick={() => setNotificationTab("UNREAD")}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  <div className="notification-dropdown-list">
                    {(() => {
                      const displayedItems = notificationTab === "ALL"
                        ? notificationItems
                        : notificationItems.filter(item => !item.read);

                      if (isNotificationsLoading) {
                        return (
                          <div className="notification-empty-state">
                            <span className="topbar-skeleton-badge" style={{ position: "static", width: "1.5rem", height: "1.5rem" }} />
                            <span>Loading notifications...</span>
                          </div>
                        );
                      }

                      if (displayedItems.length === 0) {
                        return (
                          <div className="notification-empty-state">
                            <svg className="notification-empty-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            <span>{notificationTab === "ALL" ? "No notifications received." : "No unread notifications."}</span>
                          </div>
                        );
                      }

                      return displayedItems.map(item => (
                        <div key={item.notificationRef} className={`notification-item-card ${!item.read ? "is-unread" : ""}`}>
                          {/* Orange Shield with Checkmark Icon matching reference */}
                          <div className="notification-item-icon-box" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <polyline points="9 12 11 14 15 10" />
                            </svg>
                          </div>

                          <div className="notification-item-content">
                            <div className="notification-item-top-row">
                              <strong className="notification-item-title" title={item.title}>
                                {item.title}
                              </strong>
                              <span className="notification-item-date">
                                {formatNotificationDate(item.receivedAt)}
                              </span>
                            </div>
                            <p className="notification-item-body" title={item.body}>
                              {item.body}
                            </p>
                            <div className="notification-item-bottom-row">
                              <span className="notification-item-badge">
                                {deriveNotificationCategory(item)}
                              </span>
                              <Link
                                href="/admin/communications"
                                className="notification-item-view-link"
                                onClick={() => setNotificationDropdownOpen(false)}
                              >
                                <span>View</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <line x1="7" y1="17" x2="17" y2="7" />
                                  <polyline points="7 7 17 7 17 17" />
                                </svg>
                              </Link>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="notification-dropdown-footer">
                    <Link
                      href="/admin/communications"
                      className="notification-dropdown-view-all-link"
                      onClick={() => setNotificationDropdownOpen(false)}
                    >
                      View All Notifications →
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View Site */}
          <Link className="topbar-text-action-link" href="/" title="Open public CareGanga website">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>View Site</span>
          </Link>

          {/* Header Profile Section & Super Admin Dropdown Trigger */}
          <div className="topbar-profile-container">
            <button
              ref={profileTriggerRef}
              type="button"
              className="topbar-profile-trigger-btn"
              onClick={() => {
                setProfileDropdownOpen(prev => !prev);
                setNotificationDropdownOpen(false);
              }}
              aria-haspopup="true"
              aria-expanded={profileDropdownOpen}
              aria-label="Open profile settings menu"
            >
              <div className="topbar-profile-avatar" aria-hidden="true">
                {avatarInitial}
              </div>
              <div className="topbar-profile-meta">
                <span className="topbar-profile-name">{displayName || "System Administrator"}</span>
                <span className="topbar-profile-role">{roleName || "Super Admin"}</span>
              </div>
              <svg
                className={`topbar-chevron-icon ${profileDropdownOpen ? "is-open" : ""}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Premium Super Admin Dropdown Menu */}
            <AnimatePresence>
              {profileDropdownOpen && (
                <motion.div
                  ref={profileDropdownRef}
                  className="topbar-profile-dropdown-menu"
                  role="menu"
                  aria-label="Administrator profile menu"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <div className="dropdown-identity-header">
                    <strong className="dropdown-identity-name">{displayName || "System Administrator"}</strong>
                    <span className="dropdown-identity-email">admin@careganga.org</span>
                    <span className="dropdown-role-tag">{roleName || "Super Admin"}</span>
                  </div>

                  <div className="dropdown-divider" role="separator" />

                  <Link
                    href="/admin"
                    className="dropdown-menu-link"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>My Profile</span>
                  </Link>

                  {settingsAccess && (
                    <Link
                      href="/admin/settings"
                      className="dropdown-menu-link"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      <span>Global Settings</span>
                    </Link>
                  )}

                  <div className="dropdown-divider" role="separator" />

                  <button
                    type="button"
                    className="dropdown-menu-link dropdown-signout-btn"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
}
