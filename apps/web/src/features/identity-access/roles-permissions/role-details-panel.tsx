import React from "react";
import type { Role } from "./roles-permissions-types";
import { roleColor } from "../../../../../../packages/design-tokens/src/index";
import {
  IconEye,
  IconPencil,
  IconCopy,
  IconBan,
  IconClock
} from "./roles-permissions-icons";

type Props = {
  selectedRole: Role | null;
  canManage: boolean;
  canAudit: boolean;
  saving: boolean;
  onViewDetails: (role: Role) => void;
  onEditRole: (role: Role) => void;
  onCopyRole: (role: Role) => void;
  onRetireRole: (role: Role) => void;
  onViewActivity: () => void;
};

export function RoleDetailsPanel({
  selectedRole,
  canManage,
  canAudit,
  saving,
  onViewDetails,
  onEditRole,
  onCopyRole,
  onRetireRole,
  onViewActivity
}: Props) {
  if (!selectedRole) {
    return (
      <aside aria-label="Selected role details" className="cg-rp-panel">
        <header className="cg-rp-panel-header">
          <div className="cg-rp-panel-title-wrap">
            <h2 className="cg-rp-panel-title">Role Details</h2>
            <p className="cg-rp-panel-subtitle">Foundation access</p>
          </div>
        </header>
        <div style={{ padding: "2rem", textAlign: "center", color: "#64748B", fontSize: "0.8125rem" }}>
          Select a role to inspect its details and actions.
        </div>
      </aside>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(selectedRole.name);
  const bgColor = roleColor(selectedRole.colorKey);

  const canEdit = canManage && !selectedRole.protected && selectedRole.active;
  const canCopy = canManage && !selectedRole.protected;
  const canRetire = canManage && !selectedRole.protected && selectedRole.active && selectedRole.assignedCount === 0;

  return (
    <aside aria-label="Selected role details" className="cg-rp-panel">
      <header className="cg-rp-panel-header">
        <div className="cg-rp-panel-title-wrap">
          <h2 className="cg-rp-panel-title">Role Details</h2>
          <p className="cg-rp-panel-subtitle">Foundation access</p>
        </div>
      </header>

      <div className="cg-rp-role-details-content">
        {/* Hero Identity */}
        <div className="cg-rp-detail-hero">
          <div
            className="cg-rp-detail-avatar-lg"
            style={{ backgroundColor: bgColor }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <h3 className="cg-rp-detail-name">{selectedRole.name}</h3>

          <div className="cg-rp-detail-badges">
            <span className={`cg-rp-badge ${selectedRole.active ? "active" : "retired"}`}>
              ● {selectedRole.active ? "Active" : "Retired"}
            </span>
            <span className={`cg-rp-badge ${selectedRole.protected ? "system" : "custom"}`}>
              {selectedRole.protected ? "System Role" : "Custom Role"}
            </span>
          </div>
        </div>

        {/* Metadata List */}
        <div className="cg-rp-detail-meta-list">
          <div className="cg-rp-detail-meta-row">
            <span className="cg-rp-detail-meta-label">Scope</span>
            <span className="cg-rp-detail-meta-val">Foundation</span>
          </div>

          <div className="cg-rp-detail-meta-row">
            <span className="cg-rp-detail-meta-label">Assigned accounts</span>
            <span className="cg-rp-detail-meta-val">{selectedRole.assignedCount}</span>
          </div>

          <div className="cg-rp-detail-meta-row">
            <span className="cg-rp-detail-meta-label">Allowed actions</span>
            <span className="cg-rp-detail-meta-val">
              {selectedRole.protected ? "Protected" : selectedRole.actionKeys.length}
            </span>
          </div>
        </div>

        {/* Description Box */}
        <div className="cg-rp-detail-desc-box">
          <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#64748B", marginBottom: "0.2rem" }}>
            Description
          </span>
          <span>{selectedRole.description || "Full system access or foundation role authority."}</span>
        </div>

        {/* Actions Stack */}
        <div className="cg-rp-detail-actions-stack">
          <button
            type="button"
            className="cg-rp-detail-action-btn"
            onClick={() => onViewDetails(selectedRole)}
          >
            <IconEye size={15} />
            <span>View details</span>
          </button>

          {canEdit && (
            <button
              type="button"
              className="cg-rp-detail-action-btn"
              onClick={() => onEditRole(selectedRole)}
              disabled={saving}
            >
              <IconPencil size={15} />
              <span>Edit role</span>
            </button>
          )}

          {canCopy && (
            <button
              type="button"
              className="cg-rp-detail-action-btn"
              onClick={() => onCopyRole(selectedRole)}
              disabled={saving}
            >
              <IconCopy size={15} />
              <span>Copy role</span>
            </button>
          )}

          {!selectedRole.protected && selectedRole.active && (
            <button
              type="button"
              className="cg-rp-detail-action-btn"
              onClick={() => onRetireRole(selectedRole)}
              disabled={!canRetire || saving}
              title={
                selectedRole.assignedCount > 0
                  ? "Reassign assigned accounts before retiring this role"
                  : "Retire this role"
              }
            >
              <IconBan size={15} />
              <span>Retire role</span>
            </button>
          )}

          {canAudit && (
            <button
              type="button"
              className="cg-rp-detail-action-btn"
              onClick={onViewActivity}
            >
              <IconClock size={15} />
              <span>View role activity</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
