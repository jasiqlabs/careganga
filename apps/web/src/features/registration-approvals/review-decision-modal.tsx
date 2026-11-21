"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CG03CaseDetail, DecisionActionType } from "./registration-approvals-types";
import {
  IconX,
  IconEye,
  IconCheck,
  IconCornerDownLeft,
  IconArrowRight,
  IconShield,
  IconUser,
  IconGitBranch,
  IconFileText,
  IconLock
} from "./registration-approvals-icons";

interface ReviewDecisionModalProps {
  isOpen: boolean;
  busy: boolean;
  detail: CG03CaseDetail | null;
  selectedAction: DecisionActionType | null;
  remarks: string;
  hasPasswordProof: boolean;
  onConfirmSubmit: () => void;
  onCancel: () => void;
}

function renderDecisionBadge(action: DecisionActionType) {
  switch (action) {
    case "APPROVE":
      return (
        <span className="cg-ra-decision-chip approve">
          <IconCheck size={15} /> Approve
        </span>
      );
    case "FORWARD":
      return (
        <span className="cg-ra-decision-chip forward">
          <IconArrowRight size={15} /> Forward
        </span>
      );
    case "RETURN":
      return (
        <span className="cg-ra-decision-chip return">
          <IconCornerDownLeft size={15} /> Send Back
        </span>
      );
    case "REJECT":
      return (
        <span className="cg-ra-decision-chip reject">
          <IconX size={15} /> Reject
        </span>
      );
  }
}

export function ReviewDecisionModal({
  isOpen,
  busy,
  detail,
  selectedAction,
  remarks,
  hasPasswordProof,
  onConfirmSubmit,
  onCancel
}: ReviewDecisionModalProps) {
  if (!isOpen || !detail || !selectedAction) return null;

  return (
    <AnimatePresence>
      <div className="cg-ra-modal-backdrop" role="presentation" onClick={onCancel}>
        <motion.div
          className="cg-ra-modal-card md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cg-ra-confirm-title"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {/* Header matching Wireframe Panel 4 */}
          <div className="cg-ra-modal-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="cg-ra-icon-badge blue">
                <IconEye size={22} />
              </div>
              <div>
                <h3 id="cg-ra-confirm-title" className="cg-ra-modal-title">
                  Review Application
                </h3>
                <p className="cg-ra-modal-subtitle">
                  Verify the details and add your decision remarks before submitting.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cg-ra-modal-close-btn"
              onClick={onCancel}
              disabled={busy}
              aria-label="Close"
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="cg-ra-modal-body">
            {/* 2-column details grid matching Wireframe Panel 4 */}
            <div className="cg-ra-overview-grid-box">
              <div className="cg-ra-grid-cell">
                <span className="cell-label">Application ID</span>
                <strong className="cell-value">{detail.reference}</strong>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">Current Status</span>
                <span className="cg-ra-badge badge-in-review">
                  <span className="cg-ra-badge-dot" /> In Review
                </span>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">
                  <IconUser size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />
                  Account
                </span>
                <strong className="cell-value">{detail.accountName}</strong>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">
                  <IconShield size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />
                  Proposed Role
                </span>
                <strong className="cell-value">{detail.roleName}</strong>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">Proposal Revision</span>
                <span className="cell-value">{detail.proposalRevision}</span>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">Process Version</span>
                <span className="cell-value">{detail.processVersion}</span>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">Account Revision</span>
                <span className="cell-value font-mono">{detail.sourceAccountAccessRevision}</span>
              </div>

              <div className="cg-ra-grid-cell">
                <span className="cell-label">Role Revision</span>
                <span className="cell-value">{detail.sourceRoleRevision}</span>
              </div>
            </div>

            {/* Selected Decision */}
            <div className="cg-ra-form-group" style={{ marginTop: "1rem" }}>
              <label className="cg-ra-label">
                Decision <span className="req">*</span>
              </label>
              <div className="cg-ra-decision-chips-row">
                {renderDecisionBadge(selectedAction)}
              </div>
            </div>

            {/* Reviewer Remarks */}
            <div className="cg-ra-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="cg-ra-label">
                  Reviewer Remarks <span className="req">*</span>
                </label>
                <span className="cg-ra-char-counter">{remarks.length} / 300</span>
              </div>
              <div className="cg-ra-remarks-display">
                {remarks.trim() ? remarks : <span className="text-muted">No remarks entered.</span>}
              </div>
            </div>

            {/* Security Proof Notice */}
            <div className="cg-ra-info-box">
              <p>
                <strong>Permanent Record:</strong> Submitting will record an immutable reviewer entry.
                {hasPasswordProof && " Super Admin identity verified."} Access changes are applied only after verified finalization.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="cg-ra-modal-footer">
            <button
              type="button"
              className="cg-ra-btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cg-ra-btn-primary"
              onClick={onConfirmSubmit}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="cg-ra-spinner-sm" /> Submitting decision…
                </>
              ) : (
                <>
                  Submit Decision <IconArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
