"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type {
  CG21RecoveryAvailability,
  CG21RecoveryOperation,
  CG21RecoveryOutcome
} from "@careganga/api-contracts";
import {
  ShieldIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  LayersIcon,
  ClockIcon,
  SettingsIcon,
  SearchIcon,
  FilterIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  XCircleIcon,
  FileTextIcon,
  UserIcon,
  CalendarIcon,
  ServerIcon,
  DatabaseIcon,
  SendIcon,
  LockIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  XIcon
} from "./recovery-icons";
import "./backup-recovery.css";

type Feedback = {
  kind: "error" | "info" | "success" | "uncertain";
  message: string;
};

async function call<T>(path: string, method = "GET", body?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/platform/" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error("UNKNOWN");
  }
  if (response.status === 401 || response.status === 403) throw Error("DENIED");
  if (response.status === 400) throw Error("VALIDATION");
  if (response.status === 409) throw Error("CONFLICT");
  if (response.status === 429) throw Error("RATE_LIMITED");
  if (!response.ok) throw Error("UNKNOWN");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

function describe(e: unknown): string {
  const reason = e instanceof Error ? e.message : "UNKNOWN";
  return reason === "DENIED"
    ? "Your recovery permissions expired. Sign in again."
    : reason === "VALIDATION"
    ? "Check the secured backup reference and current password."
    : reason === "CONFLICT"
    ? "This recovery request changed. Verify the earlier request."
    : reason === "RATE_LIMITED"
    ? "Too many proof attempts. Try again later."
    : "The recovery request outcome could not be verified. Check its original reference before retrying.";
}

function stateLabel(s: string): string {
  return (
    ({
      REQUESTED: "Request recorded, not executed",
      PRIVILEGED_AUTHORIZED: "Privileged authorization recorded",
      RUNNING: "Execution reported (proof required)",
      VERIFIED_SUCCEEDED: "Independently verified",
      FAILED: "Failed",
      UNKNOWN: "Outcome unconfirmed"
    } as Record<string, string>)[s] ?? "Unverified recovery status"
  );
}

