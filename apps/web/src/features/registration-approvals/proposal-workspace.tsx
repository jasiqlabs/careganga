"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CG03CaseView,
  CG03CaseDetail,
  CG03CaseOutcome,
  CG03Lookup,
  CG03OwnerOutcome,
  CG03Option,
  CG03ProcessView,
  DecisionActionType,
  ApprovalFilters,
  ApprovalStats,
  ActiveTab
} from "./registration-approvals-types";

import "./registration-approvals.css";

import {
  IconRefresh,
  IconPlus,
  IconFileText,
  IconLayers
} from "./registration-approvals-icons";
import {
  ApprovalStatsCardsSkeleton,
  ApprovalTableSkeleton,
  VersionProcessSkeleton
} from "./registration-approvals-skeletons";
import { SuccessModal, ErrorModal } from "./feedback-modals";
import { ApprovalStatsCards } from "./approval-stats-cards";
import { ApprovalFiltersPanel } from "./approval-filters-panel";
import { ApprovalTableView } from "./approval-table-view";
import { ApprovalPagination } from "./approval-pagination";
import { VersionProcessView } from "./version-process-view";
import { VersionProcessModal } from "./version-process-modal";
import { CreateApplicationModal } from "./create-application-modal";
import { ApplicationDetailView } from "./application-detail-view";
import { ReviewDecisionModal } from "./review-decision-modal";

const humanStatus = (v: string): string =>
  ({
    SUBMITTED: "Submitted for review",
    IN_REVIEW: "In review",
    RETURNED: "Returned for correction",
    REJECTED: "Rejected",
    FINAL_APPROVED: "Final decision recorded",
    PENDING_OWNER: "Applying approved access",
    OWNER_COMPLETED: "Access change confirmed",
    OWNER_BLOCKED: "Access changed; new review required",
    OWNER_FAILED_RETRYABLE: "Access change not confirmed"
  } as Record<string, string>)[v] ?? "Pending verification";

async function api<T>(path: string, method = "GET", body?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/approvals/" + path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error(method === "POST" ? "UNKNOWN" : "UNAVAILABLE");
  }
  if (response.status === 401) throw Error("EXPIRED");
  if (response.status === 403) throw Error("DENIED");
  if (response.status === 400) throw Error("INVALID");
  if (response.status === 409) {
    try {
      const value: unknown = await response.json();
      if (value && typeof value === "object" && "code" in value && typeof value.code === "string") {
        throw Error(value.code);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== "CONFLICT" && e.message !== "UNKNOWN") throw e;
    }
    throw Error("CONFLICT");
  }
  if (!response.ok) throw Error(method === "POST" ? "UNKNOWN" : "UNAVAILABLE");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error(method === "POST" ? "UNKNOWN" : "UNAVAILABLE");
  }
}

function explanation(error: unknown): string {
  const reason = error instanceof Error ? error.message : "UNKNOWN";
  return reason === "EXPIRED"
    ? "Your session expired. Sign in again."
    : reason === "DENIED"
    ? "Your current Foundation access does not permit this action."
    : reason === "INVALID"
    ? "Choose an eligible account and role before submitting."
    : reason === "REVIEWER_REQUIRED"
    ? "A second active Foundation Super Admin is required to review this request."
    : reason === "CORRECTION_REQUIRES_RETURN"
    ? "Only a returned request can be corrected. Refresh its status."
    : reason === "ACTIVE_CASE_EXISTS"
    ? "An active request already exists for this account. View the earlier application."
    : reason === "APPROVAL_REPLAY_CONFLICT"
    ? "This request was already used for another change. Refresh before editing."
    : reason === "CONFLICT"
    ? "An application or role changed elsewhere. Refresh before trying again."
    : "The result could not be confirmed. Check the original request before any retry.";
}

function validCase(x: unknown): x is CG03CaseView {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const v = x as Record<string, unknown>;
  return (
    typeof v.caseRef === "string" &&
    typeof v.reference === "string" &&
    typeof v.accountName === "string" &&
    typeof v.roleName === "string" &&
    typeof v.status === "string" &&
    Number.isInteger(v.revision)
  );
}

