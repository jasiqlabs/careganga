"use client";

import { useState, useRef, useEffect } from "react";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  EyeIcon,
  EditIcon,
  MoreVerticalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCwIcon,
  GridIcon,
  ListIcon,
  ShieldIcon,
  Trash2Icon,
  UserCheckIcon,
  ClockIcon,
  KeyIcon
} from "./users-management-icons";
import {
  formatEmployeeId,
  formatDisplayDate,
  accountStatusLabel,
  getInitials,
  getAvatarColor
} from "./users-management-types";
import type { ViewMode, Density } from "./users-management-types";

interface EmployeeTableViewProps {
  accounts: CG01AccountView[];
  total: number;
  offset: number;
  limit: number;
  loading: boolean;
  actions: string[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  onPageChange: (newOffset: number) => void;
  onRefresh: () => void;
  onAddStaff: () => void;
  onViewDetails: (account: CG01AccountView) => void;
  onEditAccount: (account: CG01AccountView) => void;
  onAssignRole: (account: CG01AccountView) => void;
  onStatusChange: (account: CG01AccountView, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => void;
  onDeleteAccount: (account: CG01AccountView) => void;
}

export function EmployeeTableView({
  accounts,
  total,
  offset,
  limit,
  loading,
  actions,
  viewMode,
  onViewModeChange,
  density,
  onDensityChange,
  onPageChange,
  onRefresh,
  onAddStaff,
  onViewDetails,
  onEditAccount,
  onAssignRole,
  onStatusChange,
  onDeleteAccount
}: EmployeeTableViewProps) {
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [activeMenuRef, setActiveMenuRef] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const canCreate = actions.includes("accounts.create") && actions.includes("roles.assign");
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");

  // Close popup menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenuRef(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRefs(new Set(accounts.map(a => a.accountRef)));
    } else {
      setSelectedRefs(new Set());
    }
  };

  const handleSelectRow = (ref: string, checked: boolean) => {
    setSelectedRefs(prev => {
      const next = new Set(prev);
      if (checked) next.add(ref);
      else next.delete(ref);
      return next;
    });
  };

  const isAllSelected = accounts.length > 0 && accounts.every(a => selectedRefs.has(a.accountRef));
  const isSomeSelected = accounts.some(a => selectedRefs.has(a.accountRef)) && !isAllSelected;

