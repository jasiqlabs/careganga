import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Role, Group } from "./roles-permissions-types";
import {
  IconX,
  IconShield,
  IconBuilding,
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconLock
} from "./roles-permissions-icons";

type Props = {
  details: Role;
  groups: Group[];
  onClose: () => void;
};

export function RoleDetailsDrawer({ details, groups, onClose }: Props) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const [permSearch, setPermSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Stable callback ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const firstBtn = dialog.querySelector<HTMLElement>("button:not([disabled])");
    firstBtn?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock background scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [permSearch]);

  // Flatten all granted permissions for this role
  const allGrantedActions = useMemo(() => {
    const list: { group: string; key: string; label: string; assignable: boolean }[] = [];
    for (const group of groups) {
      for (const action of group.actions) {
        if (details.actionKeys.includes(action.key)) {
          list.push({
            group: group.group,
            key: action.key,
            label: action.businessLabel,
            assignable: action.assignable
          });
        }
      }
    }
    return list;
  }, [groups, details.actionKeys]);

  const filteredActions = useMemo(() => {
    if (!permSearch.trim()) return allGrantedActions;
    const q = permSearch.trim().toLowerCase();
    return allGrantedActions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.key.toLowerCase().includes(q) || a.group.toLowerCase().includes(q)
    );
  }, [allGrantedActions, permSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredActions.length / pageSize));
  const paginatedActions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActions.slice(start, start + pageSize);
  }, [filteredActions, currentPage, pageSize]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="cg-rp-drawer-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-view-details-title"
        className="cg-rp-drawer"
        style={{ width: "min(100%, 34rem)" }}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
      >
        <header className="cg-rp-drawer-header">
          <div className="cg-rp-drawer-title-wrap">
            <h2 id="role-view-details-title">{details.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
              <span className={`cg-rp-badge ${details.active ? "active" : "retired"}`}>
                {details.active ? "Active" : "Retired"}
              </span>
              <span className={`cg-rp-badge ${details.protected ? "system" : "custom"}`}>
                {details.protected ? "System Role" : "Custom Role"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="cg-rp-drawer-close-btn"
            onClick={onClose}
            aria-label="Close role details"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="cg-rp-drawer-form">
          <div className="cg-rp-drawer-body">
            {/* Metadata Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.65rem",
                padding: "0.75rem",
                background: "#F8FAFC",
                borderRadius: "0.5rem",
                border: "1px solid #E2E8F0",
                fontSize: "0.775rem"
              }}
            >
              <div>
                <span style={{ color: "#64748B", display: "block" }}>Scope</span>
                <span style={{ fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <IconBuilding size={13} />
                  Foundation
                </span>
              </div>
              <div>
                <span style={{ color: "#64748B", display: "block" }}>Assigned Accounts</span>
                <span style={{ fontWeight: 600, color: "#0F172A" }}>
                  {details.assignedCount} staff
                </span>
              </div>
            </div>

            {details.description && (
              <div className="cg-rp-detail-desc-box">
                <span style={{ fontWeight: 700, fontSize: "0.7rem", color: "#64748B", display: "block", marginBottom: "0.15rem" }}>
                  Description
                </span>
                <span style={{ fontSize: "0.775rem" }}>{details.description}</span>
              </div>
            )}

            {details.protected ? (
              <div className="cg-rp-notice uncertain">
                <IconShield size={16} />
                <span>
                  Protected administrative authority. This role is managed directly by identity policy.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0F172A" }}>
                    Granted Permissions ({filteredActions.length})
                  </h4>
                  <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                {/* Search Bar for Permissions */}
                <div className="cg-rp-input-wrapper">
                  <input
                    type="text"
                    className="cg-rp-input with-icon-left"
                    placeholder="Filter permissions by name or module..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    style={{ height: "2.1rem", fontSize: "0.775rem" }}
                  />
                  <IconSearch className="left" size={14} />
                </div>

                {/* Paginated Permission List */}
                {!paginatedActions.length ? (
                  <p style={{ fontSize: "0.775rem", color: "#94A3B8", textAlign: "center", padding: "1.5rem" }}>
                    {permSearch ? "No permissions match your filter." : "No assignable permissions are currently granted."}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {paginatedActions.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "0.45rem",
                          padding: "0.55rem 0.75rem",
                          background: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                          <span style={{ fontSize: "0.775rem", fontWeight: 600, color: "#0F172A" }}>
                            {item.label}
                          </span>
                          <span style={{ fontSize: "0.675rem", color: "#64748B", fontFamily: "monospace" }}>
                            {item.key} · <span style={{ color: "#2563EB" }}>{item.group}</span>
                          </span>
                        </div>

                        {!item.assignable && (
                          <span title="Administrator-only permission" style={{ color: "#94A3B8" }}>
                            <IconLock size={12} />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "0.5rem",
                      paddingTop: "0.5rem",
                      borderTop: "1px solid #F1F5F9"
                    }}
                  >
                    <button
                      type="button"
                      className="cg-rp-btn cg-rp-btn-ghost"
                      style={{ height: "1.9rem", padding: "0 0.5rem", fontSize: "0.725rem" }}
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <IconChevronLeft size={13} />
                      <span>Previous</span>
                    </button>

                    <span style={{ fontSize: "0.725rem", color: "#64748B" }}>
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      className="cg-rp-btn cg-rp-btn-ghost"
                      style={{ height: "1.9rem", padding: "0 0.5rem", fontSize: "0.725rem" }}
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <span>Next</span>
                      <IconChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="cg-rp-drawer-footer">
            <button
              type="button"
              className="cg-rp-btn cg-rp-btn-primary"
              onClick={onClose}
              style={{ minWidth: "5rem" }}
            >
              Close
            </button>
          </footer>
        </div>
      </motion.section>
    </motion.div>
  );
}
