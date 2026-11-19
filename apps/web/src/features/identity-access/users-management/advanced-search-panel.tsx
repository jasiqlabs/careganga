"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  SearchIcon,
  SlidersHorizontalIcon,
  RotateCcwIcon,
  DownloadIcon,
  CalendarIcon
} from "./users-management-icons";
import type { AdvancedFilterState, RoleOption } from "./users-management-types";
import { initialFilters } from "./users-management-types";

interface AdvancedSearchPanelProps {
  loading: boolean;
  roles: RoleOption[];
  onSearch: (keyword: string, status: string) => void;
  onClear: () => void;
  onExport: () => void;
  initialQuery?: string;
  initialStatus?: string;
}

export function AdvancedSearchPanel({
  loading,
  roles,
  onSearch,
  onClear,
  onExport,
  initialQuery = "",
  initialStatus = "all"
}: AdvancedSearchPanelProps) {
  const [filters, setFilters] = useState<AdvancedFilterState>({
    ...initialFilters,
    keyword: initialQuery,
    status: initialStatus
  });

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const effectiveQuery = (filters.keyword.trim() || filters.employeeId.trim());
    onSearch(effectiveQuery, filters.status);
  };

  const handleClear = () => {
    setFilters(initialFilters);
    onClear();
  };

  const updateField = (key: keyof AdvancedFilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <section className="cg-um-search-panel" aria-label="Advanced Employee Search">
      <form onSubmit={handleSubmit} className="cg-um-search-form">
        <div className="cg-um-search-header">
          <div className="cg-um-search-title">
            <span className="cg-um-search-title-icon" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <h2>Advanced Digital Search</h2>
          </div>
        </div>

        {/* Row 1: Primary Search Criteria */}
        <div className="cg-um-filter-grid">
          {/* 1. Keyword */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-keyword">Search By Keyword</label>
            <div className="cg-um-input-with-icon">
              <SearchIcon size={15} className="cg-um-input-icon" />
              <input
                id="um-filter-keyword"
                type="text"
                value={filters.keyword}
                onChange={e => updateField("keyword", e.target.value)}
                placeholder="Search by name, ID, email, mob..."
                autoComplete="off"
                disabled={loading}
              />
            </div>
          </div>

          {/* 2. Employee ID */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-empid">Employee ID</label>
            <input
              id="um-filter-empid"
              type="text"
              value={filters.employeeId}
              onChange={e => updateField("employeeId", e.target.value)}
              placeholder="Enter Employee ID"
              autoComplete="off"
              disabled={loading}
            />
          </div>

          {/* 3. Employee Type */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-emptype">Employee Type</label>
            <select
              id="um-filter-emptype"
              value={filters.employeeType}
              onChange={e => updateField("employeeType", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Types</option>
              <option value="staff">Staff</option>
              <option value="volunteer">Volunteer</option>
              <option value="member">Member</option>
            </select>
          </div>

          {/* 4. Employment Type */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-employment">Employment Type</label>
            <select
              id="um-filter-employment"
              value={filters.employmentType}
              onChange={e => updateField("employmentType", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Employment Types</option>
              <option value="full-time">Full-Time</option>
              <option value="part-time">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="volunteer">Honorary Volunteer</option>
            </select>
          </div>

          {/* 5. Department */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-dept">Department</label>
            <select
              id="um-filter-dept"
              value={filters.department}
              onChange={e => updateField("department", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Departments</option>
              <option value="field">Field Operations</option>
              <option value="admin">Administration</option>
              <option value="finance">Finance & Accounts</option>
              <option value="healthcare">Healthcare Assistance</option>
              <option value="programs">District Programs</option>
            </select>
          </div>

          {/* 6. Designation */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-designation">Designation</label>
            <select
              id="um-filter-designation"
              value={filters.designation}
              onChange={e => updateField("designation", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Designations</option>
              <option value="director">Project Director</option>
              <option value="coordinator">District Coordinator</option>
              <option value="officer">Executive Officer</option>
              <option value="manager">District Manager</option>
              <option value="staff">Field Staff</option>
            </select>
          </div>
        </div>

        {/* Row 2: Secondary / Geographic Criteria */}
        <div className={`cg-um-filter-grid secondary ${showMoreFilters ? "is-expanded" : ""}`}>
          {/* 7. State */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-state">State</label>
            <select
              id="um-filter-state"
              value={filters.state}
              onChange={e => updateField("state", e.target.value)}
              disabled={loading}
            >
              <option value="all">All States</option>
              <option value="wb">West Bengal</option>
              <option value="br">Bihar</option>
              <option value="jh">Jharkhand</option>
              <option value="od">Odisha</option>
            </select>
          </div>

          {/* 8. District */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-district">District</label>
            <select
              id="um-filter-district"
              value={filters.district}
              onChange={e => updateField("district", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Districts</option>
              <option value="murshidabad">Murshidabad</option>
              <option value="kolkata">Kolkata</option>
              <option value="nadia">Nadia</option>
              <option value="malda">Malda</option>
              <option value="birbhum">Birbhum</option>
            </select>
          </div>

          {/* 9. Branch / Office */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-branch">Branch / Office</label>
            <select
              id="um-filter-branch"
              value={filters.branch}
              onChange={e => updateField("branch", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Branches</option>
              <option value="ho">Head Office - Kolkata</option>
              <option value="murshidabad-br">Murshidabad Branch</option>
              <option value="malda-br">Malda Regional Office</option>
              <option value="siliguri-br">Siliguri Center</option>
            </select>
          </div>

          {/* 10. Role / Designation Level */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-role">Role / Designation Level</label>
            <select
              id="um-filter-role"
              value={filters.roleLevel}
              onChange={e => updateField("roleLevel", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Roles</option>
              {roles.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* 11. Status */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-status">Status</label>
            <select
              id="um-filter-status"
              value={filters.status}
              onChange={e => updateField("status", e.target.value)}
              disabled={loading}
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>

          {/* 12. Joined Between */}
          <div className="cg-um-form-group">
            <label htmlFor="um-filter-joined-from">Joined Between</label>
            <div className="cg-um-date-range">
              <div className="cg-um-date-input-wrap">
                <input
                  id="um-filter-joined-from"
                  type="date"
                  value={filters.joinedFrom}
                  onChange={e => updateField("joinedFrom", e.target.value)}
                  placeholder="dd-mm-yyyy"
                  disabled={loading}
                  aria-label="Joined From Date"
                />
              </div>
              <span className="cg-um-date-separator">to</span>
              <div className="cg-um-date-input-wrap">
                <input
                  id="um-filter-joined-to"
                  type="date"
                  value={filters.joinedTo}
                  onChange={e => updateField("joinedTo", e.target.value)}
                  placeholder="dd-mm-yyyy"
                  disabled={loading}
                  aria-label="Joined To Date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="cg-um-search-actions">
          <div className="cg-um-search-actions-left">
            <button
              type="button"
              className="cg-um-btn cg-um-btn-outline"
              onClick={() => setShowMoreFilters(v => !v)}
              aria-expanded={showMoreFilters}
            >
              <SlidersHorizontalIcon size={15} />
              <span>{showMoreFilters ? "Less Filters" : "More Filters"}</span>
            </button>
            <button
              type="button"
              className="cg-um-btn cg-um-btn-ghost"
              onClick={handleClear}
              disabled={loading}
            >
              <RotateCcwIcon size={14} />
              <span>Clear All</span>
            </button>
          </div>

          <div className="cg-um-search-actions-right">
            <button
              type="submit"
              className="cg-um-btn cg-um-btn-primary"
              disabled={loading}
            >
              <SearchIcon size={15} />
              <span>Search</span>
            </button>
            <button
              type="button"
              className="cg-um-btn cg-um-btn-outline"
              onClick={onExport}
              disabled={loading}
              title="Export staff records as CSV"
            >
              <DownloadIcon size={15} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
