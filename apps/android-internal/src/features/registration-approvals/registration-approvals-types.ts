import type { CG03CaseView, CG03CaseDetail, CG03Lookup, CG03Option, CG03ProcessView, CG03OwnerOutcome } from "@careganga/api-contracts";

export type ScreenMode = "HOME" | "CREATE" | "DETAIL" | "REVIEW_DECISION" | "PROCESS_CONFIG";
export type HomeTab = "APPLICATIONS" | "PROCESS";
export type DetailTab = "OVERVIEW" | "HISTORY";
export type DecisionAction = "APPROVE" | "FORWARD" | "RETURN" | "REJECT";

export interface ApprovalFilters {
  search: string;
  status: string;
  role: string;
}

export interface FeedbackModalState {
  type: "SUCCESS" | "ERROR" | "UNCERTAIN" | null;
  title: string;
  message: string;
  caseRef?: string;
  canRetry?: boolean;
}

export interface ReviewConfirmModalState {
  visible: boolean;
  action: DecisionAction | null;
  remarks: string;
}

/** Human-friendly status label */
export function friendlyStatus(status: string): string {
  const map: Record<string, string> = {
    SUBMITTED: "Submitted for review",
    IN_REVIEW: "In Review",
    RETURNED: "Returned for correction",
    REJECTED: "Rejected",
    FINAL_APPROVED: "Final decision approved",
    PENDING_OWNER: "Applying access changes",
    OWNER_COMPLETED: "Access change confirmed",
    OWNER_BLOCKED: "New approval required",
    OWNER_FAILED_RETRYABLE: "Awaiting source verification"
  };
  return map[status] ?? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Semantic chip styling matching CareGanga design system */
export function getStatusChipTheme(status: string): { bg: string; text: string; dot: string; border: string } {
  switch (status) {
    case "SUBMITTED":
      return { bg: "#FEF3C7", text: "#92400E", dot: "#D97706", border: "#FDE68A" };
    case "IN_REVIEW":
      return { bg: "#EFF6FF", text: "#1E40AF", dot: "#2563EB", border: "#BFDBFE" };
    case "RETURNED":
      return { bg: "#FFF7ED", text: "#C2410C", dot: "#EA580C", border: "#FED7AA" };
    case "FINAL_APPROVED":
    case "OWNER_COMPLETED":
      return { bg: "#ECFDF5", text: "#065F46", dot: "#059669", border: "#A7F3D0" };
    case "REJECTED":
    case "OWNER_BLOCKED":
      return { bg: "#FEF2F2", text: "#991B1B", dot: "#DC2626", border: "#FECACA" };
    case "PENDING_OWNER":
    case "OWNER_FAILED_RETRYABLE":
      return { bg: "#F5F3FF", text: "#5B21B6", dot: "#7C3AED", border: "#DDD6FE" };
    default:
      return { bg: "#F1F5F9", text: "#475569", dot: "#64748B", border: "#E2E8F0" };
  }
}
