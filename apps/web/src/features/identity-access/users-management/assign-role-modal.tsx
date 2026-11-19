"use client";

import { useState } from "react";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  XIcon,
  ShieldIcon,
  SearchIcon,
  CheckIcon,
  ShieldCheckIcon
} from "./users-management-icons";
import type { RoleOption, Notice } from "./users-management-types";

interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  roles: RoleOption[];
  rolesLoading: boolean;
  selectedRoleRef: string;
  onSelectRoleRef: (roleRef: string) => void;
  busy: boolean;
  uncertain: boolean;
  notice: Notice | null;
  onConfirm: () => void;
}

export function AssignRoleModal({
  isOpen,
  onClose,
  account,
  roles,
  rolesLoading,
  selectedRoleRef,
  onSelectRoleRef,
  busy,
  uncertain,
  notice,
  onConfirm
}: AssignRoleModalProps) {
  const [managerQuery, setManagerQuery] = useState("");

  if (!isOpen || !account) return null;

  // The 10 standard roles from wireframe
  const standardRoleNames = [
    "Super Admin",
    "Sub Admin",
    "State Coordinator",
    "District Coordinator",
    "Block Coordinator",
    "Project Director",
    "HR / Membership",
    "Team Leader",
    "Volunteer",
    "Staff"
  ];

  // RBAC Filter: map standard roles to backend eligible roles
  // A role is ONLY active/selectable if present in the backend `roles` response!
  const matchedStandardRoles = standardRoleNames.map(name => {
    const found = roles.find(r =>
      r.label.toLowerCase() === name.toLowerCase() ||
      r.value.toLowerCase() === name.toLowerCase().replace(/[^a-z0-9]/g, "_")
    );
    return {
      name,
      eligible: Boolean(found),
      value: found?.value || ""
    };
  });

  // Custom roles: any role returned by the backend that is not in the standard list
  const customRoles = roles.filter(r =>
    !standardRoleNames.some(s => s.toLowerCase() === r.label.toLowerCase())
  );

  return (
    <div className="cg-um-modal-backdrop" role="presentation" onClick={e => {
      if (e.target === e.currentTarget && !busy) onClose();
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-assign-role-title"
        className="cg-um-modal cg-um-assign-role-modal"
      >
        {/* Header */}
        <header className="cg-um-modal-header">
          <div className="cg-um-modal-title-row">
            <span className="cg-um-modal-icon-badge" aria-hidden="true">
              <ShieldIcon size={18} />
            </span>
            <h2 id="um-assign-role-title" className="cg-um-modal-title">
              Assign Role
            </h2>
          </div>
          <button
            type="button"
            className="cg-um-drawer-close-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close modal"
          >
            <XIcon size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="cg-um-modal-body">
          {/* User Identity Section */}
          <div className="cg-um-assign-user-card">
            <span className="cg-um-assign-label">User</span>
            <div className="cg-um-assign-user-details">
              <strong className="cg-um-assign-user-name">{account.displayName}</strong>
              <span className="cg-um-assign-user-email">{account.email || account.phone || "Mobile login"}</span>
            </div>
            <div className="cg-um-assign-current-role">
              <span className="cg-um-assign-current-label">Current:</span>
              <span className="cg-um-role-chip current">
                {account.roleName || "Volunteer"}
              </span>
            </div>
          </div>

          {/* New Role Section */}
          <div className="cg-um-assign-section">
            <span className="cg-um-assign-section-title">New Role</span>
            {rolesLoading ? (
              <p className="cg-um-text-muted">Loading permitted roles…</p>
            ) : (
              <div className="cg-um-role-chips-wrap">
                {matchedStandardRoles.map(item => {
                  const isSelected = selectedRoleRef === item.value && item.eligible;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      disabled={!item.eligible || busy}
                      className={`cg-um-assign-chip ${isSelected ? "is-selected" : ""} ${!item.eligible ? "is-disabled" : ""}`}
                      onClick={() => {
                        if (item.eligible) onSelectRoleRef(item.value);
                      }}
                      title={item.eligible ? `Select ${item.name}` : `Role "${item.name}" not permitted for this assignment`}
                    >
                      {item.name}
                      {isSelected && <CheckIcon size={12} className="cg-um-chip-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Roles Section */}
          {customRoles.length > 0 && (
            <div className="cg-um-assign-section">
              <span className="cg-um-assign-section-title">Custom Roles</span>
              <div className="cg-um-role-chips-wrap">
                {customRoles.map(r => {
                  const isSelected = selectedRoleRef === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={busy}
                      className={`cg-um-assign-chip custom ${isSelected ? "is-selected" : ""}`}
                      onClick={() => onSelectRoleRef(r.value)}
                    >
                      {r.label}
                      {isSelected && <CheckIcon size={12} className="cg-um-chip-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reporting To (Manager) */}
          <div className="cg-um-assign-section">
            <label htmlFor="um-assign-manager" className="cg-um-assign-section-title">
              REPORTING TO (MANAGER)
            </label>
            <div className="cg-um-input-with-icon">
              <SearchIcon size={14} className="cg-um-input-icon" />
              <input
                id="um-assign-manager"
                type="text"
                value={managerQuery}
                onChange={e => setManagerQuery(e.target.value)}
                placeholder="Search by Role Name or Employee ID..."
                disabled={busy}
              />
            </div>
            <span className="cg-um-field-hint">Automatic (from role hierarchy)</span>
          </div>

          {/* Notice & Uncertain Alerts */}
          {notice && (
            <div className={`cg-um-notice-box ${notice.kind}`} role={notice.kind === "success" ? "status" : "alert"}>
              <span>{notice.text}</span>
            </div>
          )}

          {uncertain && (
            <div className="cg-um-notice-box uncertain" role="alert">
              <span>This request may have been saved. Refresh before another change.</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="cg-um-modal-footer">
          <button
            type="button"
            className="cg-um-btn cg-um-btn-outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cg-um-btn cg-um-btn-green"
            disabled={busy || uncertain || !selectedRoleRef || selectedRoleRef === account.roleRef}
            onClick={onConfirm}
          >
            <ShieldCheckIcon size={16} />
            <span>{busy ? "Saving…" : "Save Changes"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
