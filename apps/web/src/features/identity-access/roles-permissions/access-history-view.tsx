import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AuditEvent } from "./roles-permissions-types";
import {
  IconFileText,
  IconSearch,
  IconRefresh,
  IconDownload,
  IconUserCheck,
  IconShield,
  IconLayers,
  IconKey,
  IconMoreHorizontal,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconSpinner
} from "./roles-permissions-icons";

type Props = {
  history: AuditEvent[] | null;
  historyCursor: string | null;
  onMoreHistory: () => Promise<void>;
  onBackToDashboard: () => void;
};

export function AccessHistoryView({
  history,
  historyCursor,
  onMoreHistory,
  onBackToDashboard
}: Props) {
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [actorSearch, setActorSearch] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeEventDetail, setActiveEventDetail] = useState<AuditEvent | null>(null);

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const handleClear = () => {
    setEventTypeFilter("all");
    setActorSearch("");
    setDateRange("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [eventTypeFilter, actorSearch, dateRange, statusFilter, pageSize]);

  const filteredEvents = useMemo(() => {
    if (!history) return [];
    return history.filter((event) => {
      if (eventTypeFilter !== "all") {
        if (!event.actionLabel.toLowerCase().includes(eventTypeFilter.toLowerCase())) {
          return false;
        }
      }
      if (actorSearch.trim()) {
        const query = actorSearch.trim().toLowerCase();
        if (
          !event.actorDisplay.toLowerCase().includes(query) &&
          !event.targetDisplay.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      if (statusFilter !== "all") {
        if (event.outcome.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [history, eventTypeFilter, actorSearch, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const handleExportCSV = () => {
    if (!filteredEvents.length) return;
    const headers = ["Event Type", "Actor", "Target", "Outcome", "Timestamp"];
    const rows = filteredEvents.map((e) => [
      `"${e.actionLabel.replace(/"/g, '""')}"`,
      `"${e.actorDisplay.replace(/"/g, '""')}"`,
      `"${e.targetDisplay.replace(/"/g, '""')}"`,
      `"${e.outcome.replace(/"/g, '""')}"`,
      `"${new Date(e.occurredAt).toLocaleString().replace(/"/g, '""')}"`
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `careganga-access-history-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("sign") || l.includes("login") || l.includes("auth")) {
      return (
        <span className="cg-rp-audit-icon-sm signin" aria-hidden="true">
          <IconUserCheck size={12} />
        </span>
      );
    }
    if (l.includes("security") || l.includes("policy") || l.includes("lock")) {
      return (
        <span className="cg-rp-audit-icon-sm security" aria-hidden="true">
          <IconShield size={12} />
        </span>
      );
    }
    if (l.includes("role") || l.includes("create")) {
      return (
        <span className="cg-rp-audit-icon-sm role" aria-hidden="true">
          <IconLayers size={12} />
        </span>
      );
    }
    return (
      <span className="cg-rp-audit-icon-sm perm" aria-hidden="true">
        <IconKey size={12} />
      </span>
    );
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await onMoreHistory();
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="cg-rp-history-view">
      {/* Breadcrumb */}
      <div className="cg-rp-breadcrumb">
        <button
          type="button"
          className="cg-rp-breadcrumb-btn"
          onClick={onBackToDashboard}
        >
          Roles &amp; Permissions
        </button>
        <span>›</span>
        <span style={{ fontWeight: 600, color: "#0F172A" }}>Access History</span>
      </div>

      {/* Header Card */}
      <div className="cg-rp-history-header-card">
        <div className="cg-rp-history-header-left">
          <div className="cg-rp-history-icon-circle" aria-hidden="true">
            <IconFileText size={22} />
          </div>
          <div className="cg-rp-history-title-wrap">
            <h2>Foundation Access History</h2>
            <p>Audit trail of role, permission and access related activities.</p>
          </div>
        </div>

        <button
          type="button"
          className="cg-rp-btn"
          onClick={onBackToDashboard}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Search & Filter Panel */}
      <div className="cg-rp-filter-card">
        <div className="cg-rp-filter-title-row">
          <IconSearch size={16} />
          <span>Search &amp; Filter Audit Logs</span>
        </div>

        <div className="cg-rp-history-filter-grid">
          {/* Event Type */}
          <div className="cg-rp-field-group">
            <label className="cg-rp-field-label">Event Type</label>
            <select
              className="cg-rp-select"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">All Events</option>
              <option value="signed in">Account signed in</option>
              <option value="security">Account security event</option>
              <option value="role">Role events</option>
              <option value="status">Status changes</option>
              <option value="permission">Permissions updated</option>
            </select>
          </div>

          {/* Actor */}
          <div className="cg-rp-field-group">
            <label className="cg-rp-field-label">Actor</label>
            <div className="cg-rp-input-wrapper">
              <input
                type="text"
                className="cg-rp-input with-icon-left"
                placeholder="Search by name..."
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
              />
              <IconSearch className="left" size={14} />
            </div>
          </div>

          {/* Date Range */}
          <div className="cg-rp-field-group">
            <label className="cg-rp-field-label">Date Range</label>
            <div className="cg-rp-input-wrapper">
              <input
                type="text"
                className="cg-rp-input with-icon-right"
                placeholder="dd-mm-yyyy - dd-mm-yyyy"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              />
              <IconCalendar className="right" size={14} />
            </div>
          </div>

          {/* Status */}
          <div className="cg-rp-field-group">
            <label className="cg-rp-field-label">Status</label>
            <select
              className="cg-rp-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem" }}>
          <button
            type="button"
            className="cg-rp-btn cg-rp-btn-ghost"
            onClick={handleClear}
          >
            <IconRefresh size={14} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Audit Records Table Card */}
      <div className="cg-rp-panel">
        <header className="cg-rp-panel-header">
          <div className="cg-rp-panel-title-wrap">
            <h3 className="cg-rp-panel-title">
              Audit Records ({filteredEvents.length})
            </h3>
            <p className="cg-rp-panel-subtitle">Authenticated activity ledger</p>
          </div>

          <button
            type="button"
            className="cg-rp-btn"
            onClick={handleExportCSV}
            disabled={!filteredEvents.length}
          >
            <IconDownload size={14} />
            <span>Export</span>
          </button>
        </header>

        <div className="cg-rp-table-wrap">
          <table className="cg-rp-audit-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Actor</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!paginatedEvents.length ? (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748B" }}>
                    No security events match the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((event, idx) => {
                  const dateStr = new Date(event.occurredAt).toLocaleString();

                  return (
                    <tr key={`${event.occurredAt}-${idx}`}>
                      <td>
                        <div className="cg-rp-audit-event-cell">
                          {getEventIcon(event.actionLabel)}
                          <span>{event.actionLabel}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#0F172A" }}>
                          {event.actorDisplay}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#64748B", fontSize: "0.75rem" }}>
                          {dateStr}
                        </span>
                      </td>
                      <td>
                        <span className="cg-rp-badge active">
                          {event.outcome ? event.outcome.charAt(0).toUpperCase() + event.outcome.slice(1) : "Confirmed"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="cg-rp-btn cg-rp-btn-ghost"
                          style={{ width: "1.85rem", height: "1.85rem", padding: 0 }}
                          onClick={() => setActiveEventDetail(event)}
                          title="View Event Details"
                        >
                          <IconMoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Proper Pagination Footer with Page Size Selector & Controls */}
        <footer className="cg-rp-panel-footer">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span>
              Showing{" "}
              <strong>
                {filteredEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>
              –
              <strong>
                {Math.min(currentPage * pageSize, filteredEvents.length)}
              </strong>{" "}
              of <strong>{filteredEvents.length}</strong>
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Per page:</span>
              <select
                className="cg-rp-select"
                style={{ height: "1.75rem", width: "4rem", padding: "0 0.35rem", fontSize: "0.725rem" }}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            {/* Pagination page buttons */}
            <div className="cg-rp-pagination-controls">
              <button
                type="button"
                className="cg-rp-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <IconChevronLeft size={13} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    type="button"
                    className={`cg-rp-page-btn ${currentPage === page ? "active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                className="cg-rp-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <IconChevronRight size={13} />
              </button>
            </div>

            {/* Cursor pagination trigger to fetch next batch from server */}
            {historyCursor && (
              <button
                type="button"
                className="cg-rp-btn cg-rp-btn-primary"
                style={{ height: "1.9rem", fontSize: "0.725rem", padding: "0 0.65rem" }}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <IconSpinner size={13} />}
                <span>{loadingMore ? "Loading…" : "Fetch More from Server"}</span>
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Event Details Modal */}
      <AnimatePresence>
        {activeEventDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="cg-rp-drawer-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveEventDetail(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.16 }}
              style={{
                background: "#FFFFFF",
                borderRadius: "0.75rem",
                width: "min(100%, 28rem)",
                margin: "auto",
                padding: "1.25rem",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0F172A" }}>
                  Security Event Details
                </h4>
                <button
                  type="button"
                  className="cg-rp-btn cg-rp-btn-ghost"
                  style={{ width: "1.85rem", height: "1.85rem", padding: 0 }}
                  onClick={() => setActiveEventDetail(null)}
                >
                  <IconX size={15} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.775rem" }}>
                <div><strong>Action:</strong> {activeEventDetail.actionLabel}</div>
                <div><strong>Actor:</strong> {activeEventDetail.actorDisplay}</div>
                <div><strong>Target:</strong> {activeEventDetail.targetDisplay}</div>
                <div><strong>Outcome:</strong> {activeEventDetail.outcome}</div>
                <div><strong>Timestamp:</strong> {new Date(activeEventDetail.occurredAt).toLocaleString()}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="cg-rp-btn cg-rp-btn-primary"
                  onClick={() => setActiveEventDetail(null)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
