"use client";

import React, { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CG03Option } from "./registration-approvals-types";
import {
  IconX,
  IconUserPlus,
  IconUser,
  IconShield,
  IconSearch,
  IconInfo,
  IconArrowRight,
  IconAlertTriangle
} from "./registration-approvals-icons";

interface CreateApplicationModalProps {
  isOpen: boolean;
  busy: boolean;
  isCorrection: boolean;
  accountQuery: string;
  onAccountQueryChange: (q: string) => void;
  roleQuery: string;
  onRoleQueryChange: (q: string) => void;
  accounts: CG03Option[];
  roles: CG03Option[];
  selectedAccount: string;
  onSelectAccount: (acc: string) => void;
  selectedRole: string;
  onSelectRole: (role: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function CreateApplicationModal({
  isOpen,
  busy,
  isCorrection,
  accountQuery,
  onAccountQueryChange,
  roleQuery,
  onRoleQueryChange,
  accounts,
  roles,
  selectedAccount,
  onSelectAccount,
  selectedRole,
  onSelectRole,
  onSubmit,
  onClose
}: CreateApplicationModalProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState({ account: false, role: false });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ account: true, role: true });
    if (!selectedAccount || !selectedRole) {
      return;
    }
    onSubmit(e);
  }

  const accountError = touched.account && !selectedAccount;
  const roleError = touched.role && !selectedRole;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="cg-ra-modal-backdrop" role="presentation" onClick={onClose}>
          <motion.div
            className="cg-ra-modal-card lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-ra-create-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="cg-ra-modal-header">
              <div className="cg-ra-modal-header-info">
                <div className="cg-ra-icon-badge green">
                  <IconUserPlus size={20} />
                </div>
                <div className="cg-ra-modal-header-text">
                  <h3 id="cg-ra-create-title" className="cg-ra-modal-title">
                    {isCorrection ? "Correct Returned Request" : "Request Protected Role Access"}
                  </h3>
                  <p className="cg-ra-modal-subtitle">
                    {isCorrection
                      ? "Create an updated proposal addressing the reviewer's feedback"
                      : "Create a new approval request for an existing Foundation account"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="cg-ra-modal-close-btn"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cg-ra-form">
              <div className="cg-ra-form-body">
                {/* 2-column inputs: Account & Role */}
                <div className="cg-ra-form-row">
                  {/* Select Account */}
                  <div className="cg-ra-form-group">
                    <label htmlFor="cg-ra-account-select" className="cg-ra-label">
                      Select Account <span className="req">*</span>
                    </label>

                    {/* Filter account search input */}
                    <div className="cg-ra-input-with-icon" style={{ marginBottom: "0.25rem" }}>
                      <IconSearch size={15} className="icon" />
                      <input
                        type="text"
                        className="cg-ra-input"
                        placeholder="Search active Foundation account…"
                        maxLength={70}
                        value={accountQuery}
                        onChange={(e) => onAccountQueryChange(e.target.value)}
                        disabled={busy}
                      />
                    </div>

                    <div className="cg-ra-select-wrap">
                      <select
                        id="cg-ra-account-select"
                        className={`cg-ra-input select ${accountError ? "error" : ""}`}
                        value={selectedAccount}
                        onChange={(e) => {
                          onSelectAccount(e.target.value);
                          setTouched((prev) => ({ ...prev, account: true }));
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, account: true }))}
                        required
                        disabled={busy}
                      >
                        <option value="">Choose an eligible staff account</option>
                        {accounts.map((acc) => (
                          <option key={acc.value} value={acc.value}>
                            {acc.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {accountError && (
                      <span className="cg-ra-error-message">
                        <IconAlertTriangle size={13} /> Please select an eligible account.
                      </span>
                    )}
                  </div>

                  {/* Proposed Role */}
                  <div className="cg-ra-form-group">
                    <label htmlFor="cg-ra-role-select" className="cg-ra-label">
                      Proposed Role <span className="req">*</span>
                    </label>

                    {/* Filter role search input */}
                    <div className="cg-ra-input-with-icon" style={{ marginBottom: "0.25rem" }}>
                      <IconSearch size={15} className="icon" />
                      <input
                        type="text"
                        className="cg-ra-input"
                        placeholder="Search protected custom role…"
                        maxLength={70}
                        value={roleQuery}
                        onChange={(e) => onRoleQueryChange(e.target.value)}
                        disabled={busy}
                      />
                    </div>

                    <div className="cg-ra-select-wrap">
                      <select
                        id="cg-ra-role-select"
                        className={`cg-ra-input select ${roleError ? "error" : ""}`}
                        value={selectedRole}
                        onChange={(e) => {
                          onSelectRole(e.target.value);
                          setTouched((prev) => ({ ...prev, role: true }));
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, role: true }))}
                        required
                        disabled={busy}
                      >
                        <option value="">Choose a role requiring approval</option>
                        {roles.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {roleError && (
                      <span className="cg-ra-error-message">
                        <IconAlertTriangle size={13} /> Please select a valid role.
                      </span>
                    )}
                  </div>
                </div>

                {/* Request Reason */}
                <div className="cg-ra-form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label htmlFor="cg-ra-request-reason" className="cg-ra-label">
                      Request Reason <span className="opt">(Optional)</span>
                    </label>
                    <span className="cg-ra-char-counter">{reason.length} / 300</span>
                  </div>
                  <textarea
                    id="cg-ra-request-reason"
                    className="cg-ra-textarea"
                    placeholder="Explain why this role is required (e.g., role responsibilities, scope, etc.)"
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                    rows={3}
                  />
                  <span className="cg-ra-helper-text">
                    Provides helpful context for the reviewing Super Admin during verification.
                  </span>
                </div>

                {/* Info Callout */}
                <div className="cg-ra-info-box">
                  <IconInfo size={18} className="cg-ra-info-icon" />
                  <div>
                    <strong style={{ color: "#1D4ED8" }}>Note:</strong> Current account and role revisions will be securely frozen when you submit. Corrections will create a new application; earlier decisions are kept.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="cg-ra-modal-footer">
                <button
                  type="button"
                  className="cg-ra-btn-secondary"
                  onClick={onClose}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cg-ra-btn-primary"
                  disabled={busy || !selectedAccount || !selectedRole}
                >
                  {busy ? "Submitting…" : (
                    <>
                      Submit for approval <IconArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
