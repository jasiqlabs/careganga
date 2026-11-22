import type {
  CG03CaseView,
  CG03CaseDetail,
  CG03CaseOutcome,
  CG03Lookup,
  CG03OwnerOutcome,
  CG03Option,
  CG03ProcessView
} from "@careganga/api-contracts";

export type {
  CG03CaseView,
  CG03CaseDetail,
  CG03CaseOutcome,
  CG03Lookup,
  CG03OwnerOutcome,
  CG03Option,
  CG03ProcessView
};

export type DecisionActionType = "APPROVE" | "RETURN" | "REJECT" | "FORWARD";

export interface ApprovalFilters {
  searchQuery: string;
  statusFilter: string;
  roleFilter: string;
  reviewerFilter: string;
  dateFrom: string;
  dateTo: string;
}

export interface ApprovalStats {
  total: number;
  awaitingReview: number;
  inReview: number;
  approved: number;
  rejected: number;
}

export interface FeedbackMessage {
  kind: "error" | "info" | "success";
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export type ActiveTab = "applications" | "versionProcess";
