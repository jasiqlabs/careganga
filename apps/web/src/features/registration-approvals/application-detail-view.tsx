"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  CG03CaseDetail,
  CG03OwnerOutcome,
  DecisionActionType
} from "./registration-approvals-types";
import {
  IconX,
  IconArrowLeft,
  IconUser,
  IconShield,
  IconGitBranch,
  IconFileText,
  IconLock,
  IconCheck,
  IconCornerDownLeft,
  IconRefresh,
  IconMoreHorizontal,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
  IconInfo
} from "./registration-approvals-icons";
import { ApplicationDetailSkeleton } from "./registration-approvals-skeletons";

interface ApplicationDetailViewProps {
  isOpen: boolean;
  detail: CG03CaseDetail | null;
  detailBusy: boolean;
  ownerOutcome: CG03OwnerOutcome | null;
  ownerBusy: boolean;
  decisionUnknown: boolean;
  busy: boolean;
  mayReview: boolean;
  onClose: () => void;
  onRefreshCase: () => void;
  onVerifyDecision: () => void;
  onRetryOwner: () => void;
  onRequestDecisionReview: (
    action: DecisionActionType,
    remarks: string,
    password: string
  ) => void;
}

function renderDetailStatusBadge(status: string) {
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

export function ApplicationDetailView({
  isOpen,
  detail,
  detailBusy,
  ownerOutcome,
  ownerBusy,
  decisionUnknown,
  busy,
  mayReview,
  onClose,
  onRefreshCase,
  onVerifyDecision,
  onRetryOwner,
  onRequestDecisionReview
}: ApplicationDetailViewProps) {
  const [selectedAction, setSelectedAction] = useState<DecisionActionType | null>(null);
  const [remarks, setRemarks] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");

  if (!isOpen) return null;

  function handleActionClick(action: DecisionActionType) {
    setSelectedAction(action);
    setValidationError("");
  }

  function handleProceedToReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAction) return;

    if (detail?.requiresCurrentPassword && (!password || password.length < 8)) {
      setValidationError("A current password (min 8 characters) is required for this decision.");
      return;
    }

    setValidationError("");
    onRequestDecisionReview(selectedAction, remarks, password);
  }

  return (
    <div className="cg-ra-modal-backdrop" role="presentation" onClick={onClose}>
      <motion.div
        className="cg-ra-modal-card xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-ra-detail-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {/* Top Header */}
        <div className="cg-ra-modal-header detail-header">
          <div className="cg-ra-detail-title-wrap">
            <button
              type="button"
              className="cg-ra-btn-icon-back"
              onClick={onClose}
              aria-label="Back to applications list"
            >
              <IconArrowLeft size={18} />
            </button>
            <h3 id="cg-ra-detail-title" className="cg-ra-detail-reference">
              {detail?.reference ?? "Loading Application Details…"}
            </h3>
            {detail && renderDetailStatusBadge(detail.status)}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              className="cg-ra-btn-icon"
              onClick={onRefreshCase}
              title="Refresh application data"
              disabled={detailBusy || busy}
            >
              <IconRefresh size={16} className={detailBusy ? "spinning" : ""} />
            </button>
            <button
              type="button"
              className="cg-ra-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="cg-ra-detail-body">
          {detailBusy || !detail ? (
            <ApplicationDetailSkeleton />
          ) : (
            <>
              {/* Two Column Layout: Overview + Approval History */}
              <div className="cg-ra-detail-grid">
                {/* Column 1: Application Overview */}
                <div className="cg-ra-detail-card">
                  <div className="cg-ra-card-header">
                    <h4 className="cg-ra-card-title">Application Overview</h4>
                  </div>
                  <div className="cg-ra-overview-list">
                    <div className="cg-ra-overview-item">
                      <div className="item-label">
                        <IconUser size={16} className="icon" /> Account
                      </div>
                      <div className="item-value">
                        <strong>{detail.accountName}</strong>
                      </div>
                    </div>

                    <div className="cg-ra-overview-item">
                      <div className="item-label">
                        <IconShield size={16} className="icon" /> Proposed Role
                      </div>
                      <div className="item-value">
                        <span className="cg-ra-role-pill">{detail.roleName}</span>
                      </div>
                    </div>

                    <div className="cg-ra-overview-item">
                      <div className="item-label">
                        <IconFileText size={16} className="icon" /> Proposal Revision
                      </div>
                      <div className="item-value">{detail.proposalRevision}</div>
                    </div>

                    <div className="cg-ra-overview-item">
                      <div className="item-label">
                        <IconGitBranch size={16} className="icon" /> Process Version
                      </div>
                      <div className="item-value">{detail.processVersion}</div>
                    </div>

                    <div className="cg-ra-overview-item">
                      <div className="item-label">
                        <IconLock size={16} className="icon" /> Frozen Account Access Revision
                      </div>
                      <div className="item-value font-mono">{detail.sourceAccountAccessRevision}</div>
                    </div>

                    <div className="cg-ra-overview-item">
                      <div className="item-label">
                        <IconFileText size={16} className="icon" /> Frozen Role Revision
                      </div>
                      <div className="item-value">{detail.sourceRoleRevision}</div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Approval History Timeline */}
                <div className="cg-ra-detail-card">
                  <div className="cg-ra-card-header">
                    <h4 className="cg-ra-card-title">Approval History</h4>
                  </div>

                  <div className="cg-ra-timeline">
                    {!detail.history || detail.history.length === 0 ? (
                      <p className="cg-ra-empty-history">No decision events recorded yet.</p>
                    ) : (
                      detail.history.map((evt, idx) => {
                        const isSubmit = evt.action === "SUBMITTED" || evt.action === "CORRECTED";
                        const isApprove =
                          evt.action === "APPROVE" ||
                          evt.action === "APPROVED" ||
                          evt.action === "FINAL_APPROVED";
                        const isConfirmed = evt.action === "OWNER_COMPLETED";
                        const isPendingOwner = evt.action === "PENDING_OWNER";
                        const isInReview = evt.action === "IN_REVIEW" || evt.action === "AWAITING_REVIEW";
                        const isReject = evt.action === "REJECT" || evt.action === "REJECTED";
                        const isReturn = evt.action === "RETURN" || evt.action === "RETURNED";
                        const isBlocked =
                          evt.action === "OWNER_BLOCKED" ||
                          evt.action === "OWNER_FAILED_RETRYABLE" ||
                          evt.action === "FAILED";

                        // Status-based semantic color mapping according to CG-03 approval rules
                        const dotClass = (isApprove || isConfirmed || isSubmit)
                          ? "green"
                          : isReject
                          ? "red"
                          : isReturn
                          ? "amber"
                          : isPendingOwner
                          ? "blue-soft"
                          : isBlocked
                          ? "red"
                          : isInReview
                          ? "blue"
                          : "blue";

                        return (
                          <div key={idx} className="cg-ra-timeline-item">
                            <div className={`cg-ra-timeline-dot ${dotClass}`}>
                              {isApprove || isConfirmed || isSubmit ? (
                                <IconCheck size={12} />
                              ) : isReject || isBlocked ? (
                                <IconX size={12} />
                              ) : (
                                <span className="inner-dot" />
                              )}
                            </div>
                            <div className="cg-ra-timeline-content">
                              <div className="cg-ra-timeline-action">
                                <strong>
                                  {evt.action === "SUBMITTED"
                                    ? "Submitted"
                                    : evt.action === "CORRECTED"
                                    ? "Submitted Correction"
                                    : evt.action === "APPROVE" || evt.action === "APPROVED"
                                    ? "Initial Review Approved"
                                    : evt.action === "FINAL_APPROVED"
                                    ? "Final Approval Recorded"
                                    : evt.action === "OWNER_COMPLETED"
                                    ? "Access Confirmed in Ledger"
                                    : evt.action === "PENDING_OWNER"
                                    ? "Applying Approved Access"
                                    : evt.action === "OWNER_BLOCKED"
                                    ? "Access Blocked / Revision Mismatch"
                                    : evt.action === "OWNER_FAILED_RETRYABLE"
                                    ? "Access Finalization Pending Retry"
                                    : evt.action === "RETURN" || evt.action === "RETURNED"
                                    ? "Returned for Correction"
                                    : evt.action === "REJECT" || evt.action === "REJECTED"
                                    ? "Rejected"
                                    : evt.action}
                                </strong>
                              </div>
                              <div className="cg-ra-timeline-meta">
                                By {evt.by} • {new Date(evt.at).toLocaleString()}
                              </div>
                              {evt.remarks && (
                                <div className="cg-ra-timeline-remarks">
                                  <strong>Remarks:</strong> {evt.remarks}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Pending next step indicator if application is in progress */}
                    {["SUBMITTED", "IN_REVIEW", "PENDING_OWNER"].includes(detail.status) && (
                      <div className="cg-ra-timeline-item pending">
                        <div className="cg-ra-timeline-dot outline">
                          <span className="inner-dot" />
                        </div>
                        <div className="cg-ra-timeline-content">
                          <div className="cg-ra-timeline-action">
                            <strong>
                              {detail.status === "PENDING_OWNER"
                                ? "Pending Owner Finalization"
                                : "Pending Review Decision"}
                            </strong>
                          </div>
                          <div className="cg-ra-timeline-meta">
                            {detail.status === "PENDING_OWNER"
                              ? "Waiting for verified role assignment in account ledger"
                              : "Awaiting review and verified Super Admin confirmation"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Security Warning Information Banner */}
              <div className="cg-ra-security-callout">
                <IconShield size={20} className="icon" />
                <p>
                  <strong>Security Policy:</strong> Approval is not an access grant. The account source applies changes only after a verified final decision.
                </p>
              </div>

              {/* Decision Unknown Verification Section */}
              {decisionUnknown && (
                <div className="cg-ra-warning-box" role="alert">
                  <IconAlertTriangle size={20} />
                  <div>
                    <strong>Review outcome needs verification</strong>
                    <p>Do not send another approval or rejection until the original result is known.</p>
                  </div>
                  <button
                    type="button"
                    className="cg-ra-btn-secondary"
                    disabled={busy}
                    onClick={onVerifyDecision}
                  >
                    Check Previous Decision
                  </button>
                </div>
              )}

              {/* Permitted Reviewer Decisions Section */}
              {!decisionUnknown && detail.allowedDecisions && detail.allowedDecisions.length > 0 && (
                <div className="cg-ra-review-box">
                  <h4 className="cg-ra-review-title">Review Decision</h4>
                  <p className="cg-ra-review-subtitle">
                    Select a decision action and provide review remarks. You will review and confirm all details before final submission.
                  </p>

                  {/* Decision Action Buttons */}
                  <div className="cg-ra-decision-buttons-row">
                    {detail.allowedDecisions.includes("APPROVE") && (
                      <button
                        type="button"
                        className={`cg-ra-btn-decision approve ${selectedAction === "APPROVE" ? "selected" : ""}`}
                        onClick={() => handleActionClick("APPROVE")}
                        disabled={busy}
                      >
                        <IconCheck size={18} /> Approve
                      </button>
                    )}

                    {detail.allowedDecisions.includes("FORWARD") && (
                      <button
                        type="button"
                        className={`cg-ra-btn-decision forward ${selectedAction === "FORWARD" ? "selected" : ""}`}
                        onClick={() => handleActionClick("FORWARD")}
                        disabled={busy}
                      >
                        <IconArrowLeft size={18} style={{ transform: "rotate(180deg)" }} /> Forward
                      </button>
                    )}

                    {detail.allowedDecisions.includes("RETURN") && (
                      <button
                        type="button"
                        className={`cg-ra-btn-decision return ${selectedAction === "RETURN" ? "selected" : ""}`}
                        onClick={() => handleActionClick("RETURN")}
                        disabled={busy}
                      >
                        <IconCornerDownLeft size={18} /> Send Back
                      </button>
                    )}

                    {detail.allowedDecisions.includes("REJECT") && (
                      <button
                        type="button"
                        className={`cg-ra-btn-decision reject ${selectedAction === "REJECT" ? "selected" : ""}`}
                        onClick={() => handleActionClick("REJECT")}
                        disabled={busy}
                      >
                        <IconX size={18} /> Reject
                      </button>
                    )}
                  </div>

                  {/* Remarks & Password Form */}
                  {selectedAction && (
                    <form onSubmit={handleProceedToReview} className="cg-ra-decision-form">
                      <div className="cg-ra-form-group">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label htmlFor="cg-ra-remarks" className="cg-ra-label">
                            Reviewer Remarks <span className="opt">(Optional)</span>
                          </label>
                          <span className="cg-ra-char-counter">{remarks.length} / 300</span>
                        </div>
                        <textarea
                          id="cg-ra-remarks"
                          className="cg-ra-textarea"
                          maxLength={300}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Add comments or justification for this decision (e.g. all checks completed, verified qualifications, etc.)"
                          disabled={busy}
                          rows={3}
                        />
                      </div>

                      {detail.requiresCurrentPassword && (
                        <div className="cg-ra-form-group">
                          <label htmlFor="cg-ra-decision-password" className="cg-ra-label">
                            Current Password <span className="req">*</span>
                          </label>
                          <div className="cg-ra-password-input-wrap">
                            <input
                              id="cg-ra-decision-password"
                              type={showPassword ? "text" : "password"}
                              className={`cg-ra-input ${validationError ? "error" : ""}`}
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                if (validationError) setValidationError("");
                              }}
                              placeholder="Enter your current Foundation password"
                              autoComplete="current-password"
                              required
                              minLength={8}
                              maxLength={1024}
                              disabled={busy}
                            />
                            <button
                              type="button"
                              className="cg-ra-password-toggle-btn"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              tabIndex={-1}
                            >
                              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                            </button>
                          </div>
                          <span className="cg-ra-helper-text">
                            Foundation Super Admin re-authentication is required to record a final decision.
                          </span>
                        </div>
                      )}

                      {validationError && (
                        <div className="cg-ra-error-message" style={{ margin: "0.5rem 0" }}>
                          <IconAlertTriangle size={14} /> {validationError}
                        </div>
                      )}

                      <div className="cg-ra-decision-form-actions">
                        <button
                          type="button"
                          className="cg-ra-btn-secondary"
                          onClick={() => {
                            setSelectedAction(null);
                            setRemarks("");
                            setPassword("");
                            setValidationError("");
                          }}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="cg-ra-btn-primary"
                          disabled={busy}
                        >
                          Review Decision
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
