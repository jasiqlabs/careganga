import type { CG01AccountView } from "@careganga/api-contracts";

export type RoleOption = {
  value: string;
  label: string;
  context: string;
};

export type UserNotice = {
  kind: "success" | "error" | "uncertain";
  text: string;
};

export type PendingUserAction = {
  kind: "assign" | "revoke" | "status";
  row: CG01AccountView;
  status?: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
};

export type UserTab = "users" | "create" | "history";
export type DetailTab = "overview" | "personal" | "employment" | "roles" | "documents" | "activity";

export interface UserInternalNote {
  id: string;
  text: string;
  createdAt: string;
  author: string;
}

/**
 * Display human business status words, never raw wire codes.
 */
export function accountStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "SUSPENDED":
      return "Suspended";
    case "DEACTIVATED":
      return "Deactivated";
    default:
      return "Status unavailable";
  }
}

/**
 * Format audit outcome labels safely for display
 */
export function auditOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "Confirmed":
      return "Completed";
    case "Denied":
      return "Not permitted";
    case "Pending":
      return "Awaiting confirmation";
    default:
      return "Outcome unavailable";
  }
}

/**
 * Authoritative employee identifier helper.
 * Returns verified employee ID if present on the account record, or a neutral fallback.
 * Never invents fabricated deterministic strings.
 */
export function formatEmployeeId(account: CG01AccountView, fallback = "Not assigned"): string {
  const customId =
    (account as unknown as { employeeId?: string; staffId?: string }).employeeId ||
    (account as unknown as { employeeId?: string; staffId?: string }).staffId;
  if (typeof customId === "string" && customId.trim()) {
    return customId.trim();
  }
  return fallback;
}

/**
 * Format ISO date string into readable e.g. "19 Nov 2026"
 */
export function formatDisplayDate(isoString?: string | null, fallback = "—"): string {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Format ISO date string into readable e.g. "19 Nov 2026, 06:11 PM"
 */
export function formatDisplayDateTime(isoString?: string | null, fallback = "—"): string {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, "0");
    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return fallback;
  }
}

/**
 * Format relative elapsed time e.g. "5 hr ago" or "Just now"
 */
export function formatRelativeTime(isoString?: string | null, fallback = "—"): string {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays} days ago`;
    return formatDisplayDate(isoString, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Get initials from display name
 */
export function getInitials(name?: string | null): string {
  if (!name) return "CG";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Soft avatar background color generator matching Web design system
 */
export function getAvatarColor(name?: string | null): { bg: string; text: string } {
  const colors = [
    { bg: "#EFF6FF", text: "#1D4ED8" }, // blue
    { bg: "#F5F3FF", text: "#6D28D9" }, // purple
    { bg: "#ECFDF5", text: "#047857" }, // emerald
    { bg: "#FFFBEB", text: "#B45309" }, // amber
    { bg: "#F0FDF4", text: "#15803D" }, // green
    { bg: "#ECFEFF", text: "#0E7490" }, // cyan
    { bg: "#0F172A", text: "#FFFFFF" }  // dark
  ];
  if (!name) return colors[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}
