"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconLock, IconEye, IconEyeOff, IconGitBranch } from "./registration-approvals-icons";

interface VersionProcessModalProps {
  isOpen: boolean;
  busy: boolean;
  firstReviewer: "NONE" | "ACCESS_MANAGER";
  onFirstReviewerChange: (val: "NONE" | "ACCESS_MANAGER") => void;
  currentPassword: string;
  onCurrentPasswordChange: (val: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function VersionProcessModal({
  isOpen,
  busy,
  firstReviewer,
  onFirstReviewerChange,
  currentPassword,
  onCurrentPasswordChange,
  onSubmit,
  onClose
}: VersionProcessModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentPassword || currentPassword.length < 8) {
      setPasswordError("Please enter your current password (min 8 characters).");
      return;
    }
    setPasswordError("");
    onSubmit(e);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="cg-ra-modal-backdrop" role="presentation" onClick={onClose}>
          <motion.div
            className="cg-ra-modal-card md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-ra-version-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="cg-ra-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="cg-ra-icon-badge green">
                  <IconGitBranch size={20} />
                </div>
                <div>
                  <h3 id="cg-ra-version-title" className="cg-ra-modal-title">
                    Version Reviewer Route
                  </h3>
                  <p className="cg-ra-modal-subtitle">
                    Configure the multi-step approval workflow for protected Foundation access
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
                {/* Initial Review Step */}
                <div className="cg-ra-form-group">
                  <label htmlFor="cg-ra-first-reviewer" className="cg-ra-label">
                    Initial Review Step <span className="req">*</span>
                  </label>
                  <select
                    id="cg-ra-first-reviewer"
                    className="cg-ra-input select"
                    value={firstReviewer}
                    onChange={(e) =>
                      onFirstReviewerChange(
                        e.target.value === "ACCESS_MANAGER" ? "ACCESS_MANAGER" : "NONE"
                      )
                    }
                    disabled={busy}
                  >
                    <option value="NONE">Final Foundation Super Admin only (1-step)</option>
                    <option value="ACCESS_MANAGER">Access manager, then Super Admin (2-step)</option>
                  </select>
                  <span className="cg-ra-helper-text">
                    Select whether initial verification is handled by an authorized Access Manager before final Super Admin review.
                  </span>
                </div>

                {/* Password field */}
                <div className="cg-ra-form-group">
                  <label htmlFor="cg-ra-current-password" className="cg-ra-label">
                    Current Password <span className="req">*</span>
                  </label>
                  <div className="cg-ra-password-input-wrap">
                    <input
                      id="cg-ra-current-password"
                      type={showPassword ? "text" : "password"}
                      className={`cg-ra-input ${passwordError ? "error" : ""}`}
                      value={currentPassword}
                      onChange={(e) => {
                        onCurrentPasswordChange(e.target.value);
                        if (passwordError) setPasswordError("");
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
                  {passwordError ? (
                    <span className="cg-ra-error-message">
                      <IconLock size={13} /> {passwordError}
                    </span>
                  ) : (
                    <span className="cg-ra-helper-text">
                      Required by Foundation security policy to verify Super Admin authority.
                    </span>
                  )}
                </div>

                {/* Notice callout */}
                <div className="cg-ra-info-box">
                  <p>
                    <strong>Note:</strong> Existing applications retain their pinned reviewer steps. The new version will automatically apply to future submissions.
                  </p>
                </div>
              </div>

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
                  disabled={busy || !currentPassword || currentPassword.length < 8}
                >
                  {busy ? "Saving…" : "Create New Process Version"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