  // Pagination calculation
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + limit, total);

  // Generate 1-based page numbers around current page
  const pageNumbers: number[] = [];
  for (let p = Math.max(1, currentPage - 1); p <= Math.min(totalPages, currentPage + 1); p++) {
    pageNumbers.push(p);
  }

  return (
    <section className="cg-um-list-section" aria-label="Staff Accounts List">
      {/* List Header & Controls Bar */}
      <div className="cg-um-list-header">
        <div className="cg-um-list-title-wrap">
          <h3 className="cg-um-list-title">Employee List</h3>
          <span className="cg-um-count-badge">{total}</span>
        </div>

        <div className="cg-um-list-toolbar">
          <span className="cg-um-entries-info">
            Showing {startItem} to {endItem} of {total} entries
          </span>

          {/* Density Selector */}
          <div className="cg-um-view-density-select">
            <label htmlFor="um-density-select" className="sr-only">Table Density</label>
            <select
              id="um-density-select"
              value={density}
              onChange={e => onDensityChange(e.target.value as Density)}
              className="cg-um-select-compact"
            >
              <option value="comfortable">View: Comfortable</option>
              <option value="compact">View: Compact</option>
            </select>
          </div>

          {/* Table / Card View Toggle */}
          <div className="cg-um-view-toggle-group" role="group" aria-label="View layout switch">
            <button
              type="button"
              className={`cg-um-toggle-btn ${viewMode === "table" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("table")}
              aria-label="Table View"
              title="Table View"
            >
              <ListIcon size={16} />
            </button>
            <button
              type="button"
              className={`cg-um-toggle-btn ${viewMode === "card" ? "is-active" : ""}`}
              onClick={() => onViewModeChange("card")}
              aria-label="Card Grid View"
              title="Card View"
            >
              <GridIcon size={16} />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            className="cg-um-icon-btn"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh employee list"
            title="Refresh list"
          >
            <RefreshCwIcon size={15} />
          </button>

          {/* Add Staff Button */}
          {canCreate && (
            <button
              type="button"
              className="cg-um-btn cg-um-btn-primary cg-um-btn-add"
              onClick={onAddStaff}
              title="Add new staff account"
            >
              <PlusIcon size={15} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className={`cg-um-table-wrapper ${density === "compact" ? "is-compact" : ""}`}>
        <table className="cg-um-table">
          <thead>
            <tr>
              <th className="col-checkbox">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={el => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={e => handleSelectAll(e.target.checked)}
                  aria-label="Select all staff on this page"
                />
              </th>
              <th className="col-empid">Employee ID</th>
              <th className="col-contact">Name &amp; Contact</th>
              <th className="col-dept">
                <span>Department</span>
                <span className="th-sub">Designation</span>
              </th>
              <th className="col-role">Role</th>
              <th className="col-employment">Employment Type</th>
              <th className="col-joined">Joining Date</th>
              <th className="col-status">Status</th>
              <th className="col-level">Current Level</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && accounts.length === 0 ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="cg-um-table-row cg-um-row-skeleton">
                  <td>
                    <div className="cg-um-skeleton" style={{ width: "1rem", height: "1rem", borderRadius: "0.25rem" }} />
                  </td>
                  <td>
                    <div className="cg-um-skeleton" style={{ height: "0.85rem", width: "7rem" }} />
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <div className="cg-um-skeleton" style={{ width: "2.1rem", height: "2.1rem", borderRadius: "9999px", flexShrink: 0 }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", width: "9rem" }}>
                        <div className="cg-um-skeleton" style={{ height: "0.85rem", width: "85%" }} />
                        <div className="cg-um-skeleton" style={{ height: "0.7rem", width: "65%" }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", width: "7rem" }}>
                      <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "75%" }} />
                      <div className="cg-um-skeleton" style={{ height: "0.65rem", width: "55%" }} />
                    </div>
                  </td>
                  <td>
                    <div className="cg-um-skeleton" style={{ height: "1.3rem", width: "5rem", borderRadius: "9999px" }} />
                  </td>
                  <td>
                    <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "4rem" }} />
                  </td>
                  <td>
                    <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "5.5rem" }} />
                  </td>
                  <td>
                    <div className="cg-um-skeleton" style={{ height: "1.3rem", width: "4.5rem", borderRadius: "9999px" }} />
                  </td>
                  <td>
                    <div className="cg-um-skeleton" style={{ height: "0.8rem", width: "3.5rem" }} />
                  </td>
                  <td className="text-right">
                    <div style={{ display: "inline-flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                      <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
                      <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
                      <div className="cg-um-skeleton" style={{ width: "1.85rem", height: "1.85rem", borderRadius: "0.35rem" }} />
                    </div>
                  </td>
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={10} className="cg-um-table-status-cell">
                  <div className="cg-um-empty-state">
                    <h3>No staff accounts match your search</h3>
                    <p>Try clearing filters or search by another keyword. No fictional records are displayed.</p>
                  </div>
                </td>
              </tr>
            ) : (
              accounts.map(row => {
                const empId = formatEmployeeId(row);
                const isSelected = selectedRefs.has(row.accountRef);
                const avatarTheme = getAvatarColor(row.displayName);
                const isMenuOpen = activeMenuRef === row.accountRef;

                return (
                  <tr key={row.accountRef} className={isSelected ? "is-selected-row" : ""}>
                    {/* 1. Selection Checkbox */}
                    <td className="col-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => handleSelectRow(row.accountRef, e.target.checked)}
                        aria-label={`Select ${row.displayName}`}
                      />
                    </td>

                    {/* 2. Employee ID */}
                    <td className="col-empid">
                      <span className="cg-um-empid-pill">{empId}</span>
                    </td>

                    {/* 3. Name & Contact */}
                    <td className="col-contact">
                      <div className="cg-um-contact-cell">
                        <div
                          className="cg-um-avatar"
                          style={{ backgroundColor: avatarTheme.bg, color: avatarTheme.text }}
                          aria-hidden="true"
                        >
                          {getInitials(row.displayName)}
                        </div>
                        <div className="cg-um-contact-meta">
                          <strong className="cg-um-contact-name">{row.displayName}</strong>
                          <span className="cg-um-contact-sub">
                            {row.email || row.phone || "Mobile login"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 4. Department / Designation */}
                    <td className="col-dept">
                      <span className="cg-um-cell-muted">—</span>
                    </td>

                    {/* 5. Role */}
                    <td className="col-role">
                      <span className="cg-um-role-chip" title={row.roleName || "Unassigned"}>
                        {row.roleName || "Volunteer"}
                      </span>
                    </td>

                    {/* 6. Employment Type */}
                    <td className="col-employment">
                      <span className="cg-um-cell-muted">—</span>
                    </td>

                    {/* 7. Joining Date */}
                    <td className="col-joined">
                      <span className="cg-um-date-text">
                        {formatDisplayDate(row.assignedAt)}
                      </span>
                    </td>

                    {/* 8. Status */}
                    <td className="col-status">
                      <span className={`cg-um-status-pill ${row.status.toLowerCase()}`}>
                        <span className="cg-um-status-dot" aria-hidden="true" />
                        <span>{accountStatusLabel(row.status)}</span>
                      </span>
                    </td>

                    {/* 9. Current Level */}
                    <td className="col-level">
                      <span className="cg-um-cell-muted">—</span>
                    </td>

                    {/* 10. Actions */}
                    <td className="col-actions">
                      <div className="cg-um-actions-row">
                        {/* View Details Button */}
                        <button
                          type="button"
                          className="cg-um-action-icon-btn view"
                          onClick={() => onViewDetails(row)}
                          title="View user details"
                          aria-label={`View details for ${row.displayName}`}
                        >
                          <EyeIcon size={15} />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="cg-um-action-icon-btn edit"
                          onClick={() => onEditAccount(row)}
                          disabled={row.roleProtected}
                          title={row.roleProtected ? "Protected Administrator" : "Edit staff account"}
                          aria-label={`Edit ${row.displayName}`}
                        >
                          <EditIcon size={15} />
                        </button>

                        {/* More Actions Menu */}
                        <div className="cg-um-action-menu-wrap" ref={isMenuOpen ? menuContainerRef : null}>
                          <button
                            type="button"
                            className="cg-um-action-icon-btn more"
                            onClick={() => setActiveMenuRef(isMenuOpen ? null : row.accountRef)}
                            title="More actions"
                            aria-expanded={isMenuOpen}
                            aria-haspopup="true"
                          >
                            <MoreVerticalIcon size={15} />
                          </button>

                          {isMenuOpen && (
                            <div className="cg-um-dropdown-menu" role="menu">
                              <button
                                type="button"
                                className="cg-um-menu-item"
                                onClick={() => {
                                  setActiveMenuRef(null);
                                  onViewDetails(row);
                                }}
                                role="menuitem"
                              >
                                <EyeIcon size={14} />
                                <span>View Details</span>
                              </button>

                              {!row.roleProtected && canAssign && (
                                <button
                                  type="button"
                                  className="cg-um-menu-item"
                                  onClick={() => {
                                    setActiveMenuRef(null);
                                    onAssignRole(row);
                                  }}
                                  role="menuitem"
                                >
                                  <ShieldIcon size={14} />
                                  <span>Assign Role</span>
                                </button>
                              )}

                              {!row.roleProtected && canStatus && (
                                <>
                                  {row.status === "ACTIVE" ? (
                                    <button
                                      type="button"
                                      className="cg-um-menu-item warning"
                                      onClick={() => {
                                        setActiveMenuRef(null);
                                        onStatusChange(row, "SUSPENDED");
                                      }}
                                      role="menuitem"
                                    >
                                      <ClockIcon size={14} />
                                      <span>Suspend Account</span>
                                    </button>
                                  ) : row.status === "SUSPENDED" ? (
                                    <button
                                      type="button"
                                      className="cg-um-menu-item"
                                      onClick={() => {
                                        setActiveMenuRef(null);
                                        onStatusChange(row, "ACTIVE");
                                      }}
                                      role="menuitem"
                                    >
                                      <UserCheckIcon size={14} />
                                      <span>Reactivate Account</span>
                                    </button>
                                  ) : null}

                                  {row.status !== "DEACTIVATED" && (
                                    <button
                                      type="button"
                                      className="cg-um-menu-item danger"
                                      onClick={() => {
                                        setActiveMenuRef(null);
                                        onDeleteAccount(row);
                                      }}
                                      role="menuitem"
                                    >
                                      <Trash2Icon size={14} />
                                      <span>Delete Account</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer & Pagination */}
      <div className="cg-um-table-footer">
        <div className="cg-um-footer-left">
          <span className="cg-um-footer-label">Show</span>
          <select
            value={limit}
            onChange={() => onPageChange(0)}
            className="cg-um-page-size-select"
            aria-label="Items per page"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="cg-um-footer-label">entries</span>
        </div>

        <div className="cg-um-pagination">
          <button
            type="button"
            className="cg-um-page-btn arrow"
            disabled={loading || offset === 0}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeftIcon size={14} />
          </button>

          {pageNumbers.map(page => {
            const pageOffset = (page - 1) * limit;
            const isCurrent = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                className={`cg-um-page-btn ${isCurrent ? "is-active" : ""}`}
                disabled={loading || isCurrent}
                onClick={() => onPageChange(pageOffset)}
                aria-current={isCurrent ? "page" : undefined}
              >
                {page}
              </button>
            );
          })}

          <button
            type="button"
            className="cg-um-page-btn arrow"
            disabled={loading || offset + limit >= total}
            onClick={() => onPageChange(offset + limit)}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
