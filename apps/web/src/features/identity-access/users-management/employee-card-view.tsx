"use client";

import { useState } from "react";
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
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  ShieldIcon,
  Trash2Icon,
  UserCheckIcon,
  ClockIcon
} from "./users-management-icons";
import {
  formatEmployeeId,
  formatDisplayDate,
  accountStatusLabel,
  getInitials,
  getAvatarColor
} from "./users-management-types";
import type { ViewMode, Density } from "./users-management-types";
import { EmployeeCardViewSkeleton } from "./users-management-skeletons";

interface EmployeeCardViewProps {
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

export function EmployeeCardView({
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
}: EmployeeCardViewProps) {
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [activeMenuRef, setActiveMenuRef] = useState<string | null>(null);

  const canCreate = actions.includes("accounts.create") && actions.includes("roles.assign");
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");
  const canEdit = canAssign || canStatus;

  const handleSelectRow = (ref: string, checked: boolean) => {
    setSelectedRefs(prev => {
      const next = new Set(prev);
      if (checked) next.add(ref);
      else next.delete(ref);
      return next;
    });
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + limit, total);

  const pageNumbers: number[] = [];
  for (let p = Math.max(1, currentPage - 1); p <= Math.min(totalPages, currentPage + 1); p++) {
    pageNumbers.push(p);
  }

  return (
    <section className="cg-um-list-section" aria-label="Staff Accounts Card Grid">
      {/* Header Bar */}
      <div className="cg-um-list-header">
        <div className="cg-um-list-title-wrap">
          <h3 className="cg-um-list-title">Employee List</h3>
          <span className="cg-um-count-badge">{total}</span>
        </div>

        <div className="cg-um-list-toolbar">
          <span className="cg-um-entries-info">
            Showing {startItem} to {endItem} of {total} entries
          </span>

          <div className="cg-um-view-density-select">
            <select
              value={density}
              onChange={e => onDensityChange(e.target.value as Density)}
              className="cg-um-select-compact"
              aria-label="Card Density"
            >
              <option value="comfortable">View: Card</option>
              <option value="compact">View: Compact Card</option>
            </select>
          </div>

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
              aria-label="Card View"
              title="Card View"
            >
              <GridIcon size={16} />
            </button>
          </div>

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

      {/* Grid Container */}
      {loading && accounts.length === 0 ? (
        <EmployeeCardViewSkeleton cards={6} />
      ) : (
        <div className="cg-um-cards-grid">
          {accounts.length === 0 ? (
            <div className="cg-um-empty-state col-span-full">
              <h3>No employees found</h3>
              <p>No matching staff accounts found for this criteria.</p>
            </div>
          ) : (
            accounts.map(row => {
            const empId = formatEmployeeId(row);
            const isSelected = selectedRefs.has(row.accountRef);
            const avatarTheme = getAvatarColor(row.displayName);
            const isMenuOpen = activeMenuRef === row.accountRef;

            return (
              <div
                key={row.accountRef}
                className={`cg-um-employee-card ${isSelected ? "is-selected-card" : ""}`}
              >
                {/* Card Top Row */}
                <div className="cg-um-card-top">
                  <div className="cg-um-card-identity">
                    <div
                      className="cg-um-card-avatar"
                      style={{ backgroundColor: avatarTheme.bg, color: avatarTheme.text }}
                      aria-hidden="true"
                    >
                      {getInitials(row.displayName)}
                    </div>
                    <div className="cg-um-card-titles">
                      <h4 className="cg-um-card-name" title={row.displayName}>
                        {row.displayName}
                      </h4>
                      <span className="cg-um-card-empid">{empId}</span>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => handleSelectRow(row.accountRef, e.target.checked)}
                    className="cg-um-card-checkbox"
                    aria-label={`Select ${row.displayName}`}
                  />
                </div>

                {/* Card Contact Info */}
                <div className="cg-um-card-body">
                  <div className="cg-um-card-info-item">
                    <MailIcon size={14} className="cg-um-card-icon" />
                    <span className="cg-um-card-text truncate" title={row.email || "No email"}>
                      {row.email || row.phone || "Mobile login"}
                    </span>
                  </div>

                  {row.phone && (
                    <div className="cg-um-card-info-item">
                      <PhoneIcon size={14} className="cg-um-card-icon" />
                      <span className="cg-um-card-text">{row.phone}</span>
                    </div>
                  )}

                  <div className="cg-um-card-info-item">
                    <CalendarIcon size={14} className="cg-um-card-icon" />
                    <span className="cg-um-card-text">
                      Joined {formatDisplayDate(row.assignedAt)}
                    </span>
                  </div>
                </div>

                {/* Card Bottom Row: Badges & Quick Actions */}
                <div className="cg-um-card-footer">
                  <div className="cg-um-card-badges">
                    <span className="cg-um-role-chip" title={row.roleName || "Unassigned"}>
                      {row.roleName || "Volunteer"}
                    </span>
                    <span className={`cg-um-status-pill ${row.status.toLowerCase()}`}>
                      <span className="cg-um-status-dot" aria-hidden="true" />
                      <span>{accountStatusLabel(row.status)}</span>
                    </span>
                  </div>

                  <div className="cg-um-card-actions">
                    <button
                      type="button"
                      className="cg-um-action-icon-btn view"
                      onClick={() => onViewDetails(row)}
                      title="View Details"
                      aria-label="View Details"
                    >
                      <EyeIcon size={14} />
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        className="cg-um-action-icon-btn edit"
                        onClick={() => onEditAccount(row)}
                        disabled={row.roleProtected}
                        title={row.roleProtected ? "Protected Administrator" : "Edit Profile"}
                        aria-label="Edit Profile"
                      >
                        <EditIcon size={14} />
                      </button>
                    )}

                    <div className="cg-um-action-menu-wrap">
                      <button
                        type="button"
                        className="cg-um-action-icon-btn more"
                        onClick={() => setActiveMenuRef(isMenuOpen ? null : row.accountRef)}
                        title="More Actions"
                        aria-expanded={isMenuOpen}
                      >
                        <MoreVerticalIcon size={14} />
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
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* Pagination Footer */}
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
