"use client";

import React, { useEffect, useRef } from "react";
import { IconSearch, IconCalendar } from "./registration-approvals-icons";
import type { ApprovalFilters } from "./registration-approvals-types";

interface ApprovalFiltersPanelProps {
  filters: ApprovalFilters;
  onChangeFilters: (filters: Partial<ApprovalFilters>) => void;
  onResetFilters: () => void;
  availableRoles: string[];
}

export function ApprovalFiltersPanel({
  filters,
  onChangeFilters,
  onResetFilters,
  availableRoles
}: ApprovalFiltersPanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K shortcut listener to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasActiveFilters =
    Boolean(filters.searchQuery.trim()) ||
    filters.statusFilter !== "all" ||
    filters.roleFilter !== "all" ||
    filters.reviewerFilter !== "all" ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  return (
    <div className="cg-ra-filters-card">
      <div className="cg-ra-filters-row">
        {/* Inline Search Input with Ctrl+K shortcut matching wireframe */}
        <div className="cg-ra-filter-search-box">
          <IconSearch size={16} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="cg-ra-filter-search-input"
            placeholder="Search by Application ID, Name, Role..."
            value={filters.searchQuery}
            onChange={(e) => onChangeFilters({ searchQuery: e.target.value })}
          />
          <kbd className="cg-ra-shortcut-badge">Ctrl K</kbd>
        </div>

        {/* Status Dropdown */}
        <div className="cg-ra-filter-field">
          <label htmlFor="cg-ra-filter-status" className="sr-only">Filter by Status</label>
          <select
            id="cg-ra-filter-status"
            className="cg-ra-select"
            value={filters.statusFilter}
            onChange={(e) => onChangeFilters({ statusFilter: e.target.value })}
          >
            <option value="all">All Status</option>
            <option value="SUBMITTED">Submitted for review</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="RETURNED">Returned for correction</option>
            <option value="FINAL_APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PENDING_OWNER">Applying access</option>
            <option value="OWNER_COMPLETED">Access confirmed</option>
          </select>
        </div>

        {/* Role Dropdown */}
        <div className="cg-ra-filter-field">
          <label htmlFor="cg-ra-filter-role" className="sr-only">Filter by Role</label>
          <select
            id="cg-ra-filter-role"
            className="cg-ra-select"
            value={filters.roleFilter}
            onChange={(e) => onChangeFilters({ roleFilter: e.target.value })}
          >
            <option value="all">All Roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        {/* Reviewer Dropdown */}
        <div className="cg-ra-filter-field">
          <label htmlFor="cg-ra-filter-reviewer" className="sr-only">Filter by Reviewer</label>
          <select
            id="cg-ra-filter-reviewer"
            className="cg-ra-select"
            value={filters.reviewerFilter}
            onChange={(e) => onChangeFilters({ reviewerFilter: e.target.value })}
          >
            <option value="all">All Reviewers</option>
            <option value="SUPER_ADMIN">Foundation Super Admin</option>
            <option value="ACCESS_MANAGER">Access Manager</option>
          </select>
        </div>

        {/* Date Range Picker Controls matching dd-mm-yyyy format */}
        <div className="cg-ra-date-range-wrap">
          <IconCalendar size={16} className="cg-ra-date-icon" />
          <input
            type="date"
            className="cg-ra-date-input"
            value={filters.dateFrom}
            onChange={(e) => onChangeFilters({ dateFrom: e.target.value })}
            aria-label="From date"
            title="From date"
            placeholder="dd-mm-yyyy"
          />
          <span className="cg-ra-date-sep">–</span>
          <input
            type="date"
            className="cg-ra-date-input"
            value={filters.dateTo}
            onChange={(e) => onChangeFilters({ dateTo: e.target.value })}
            aria-label="To date"
            title="To date"
            placeholder="dd-mm-yyyy"
          />
        </div>

        {/* Reset Action */}
        <div className="cg-ra-filter-reset-wrap">
          <button
            type="button"
            className="cg-ra-btn-link"
            disabled={!hasActiveFilters}
            onClick={onResetFilters}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
