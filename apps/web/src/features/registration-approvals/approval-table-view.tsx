"use client";

import React from "react";
import type { CG03CaseView } from "./registration-approvals-types";
import { IconArrowRight } from "./registration-approvals-icons";

interface ApprovalTableViewProps {
  cases: CG03CaseView[];
  loading: boolean;
  selectedCaseRefs: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectCase: (caseRef: string) => void;
  onViewCase: (entry: CG03CaseView) => void;
  onCorrectCase: (entry: CG03CaseView) => void;
  mayPropose: boolean;
  hasFirstReviewerStep?: boolean;
}

function getInitials(name: string): string {
  if (!name) return "CG";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatSubmittedDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return dateStr;
  }
}

function renderStatusBadge(status: string) {
  switch (status) {
    case "SUBMITTED":
      return <span className="cg-ra-badge badge-submitted"><span className="cg-ra-badge-dot" />Submitted for review</span>;
    case "IN_REVIEW":
      return <span className="cg-ra-badge badge-in-review"><span className="cg-ra-badge-dot" />In Review</span>;
    case "RETURNED":
      return <span className="cg-ra-badge badge-returned"><span className="cg-ra-badge-dot" />Returned</span>;
    case "FINAL_APPROVED":
      return <span className="cg-ra-badge badge-approved"><span className="cg-ra-badge-dot" />Approved</span>;
    case "OWNER_COMPLETED":
      return <span className="cg-ra-badge badge-approved"><span className="cg-ra-badge-dot" />Access change confirmed</span>;
    case "PENDING_OWNER":
      return <span className="cg-ra-badge badge-pending-owner"><span className="cg-ra-badge-dot" />Applying access</span>;
    case "REJECTED":
      return <span className="cg-ra-badge badge-rejected"><span className="cg-ra-badge-dot" />Rejected</span>;
    default:
      return <span className="cg-ra-badge badge-pending"><span className="cg-ra-badge-dot" />{status}</span>;
  }
}

function getStepLabel(entry: CG03CaseView, hasFirstReviewerStep?: boolean): string {
  if (entry.status === "REJECTED") return "—";
  if (entry.status === "RETURNED") return "Correction";
  if (entry.status === "FINAL_APPROVED" || entry.status === "OWNER_COMPLETED") return "Completed";
  if (entry.status === "SUBMITTED" || entry.status === "IN_REVIEW") {
    if (entry.currentStep === 1) {
      return hasFirstReviewerStep ? "Initial Review" : "Final Review";
    }
    if (entry.currentStep === 2) {
      return "Final Review";
    }
  }
  return "Review";
}

