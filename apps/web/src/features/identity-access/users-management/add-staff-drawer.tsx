"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  XIcon,
  BriefcaseIcon,
  EyeIcon,
  EyeOffIcon,
  UserPlusIcon,
  SearchIcon,
  ShieldCheckIcon
} from "./users-management-icons";
import type { RoleOption, Notice } from "./users-management-types";

interface AddStaffDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleOption[];
  rolesLoading: boolean;
  searchRole: string;
  onSearchRoleChange: (val: string) => void;
  onSearchRoleSubmit: () => void;
  fullName: string;
  onFullNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  phone: string;
  onPhoneChange: (val: string) => void;
  newPassword: string;
  onNewPasswordChange: (val: string) => void;
  roleRef: string;
  onRoleRefChange: (val: string) => void;
  busy: boolean;
  uncertain: boolean;
  notice: Notice | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function AddStaffDrawer({
  isOpen,
  onClose,
  roles,
  rolesLoading,
  searchRole,
  onSearchRoleChange,
  onSearchRoleSubmit,
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  newPassword,
  onNewPasswordChange,
  roleRef,
  onRoleRefChange,
  busy,
  uncertain,
  notice,
  onSubmit
}: AddStaffDrawerProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="cg-um-drawer-backdrop" role="presentation" onClick={e => {
      if (e.target === e.currentTarget && !busy) onClose();
    }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-add-staff-title"
        className="cg-um-drawer cg-um-add-drawer"
      >
        {/* Drawer Header */}
        <header className="cg-um-drawer-header">
          <div className="cg-um-drawer-title-group">
            <div className="cg-um-drawer-icon-box green" aria-hidden="true">
              <BriefcaseIcon size={20} />
            </div>
            <div>
              <div className="cg-um-drawer-title-row">
                <h2 id="um-add-staff-title" className="cg-um-drawer-title">
                  Add New Staff Account
                </h2>
                <span className="cg-um-staff-badge">STAFF</span>
              </div>
              <p className="cg-um-drawer-subtitle">
                Provision standard field staff account
              </p>
            </div>
          </div>

          <button
            type="button"
            className="cg-um-drawer-close-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close drawer"
          >
            <XIcon size={18} />
          </button>
        </header>

        {/* Informational Banner */}
        <div className="cg-um-drawer-banner green">
          <ShieldCheckIcon size={18} className="cg-um-banner-icon" />
          <span>Enter field staff profile identity and initial account login credentials.</span>
        </div>

        {/* Drawer Form Body */}
        <form onSubmit={onSubmit} className="cg-um-drawer-form">
          <div className="cg-um-drawer-body">
            {/* Full Name */}
            <div className="cg-um-field">
              <label htmlFor="um-new-fullname">
                FULL NAME <span className="req">*</span>
              </label>
              <input
                id="um-new-fullname"
                type="text"
                required
                maxLength={160}
                value={fullName}
                onChange={e => onFullNameChange(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                disabled={busy}
                autoComplete="off"
              />
            </div>

            {/* Role Finder & Selector */}
            <div className="cg-um-field">
              <label htmlFor="um-new-role">
                ROLE <span className="req">*</span>
              </label>

              {/* Role filter bar */}
              <div className="cg-um-role-search-bar">
                <div className="cg-um-input-with-icon">
                  <SearchIcon size={14} className="cg-um-input-icon" />
                  <input
                    type="text"
                    value={searchRole}
                    onChange={e => onSearchRoleChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSearchRoleSubmit();
                      }
                    }}
                    placeholder="Find an eligible role..."
                    disabled={busy || rolesLoading}
                  />
                </div>
                <button
                  type="button"
                  className="cg-um-btn cg-um-btn-outline cg-um-btn-sm"
                  onClick={onSearchRoleSubmit}
                  disabled={busy || rolesLoading}
                >
                  Find
                </button>
              </div>

              {/* Role select */}
              <select
                id="um-new-role"
                required
                value={roleRef}
                onChange={e => onRoleRefChange(e.target.value)}
                disabled={busy || rolesLoading}
                className="cg-um-select"
              >
                <option value="">
                  {rolesLoading
                    ? "Loading eligible roles…"
                    : roles.length === 0
                    ? "No eligible roles available"
                    : "Choose a role explicitly"}
                </option>
                {roles.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Work Email */}
            <div className="cg-um-field">
              <label htmlFor="um-new-email">WORK EMAIL</label>
              <input
                id="um-new-email"
                type="email"
                maxLength={254}
                value={email}
                onChange={e => onEmailChange(e.target.value)}
                placeholder="rahul@careganga.org"
                disabled={busy}
                autoComplete="off"
              />
            </div>

            {/* Contact Phone Number */}
            <div className="cg-um-field">
              <label htmlFor="um-new-phone">
                CONTACT PHONE NUMBER <span className="req">*</span>
              </label>
              <input
                id="um-new-phone"
                type="tel"
                inputMode="numeric"
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={phone}
                onChange={e => onPhoneChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                placeholder="+91 98765 43210 (10 digits)"
                disabled={busy}
                autoComplete="off"
              />
              <span className="cg-um-field-hint">Used as username for mobile staff sign-in</span>
            </div>

            {/* Temporary Initial Password */}
            <div className="cg-um-field">
              <label htmlFor="um-new-password">
                TEMPORARY INITIAL PASSWORD <span className="req">*</span>
              </label>
              <div className="cg-um-password-input-wrap">
                <input
                  id="um-new-password"
                  required
                  minLength={8}
                  maxLength={1024}
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => onNewPasswordChange(e.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={busy}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="cg-um-password-toggle-btn"
                  onClick={() => setShowPassword(v => !v)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={busy}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            {/* Scope / Info note */}
            <div className="cg-um-scope-note">
              <p>Applies to: <strong>Entire foundation</strong></p>
              <p className="cg-um-note-muted">Account is active immediately after creation.</p>
            </div>

            {/* Error / Notice Display */}
            {notice && (
              <div className={`cg-um-notice-box ${notice.kind}`} role={notice.kind === "success" ? "status" : "alert"}>
                <span>{notice.text}</span>
              </div>
            )}

            {uncertain && (
              <div className="cg-um-notice-box uncertain" role="alert">
                <span>The account may already have been created. Refresh the directory before retrying.</span>
              </div>
            )}
          </div>

          {/* Sticky Drawer Footer */}
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
              className="cg-um-btn cg-um-btn-green"
              disabled={busy || uncertain || !roleRef || phone.length !== 10 || newPassword.length < 8}
            >
              <UserPlusIcon size={16} />
              <span>{busy ? "Saving…" : "Create Staff Account"}</span>
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
