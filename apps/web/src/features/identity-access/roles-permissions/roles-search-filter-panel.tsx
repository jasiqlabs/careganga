import React, { FormEvent, RefObject, useState } from "react";
import type { RoleKind, RoleStatus } from "./roles-permissions-types";
import {
  IconFilter,
  IconSearch,
  IconRefresh,
  IconSliders,
  IconPlus,
  IconClock,
  IconDownload,
  IconCalendar
} from "./roles-permissions-icons";

type Props = {
  search: string;
  setSearch: (v: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  roleKind: RoleKind;
  setRoleKind: (v: RoleKind) => void;
  tab: RoleStatus;
  setTab: (v: RoleStatus) => void;
  loading: boolean;
  canManage: boolean;
  canAudit: boolean;
  onSearchSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClearAll: () => void;
  onCreateRole: () => void;
  onViewHistory: () => void;
  onExport: () => void;
};

export function RolesSearchFilterPanel({
  search,
  setSearch,
  searchInputRef,
  roleKind,
  setRoleKind,
  tab,
  setTab,
  loading,
  canManage,
  canAudit,
  onSearchSubmit,
  onClearAll,
  onCreateRole,
  onViewHistory,
  onExport
}: Props) {
  const [createdBy, setCreatedBy] = useState("all");
  const [createdDate, setCreatedDate] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const handleClear = () => {
    setCreatedBy("all");
    setCreatedDate("");
    setShowMoreFilters(false);
    onClearAll();
  };

  return (
    <section aria-label="Search and filter roles" className="cg-rp-filter-card">
      <div className="cg-rp-filter-title-row">
        <IconFilter size={18} />
        <span>Search &amp; Filter</span>
      </div>

      <form onSubmit={onSearchSubmit} className="cg-rp-filter-form">
        {/* Row 1: Grid of 5 filters */}
        <div className="cg-rp-filter-grid">
          {/* 1. Search by Role Name */}
          <div className="cg-rp-field-group">
            <label htmlFor="cg-rp-search-name" className="cg-rp-field-label">
              Search by Role Name
            </label>
            <div className="cg-rp-input-wrapper">
              <input
                id="cg-rp-search-name"
                ref={searchInputRef}
                type="text"
                className="cg-rp-input with-icon-right"
                placeholder="Search role name... (Ctrl+K)"
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
              />
              <IconSearch className="right" size={16} />
            </div>
          </div>

          {/* 2. Role Type */}
          <div className="cg-rp-field-group">
            <label htmlFor="cg-rp-role-type" className="cg-rp-field-label">
              Role Type
            </label>
            <select
              id="cg-rp-role-type"
              className="cg-rp-select"
              value={roleKind}
              disabled={loading}
              onChange={(e) => setRoleKind(e.target.value as RoleKind)}
            >
              <option value="all">All Types</option>
              <option value="system">System Roles</option>
              <option value="custom">Custom Roles</option>
            </select>
          </div>

          {/* 3. Status */}
          <div className="cg-rp-field-group">
            <label htmlFor="cg-rp-status-select" className="cg-rp-field-label">
              Status
            </label>
            <select
              id="cg-rp-status-select"
              className="cg-rp-select"
              value={tab}
              disabled={loading}
              onChange={(e) => setTab(e.target.value as RoleStatus)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {/* 4. Created By */}
          <div className="cg-rp-field-group">
            <label htmlFor="cg-rp-created-by" className="cg-rp-field-label">
              Created By
            </label>
            <select
              id="cg-rp-created-by"
              className="cg-rp-select"
              value={createdBy}
              disabled={loading}
              onChange={(e) => setCreatedBy(e.target.value)}
            >
              <option value="all">All</option>
              <option value="system">System Administrator</option>
              <option value="custom">Custom Creators</option>
            </select>
          </div>

          {/* 5. Created Date */}
          <div className="cg-rp-field-group">
            <label htmlFor="cg-rp-created-date" className="cg-rp-field-label">
              Created Date
            </label>
            <div className="cg-rp-input-wrapper">
              <input
                id="cg-rp-created-date"
                type="text"
                className="cg-rp-input with-icon-right"
                placeholder="dd-mm-yyyy"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                disabled={loading}
              />
              <IconCalendar className="right" size={16} />
            </div>
          </div>
        </div>

        {/* More Filters collapsible drawer/row if toggled */}
        {showMoreFilters && (
          <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#F8FAFC", borderRadius: "0.5rem", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              Additional scope filters: Active within Foundation realm, verified permission sets only.
            </span>
          </div>
        )}

        {/* Row 2: Controls & Actions */}
        <div className="cg-rp-filter-actions-row">
          <div className="cg-rp-filter-actions-left">
            <button
              type="button"
              className="cg-rp-btn cg-rp-btn-ghost"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
            >
              <IconSliders size={15} />
              <span>More Filters</span>
            </button>

            <button
              type="button"
              className="cg-rp-btn cg-rp-btn-ghost"
              onClick={handleClear}
              disabled={loading}
            >
              <IconRefresh size={15} />
              <span>Clear All</span>
            </button>

            <div className="cg-rp-divider-vertical" aria-hidden="true" />

            {/* Segmented Status Pills */}
            <div className="cg-rp-pills-group" role="group" aria-label="Filter roles by status">
              <button
                type="button"
                className={`cg-rp-pill-btn ${tab === "all" ? "active" : ""}`}
                onClick={() => setTab("all")}
                disabled={loading}
              >
                All Roles
              </button>
              <button
                type="button"
                className={`cg-rp-pill-btn ${tab === "active" ? "active" : ""}`}
                onClick={() => setTab("active")}
                disabled={loading}
              >
                Active
              </button>
              <button
                type="button"
                className={`cg-rp-pill-btn ${tab === "retired" ? "active" : ""}`}
                onClick={() => setTab("retired")}
                disabled={loading}
              >
                Retired
              </button>
            </div>
          </div>

          <div className="cg-rp-filter-actions-right">
            {canManage && (
              <button
                type="button"
                className="cg-rp-btn cg-rp-btn-primary"
                onClick={onCreateRole}
              >
                <IconPlus size={16} />
                <span>Create Role</span>
              </button>
            )}

            {canAudit && (
              <button
                type="button"
                className="cg-rp-btn"
                onClick={onViewHistory}
              >
                <IconClock size={16} />
                <span>Access History</span>
              </button>
            )}

            <button
              type="submit"
              className="cg-rp-btn cg-rp-btn-primary"
              disabled={loading}
            >
              <IconSearch size={16} />
              <span>Search</span>
            </button>

            <button
              type="button"
              className="cg-rp-btn"
              onClick={onExport}
              disabled={loading}
              title="Export visible roles"
            >
              <IconDownload size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