export function ApprovalTableView({
  cases,
  loading,
  selectedCaseRefs,
  onToggleSelectAll,
  onToggleSelectCase,
  onViewCase,
  onCorrectCase,
  mayPropose,
  hasFirstReviewerStep
}: ApprovalTableViewProps) {
  const allSelected = cases.length > 0 && cases.every((c) => selectedCaseRefs.has(c.caseRef));
  const someSelected = cases.some((c) => selectedCaseRefs.has(c.caseRef)) && !allSelected;

  return (
    <>
      {/* Desktop Table View for screen widths >= 48rem */}
      <div className="cg-ra-desktop-table-container">
        <div className="cg-ra-table-wrap">
          <table className="cg-ra-table">
            <thead>
              <tr>
                <th style={{ width: "42px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    className="cg-ra-checkbox"
                    aria-label="Select all applications"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={onToggleSelectAll}
                    disabled={loading || cases.length === 0}
                  />
                </th>
                <th>Application ID</th>
                <th>Account</th>
                <th>Proposed Role</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Current Step</th>
                <th style={{ textAlign: "right", paddingRight: "1.25rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="cg-ra-empty-state cg-module-empty">
                      <p className="cg-ra-empty-title">No protected access applications found</p>
                      <p className="cg-ra-empty-desc">
                        Try adjusting your filters or search terms to locate specific records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                cases.map((entry) => {
                  const isSelected = selectedCaseRefs.has(entry.caseRef);
                  return (
                    <tr
                      key={entry.caseRef}
                      className={isSelected ? "row-selected" : ""}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          className="cg-ra-checkbox"
                          aria-label={`Select application ${entry.reference}`}
                          checked={isSelected}
                          onChange={() => onToggleSelectCase(entry.caseRef)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cg-ra-case-link"
                          onClick={() => onViewCase(entry)}
                          title={`View details for ${entry.reference}`}
                        >
                          {entry.reference}
                        </button>
                      </td>
                      <td>
                        <div className="cg-ra-account-cell">
                          <div className="cg-ra-avatar">{getInitials(entry.accountName)}</div>
                          <span className="cg-ra-account-name">{entry.accountName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cg-ra-role-name">{entry.roleName}</span>
                      </td>
                      <td>{renderStatusBadge(entry.status)}</td>
                      <td>
                        <span className="cg-ra-submitted-time">
                          {formatSubmittedDate(entry.submittedAt)}
                        </span>
                      </td>
                      <td>
                        <span className="cg-ra-step-label">
                          {getStepLabel(entry, hasFirstReviewerStep)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="cg-ra-table-actions">
                          <button
                            type="button"
                            className="cg-ra-btn-table-action"
                            onClick={() => onViewCase(entry)}
                          >
                            View <IconArrowRight size={14} />
                          </button>
                          {mayPropose && entry.status === "RETURNED" && (
                            <button
                              type="button"
                              className="cg-ra-btn-table-correction"
                              onClick={() => onCorrectCase(entry)}
                              title="Submit correction for returned request"
                            >
                              Correct
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout for screen widths < 48rem */}
      <div className="cg-ra-mobile-card-list">
        {cases.length === 0 ? (
          <div className="cg-ra-empty-state">
            <p className="cg-ra-empty-title">No protected access applications found</p>
            <p className="cg-ra-empty-desc">
              Try adjusting your filters or search terms to locate specific records.
            </p>
          </div>
        ) : (
          cases.map((entry) => {
            const isSelected = selectedCaseRefs.has(entry.caseRef);
            return (
              <div
                key={entry.caseRef}
                className={`cg-ra-mobile-card ${isSelected ? "selected" : ""}`}
              >
                <div className="cg-ra-mobile-card-header">
                  <div className="cg-ra-mobile-card-id-wrap">
                    <input
                      type="checkbox"
                      className="cg-ra-checkbox"
                      aria-label={`Select application ${entry.reference}`}
                      checked={isSelected}
                      onChange={() => onToggleSelectCase(entry.caseRef)}
                    />
                    <button
                      type="button"
                      className="cg-ra-case-link"
                      onClick={() => onViewCase(entry)}
                    >
                      {entry.reference}
                    </button>
                  </div>
                  <div>{renderStatusBadge(entry.status)}</div>
                </div>

                <div className="cg-ra-mobile-card-body">
                  <div className="cg-ra-account-cell">
                    <div className="cg-ra-avatar">{getInitials(entry.accountName)}</div>
                    <div>
                      <div className="cg-ra-account-name">{entry.accountName}</div>
                      <div className="cg-ra-role-name">{entry.roleName}</div>
                    </div>
                  </div>

                  <div className="cg-ra-mobile-card-meta">
                    <span className="cg-ra-submitted-time">
                      {formatSubmittedDate(entry.submittedAt)}
                    </span>
                    <span className="cg-ra-step-label">
                      Step: {getStepLabel(entry, hasFirstReviewerStep)}
                    </span>
                  </div>
                </div>

                <div className="cg-ra-mobile-card-footer">
                  {mayPropose && entry.status === "RETURNED" && (
                    <button
                      type="button"
                      className="cg-ra-btn-table-correction"
                      onClick={() => onCorrectCase(entry)}
                      title="Submit correction for returned request"
                    >
                      Correct
                    </button>
                  )}
                  <button
                    type="button"
                    className="cg-ra-btn-table-action"
                    onClick={() => onViewCase(entry)}
                  >
                    View Details <IconArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