function formatRequestRef(ref: string): string {
  if (!ref) return "REC-0000";
  const cleaned = ref.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `REC-${cleaned.slice(0, 4) || "0001"}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return "—";
  }
}

export function RecoveryPanel() {
  const prefersReducedMotion = useReducedMotion();

  // Core Backend State (Preserved 100%)
  const [availability, setAvailability] = useState<CG21RecoveryAvailability | null>(null);
  const [operations, setOperations] = useState<CG21RecoveryOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [notice, setNotice] = useState<Feedback | null>(null);
  const [backupReference, setBackupReference] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [review, setReview] = useState(false);
  const [authorization, setAuthorization] = useState<CG21RecoveryOperation | null>(null);
  const [authorizationPassword, setAuthorizationPassword] = useState("");
  const [authorizationReview, setAuthorizationReview] = useState(false);

  const pendingKind = useRef<"REQUEST" | "AUTHORIZE">("REQUEST");
  const requestKey = useRef("");
  const generation = useRef(0);

  // Additional Presentation State for Premium Wireframe
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "config">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawers
  const [isRequestDrawerOpen, setIsRequestDrawerOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<CG21RecoveryOperation | null>(null);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [requestOperationType, setRequestOperationType] = useState<"RESTORE" | "BACKUP">("RESTORE");
  const [requestReason, setRequestReason] = useState("");

  // Data Fetching
  const read = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const [avail, history] = await Promise.all([
        call<CG21RecoveryAvailability>("recovery/availability"),
        call<{ operations: CG21RecoveryOperation[] }>("recovery/operations")
      ]);
      if (
        !["AVAILABLE", "NOT_AVAILABLE"].includes(avail.status) ||
        !Array.isArray(history.operations) ||
        history.operations.length > 30
      ) {
        throw Error("UNKNOWN");
      }
      if (seq !== generation.current) return;
      setAvailability(avail);
      setOperations(history.operations);
    } catch (e) {
      if (seq !== generation.current) return;
      setAvailability(null);
      setOperations([]);
      setNotice({ kind: "error", message: describe(e) });
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void read();
    return () => {
      ++generation.current;
    };
  }, [read]);

  // Request Recovery Handler
  async function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || unknown || availability?.status !== "AVAILABLE") return;
    if (
      !/^backupref:[A-Za-z0-9/_-]{6,170}$/.test(backupReference) ||
      currentPassword.length < 8 ||
      currentPassword.length > 1024
    ) {
      setNotice({
        kind: "error",
        message: "Enter a secured backup reference (backupref:...) and current password."
      });
      return;
    }
    if (!review) {
      setReview(true);
      return;
    }
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    pendingKind.current = "REQUEST";
    setSaving(true);
    setNotice(null);
    try {
      const outcome = await call<CG21RecoveryOutcome>("recovery/request", "POST", {
        backupReference,
        expectedVersion: 0,
        requestKey: requestKey.current,
        currentPassword
      });
      if (outcome.status === "NOT_AVAILABLE") {
        setNotice({
          kind: "info",
          message: "No independently verified backup is available. No recovery request was created."
        });
        return;
      }
      if (!["REQUESTED", "REPLAY_CONFIRMED"].includes(outcome.status)) throw Error("UNKNOWN");
      setBackupReference("");
      setCurrentPassword("");
      setRequestReason("");
      setReview(false);
      requestKey.current = "";
      setIsRequestDrawerOpen(false);
      setNotice({
        kind: "success",
        message: "Recovery request recorded. No restore has been started or completed."
      });
      await read();
    } catch (err) {
      if (err instanceof Error && err.message === "UNKNOWN") setUnknown(true);
      setNotice({ kind: "error", message: describe(err) });
    } finally {
      setSaving(false);
    }
  }

  // Uncertain Request Recovery Verification
  async function verifyPrevious() {
    if (!unknown || !requestKey.current || saving) return;
    setSaving(true);
    try {
      const endpoint =
        pendingKind.current === "AUTHORIZE" ? "recovery/authorization/changes/" : "recovery/changes/";
      const result = await call<{ status: string; operationStatus?: string }>(
        endpoint + encodeURIComponent(requestKey.current)
      );
      if (result.status === "CONFIRMED") {
        setUnknown(false);
        requestKey.current = "";
        setReview(false);
        setBackupReference("");
        setCurrentPassword("");
        setRequestReason("");
        setAuthorization(null);
        setAuthorizationPassword("");
        setAuthorizationReview(false);
        setNotice({
          kind: "success",
          message:
            pendingKind.current === "AUTHORIZE"
              ? "Authorization was recorded. No restoration was executed."
              : "The original recovery request is confirmed. This does not mean restoration occurred."
        });
        await read();
      } else {
        setNotice({
          kind: "info",
          message: "No committed request is visible. Contact Foundation operations before any retry."
        });
      }
    } catch (e) {
      setNotice({ kind: "error", message: describe(e) });
    } finally {
      setSaving(false);
    }
  }

  // Authorization Flow
  function startAuthorization(row: CG21RecoveryOperation) {
    if (saving || unknown || availability?.status !== "AVAILABLE" || row.status !== "REQUESTED") return;
    pendingKind.current = "AUTHORIZE";
    requestKey.current = crypto.randomUUID();
    setAuthorization(row);
    setAuthorizationPassword("");
    setAuthorizationReview(false);
    setNotice(null);
    setSelectedOperation(null);
  }

  async function saveAuthorization(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!authorization || saving || unknown || availability?.status !== "AVAILABLE") return;
    if (authorizationPassword.length < 8 || authorizationPassword.length > 1024) {
      setNotice({ kind: "error", message: "Enter a current password." });
      return;
    }
    if (!authorizationReview) {
      setAuthorizationReview(true);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const result = await call<{ status: string; version?: number }>(
        "recovery/operations/" + encodeURIComponent(authorization.operationRef) + "/authorize",
        "POST",
        {
          expectedVersion: authorization.version,
          requestKey: requestKey.current,
          currentPassword: authorizationPassword
        }
      );
      if (result.status === "NOT_AVAILABLE") {
        setNotice({
          kind: "info",
          message: "Backup readiness was not verified. No authorization was recorded."
        });
        return;
      }
      if (result.status !== "PRIVILEGED_AUTHORIZED" && result.status !== "REPLAY_CONFIRMED")
        throw Error("UNKNOWN");
      requestKey.current = "";
      setAuthorization(null);
      setAuthorizationPassword("");
      setAuthorizationReview(false);
      setNotice({
        kind: "success",
        message: "Authorization recorded under current root access. Restoration has not started."
      });
      await read();
    } catch (error) {
      if (error instanceof Error && error.message === "UNKNOWN") setUnknown(true);
      setNotice({ kind: "error", message: describe(error) });
    } finally {
      setSaving(false);
    }
  }

  // Filtered & Paginated Operations
  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      // Status Filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "COMPLETED" && op.status !== "VERIFIED_SUCCEEDED") return false;
        if (statusFilter === "IN_PROGRESS" && op.status !== "RUNNING") return false;
        if (statusFilter === "FAILED" && op.status !== "FAILED") return false;
        if (statusFilter === "REQUESTED" && op.status !== "REQUESTED") return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const refMatch = op.operationRef.toLowerCase().includes(query);
        const formattedIdMatch = formatRequestRef(op.operationRef).toLowerCase().includes(query);
        const statusMatch = stateLabel(op.status).toLowerCase().includes(query);
        const dateMatch = formatDate(op.requestedAt).toLowerCase().includes(query);
        if (!refMatch && !formattedIdMatch && !statusMatch && !dateMatch) return false;
      }

      return true;
    });
  }, [operations, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOperations.length / pageSize));
  const paginatedOperations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOperations.slice(start, start + pageSize);
  }, [filteredOperations, currentPage, pageSize]);

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED_SUCCEEDED":
        return (
          <span className="cg-br-pill success">
            <CheckCircleIcon size={13} />
            Completed
          </span>
        );
      case "RUNNING":
        return (
          <span className="cg-br-pill info">
            <RefreshCwIcon size={12} className="cg-br-spinner" />
            In Progress
          </span>
        );
      case "REQUESTED":
        return (
          <span className="cg-br-pill warning">
            <ClockIcon size={13} />
            Awaiting Auth
          </span>
        );
      case "PRIVILEGED_AUTHORIZED":
        return (
          <span className="cg-br-pill info">
            <ShieldCheckIcon size={13} />
            Authorized
          </span>
        );
      case "FAILED":
        return (
          <span className="cg-br-pill danger">
            <XCircleIcon size={13} />
            Failed
          </span>
        );
      default:
        return (
          <span className="cg-br-pill neutral">
            <AlertCircleIcon size={13} />
            Unconfirmed
          </span>
        );
    }
  };

  useEffect(() => {
    if (!isRequestDrawerOpen && !selectedOperation && !authorization && !isConfigDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (authorization && !saving && !unknown) {
        setAuthorization(null);
        setAuthorizationPassword("");
        setAuthorizationReview(false);
        requestKey.current = "";
      } else if (isConfigDrawerOpen) {
        setIsConfigDrawerOpen(false);
      } else if (isRequestDrawerOpen) {
        setIsRequestDrawerOpen(false);
        setReview(false);
      } else if (selectedOperation) {
        setSelectedOperation(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRequestDrawerOpen, selectedOperation, authorization, isConfigDrawerOpen, saving, unknown]);

  return (
    <div className="cg-br-container">
      {/* ------------------------------------------------------------------
          A. Page Header Row
          ------------------------------------------------------------------ */}
      <div className="cg-br-header">
        <div className="cg-br-header-left">
          <h1 className="cg-br-title">Backup &amp; Restore</h1>
          <p className="cg-br-subtitle">
            Restricted recovery readiness and independently authorized operations
          </p>
        </div>
        <div className="cg-br-header-actions">
          <button
            type="button"
            className="cg-br-btn-secondary"
            disabled={saving || loading || unknown}
            onClick={() => void read()}
            aria-label="Refresh backup readiness status"
          >
            <RefreshCwIcon size={15} className={loading ? "cg-br-spinner" : ""} />
            <span>{loading ? "Refreshing..." : "Refresh readiness"}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          B. Notice & Feedback Banners
          ------------------------------------------------------------------ */}
      {notice && (
        <div
          className={`cg-br-notice ${notice.kind}`}
          role={notice.kind === "success" ? "status" : "alert"}
        >
          <div className="cg-br-notice-icon">
            {notice.kind === "success" ? (
              <CheckCircleIcon size={18} />
            ) : notice.kind === "error" ? (
              <XCircleIcon size={18} />
            ) : (
              <AlertCircleIcon size={18} />
            )}
          </div>
          <div className="cg-br-notice-body">{notice.message}</div>
          <button
            type="button"
            className="cg-br-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {unknown && (
        <div className="cg-br-notice uncertain" role="alert">
          <div className="cg-br-notice-icon">
            <AlertCircleIcon size={18} />
          </div>
          <div className="cg-br-notice-body">
            <div className="cg-br-notice-title">Previous request outcome is uncertain</div>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8125rem" }}>
              Never repeat an unconfirmed recovery request or start a second restore.
            </p>
            <button
              type="button"
              className="cg-br-btn-secondary"
              style={{ height: "2rem", fontSize: "0.75rem" }}
              disabled={saving}
              onClick={() => void verifyPrevious()}
            >
              {saving ? "Checking..." : "Check previous request"}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          C. Navigation Tabs Bar
          ------------------------------------------------------------------ */}
      <nav className="cg-br-tabs-nav" aria-label="Backup and restore navigation">
        <button
          type="button"
          className={`cg-br-tab-btn ${activeTab === "overview" ? "is-active" : ""}`}
          onClick={() => setActiveTab("overview")}
          aria-current={activeTab === "overview" ? "page" : undefined}
        >
          <LayersIcon size={16} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={`cg-br-tab-btn ${activeTab === "requests" ? "is-active" : ""}`}
          onClick={() => setActiveTab("requests")}
          aria-current={activeTab === "requests" ? "page" : undefined}
        >
          <ClockIcon size={16} />
          <span>Recovery Requests</span>
        </button>
        <button
          type="button"
          className={`cg-br-tab-btn ${activeTab === "config" ? "is-active" : ""}`}
          onClick={() => setActiveTab("config")}
          aria-current={activeTab === "config" ? "page" : undefined}
        >
          <SettingsIcon size={16} />
          <span>Configuration</span>
        </button>
      </nav>

      {/* ------------------------------------------------------------------
          D. Secured Backup Readiness Card (Visible on Overview & Config)
          ------------------------------------------------------------------ */}
      {(activeTab === "overview" || activeTab === "config") && (
        <section className="cg-br-card" aria-labelledby="cg-br-readiness-heading">
          <div className="cg-br-card-header">
            <div className="cg-br-card-header-left">
              <div className="cg-br-card-icon-wrap">
                <ShieldIcon size={20} />
              </div>
              <div className="cg-br-card-title-group">
                <h2 id="cg-br-readiness-heading" className="cg-br-card-title">
                  Secured backup readiness
                </h2>
                <p className="cg-br-card-subtitle">
                  Current integration status and restore eligibility
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cg-br-btn-primary"
              onClick={() => setIsConfigDrawerOpen(true)}
              aria-label="Configure backup facility"
            >
              <SettingsIcon size={16} />
              <span>Configure Backup</span>
            </button>
          </div>

          <div className="cg-br-card-body">
            {loading ? (
              /* Premium Skeleton Shimmer State */
              <div className="cg-br-readiness-layout" aria-busy="true">
                <div
                  className="cg-br-facility-box cg-br-skeleton"
                  style={{ minHeight: "220px" }}
                />
                <div className="cg-br-stats-list">
                  {[1, 2, 3, 4].map(idx => (
                    <div
                      key={idx}
                      className="cg-br-skeleton"
                      style={{ height: "48px", borderRadius: "0.5rem" }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="cg-br-readiness-layout">
                {/* Left Facility Box */}
                <div
                  className={`cg-br-facility-box ${
                    availability?.status === "AVAILABLE" ? "available" : "unavailable"
                  }`}
                >
                  <div className="cg-br-facility-badge-icon">
                    <ShieldIcon size={26} />
                  </div>
                  <div className="cg-br-facility-label">Backup facility</div>
                  <div className="cg-br-facility-status">
                    {availability?.status === "AVAILABLE"
                      ? "Secured Facility Registered"
                      : "Not Configured"}
                  </div>
                  <p className="cg-br-facility-desc">
                    {availability?.message || "No independently verified backup facility is connected."}
                  </p>
                  <div className="cg-br-facility-drill-note">
                    CareGanga never assumes that an integration reference is a usable backup. A
                    production restore requires separate operations authorization, isolated
                    recovery drill and independently verified completion evidence.
                  </div>
                </div>

                {/* Right 4 Meta Stats */}
                <div className="cg-br-stats-list">
                  <div className="cg-br-stat-item">
                    <div className="cg-br-stat-left">
                      <FileTextIcon size={18} className="cg-br-stat-icon" />
                      <span className="cg-br-stat-label">Integration Reference</span>
                    </div>
                    <span className="cg-br-pill neutral">
                      {availability?.status === "AVAILABLE" ? "Registered" : "Not configured"}
                    </span>
                  </div>

                  <div className="cg-br-stat-item">
                    <div className="cg-br-stat-left">
                      <CalendarIcon size={18} className="cg-br-stat-icon" />
                      <span className="cg-br-stat-label">Last Verification</span>
                    </div>
                    <span style={{ fontSize: "0.875rem", color: "var(--cg-br-slate-500)", fontWeight: 500 }}>
                      —
                    </span>
                  </div>

                  <div className="cg-br-stat-item">
                    <div className="cg-br-stat-left">
                      <ShieldCheckIcon size={18} className="cg-br-stat-icon" />
                      <span className="cg-br-stat-label">Restore Eligibility</span>
                    </div>
                    <span
                      className={`cg-br-pill ${
                        availability?.status === "AVAILABLE" ? "info" : "neutral"
                      }`}
                    >
                      {availability?.status === "AVAILABLE" ? "Restricted" : "Unavailable"}
                    </span>
                  </div>

                  <div className="cg-br-stat-item">
                    <div className="cg-br-stat-left">
                      <ServerIcon size={18} className="cg-br-stat-icon" />
                      <span className="cg-br-stat-label">Recovery Operations</span>
                    </div>
                    <span
                      className={`cg-br-pill ${
                        availability?.status === "AVAILABLE" ? "success" : "neutral"
                      }`}
                    >
                      {availability?.status === "AVAILABLE" ? "Guarded" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------
          E. Recovery Request History Card (Visible on Overview & Requests)
          ------------------------------------------------------------------ */}
      {(activeTab === "overview" || activeTab === "requests") && (
        <section className="cg-br-card" aria-labelledby="cg-br-history-heading">
          <div className="cg-br-card-header">
            <div className="cg-br-card-header-left">
              <div className="cg-br-card-icon-wrap navy">
                <ClockIcon size={20} />
              </div>
              <div className="cg-br-card-title-group">
                <h2 id="cg-br-history-heading" className="cg-br-card-title">
                  Recovery request history
                </h2>
                <p className="cg-br-card-subtitle">
                  All backup/restore requests and their outcomes
                </p>
              </div>
            </div>

            <div className="cg-br-history-controls">
              {/* Search Bar */}
              <div className="cg-br-search-wrap">
                <SearchIcon size={16} className="cg-br-search-icon" />
                <input
                  type="text"
                  className="cg-br-search-input"
                  placeholder="Search by request ID, initiated by..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Search recovery requests"
                />
              </div>

              {/* Status Filter */}
              <div className="cg-br-filter-select-wrap">
                <FilterIcon size={15} className="cg-br-filter-icon" />
                <select
                  className="cg-br-filter-select"
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by recovery status"
                >
                  <option value="ALL">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REQUESTED">Awaiting Auth</option>
                  <option value="FAILED">Failed</option>
                </select>
                <ChevronDownIcon size={14} className="cg-br-select-chevron" />
              </div>
            </div>
          </div>

          <div className="cg-br-card-body" style={{ padding: 0 }}>
            {loading ? (
              /* Shimmer Table Loading Skeleton */
              <div style={{ padding: "1.5rem" }} aria-busy="true">
                <div
                  className="cg-br-skeleton"
                  style={{ height: "42px", marginBottom: "0.75rem", borderRadius: "0.375rem" }}
                />
                {[1, 2, 3].map(row => (
                  <div
                    key={row}
                    className="cg-br-skeleton"
                    style={{ height: "54px", marginBottom: "0.5rem", borderRadius: "0.375rem" }}
                  />
                ))}
              </div>
            ) : operations.length === 0 ? (
              /* Empty History State Matching Wireframe */
              <div className="cg-br-empty-state cg-module-empty">
                <div className="cg-br-empty-icon-wrap">
                  <FileTextIcon size={28} />
                </div>
                <h3 className="cg-br-empty-title">No recovery requests yet</h3>
                <p className="cg-br-empty-desc">
                  Restore and backup requests will appear here once initiated.
                </p>
                <button
                  type="button"
                  className="cg-br-btn-primary"
                  onClick={() => {
                    if (availability?.status === "AVAILABLE") {
                      setIsRequestDrawerOpen(true);
                    } else {
                      setNotice({
                        kind: "info",
                        message:
                          "No independently verified backup facility is connected. A recovery request cannot be created."
                      });
                    }
                  }}
                  aria-label="Request recovery"
                >
                  <PlusIcon size={16} />
                  <span>Request Recovery</span>
                </button>
              </div>
            ) : filteredOperations.length === 0 ? (
              <div className="cg-br-empty-state">
                <div
                  className="cg-br-empty-icon-wrap"
                  style={{
                    background: "var(--cg-br-slate-100)",
                    color: "var(--cg-br-slate-400)",
                    borderColor: "var(--cg-br-slate-200)"
                  }}
                >
                  <SearchIcon size={28} />
                </div>
                <h3 className="cg-br-empty-title">No matching requests</h3>
                <p className="cg-br-empty-desc">
                  No recovery records matched your search query or filter selection.
                </p>
                <button
                  type="button"
                  className="cg-br-btn-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setCurrentPage(1);
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                {/* Desktop & Tablet Table */}
                <div className="cg-br-table-wrap" role="region" aria-label="Recovery request history table" tabIndex={0}>
                  <table className="cg-br-table" aria-label="Recovery request history table">
                    <thead>
                      <tr>
                        <th scope="col">Request ID</th>
                        <th scope="col">Operation</th>
                        <th scope="col">Requested By</th>
                        <th scope="col">Requested On</th>
                        <th scope="col">Status</th>
                        <th scope="col">Completed On</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOperations.map(op => {
                        const isCompleted =
                          op.status === "VERIFIED_SUCCEEDED" || op.status === "FAILED";
                        return (
                          <tr key={op.operationRef}>
                            <td className="cg-br-req-id" title={op.operationRef}>
                              {formatRequestRef(op.operationRef)}
                            </td>
                            <td className="cg-br-operation-name">Data Restore</td>
                            <td>System Administrator</td>
                            <td>{formatDate(op.requestedAt)}</td>
                            <td>{renderStatusBadge(op.status)}</td>
                            <td>{isCompleted ? formatDate(op.updatedAt) : "—"}</td>
                            <td>
                              <button
                                type="button"
                                className="cg-br-btn-view"
                                onClick={() => setSelectedOperation(op)}
                                aria-label={`View details for request ${formatRequestRef(
                                  op.operationRef
                                )}`}
                              >
                                <EyeIcon size={15} />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards (Automatic Switch on Small Screens) */}
                <div className="cg-br-mobile-cards">
                  {paginatedOperations.map(op => {
                    const isCompleted =
                      op.status === "VERIFIED_SUCCEEDED" || op.status === "FAILED";
                    return (
                      <div key={op.operationRef} className="cg-br-mobile-card">
                        <div className="cg-br-mobile-card-header">
                          <span className="cg-br-req-id" title={op.operationRef}>
                            {formatRequestRef(op.operationRef)}
                          </span>
                          {renderStatusBadge(op.status)}
                        </div>
                        <div className="cg-br-mobile-card-grid">
                          <div>
                            <div className="cg-br-mobile-prop-label">Operation</div>
                            <div className="cg-br-mobile-prop-val">Data Restore</div>
                          </div>
                          <div>
                            <div className="cg-br-mobile-prop-label">Requested By</div>
                            <div className="cg-br-mobile-prop-val">System Administrator</div>
                          </div>
                          <div>
                            <div className="cg-br-mobile-prop-label">Requested On</div>
                            <div className="cg-br-mobile-prop-val">{formatDate(op.requestedAt)}</div>
                          </div>
                          <div>
                            <div className="cg-br-mobile-prop-label">Completed On</div>
                            <div className="cg-br-mobile-prop-val">
                              {isCompleted ? formatDate(op.updatedAt) : "—"}
                            </div>
                          </div>
                        </div>
                        <div className="cg-br-mobile-card-footer">
                          <button
                            type="button"
                            className="cg-br-btn-view"
                            onClick={() => setSelectedOperation(op)}
                          >
                            <EyeIcon size={15} />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Table Footer with Pagination */}
                <div className="cg-br-table-footer">
                  <div className="cg-br-footer-left">
                    <span>
                      Showing{" "}
                      {filteredOperations.length === 0
                        ? 0
                        : (currentPage - 1) * pageSize + 1}
                      -
                      {Math.min(currentPage * pageSize, filteredOperations.length)} of{" "}
                      {filteredOperations.length} requests
                    </span>
                  </div>

                  <div className="cg-br-footer-center">
                    <label htmlFor="cg-br-rows-selector" style={{ fontSize: "0.8125rem" }}>
                      Rows per page:
                    </label>
                    <select
                      id="cg-br-rows-selector"
                      className="cg-br-rows-select"
                      value={pageSize}
                      onChange={e => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={30}>30</option>
                    </select>
                  </div>

                  <div className="cg-br-pagination">
                    <button
                      type="button"
                      className="cg-br-page-btn"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeftIcon size={14} />
                      <span style={{ marginLeft: "0.25rem" }}>Previous</span>
                    </button>

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`cg-br-page-btn ${pageNum === currentPage ? "is-active" : ""}`}
                          onClick={() => setCurrentPage(pageNum)}
                          aria-current={pageNum === currentPage ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="cg-br-page-btn"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      aria-label="Next page"
                    >
                      <span style={{ marginRight: "0.25rem" }}>Next</span>
                      <ChevronRightIcon size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------
          F. Request Recovery Drawer (Matching Wireframe)
          ------------------------------------------------------------------ */}
      <AnimatePresence>
        {isRequestDrawerOpen && (
          <div className="cg-br-drawer-backdrop" role="presentation">
            <motion.aside
              className="cg-br-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cg-br-request-drawer-title"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="cg-br-drawer-header">
                <div className="cg-br-drawer-title-group">
                  <h2 id="cg-br-request-drawer-title" className="cg-br-drawer-title">
                    Request Recovery
                  </h2>
                  <p className="cg-br-drawer-subtitle">
                    Initiate a data restore from the latest verified backup.
                  </p>
                </div>
                <button
                  type="button"
                  className="cg-br-drawer-close-btn"
                  onClick={() => {
                    setIsRequestDrawerOpen(false);
                    setReview(false);
                  }}
                  aria-label="Close recovery request drawer"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <form
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
                onSubmit={e => void request(e)}
              >
                <div className="cg-br-drawer-body">
                  {availability?.status !== "AVAILABLE" ? (
                    <div className="cg-br-notice info">
                      <AlertCircleIcon size={18} className="cg-br-notice-icon" />
                      <div className="cg-br-notice-body">
                        No independently verified backup facility is connected. A recovery request
                        can only be submitted once a secured facility is registered.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Operation Type Radio Group */}
                      <div className="cg-br-form-group">
                        <label className="cg-br-form-label">
                          Operation Type <span className="req">*</span>
                        </label>
                        <div className="cg-br-radio-group" role="radiogroup">
                          <div
                            className={`cg-br-radio-card ${
                              requestOperationType === "RESTORE" ? "is-selected" : ""
                            }`}
                            onClick={() => setRequestOperationType("RESTORE")}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setRequestOperationType("RESTORE");
                              } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                                e.preventDefault();
                                setRequestOperationType("BACKUP");
                              }
                            }}
                            role="radio"
                            aria-checked={requestOperationType === "RESTORE"}
                            tabIndex={0}
                          >
                            <div className="cg-br-radio-indicator">
                              {requestOperationType === "RESTORE" && (
                                <div className="cg-br-radio-dot" />
                              )}
                            </div>
                            <div className="cg-br-radio-content">
                              <span className="cg-br-radio-title">Data Restore</span>
                              <span className="cg-br-radio-desc">
                                Restore system data from a verified backup.
                              </span>
                            </div>
                          </div>

                          <div
                            className={`cg-br-radio-card ${
                              requestOperationType === "BACKUP" ? "is-selected" : ""
                            }`}
                            onClick={() => setRequestOperationType("BACKUP")}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setRequestOperationType("BACKUP");
                              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                                e.preventDefault();
                                setRequestOperationType("RESTORE");
                              }
                            }}
                            role="radio"
                            aria-checked={requestOperationType === "BACKUP"}
                            tabIndex={0}
                          >
                            <div className="cg-br-radio-indicator">
                              {requestOperationType === "BACKUP" && (
                                <div className="cg-br-radio-dot" />
                              )}
                            </div>
                            <div className="cg-br-radio-content">
                              <span className="cg-br-radio-title">Backup (On-demand)</span>
                              <span className="cg-br-radio-desc">
                                Create a new verified backup (operations adapter drill).
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Verified secured-backup reference */}
                      <div className="cg-br-form-group">
                        <label htmlFor="cg-br-ref-input" className="cg-br-form-label">
                          Verified secured-backup reference <span className="req">*</span>
                        </label>
                        <input
                          id="cg-br-ref-input"
                          type="text"
                          className="cg-br-form-input"
                          placeholder="backupref:..."
                          value={backupReference}
                          onChange={e => {
                            setBackupReference(e.target.value);
                            setReview(false);
                          }}
                          required
                          maxLength={180}
                          autoComplete="off"
                        />
                        <span style={{ fontSize: "0.75rem", color: "var(--cg-br-slate-500)" }}>
                          Format: <code>backupref:identifier</code> (6 to 170 characters)
                        </span>
                      </div>

                      {/* Super Admin Password */}
                      <div className="cg-br-form-group">
                        <label htmlFor="cg-br-pw-input" className="cg-br-form-label">
                          Confirm Super Admin password <span className="req">*</span>
                        </label>
                        <input
                          id="cg-br-pw-input"
                          type="password"
                          className="cg-br-form-input"
                          value={currentPassword}
                          onChange={e => {
                            setCurrentPassword(e.target.value);
                            setReview(false);
                          }}
                          required
                          minLength={8}
                          maxLength={1024}
                          autoComplete="current-password"
                        />
                      </div>

                      {/* Reason for Request */}
                      <div className="cg-br-form-group">
                        <label htmlFor="cg-br-reason-input" className="cg-br-form-label">
                          Reason for request
                        </label>
                        <textarea
                          id="cg-br-reason-input"
                          className="cg-br-form-textarea"
                          placeholder="Enter a clear reason for this request..."
                          value={requestReason}
                          onChange={e => setRequestReason(e.target.value.slice(0, 220))}
                          maxLength={220}
                        />
                        <div className="cg-br-counter-row">
                          <span>{requestReason.length} / 220</span>
                        </div>
                      </div>

                      {review && (
                        <div className="cg-br-notice uncertain">
                          <AlertCircleIcon size={18} className="cg-br-notice-icon" />
                          <div className="cg-br-notice-body">
                            Review request: no restore will be executed. The request is auditable
                            and subject to independent operations approval.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="cg-br-drawer-footer">
                  <button
                    type="button"
                    className="cg-br-btn-secondary"
                    disabled={saving}
                    onClick={() => {
                      setIsRequestDrawerOpen(false);
                      setReview(false);
                      setCurrentPassword("");
                    }}
                  >
                    Cancel
                  </button>
                  {availability?.status === "AVAILABLE" && (
                    <button
                      type="submit"
                      className="cg-br-btn-primary"
                      disabled={saving || unknown}
                    >
                      {saving ? (
                        <>
                          <RefreshCwIcon size={15} className="cg-br-spinner" />
                          <span>Saving...</span>
                        </>
                      ) : review ? (
                        <>
                          <SendIcon size={15} />
                          <span>Submit Request</span>
                        </>
                      ) : (
                        <span>Review Request</span>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------
          G. Request Details Drawer (Matching Wireframe)
          ------------------------------------------------------------------ */}
      <AnimatePresence>
        {selectedOperation && (
          <div className="cg-br-drawer-backdrop" role="presentation">
            <motion.aside
              className="cg-br-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cg-br-details-drawer-title"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="cg-br-drawer-header">
                <div className="cg-br-drawer-title-group">
                  <h2 id="cg-br-details-drawer-title" className="cg-br-drawer-title">
                    Recovery Request Details
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                    {renderStatusBadge(selectedOperation.status)}
                    <span className="cg-br-req-id" style={{ fontSize: "0.875rem" }}>
                      {formatRequestRef(selectedOperation.operationRef)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-br-drawer-close-btn"
                  onClick={() => setSelectedOperation(null)}
                  aria-label="Close recovery details drawer"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div className="cg-br-drawer-body">
                <div className="cg-br-detail-list">
                  <div className="cg-br-detail-row">
                    <LayersIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Operation</span>
                    <span className="cg-br-detail-value">Data Restore</span>
                  </div>

                  <div className="cg-br-detail-row">
                    <UserIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Requested By</span>
                    <span className="cg-br-detail-value">System Administrator</span>
                  </div>

                  <div className="cg-br-detail-row">
                    <CalendarIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Requested On</span>
                    <span className="cg-br-detail-value">
                      {formatDate(selectedOperation.requestedAt)}
                    </span>
                  </div>

                  <div className="cg-br-detail-row">
                    <CalendarIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Completed On</span>
                    <span className="cg-br-detail-value">
                      {selectedOperation.status === "VERIFIED_SUCCEEDED" ||
                      selectedOperation.status === "FAILED"
                        ? formatDate(selectedOperation.updatedAt)
                        : "—"}
                    </span>
                  </div>

                  <div className="cg-br-detail-row">
                    <CheckCircleIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Outcome</span>
                    <span className="cg-br-detail-value">
                      {stateLabel(selectedOperation.status)}
                    </span>
                  </div>

                  <div className="cg-br-detail-row">
                    <FileTextIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Audit Reference</span>
                    <span
                      className="cg-br-detail-value"
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.8125rem",
                        color: "var(--cg-br-slate-600)"
                      }}
                    >
                      {selectedOperation.operationRef}
                    </span>
                  </div>

                  <div className="cg-br-detail-row">
                    <ServerIcon size={18} className="cg-br-detail-icon" />
                    <span className="cg-br-detail-key">Details</span>
                    <span className="cg-br-detail-value">
                      Revision {selectedOperation.version}. Secured backup reference is{" "}
                      {selectedOperation.backupReferencePresent ? "recorded" : "not present"}.
                    </span>
                  </div>
                </div>

                {selectedOperation.status === "REQUESTED" &&
                  availability?.status === "AVAILABLE" && (
                    <div
                      style={{
                        marginTop: "1.5rem",
                        padding: "1rem",
                        backgroundColor: "var(--cg-br-amber-50)",
                        border: "1px solid var(--cg-br-amber-100)",
                        borderRadius: "0.5rem"
                      }}
                    >
                      <strong style={{ color: "var(--cg-br-amber-700)", display: "block", marginBottom: "0.375rem" }}>
                        Action Required: Super Admin Authorization
                      </strong>
                      <p style={{ margin: "0 0 0.875rem 0", fontSize: "0.8125rem", color: "var(--cg-br-slate-600)" }}>
                        This request is awaiting privileged operations authorization with your Super Admin password.
                      </p>
                      <button
                        type="button"
                        className="cg-br-btn-primary"
                        onClick={() => startAuthorization(selectedOperation)}
                      >
                        <ShieldCheckIcon size={16} />
                        <span>Review Authorization</span>
                      </button>
                    </div>
                  )}
              </div>

              <div className="cg-br-drawer-footer">
                <button
                  type="button"
                  className="cg-br-btn-secondary"
                  onClick={() => setSelectedOperation(null)}
                >
                  Close
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------
          H. Authorize Recovery Request Drawer (Privileged Action)
          ------------------------------------------------------------------ */}
      <AnimatePresence>
        {authorization && availability?.status === "AVAILABLE" && (
          <div className="cg-br-drawer-backdrop" role="presentation">
            <motion.aside
              className="cg-br-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cg-br-auth-drawer-title"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="cg-br-drawer-header">
                <div className="cg-br-drawer-title-group">
                  <h2 id="cg-br-auth-drawer-title" className="cg-br-drawer-title">
                    Authorize recovery request
                  </h2>
                  <p className="cg-br-drawer-subtitle">
                    Request ID: {formatRequestRef(authorization.operationRef)} &bull; Revision:{" "}
                    {authorization.version}
                  </p>
                </div>
                <button
                  type="button"
                  className="cg-br-drawer-close-btn"
                  disabled={saving || unknown}
                  onClick={() => {
                    setAuthorization(null);
                    setAuthorizationPassword("");
                    setAuthorizationReview(false);
                    requestKey.current = "";
                  }}
                  aria-label="Close authorization drawer"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <form
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
                onSubmit={e => void saveAuthorization(e)}
              >
                <div className="cg-br-drawer-body">
                  <div className="cg-br-notice info">
                    <AlertCircleIcon size={18} className="cg-br-notice-icon" />
                    <div className="cg-br-notice-body">
                      Authorization is not a restore command. An independently verified operations
                      adapter and successful isolated drill are still required.
                    </div>
                  </div>

                  <div className="cg-br-form-group">
                    <label htmlFor="cg-br-auth-pw" className="cg-br-form-label">
                      Confirm Super Admin password <span className="req">*</span>
                    </label>
                    <input
                      id="cg-br-auth-pw"
                      required
                      type="password"
                      autoComplete="current-password"
                      minLength={8}
                      maxLength={1024}
                      className="cg-br-form-input"
                      value={authorizationPassword}
                      onChange={e => {
                        setAuthorizationPassword(e.target.value);
                        setAuthorizationReview(false);
                      }}
                    />
                  </div>

                  {authorizationReview && (
                    <div className="cg-br-notice uncertain">
                      <AlertCircleIcon size={18} className="cg-br-notice-icon" />
                      <div className="cg-br-notice-body">
                        Review this guarded authorization. No backup execution or completion will
                        be claimed.
                      </div>
                    </div>
                  )}
                </div>

                <div className="cg-br-drawer-footer">
                  <button
                    type="button"
                    className="cg-br-btn-secondary"
                    disabled={saving || unknown}
                    onClick={() => {
                      setAuthorization(null);
                      requestKey.current = "";
                      setAuthorizationReview(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cg-br-btn-primary"
                    disabled={saving || unknown}
                  >
                    {saving
                      ? "Saving…"
                      : authorizationReview
                      ? "Confirm authorization"
                      : "Review authorization"}
                  </button>
                </div>
              </form>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------
          I. Configure Backup Guidance Drawer (Platform Settings Integration)
          ------------------------------------------------------------------ */}
      <AnimatePresence>
        {isConfigDrawerOpen && (
          <div className="cg-br-drawer-backdrop" role="presentation">
            <motion.aside
              className="cg-br-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cg-br-config-drawer-title"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="cg-br-drawer-header">
                <div className="cg-br-drawer-title-group">
                  <h2 id="cg-br-config-drawer-title" className="cg-br-drawer-title">
                    Configure Backup Facility
                  </h2>
                  <p className="cg-br-drawer-subtitle">
                    Secured backup integration and operations configuration
                  </p>
                </div>
                <button
                  type="button"
                  className="cg-br-drawer-close-btn"
                  onClick={() => setIsConfigDrawerOpen(false)}
                  aria-label="Close configuration drawer"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div className="cg-br-drawer-body">
                <div className="cg-br-notice info">
                  <ShieldCheckIcon size={18} className="cg-br-notice-icon" />
                  <div className="cg-br-notice-body">
                    <strong>Current Facility Status: </strong>
                    {availability?.status === "AVAILABLE"
                      ? "Secured Facility Registered"
                      : "Not Configured"}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem", color: "var(--cg-br-slate-600)" }}>
                  <p style={{ margin: 0 }}>
                    In CareGanga, backup storage facilities and secured recovery adapters are
                    centrally managed in <strong>Platform Settings</strong> under{" "}
                    <strong>Secured Integration References</strong>.
                  </p>
                  <p style={{ margin: 0 }}>
                    Only authorized Super Administrators may register or rotate integration
                    credentials. Any restore drill requires verified cryptographic evidence and
                    cannot be executed directly from public interfaces.
                  </p>
                </div>

                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "var(--cg-br-slate-50)",
                    border: "1px solid var(--cg-br-slate-200)",
                    borderRadius: "0.5rem"
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--cg-br-navy-800)", marginBottom: "0.25rem" }}>
                    Manage Integration References
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--cg-br-slate-500)", margin: "0 0 0.875rem 0" }}>
                    Navigate to Platform Settings to inspect, configure, or verify backup adapter
                    credentials.
                  </p>
                  <Link
                    href="/admin/settings"
                    className="cg-br-btn-primary"
                    style={{ textDecoration: "none", display: "inline-flex" }}
                    onClick={() => setIsConfigDrawerOpen(false)}
                  >
                    <SettingsIcon size={16} />
                    <span>Go to Platform Settings</span>
                  </Link>
                </div>
              </div>

              <div className="cg-br-drawer-footer">
                <button
                  type="button"
                  className="cg-br-btn-secondary"
                  onClick={() => setIsConfigDrawerOpen(false)}
                >
                  Close
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
