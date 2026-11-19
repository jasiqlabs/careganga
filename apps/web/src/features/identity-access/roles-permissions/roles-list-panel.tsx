import React from "react";
import type { Role } from "./roles-permissions-types";
import { roleColor } from "../../../../../../packages/design-tokens/src/index";
import { IconChevronLeft, IconChevronRight } from "./roles-permissions-icons";

type Props = {
  roles: Role[];
  total: number;
  offset: number;
  limit?: number;
  selectedRoleRef: string | null;
  onSelectRole: (ref: string) => void;
  onPageChange: (newOffset: number) => void;
  loading: boolean;
};

export function RolesListPanel({
  roles,
  total,
  offset,
  selectedRoleRef,
  onSelectRole,
  onPageChange,
  loading
}: Props) {
  const pageSize = 10;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <section aria-labelledby="roles-list-title" className="cg-rp-panel">
      <header className="cg-rp-panel-header">
        <div className="cg-rp-panel-title-wrap">
          <h2 id="roles-list-title" className="cg-rp-panel-title">
            Roles List ({total})
          </h2>
          <p className="cg-rp-panel-subtitle">Available Foundation roles</p>
        </div>
      </header>

      <div className="cg-rp-roles-list-container" aria-label="Foundation roles list">
        {loading && !roles.length ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748B", fontSize: "0.8125rem" }}>
            Loading roles…
          </div>
        ) : !roles.length ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748B", fontSize: "0.8125rem" }}>
            <strong>No matching roles</strong>
            <p style={{ marginTop: "0.25rem", color: "#94A3B8" }}>Try adjusting your filters.</p>
          </div>
        ) : (
          roles.map((role) => {
            const isSelected = selectedRoleRef === role.roleRef;
            const initials = getInitials(role.name);
            const bgColor = roleColor(role.colorKey);

            return (
              <button
                key={role.roleRef}
                type="button"
                className={`cg-rp-role-item ${isSelected ? "is-selected" : ""}`}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelectRole(role.roleRef)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: 1 }}>
                  <span
                    className="cg-rp-role-avatar"
                    aria-hidden="true"
                    style={{ backgroundColor: bgColor }}
                  >
                    {initials}
                  </span>
                  <div className="cg-rp-role-info">
                    <span className="cg-rp-role-name" title={role.name}>
                      {role.name}
                    </span>
                    <span className="cg-rp-role-meta">
                      {role.protected
                        ? "Protected"
                        : role.active
                        ? "Active"
                        : "Retired"}{" "}
                      · {role.assignedCount} assigned
                    </span>
                  </div>
                </div>

                <div className="cg-rp-role-item-right">
                  <span className={`cg-rp-badge ${role.protected ? "system" : "custom"}`}>
                    {role.protected ? "System" : "Custom"}
                  </span>
                  <span className="cg-rp-role-chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <footer className="cg-rp-panel-footer">
        <div>
          Show <strong>{Math.min(pageSize, roles.length)}</strong> of <strong>{total}</strong>
        </div>

        <div className="cg-rp-pagination-controls">
          <button
            type="button"
            className="cg-rp-page-btn"
            disabled={offset <= 0 || loading}
            onClick={() => onPageChange(Math.max(0, offset - pageSize))}
            aria-label="Previous page"
          >
            <IconChevronLeft size={14} />
          </button>

          {Array.from({ length: Math.min(3, totalPages) }, (_, idx) => {
            const pageNum = idx + 1;
            return (
              <button
                key={pageNum}
                type="button"
                className={`cg-rp-page-btn ${currentPage === pageNum ? "active" : ""}`}
                onClick={() => onPageChange((pageNum - 1) * pageSize)}
                disabled={loading}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            className="cg-rp-page-btn"
            disabled={offset + pageSize >= total || loading}
            onClick={() => onPageChange(offset + pageSize)}
            aria-label="Next page"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      </footer>
    </section>
  );
}