export interface ProposalWorkspaceProps {
  mayConfigure: boolean;
  mayPropose: boolean;
  mayReview: boolean;
  currentUserName?: string;
  currentUserRole?: string;
}

export function ProposalWorkspace({
  mayConfigure,
  mayPropose,
  mayReview
}: ProposalWorkspaceProps) {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("applications");

  // Primary data states
  const [cases, setCases] = useState<CG03CaseView[]>([]);
  const [process, setProcess] = useState<CG03ProcessView | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [filters, setFilters] = useState<ApprovalFilters>({
    searchQuery: "",
    statusFilter: "all",
    roleFilter: "all",
    reviewerFilter: "all",
    dateFrom: "",
    dateTo: ""
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedCaseRefs, setSelectedCaseRefs] = useState<Set<string>>(new Set());

  // Modal feedback popups
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
  }>({ isOpen: false, title: "", description: "" });

  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", description: "" });

  // Creation drawer/modal states
  const [creating, setCreating] = useState(false);
  const [accountQuery, setAccountQuery] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [accounts, setAccounts] = useState<CG03Option[]>([]);
  const [roles, setRoles] = useState<CG03Option[]>([]);
  const [account, setAccount] = useState("");
  const [role, setRole] = useState("");
  const [previousCase, setPreviousCase] = useState<string | null>(null);

  // Version process states
  const [editingProcess, setEditingProcess] = useState(false);
  const [firstReviewer, setFirstReviewer] = useState<"NONE" | "ACCESS_MANAGER">("NONE");
  const [currentPassword, setCurrentPassword] = useState("");

  // Detail view states
  const [detail, setDetail] = useState<CG03CaseDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [ownerOutcome, setOwnerOutcome] = useState<CG03OwnerOutcome | null>(null);
  const [ownerBusy, setOwnerBusy] = useState(false);

  // Review decision states
  const [decisionAction, setDecisionAction] = useState<DecisionActionType | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [decisionPassword, setDecisionPassword] = useState("");
  const [reviewConfirmOpen, setReviewConfirmOpen] = useState(false);
  const [decisionUnknown, setDecisionUnknown] = useState(false);
  const decisionKey = useRef("");

  // Recovery & Idempotency refs
  const [unknown, setUnknown] = useState(false);
  const [pendingKind, setPendingKind] = useState<"CASE" | "PROCESS">("CASE");
  const key = useRef("");
  const generation = useRef(0);
  const detailSeq = useRef(0);

  // Refresh data from API
  const refresh = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const [records, route] = await Promise.all([
        api<{ cases: unknown[] }>("cases?limit=30"),
        api<CG03ProcessView>("process")
      ]);
      if (
        !Array.isArray(records.cases) ||
        !records.cases.every(validCase) ||
        !route ||
        typeof route.version !== "number"
      ) {
        throw Error("UNAVAILABLE");
      }
      if (seq !== generation.current) return;
      setCases(records.cases);
      setProcess(route);
    } catch (e) {
      if (seq !== generation.current) return;
      setCases([]);
      setProcess(null);
      setErrorModal({
        isOpen: true,
        title: "Unable to Load Applications",
        description: explanation(e)
      });
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      ++generation.current;
      ++detailSeq.current;
    };
  }, [refresh]);

  // Search accounts & roles for creation
  async function search(kind: "account" | "role", q: string) {
    if (q.length > 70) return;
    try {
      const data = await api<{ options: CG03Option[] }>(
        "options/" + kind + "?search=" + encodeURIComponent(q)
      );
      if (!Array.isArray(data.options) || data.options.length > 30) throw Error("UNAVAILABLE");
      if (kind === "account") setAccounts(data.options);
      else setRoles(data.options);
    } catch (e) {
      if (kind === "account") setAccounts([]);
      else setRoles([]);
      setErrorModal({
        isOpen: true,
        title: "Lookup Failed",
        description: explanation(e)
      });
    }
  }

  function begin(previous?: CG03CaseView) {
    if (busy || unknown || !mayPropose) return;
    key.current = crypto.randomUUID();
    setPendingKind("CASE");
    setPreviousCase(previous?.caseRef ?? null);
    setAccount("");
    setRole("");
    setAccounts([]);
    setRoles([]);
    setAccountQuery(previous?.accountName ?? "");
    setRoleQuery("");
    setCreating(true);
    void search("account", "");
    void search("role", "");
  }

  async function submitCreateApplication(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || unknown || !account || !role) return;
    setBusy(true);
    try {
      const result = await api<CG03CaseOutcome>("cases", "POST", {
        targetAccountRef: account,
        targetRoleRef: role,
        requestKey: key.current,
        ...(previousCase ? { previousCaseRef: previousCase } : {})
      });
      if (!validCase(result)) throw Error("UNKNOWN");
      setCreating(false);
      key.current = "";
      setPreviousCase(null);
      setSuccessModal({
        isOpen: true,
        title: "Application Submitted Successfully!",
        description: `${result.reference} submitted for protected review. Current account and role revisions have been securely frozen.`
      });
      await refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "UNKNOWN") setUnknown(true);
      setErrorModal({
        isOpen: true,
        title: "Unable to Submit Application",
        description: explanation(error)
      });
    } finally {
      setBusy(false);
    }
  }

  // Idempotency resolution for timeout cases
  async function resolvePendingCommand() {
    if (!key.current || !unknown || busy) return;
    setBusy(true);
    try {
      if (pendingKind === "CASE") {
        const result = await api<CG03Lookup>(
          "cases/requests/" + encodeURIComponent(key.current)
        );
        if (result.status === "CONFIRMED" && result.case) {
          setUnknown(false);
          setCreating(false);
          key.current = "";
          setSuccessModal({
            isOpen: true,
            title: "Application Confirmed",
            description: `${result.case.reference} is recorded. No access change has been applied.`
          });
          await refresh();
        } else {
          setErrorModal({
            isOpen: true,
            title: "Unconfirmed Submission",
            description: "No committed result is visible. Ask Foundation support before sending another request."
          });
        }
      } else {
        const prior = await api<{ status: string; version: number | null }>(
          "process/changes/" + encodeURIComponent(key.current)
        );
        if (prior.status === "CONFIRMED" && Number.isInteger(prior.version)) {
          const active = await api<CG03ProcessView>("process");
          if (active.version < Number(prior.version)) throw Error("UNAVAILABLE");
          setProcess(active);
          setUnknown(false);
          setEditingProcess(false);
          key.current = "";
          setSuccessModal({
            isOpen: true,
            title: "Process Version Confirmed",
            description: "The original process change is confirmed. Older cases keep their pinned route."
          });
        } else {
          setErrorModal({
            isOpen: true,
            title: "Process Change Unconfirmed",
            description: "No committed process change is visible. Ask Foundation support before a new attempt."
          });
        }
      }
    } catch (e) {
      setErrorModal({
        isOpen: true,
        title: "Verification Error",
        description: explanation(e)
      });
    } finally {
      setBusy(false);
    }
  }

  // View Case Details
  async function viewCase(entry: CG03CaseView) {
    const seq = ++detailSeq.current;
    setDetailBusy(true);
    setDetail(null);
    setIsDetailOpen(true);
    setOwnerOutcome(null);
    setDecisionAction(null);
    setDecisionRemarks("");
    setDecisionPassword("");
    setReviewConfirmOpen(false);

    try {
      const data = await api<CG03CaseDetail>("cases/" + encodeURIComponent(entry.caseRef));
      if (seq !== detailSeq.current) return;
      if (!validCase(data) || !Array.isArray(data.history) || !Array.isArray(data.allowedDecisions)) {
        throw Error("UNAVAILABLE");
      }
      setDetail(data);

      if (["PENDING_OWNER", "OWNER_COMPLETED", "OWNER_BLOCKED", "OWNER_FAILED_RETRYABLE"].includes(data.status)) {
        try {
          const status = await api<CG03OwnerOutcome>(
            "cases/" + encodeURIComponent(data.caseRef) + "/owner-status"
          );
          if (
            seq === detailSeq.current &&
            ["PENDING_OWNER", "OWNER_COMPLETED", "OWNER_BLOCKED", "OWNER_FAILED_RETRYABLE"].includes(status.status)
          ) {
            setOwnerOutcome(status);
          }
        } catch {
          // Non-blocking informational notice
        }
      }
    } catch (e) {
      if (seq === detailSeq.current) {
        setErrorModal({
          isOpen: true,
          title: "Unable to Load Application",
          description: explanation(e)
        });
      }
    } finally {
      if (seq === detailSeq.current) setDetailBusy(false);
    }
  }

  // Request Decision Review (opens confirmation modal)
  function handleRequestDecisionReview(
    action: DecisionActionType,
    remarksText: string,
    passwordText: string
  ) {
    setDecisionAction(action);
    setDecisionRemarks(remarksText);
    setDecisionPassword(passwordText);
    if (!decisionKey.current) {
      decisionKey.current = crypto.randomUUID();
    }
    setReviewConfirmOpen(true);
  }

  // Commit Decision after reviewer confirmation in ReviewDecisionModal
  async function commitDecision() {
    if (!detail || !decisionAction || !detail.allowedDecisions.includes(decisionAction) || decisionUnknown || busy) {
      return;
    }
    setBusy(true);

    try {
      const result = await api<{ status: string; revision: number }>(
        "cases/" + encodeURIComponent(detail.caseRef) + "/decisions",
        "POST",
        {
          action: decisionAction,
          remarks: decisionRemarks.trim(),
          expectedRevision: detail.revision,
          requestKey: decisionKey.current,
          currentPassword: decisionPassword
        }
      );
      if (!Number.isInteger(result.revision)) throw Error("UNKNOWN");

      const savedCase = detail;
      setReviewConfirmOpen(false);
      setDecisionAction(null);
      setDecisionPassword("");
      decisionKey.current = "";

      const actionLabel =
        decisionAction === "APPROVE"
          ? "approved"
          : decisionAction === "REJECT"
          ? "rejected"
          : decisionAction === "RETURN"
          ? "returned for correction"
          : "forwarded";

      setSuccessModal({
        isOpen: true,
        title: "Decision Submitted Successfully!",
        description: `Application ${savedCase.reference} has been ${actionLabel} and moved to the next step. Status: ${humanStatus(result.status)}.`
      });

      await refresh();
      await viewCase(savedCase);
    } catch (error) {
      if (error instanceof Error && error.message === "UNKNOWN") {
        setDecisionUnknown(true);
      }
      setReviewConfirmOpen(false);
      setErrorModal({
        isOpen: true,
        title: "Unable to Submit Decision",
        description: explanation(error),
        onRetry: () => setReviewConfirmOpen(true)
      });
    } finally {
      setBusy(false);
    }
  }

  async function verifyDecision() {
    if (!detail || !decisionUnknown || !decisionKey.current || busy) return;
    setBusy(true);
    try {
      const result = await api<{ status: string; revision: number | null }>(
        "cases/" +
          encodeURIComponent(detail.caseRef) +
          "/decisions/requests/" +
          encodeURIComponent(decisionKey.current)
      );
      if (result.status === "CONFIRMED" && Number.isInteger(result.revision)) {
        const original = detail;
        setDecisionUnknown(false);
        setDecisionAction(null);
        decisionKey.current = "";
        setSuccessModal({
          isOpen: true,
          title: "Decision Confirmed",
          description: "Original review decision confirmed. No duplicate was submitted."
        });
        await refresh();
        await viewCase(original);
      } else {
        setErrorModal({
          isOpen: true,
          title: "Unconfirmed Decision",
          description: "No decision is confirmed. Contact Foundation support before retrying."
        });
      }
    } catch (error) {
      setErrorModal({
        isOpen: true,
        title: "Verification Error",
        description: explanation(error)
      });
    } finally {
      setBusy(false);
    }
  }

  async function retryOwnerEffect() {
    if (!detail || !mayReview || !ownerOutcome?.canRetry || ownerBusy) return;
    setOwnerBusy(true);
    try {
      const result = await api<{ status: string }>(
        "cases/" + encodeURIComponent(detail.caseRef) + "/retry-owner",
        "POST"
      );
      const original = detail;
      if (result.status === "OWNER_COMPLETED") {
        setSuccessModal({
          isOpen: true,
          title: "Role Assignment Confirmed",
          description: "The original CG-01 role assignment is confirmed in the account ledger."
        });
      } else {
        setErrorModal({
          isOpen: true,
          title: "Access Change Status",
          description:
            result.status === "OWNER_BLOCKED"
              ? "Source revisions changed. A new proposal and review are required."
              : "The original access effect is still unconfirmed. No second grant was attempted."
        });
      }
      await refresh();
      await viewCase(original);
    } catch (e) {
      setErrorModal({
        isOpen: true,
        title: "Recheck Failed",
        description: explanation(e)
      });
    } finally {
      setOwnerBusy(false);
    }
  }

  // Version Process Submission
  async function submitProcessVersion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || unknown) return;
    if (currentPassword.length < 8 || currentPassword.length > 1024) {
      setErrorModal({
        isOpen: true,
        title: "Password Required",
        description: "Please enter your current Foundation password (minimum 8 characters)."
      });
      return;
    }
    if (!key.current) key.current = crypto.randomUUID();
    setPendingKind("PROCESS");
    setBusy(true);
    try {
      await api<{ version: number }>("process/versions", "POST", {
        firstReviewerCapability: firstReviewer === "NONE" ? null : "roles.assign",
        requestKey: key.current,
        currentPassword
      });
      setEditingProcess(false);
      setCurrentPassword("");
      key.current = "";
      setSuccessModal({
        isOpen: true,
        title: "Process Versioned Successfully!",
        description:
          "The new review process version is active. Earlier applications keep their original route."
      });
      await refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "UNKNOWN") setUnknown(true);
      setErrorModal({
        isOpen: true,
        title: "Unable to Version Process",
        description: explanation(error)
      });
    } finally {
      setBusy(false);
    }
  }

  // Computed summary statistics from loaded cases
  const stats: ApprovalStats = useMemo(() => {
    return {
      total: cases.length,
      awaitingReview: cases.filter((c) => c.status === "SUBMITTED").length,
      inReview: cases.filter((c) => c.status === "IN_REVIEW").length,
      approved: cases.filter((c) => ["FINAL_APPROVED", "OWNER_COMPLETED"].includes(c.status)).length,
      rejected: cases.filter((c) => c.status === "REJECTED").length
    };
  }, [cases]);

  // Distinct roles for filter dropdown
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      if (c.roleName) set.add(c.roleName);
    });
    return Array.from(set).sort();
  }, [cases]);

  // Client-side filtering
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Inline Search
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesRef = c.reference.toLowerCase().includes(q);
        const matchesAcc = c.accountName.toLowerCase().includes(q);
        const matchesRole = c.roleName.toLowerCase().includes(q);
        if (!matchesRef && !matchesAcc && !matchesRole) return false;
      }

      // Status Filter
      if (filters.statusFilter !== "all") {
        if (filters.statusFilter === "FINAL_APPROVED") {
          if (c.status !== "FINAL_APPROVED" && c.status !== "OWNER_COMPLETED") return false;
        } else if (c.status !== filters.statusFilter) {
          return false;
        }
      }

      // Role Filter
      if (filters.roleFilter !== "all") {
        if (c.roleName !== filters.roleFilter) return false;
      }

      // Date Range Filter
      if (filters.dateFrom) {
        const fromTime = new Date(filters.dateFrom).getTime();
        const itemTime = new Date(c.submittedAt).getTime();
        if (itemTime < fromTime) return false;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        const toTime = toDate.getTime();
        const itemTime = new Date(c.submittedAt).getTime();
        if (itemTime > toTime) return false;
      }

      return true;
    });
  }, [cases, filters]);

  // Client-side pagination
  const pagedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCases.slice(startIndex, startIndex + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  // Reset page when filters change
  function handleFilterChange(newFilters: Partial<ApprovalFilters>) {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }

  function handleResetFilters() {
    setFilters({
      searchQuery: "",
      statusFilter: "all",
      roleFilter: "all",
      reviewerFilter: "all",
      dateFrom: "",
      dateTo: ""
    });
    setCurrentPage(1);
  }

  // Selection handlers
  function handleToggleSelectAll() {
    if (selectedCaseRefs.size === pagedCases.length) {
      setSelectedCaseRefs(new Set());
    } else {
      setSelectedCaseRefs(new Set(pagedCases.map((c) => c.caseRef)));
    }
  }

  function handleToggleSelectCase(caseRef: string) {
    setSelectedCaseRefs((prev) => {
      const next = new Set(prev);
      if (next.has(caseRef)) next.delete(caseRef);
      else next.add(caseRef);
      return next;
    });
  }

  return (
    <div className="cg-ra-workspace">
      {/* Timed-out unknown submission warning banner */}
      {unknown && (
        <div className="cg-ra-banner error" role="alert">
          <div>
            <strong>Previous submission needs checking:</strong> A timed-out request may have been saved. Do not send a duplicate.
          </div>
          <button
            type="button"
            className="cg-ra-btn-secondary"
            disabled={busy}
            onClick={() => void resolvePendingCommand()}
          >
            {busy ? "Checking…" : "Check Previous Submission"}
          </button>
        </div>
      )}

      {/* Top Action Row matching Wireframe: Segmented Tabs on Left, Actions on Right */}
      <div className="cg-ra-workspace-top-row">
        {/* Segmented Tabs: Applications & Version Process */}
        <div className="cg-ra-segmented-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "applications"}
            className={`cg-ra-segment-btn ${activeTab === "applications" ? "active" : ""}`}
            onClick={() => setActiveTab("applications")}
          >
            <IconFileText size={17} className="tab-icon" />
            <span>Applications</span>
            <span className="cg-ra-segment-badge">{cases.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "versionProcess"}
            className={`cg-ra-segment-btn ${activeTab === "versionProcess" ? "active" : ""}`}
            onClick={() => setActiveTab("versionProcess")}
          >
            <IconLayers size={17} className="tab-icon" />
            <span>Version Process</span>
            <span className="cg-ra-segment-badge">{process?.version ?? 3}</span>
          </button>
        </div>

        {/* Top Actions: Refresh & Request Protected Role Access */}
        <div className="cg-ra-top-actions">
          <button
            type="button"
            className="cg-ra-btn-refresh"
            disabled={busy || loading || unknown}
            onClick={() => void refresh()}
            title="Refresh verified applications"
          >
            <IconRefresh size={16} className={loading ? "spinning" : ""} />
            <span>{loading ? "Refreshing…" : "Refresh"}</span>
          </button>

          {mayPropose && (
            <button
              type="button"
              className="cg-ra-btn-request"
              disabled={busy || unknown}
              onClick={() => begin()}
            >
              <IconPlus size={16} /> Request Protected Role Access
            </button>
          )}
        </div>
      </div>

      {/* TAB A: Applications View */}
      {activeTab === "applications" && (
        <>
          {/* Summary KPI Cards (5 Cards) */}
          {loading ? (
            <>
              <p role="status" className="cg-module-loading">Checking verified applications…</p>
              <ApprovalStatsCardsSkeleton />
            </>
          ) : (
            <ApprovalStatsCards
              stats={stats}
              selectedStatusFilter={filters.statusFilter}
              onSelectStatus={(status) => handleFilterChange({ statusFilter: status })}
            />
          )}

          {/* Filters Bar with Inline Search */}
          <ApprovalFiltersPanel
            filters={filters}
            onChangeFilters={handleFilterChange}
            onResetFilters={handleResetFilters}
            availableRoles={availableRoles}
          />

          {/* Application Table View */}
          {loading ? (
            <ApprovalTableSkeleton />
          ) : (
            <ApprovalTableView
              cases={pagedCases}
              loading={loading}
              selectedCaseRefs={selectedCaseRefs}
              onToggleSelectAll={handleToggleSelectAll}
              onToggleSelectCase={handleToggleSelectCase}
              onViewCase={(c) => void viewCase(c)}
              onCorrectCase={(c) => begin(c)}
              mayPropose={mayPropose}
              hasFirstReviewerStep={Boolean(process?.firstReviewer)}
            />
          )}

          {/* Pagination Bar */}
          <ApprovalPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalRecords={filteredCases.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* TAB B: Version Process View */}
      {activeTab === "versionProcess" && (
        <>
          {loading ? (
            <VersionProcessSkeleton />
          ) : (
            <VersionProcessView
              process={process}
              loading={loading}
              mayConfigure={mayConfigure}
              onOpenVersionModal={() => {
                setEditingProcess(true);
                key.current = crypto.randomUUID();
                setCurrentPassword("");
                setFirstReviewer(process?.firstReviewer ? "ACCESS_MANAGER" : "NONE");
              }}
            />
          )}
        </>
      )}

      {/* Create Application Modal (Panel 2) */}
      <CreateApplicationModal
        isOpen={creating}
        busy={busy}
        isCorrection={Boolean(previousCase)}
        accountQuery={accountQuery}
        onAccountQueryChange={(q) => {
          setAccountQuery(q);
          setAccount("");
          void search("account", q);
        }}
        roleQuery={roleQuery}
        onRoleQueryChange={(q) => {
          setRoleQuery(q);
          setRole("");
          void search("role", q);
        }}
        accounts={accounts}
        roles={roles}
        selectedAccount={account}
        onSelectAccount={setAccount}
        selectedRole={role}
        onSelectRole={setRole}
        onSubmit={(e) => void submitCreateApplication(e)}
        onClose={() => setCreating(false)}
      />

      {/* Version Process Modal */}
      {mayConfigure && (
        <VersionProcessModal
          isOpen={editingProcess}
          busy={busy}
          firstReviewer={firstReviewer}
          onFirstReviewerChange={setFirstReviewer}
          currentPassword={currentPassword}
          onCurrentPasswordChange={setCurrentPassword}
          onSubmit={(e) => void submitProcessVersion(e)}
          onClose={() => setEditingProcess(false)}
        />
      )}

      {/* Application Detail Screen (Panel 3) */}
      <ApplicationDetailView
        isOpen={isDetailOpen}
        detail={detail}
        detailBusy={detailBusy}
        ownerOutcome={ownerOutcome}
        ownerBusy={ownerBusy}
        decisionUnknown={decisionUnknown}
        busy={busy}
        mayReview={mayReview}
        onClose={() => {
          setIsDetailOpen(false);
          setDetail(null);
          setDetailBusy(false);
          ++detailSeq.current;
        }}
        onRefreshCase={() => {
          if (detail) void viewCase(detail);
        }}
        onVerifyDecision={() => void verifyDecision()}
        onRetryOwner={() => void retryOwnerEffect()}
        onRequestDecisionReview={handleRequestDecisionReview}
      />

      {/* Step 4: Review Decision Confirmation Modal (Panel 4) */}
      <ReviewDecisionModal
        isOpen={reviewConfirmOpen}
        busy={busy}
        detail={detail}
        selectedAction={decisionAction}
        remarks={decisionRemarks}
        hasPasswordProof={Boolean(decisionPassword && decisionPassword.length >= 8)}
        onConfirmSubmit={() => void commitDecision()}
        onCancel={() => setReviewConfirmOpen(false)}
      />

      {/* Reusable Success Popup (Panel 5) */}
      <SuccessModal
        isOpen={successModal.isOpen}
        title={successModal.title}
        description={successModal.description}
        onClose={() => setSuccessModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Reusable Error Popup (Panel 5) */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        description={errorModal.description}
        onRetry={errorModal.onRetry}
        onClose={() => setErrorModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
