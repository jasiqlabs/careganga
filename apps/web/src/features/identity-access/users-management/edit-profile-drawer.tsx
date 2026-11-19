"use client";

import type { FormEvent } from "react";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  XIcon,
  EditIcon,
  UserCheckIcon,
  ShieldIcon
} from "./users-management-icons";
import {
  accountStatusLabel,
  formatEmployeeId
} from "./users-management-types";
import type { RoleOption, Notice } from "./users-management-types";

interface EditProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  roles: RoleOption[];
  rolesLoading: boolean;
  roleRef: string;
  onRoleRefChange: (val: string) => void;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  onStatusChange: (status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => void;
  busy: boolean;
  uncertain: boolean;
  notice: Notice | null;
  onSave: () => void;
}

export function EditProfileDrawer({
  isOpen,
  onClose,
  account,
  roles,
  rolesLoading,
  roleRef,
  onRoleRefChange,
  status,
  onStatusChange,
  busy,
  uncertain,
  notice,
  onSave
}: EditProfileDrawerProps) {
  if (!isOpen || !account) return null;

  const empId = formatEmployeeId(account);
  const isStatusActive = status === "ACTIVE";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  const handleToggleStatus = () => {
    if (busy || account.roleProtected) return;
    onStatusChange(isStatusActive ? "SUSPENDED" : "ACTIVE");
  };

  return (
    <div
      className="cg-um-drawer-backdrop"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-edit-profile-title"
        className="cg-um-drawer cg-um-edit-drawer"
      >
        {/* Header */}
        <header className="cg-um-drawer-header">
          <div className="cg-um-drawer-title-group">
            <div className="cg-um-drawer-icon-box blue" aria-hidden="true">
              <EditIcon size={20} />
            </div>
            <div>
              <div className="cg-um-drawer-title-row">
                <h2 id="um-edit-profile-title" className="cg-um-drawer-title">
                  Edit Account Profile
                </h2>
                <span className="cg-um-role-chip primary">
                  {account.roleName || "Staff"}
                </span>
              </div>
              <p className="cg-um-drawer-subtitle">
                Update profile, contact details, and account status
              </p>
            </div>
          </div>

          <button
            type="button"
            className="cg-um-drawer-close-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close edit drawer"
          >
            <XIcon size={18} />
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="cg-um-drawer-form">
          <div className="cg-um-drawer-body">
            {/* Display Name */}
            <div className="cg-um-field">
              <label htmlFor="um-edit-name">
                Full Name <span className="cg-um-required-star">*</span>
              </label>
              <input
                id="um-edit-name"
                type="text"
                value={account.displayName}
                disabled
                className="is-read-only"
                aria-readonly="true"
              />
              <span className="cg-um-field-hint">Primary name is verified via Foundation registration</span>
            </div>

            {/* Email */}
            <div className="cg-um-field">
              <label htmlFor="um-edit-email">
                Work Email Address <span className="cg-um-required-star">*</span>
              </label>
              <input
                id="um-edit-email"
                type="email"
                value={account.email || ""}
                disabled
                placeholder="No email registered"
                className="is-read-only"
                aria-readonly="true"
              />
            </div>

            {/* Mobile / Username */}
            <div className="cg-um-field">
              <label htmlFor="um-edit-phone">Mobile Number</label>
              <input
                id="um-edit-phone"
                type="tel"
                value={account.phone || ""}
                disabled
                placeholder="No mobile registered"
                className="is-read-only"
                aria-readonly="true"
              />
            </div>

            {/* Role Selection / Details */}
            {!account.roleProtected ? (
              <div className="cg-um-field">
                <label htmlFor="um-edit-role">ASSIGNED ROLE</label>
                <select
                  id="um-edit-role"
                  value={roleRef}
                  onChange={e => onRoleRefChange(e.target.value)}
                  disabled={busy || rolesLoading}
                  className="cg-um-select"
                >
                  <option value="">{rolesLoading ? "Loading roles…" : "Select a role"}</option>
                  {roles.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className="cg-um-field-hint">Only server-permitted roles in realm are eligible</span>
              </div>
            ) : (
              <div className="cg-um-drawer-banner amber">
                <ShieldIcon size={15} />
                <span>Protected Administrator account role cannot be reassigned here.</span>
              </div>
            )}

            {/* Login Account Status Toggle Switch */}
            {!account.roleProtected && (
              <div className="cg-um-field-toggle-card">
                <div className="cg-um-toggle-label-wrap">
                  <strong className="cg-um-toggle-title">Login Account Status</strong>
                  <span className="cg-um-toggle-desc">
                    Enable or temporarily suspend platform access for this account
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isStatusActive}
                  onClick={handleToggleStatus}
                  disabled={busy}
                  className={`cg-um-toggle-switch ${isStatusActive ? "active" : ""}`}
                >
                  <span className="cg-um-toggle-knob" />
                </button>
              </div>
            )}

            {/* Notice / Uncertain Alert */}
            {notice && (
              <div className={`cg-um-notice-box ${notice.kind}`} role={notice.kind === "success" ? "status" : "alert"}>
                <span>{notice.text}</span>
              </div>
            )}

            {uncertain && (
              <div className="cg-um-notice-box uncertain" role="alert">
                <span>Request status is uncertain. Refresh the directory before retrying.</span>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <footer className="cg-um-drawer-footer">
            <button
              type="button"
              className="cg-um-btn cg-um-btn-outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cg-um-btn cg-um-btn-primary"
              disabled={busy || uncertain}
            >
              <UserCheckIcon size={16} />
              <span>{busy ? "Saving…" : "Save Profile Changes"}</span>
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
