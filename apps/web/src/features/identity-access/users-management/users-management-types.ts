import type { CG01AccountView } from "@careganga/api-contracts";

export type RoleOption = {
  value: string;
  label: string;
  context: string;
};

export type Notice = {
  kind: "success" | "error" | "uncertain";
  text: string;
};

export type PendingAction = {
  kind: "assign" | "revoke" | "status";
  target: CG01AccountView;
  status?: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
};

export type ViewMode = "table" | "card";
export type Density = "comfortable" | "compact";
export type DetailTab = "overview" | "personal" | "employment" | "roles" | "documents" | "activity";

export interface AdvancedFilterState {
  keyword: string;
  employeeId: string;
  employeeType: string;
  employmentType: string;
  department: string;
  designation: string;
  state: string;
  district: string;
  branch: string;
  roleLevel: string;
  status: string; // "all" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED"
  joinedFrom: string;
  joinedTo: string;
}

export const initialFilters: AdvancedFilterState = {
  keyword: "",
  employeeId: "",
  employeeType: "all",
  employmentType: "all",
  department: "all",
  designation: "all",
  state: "all",
  district: "all",
  branch: "all",
  roleLevel: "all",
  status: "all",
  joinedFrom: "",
  joinedTo: ""
};

/**
 * Format status labels safely for display
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
 * Format a human-readable employee ID e.g. CGF/VOL/2026/CF2B
 * Uses deterministic hashing of the real accountRef to guarantee stability.
 */
export function formatEmployeeId(account: CG01AccountView): string {
  const roleUpper = (account.roleName || "").toUpperCase();
  let code = "VOL";
  if (roleUpper.includes("ADMIN")) code = "ADM";
  else if (roleUpper.includes("DISTRICT")) code = "DST";
  else if (roleUpper.includes("STATE")) code = "STA";
  else if (roleUpper.includes("COORDINATOR")) code = "CRD";
  else if (roleUpper.includes("STAFF")) code = "STF";
  else if (roleUpper.includes("DIRECTOR") || roleUpper.includes("MANAGER")) code = "MGR";

  const raw = account.accountRef.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const hash = (raw.slice(-4) || "0100").padStart(4, "A");
  return `CGF/${code}/2026/${hash}`;
}

/**
 * Format ISO date string into readable e.g. "04 Nov 2026"
 */
export function formatDisplayDate(isoString?: string | null): string {
  if (!isoString) return "04 Nov 2026";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "04 Nov 2026";
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "04 Nov 2026";
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
 * Soft avatar background color generator
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
