"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  XIcon,
  ArrowLeftIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  ShieldIcon,
  KeyIcon,
  Trash2Icon,
  RefreshCwIcon,
  ArrowRightIcon,
  CheckIcon,
  SendIcon,
  FileTextIcon,
  UserIcon,
  UsersIcon,
  VerifiedBadgeIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon
} from "./users-management-icons";
import { UserDetailsDrawerSkeleton } from "./users-management-skeletons";
import {
  formatEmployeeId,
  formatDisplayDate,
  formatDisplayDateTime,
  formatRelativeTime,
  accountStatusLabel,
  auditOutcomeLabel,
  getInitials,
  getAvatarColor
} from "./users-management-types";
import type { DetailTab, UserInternalNote } from "./users-management-types";

interface UserDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  actions: string[];
  history: Array<{
    eventRef: string;
    occurredAt: string;
    actionLabel: string;
    outcome: string;
    actorDisplay: string;
  }> | null;
  onLoadHistory: (accountRef: string) => void;
  onEditProfile: (account: CG01AccountView) => void;
  onAssignRole: (account: CG01AccountView) => void;
  onStatusChange: (account: CG01AccountView, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => void;
  onDeleteAccount: (account: CG01AccountView) => void;
  busy?: boolean;
}

export function UserDetailsDrawer({
  isOpen,
  onClose,
  account,
  actions,
  history,
  onLoadHistory,
  onEditProfile,
  onAssignRole,
  onStatusChange,
  onDeleteAccount,
  busy = false
}: UserDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [copiedContact, setCopiedContact] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [notes, setNotes] = useState<UserInternalNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const tabContentRef = useRef<HTMLDivElement | null>(null);

  // Prevent background body scrolling when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle escape key to close drawer and outside-click/escape for status dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (statusDropdownOpen) {
          setStatusDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, statusDropdownOpen, onClose]);

  // Click outside to close status dropdown popover
  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [statusDropdownOpen]);

  // Load audit history when audit viewing is authorized
  useEffect(() => {
    if (account && actions.includes("access.audit.view")) {
      onLoadHistory(account.accountRef);
    }
  }, [account, actions, onLoadHistory]);

  // Reset internal states on account change
  useEffect(() => {
    setActiveTab("overview");
    setNotes([]);
    setNewNoteText("");
    setStatusDropdownOpen(false);
    if (tabContentRef.current) {
      tabContentRef.current.scrollTop = 0;
    }
  }, [account?.accountRef]);

  if (!isOpen) return null;

  if (!account) {
    return (
      <div
        className="cg-um-drawer-backdrop"
        role="presentation"
        onClick={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <aside
          role="dialog"
          aria-modal="true"
          className="cg-um-drawer cg-um-profile-drawer"
        >
          <UserDetailsDrawerSkeleton />
        </aside>
      </div>
    );
  }

  const empId = formatEmployeeId(account);
  const avatarTheme = getAvatarColor(account.displayName);
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");
  const canAudit = actions.includes("access.audit.view");
  const canEdit = canAssign || canStatus;
  const hasContact = Boolean(account.phone || account.email);

  const handleCopyContact = () => {
    const text = account.phone || account.email || account.displayName;
    navigator.clipboard?.writeText(text);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 2000);
  };

  const handleRefreshHistory = () => {
    if (refreshingHistory) return;
    setRefreshingHistory(true);
    onLoadHistory(account.accountRef);
    setTimeout(() => setRefreshingHistory(false), 600);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const note: UserInternalNote = {
      id: crypto.randomUUID(),
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      author: "Admin Staff (Session)"
    };
    setNotes(prev => [note, ...prev]);
    setNewNoteText("");
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  // Authoritative login and activity timestamps from real audit history
  const loginAudit = history?.find(
    e =>
      e.actionLabel.toLowerCase().includes("login") ||
      e.actionLabel.toLowerCase().includes("signed in") ||
      e.eventRef.toLowerCase().includes("login")
  );
  const lastLoginTime = loginAudit ? formatDisplayDateTime(loginAudit.occurredAt) : "Not recorded";
  const latestAudit = history && history.length > 0 ? history[0] : null;
  const lastSeenRelative = latestAudit ? formatRelativeTime(latestAudit.occurredAt) : "Not recorded";

  return (
    <div
      className="cg-um-drawer-backdrop"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-profile-title"
        className="cg-um-drawer cg-um-profile-drawer"
      >
        {/* ================================================================= */}
        {/* PART 1: STICKY TOP HEADER & EXPANDED IDENTITY BAR                 */}
        {/* ================================================================= */}
        <div className="cg-um-drawer-top-fixed">
          {/* A. Top Navigation Bar */}
          <header className="cg-um-profile-header">
            <div className="cg-um-profile-header-left">
              <button
                type="button"
                className="cg-um-btn-back"
                onClick={onClose}
                aria-label="Back to employee list"
              >
                <ArrowLeftIcon size={16} />
                <span>User Details</span>
              </button>
            </div>

            <div className="cg-um-profile-header-right">
              {/* Account Status Control Dropdown */}
              <div className="cg-um-status-dropdown-wrap" ref={statusMenuRef}>
                <button
                  type="button"
                  className={`cg-um-status-pill clickable ${account.status.toLowerCase()}`}
                  onClick={() => {
                    if (canStatus && !account.roleProtected) {
                      setStatusDropdownOpen(prev => !prev);
                    }
                  }}
                  title={canStatus && !account.roleProtected ? "Change account status" : "Current account status"}
                  aria-haspopup="menu"
                  aria-expanded={statusDropdownOpen}
                >
                  <span className="cg-um-status-dot" aria-hidden="true" />
                  <span>{accountStatusLabel(account.status)}</span>
                  {canStatus && !account.roleProtected && (
                    <ChevronDownIcon size={12} className="cg-um-status-chevron" />
                  )}
                </button>

                {statusDropdownOpen && canStatus && !account.roleProtected && (
                  <div className="cg-um-status-menu" role="menu" aria-label="Account status options">
                    <button
                      type="button"
                      role="menuitem"
                      className={`cg-um-status-menu-item ${account.status === "ACTIVE" ? "selected" : ""}`}
                      onClick={() => {
                        setStatusDropdownOpen(false);
                        if (account.status !== "ACTIVE") onStatusChange(account, "ACTIVE");
                      }}
                    >
                      <span className="cg-um-status-dot active" />
                      <span>Active</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`cg-um-status-menu-item ${account.status === "SUSPENDED" ? "selected" : ""}`}
                      onClick={() => {
                        setStatusDropdownOpen(false);
                        if (account.status !== "SUSPENDED") onStatusChange(account, "SUSPENDED");
                      }}
                    >
                      <span className="cg-um-status-dot suspended" />
                      <span>Suspended</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`cg-um-status-menu-item ${account.status === "DEACTIVATED" ? "selected" : ""}`}
                      onClick={() => {
                        setStatusDropdownOpen(false);
                        if (account.status !== "DEACTIVATED") onStatusChange(account, "DEACTIVATED");
                      }}
                    >
                      <span className="cg-um-status-dot deactivated" />
                      <span>Deactivated</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="cg-um-drawer-close-btn"
                onClick={onClose}
                aria-label="Close user details"
              >
                <XIcon size={18} />
              </button>
            </div>
          </header>

          {/* B. User Identity Card (QR Completely Removed — Full Width Layout) */}
          <section className="cg-um-profile-banner" aria-label="Staff Identity Banner">
            <div className="cg-um-profile-banner-left">
              {/* Profile Avatar */}
              <div
                className="cg-um-profile-large-avatar"
                style={{ backgroundColor: avatarTheme.bg, color: avatarTheme.text }}
                aria-hidden="true"
              >
                {getInitials(account.displayName)}
              </div>

              {/* Identity Details */}
              <div className="cg-um-profile-meta-wrap">
                <div className="cg-um-profile-name-row">
                  <h2 id="um-profile-title" className="cg-um-profile-name">
                    {account.displayName}
                  </h2>
                  <VerifiedBadgeIcon size={17} className="cg-um-verified-badge" title="Verified Account" />
                </div>

                <div className="cg-um-profile-id-row">
                  <span className="cg-um-profile-empid" title="Authoritative Account Reference">
                    {account.accountRef}
                  </span>
                  {empId !== "Not assigned" && (
                    <span className="cg-um-profile-secondary-id">
                      ID: {empId}
                    </span>
                  )}
                  <span className="cg-um-role-chip primary">
                    {account.roleName || "Staff"}
                  </span>
                  {account.roleProtected && (
                    <span className="cg-um-role-chip protected">
                      Protected Root
                    </span>
                  )}
                </div>

                <div className="cg-um-profile-contacts-row">
                  {account.phone && (
                    <div className="cg-um-contact-item">
                      <PhoneIcon size={13} className="cg-um-profile-icon" />
                      <span>{account.phone}</span>
                    </div>
                  )}
                  <div className="cg-um-contact-item">
                    <MailIcon size={13} className="cg-um-profile-icon" />
                    <span>{account.email || "No email registered"}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* C. Six Functional Navigation Tabs (Sticky Strip) */}
          <nav className="cg-um-profile-tabs" role="tablist" aria-label="Profile Sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              className={`cg-um-tab-btn ${activeTab === "overview" ? "is-active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "personal"}
              className={`cg-um-tab-btn ${activeTab === "personal" ? "is-active" : ""}`}
              onClick={() => setActiveTab("personal")}
            >
              Personal Info
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "employment"}
              className={`cg-um-tab-btn ${activeTab === "employment" ? "is-active" : ""}`}
              onClick={() => setActiveTab("employment")}
            >
              Employment
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "roles"}
              className={`cg-um-tab-btn ${activeTab === "roles" ? "is-active" : ""}`}
              onClick={() => setActiveTab("roles")}
            >
              Roles &amp; Permissions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "documents"}
              className={`cg-um-tab-btn ${activeTab === "documents" ? "is-active" : ""}`}
              onClick={() => setActiveTab("documents")}
            >
              Documents
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "activity"}
              className={`cg-um-tab-btn ${activeTab === "activity" ? "is-active" : ""}`}
              onClick={() => setActiveTab("activity")}
            >
              Activity Log
            </button>
          </nav>
        </div>

        {/* ================================================================= */}
        {/* PART 2: INDEPENDENTLY SCROLLABLE TAB CONTENT                      */}
        {/* ================================================================= */}
        <div className="cg-um-profile-tab-content" ref={tabContentRef}>
          {/* --------------------------------------------------------------- */}
          {/* TAB 1: OVERVIEW                                                 */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "overview" && (
            <div className="cg-um-overview-tab">
              {/* Summary Metrics Strip (4 distinct, responsive cells) */}
              <div className="cg-um-metrics-strip">
                {/* Cell 1: User Type */}
                <div className="cg-um-metric-cell">
                  <div className="cg-um-metric-icon-wrap green" aria-hidden="true">
                    <UserIcon size={16} />
                  </div>
                  <div className="cg-um-metric-info">
                    <span className="cg-um-metric-label">User Type</span>
                    <strong className="cg-um-metric-val">{account.roleName || "Staff"}</strong>
                  </div>
                </div>

                {/* Cell 2: Account Status */}
                <div className="cg-um-metric-cell">
                  <div className="cg-um-metric-icon-wrap blue" aria-hidden="true">
                    <ShieldIcon size={16} />
                  </div>
                  <div className="cg-um-metric-info">
                    <span className="cg-um-metric-label">Account Status</span>
                    <strong className="cg-um-metric-val">{accountStatusLabel(account.status)}</strong>
                  </div>
                </div>

                {/* Cell 3: Access Scope */}
                <div className="cg-um-metric-cell">
                  <div className="cg-um-metric-icon-wrap purple" aria-hidden="true">
                    <UsersIcon size={16} />
                  </div>
                  <div className="cg-um-metric-info">
                    <span className="cg-um-metric-label">Access Scope</span>
                    <strong className="cg-um-metric-val">
                      {account.roleProtected ? "Foundation Root" : "Assigned Role Policy"}
                    </strong>
                  </div>
                </div>

                {/* Cell 4: Joined On */}
                <div className="cg-um-metric-cell">
                  <div className="cg-um-metric-icon-wrap cyan" aria-hidden="true">
                    <CalendarIcon size={16} />
                  </div>
                  <div className="cg-um-metric-info">
                    <span className="cg-um-metric-label">Joined On</span>
                    <strong className="cg-um-metric-val">{formatDisplayDate(account.assignedAt, "—")}</strong>
                  </div>
                </div>
              </div>

              {/* Two-Column Cards Grid (Adapts to 1-col on medium/small viewports) */}
              <div className="cg-um-cards-two-col">
                {/* Left Column */}
                <div className="cg-um-col-stack">
                  {/* Account Information Card */}
                  <div className="cg-um-section-card">
                    <div className="cg-um-section-card-header">
                      <h3>Account Information</h3>
                      {!account.roleProtected && canEdit && (
                        <button
                          type="button"
                          className="cg-um-btn-edit-link"
                          onClick={() => onEditProfile(account)}
                          aria-label="Edit account profile"
                        >
                          <EditIcon size={13} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                    <div className="cg-um-keyval-grid">
                      <div className="cg-um-keyval-row">
                        <span className="key">Account Ref</span>
                        <span className="val bold font-mono">{account.accountRef}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Employee ID</span>
                        <span className="val text-muted">{empId}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Full Name</span>
                        <span className="val">{account.displayName}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Email</span>
                        <span className="val">{account.email || "Not registered"}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Mobile</span>
                        <span className="val">{account.phone || "Not registered"}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Password</span>
                        <span className="val text-muted">•••••••• (Secured)</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Account Status</span>
                        <span className="val">
                          <span className={`cg-um-status-pill ${account.status.toLowerCase()}`}>
                            <span className="cg-um-status-dot" aria-hidden="true" />
                            <span>{accountStatusLabel(account.status)}</span>
                          </span>
                        </span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Last Login</span>
                        <span className="val">{lastLoginTime}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Last Activity</span>
                        <span className="val">{lastSeenRelative}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Card */}
                  <div className="cg-um-section-card">
                    <div className="cg-um-section-card-header">
                      <h3>Quick Actions</h3>
                    </div>
                    <div className="cg-um-quick-actions-grid">
                      {canEdit && (
                        <button
                          type="button"
                          className="cg-um-qa-btn update-profile"
                          onClick={() => onEditProfile(account)}
                          disabled={account.roleProtected || busy}
                          title={account.roleProtected ? "Protected accounts cannot be modified" : busy ? "Operation in progress…" : "Update user profile details"}
                        >
                          {busy ? <Loader2Icon size={14} className="cg-um-rotating" /> : <EditIcon size={14} />}
                          <span>Update Profile</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="cg-um-qa-btn reset-pass is-disabled"
                        disabled
                        title="Administrative password reset is not supported. Users must use the self-service recovery flow at /admin/recovery."
                      >
                        <KeyIcon size={14} />
                        <span>Reset Password</span>
                      </button>

                      {canAssign && (
                        <button
                          type="button"
                          className="cg-um-qa-btn change-role"
                          onClick={() => onAssignRole(account)}
                          disabled={account.roleProtected || busy}
                          title={account.roleProtected ? "Protected accounts cannot be modified" : busy ? "Operation in progress…" : "Change assigned role"}
                        >
                          {busy ? <Loader2Icon size={14} className="cg-um-rotating" /> : <ShieldIcon size={14} />}
                          <span>Change Role</span>
                        </button>
                      )}

                      {canStatus && account.status !== "DEACTIVATED" && (
                        <button
                          type="button"
                          className="cg-um-qa-btn block-user"
                          onClick={() => onStatusChange(account, account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                          disabled={account.roleProtected || busy}
                          title={account.roleProtected ? "Protected accounts cannot be modified" : busy ? "Operation in progress…" : account.status === "ACTIVE" ? "Suspend user access" : "Reactivate user access"}
                        >
                          {busy ? <Loader2Icon size={14} className="cg-um-rotating" /> : <ClockIcon size={14} />}
                          <span>{account.status === "ACTIVE" ? "Suspend User" : "Reactivate User"}</span>
                        </button>
                      )}

                      {canStatus && account.status !== "DEACTIVATED" && (
                        <button
                          type="button"
                          className="cg-um-qa-btn delete-user"
                          onClick={() => onDeleteAccount(account)}
                          disabled={account.roleProtected || busy}
                          title={account.roleProtected ? "Protected accounts cannot be modified" : busy ? "Operation in progress…" : "Deactivate account"}
                        >
                          {busy ? <Loader2Icon size={14} className="cg-um-rotating" /> : <Trash2Icon size={14} />}
                          <span>Deactivate User</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="cg-um-qa-btn send-message"
                        onClick={handleCopyContact}
                        disabled={!hasContact}
                        title={hasContact ? "Copy contact information to clipboard" : "No contact details registered"}
                      >
                        {copiedContact ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        <span>{copiedContact ? "Copied!" : "Copy Contact"}</span>
                      </button>
                    </div>
                    <p className="cg-um-qa-hint">
                      Password reset requires user self-service via recovery flow. Account modifications respect server RBAC.
                    </p>
                  </div>

                  {/* Notes & Internal Comments Card (Session Only) */}
                  <div className="cg-um-section-card">
                    <div className="cg-um-section-card-header">
                      <h3>
                        Notes &amp; Comments{" "}
                        <span className="cg-um-session-badge">Session Only</span>
                      </h3>
                    </div>
                    <div className="cg-um-session-notice" role="note">
                      Internal notes entered here are temporary to this active browser session and are not persisted to the database.
                    </div>
                    <div className="cg-um-notes-container">
                      {notes.length === 0 ? (
                        <p className="cg-um-empty-notes-hint">No session notes added yet.</p>
                      ) : (
                        <div className="cg-um-notes-list">
                          {notes.map(note => (
                            <div key={note.id} className="cg-um-note-bubble">
                              <div className="cg-um-note-header">
                                <span className="cg-um-note-author">{note.author}</span>
                                <span className="cg-um-note-time">{formatDisplayDateTime(note.createdAt)}</span>
                                <button
                                  type="button"
                                  className="cg-um-note-delete-btn"
                                  onClick={() => handleDeleteNote(note.id)}
                                  title="Delete note"
                                >
                                  <XIcon size={12} />
                                </button>
                              </div>
                              <p className="cg-um-note-text">{note.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleAddNote} className="cg-um-add-note-form">
                        <input
                          type="text"
                          value={newNoteText}
                          onChange={e => setNewNoteText(e.target.value)}
                          placeholder="Add a temporary session note…"
                          className="cg-um-note-input"
                        />
                        <button
                          type="submit"
                          disabled={!newNoteText.trim()}
                          className="cg-um-note-add-btn"
                          title="Add note"
                        >
                          <SendIcon size={14} />
                          <span>Add</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="cg-um-col-stack">
                  {/* Role & Access Policy Card */}
                  <div className="cg-um-section-card">
                    <div className="cg-um-section-card-header">
                      <h3>Role &amp; Access Policy</h3>
                      {!account.roleProtected && canAssign && (
                        <button
                          type="button"
                          className="cg-um-btn-edit-link"
                          onClick={() => onAssignRole(account)}
                          aria-label="Edit assigned role"
                        >
                          <EditIcon size={13} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                    <div className="cg-um-keyval-grid">
                      <div className="cg-um-keyval-row">
                        <span className="key">Assigned Role</span>
                        <span className="val">
                          <span className="cg-um-role-chip primary">
                            {account.roleName || "Staff"}
                          </span>
                        </span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Role Reference</span>
                        <span className="val font-mono">{account.roleRef || "Not assigned"}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Access Model</span>
                        <span className="val">
                          {account.roleProtected ? "Foundation Root (Protected)" : "Assigned Role Policy"}
                        </span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">Enforcement</span>
                        <span className="val text-muted">Server-side RBAC</span>
                      </div>
                    </div>

                    <div className="cg-um-perm-info-box">
                      <p className="cg-um-perm-info-text">
                        Granular module permissions are governed by the assigned role in the CareGanga RBAC catalog and verified by the server on each transaction.
                      </p>
                      <button
                        type="button"
                        className="cg-um-permissions-link"
                        onClick={() => setActiveTab("roles")}
                      >
                        <span>View Role Details &amp; Architecture</span>
                        <ArrowRightIcon size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Important Dates Card */}
                  <div className="cg-um-section-card">
                    <div className="cg-um-section-card-header">
                      <h3>Important Dates</h3>
                    </div>
                    <div className="cg-um-keyval-grid">
                      <div className="cg-um-keyval-row">
                        <span className="key">
                          <CalendarIcon size={14} className="cg-um-key-icon" />
                          <span>Registered On</span>
                        </span>
                        <span className="val">{formatDisplayDateTime(account.assignedAt, "Not recorded")}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">
                          <ClockIcon size={14} className="cg-um-key-icon" />
                          <span>Last Login</span>
                        </span>
                        <span className="val">{lastLoginTime}</span>
                      </div>
                      <div className="cg-um-keyval-row">
                        <span className="key">
                          <RefreshCwIcon size={14} className="cg-um-key-icon" />
                          <span>Last Activity</span>
                        </span>
                        <span className="val">
                          {latestAudit ? formatDisplayDateTime(latestAudit.occurredAt) : "Not recorded"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity Log Card (Compact) */}
                  <div className="cg-um-section-card">
                    <div className="cg-um-section-card-header">
                      <h3>Recent Activity Log</h3>
                      <div className="cg-um-card-header-actions">
                        {canAudit && (
                          <button
                            type="button"
                            className="cg-um-icon-btn"
                            onClick={handleRefreshHistory}
                            disabled={refreshingHistory}
                            title="Refresh activity trail"
                          >
                            <RefreshCwIcon size={13} className={refreshingHistory ? "cg-um-rotating" : ""} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="cg-um-btn-edit-link"
                          onClick={() => setActiveTab("activity")}
                        >
                          <span>View All</span>
                        </button>
                      </div>
                    </div>

                    <div className="cg-um-activity-timeline compact">
                      {!canAudit ? (
                        <p className="cg-um-text-muted">Activity audit logs require Security Audit permission.</p>
                      ) : !history ? (
                        <div className="cg-um-loading-inline">
                          <span className="cg-um-spinner small" />
                          <span>Loading activity history…</span>
                        </div>
                      ) : history.length === 0 ? (
                        <p className="cg-um-empty-activity-text">No activity recorded yet.</p>
                      ) : (
                        history.slice(0, 4).map(event => (
                          <div key={event.eventRef} className="cg-um-timeline-item">
                            <div className="cg-um-timeline-marker" aria-hidden="true" />
                            <div className="cg-um-timeline-content">
                              <strong className="cg-um-timeline-action">{event.actionLabel}</strong>
                              <div className="cg-um-timeline-meta">
                                <span className={`cg-um-outcome-pill ${event.outcome.toLowerCase()}`}>
                                  {auditOutcomeLabel(event.outcome)}
                                </span>
                                <span>by {event.actorDisplay}</span>
                                <span>·</span>
                                <span>{formatDisplayDateTime(event.occurredAt)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 2: PERSONAL INFO (STRICT DATA VISIBILITY: IMPLEMENTED ONLY)  */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "personal" && (
            <div className="cg-um-section-card">
              <div className="cg-um-section-card-header">
                <div>
                  <h3>Personal Information</h3>
                  <p className="cg-um-section-card-desc">
                    Identity details recorded in the primary account registry.
                  </p>
                </div>
                {!account.roleProtected && canEdit && (
                  <button
                    type="button"
                    className="cg-um-btn-edit-link"
                    onClick={() => onEditProfile(account)}
                  >
                    <EditIcon size={13} />
                    <span>Edit Details</span>
                  </button>
                )}
              </div>
              <div className="cg-um-personal-info-grid">
                <div className="cg-um-keyval-row">
                  <span className="key">Full Name</span>
                  <span className="val bold">{account.displayName}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Account Reference</span>
                  <span className="val font-mono bold">{account.accountRef}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Mobile Number</span>
                  <span className="val">{account.phone || "Not provided"}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Email Address</span>
                  <span className="val">{account.email || "Not provided"}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Registration Date</span>
                  <span className="val">{formatDisplayDateTime(account.assignedAt, "Not recorded")}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Account Version</span>
                  <span className="val font-mono">Revision {account.revision}</span>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 3: EMPLOYMENT (AUTHORITATIVE ROLE ASSIGNMENT ONLY)           */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "employment" && (
            <div className="cg-um-col-stack">
              <div className="cg-um-section-card">
                <div className="cg-um-section-card-header">
                  <div>
                    <h3>Staff Assignment &amp; Designation</h3>
                    <p className="cg-um-section-card-desc">
                      Current role classification and assignment records.
                    </p>
                  </div>
                  {!account.roleProtected && canAssign && (
                    <button
                      type="button"
                      className="cg-um-btn-edit-link"
                      onClick={() => onAssignRole(account)}
                    >
                      <EditIcon size={13} />
                      <span>Change Role</span>
                    </button>
                  )}
                </div>
                <div className="cg-um-personal-info-grid">
                  <div className="cg-um-keyval-row">
                    <span className="key">Designation / Role</span>
                    <span className="val bold">{account.roleName || "Staff"}</span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Role Reference</span>
                    <span className="val font-mono">{account.roleRef || "Not assigned"}</span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Assignment Date</span>
                    <span className="val">{formatDisplayDate(account.assignedAt, "—")}</span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Account Classification</span>
                    <span className="val">
                      {account.roleProtected ? "Protected Foundation Root Staff" : "Standard Foundation Staff"}
                    </span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Access Scope</span>
                    <span className="val">
                      {account.roleProtected ? "Foundation Root Scope" : "Assigned Role Policy"}
                    </span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Account Status</span>
                    <span className="val">
                      <span className={`cg-um-status-pill ${account.status.toLowerCase()}`}>
                        <span className="cg-um-status-dot" aria-hidden="true" />
                        <span>{accountStatusLabel(account.status)}</span>
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 4: ROLES & PERMISSIONS (SERVER-SIDE RBAC ARCHITECTURE)      */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "roles" && (
            <div className="cg-um-section-card">
              <div className="cg-um-section-card-header">
                <div>
                  <h3>Roles &amp; Permissions</h3>
                  <p className="cg-um-section-card-desc">
                    Server-enforced role-based access control and security policies.
                  </p>
                </div>
                {!account.roleProtected && canAssign && (
                  <button
                    type="button"
                    className="cg-um-btn-edit-link"
                    onClick={() => onAssignRole(account)}
                  >
                    <EditIcon size={13} />
                    <span>Edit Role</span>
                  </button>
                )}
              </div>

              <div className="cg-um-keyval-grid">
                <div className="cg-um-keyval-row">
                  <span className="key">Assigned Role</span>
                  <span className="val">
                    <span className="cg-um-role-chip primary">
                      {account.roleName || "Staff"}
                    </span>
                  </span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Role Reference</span>
                  <span className="val font-mono">{account.roleRef || "Not assigned"}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">User Classification</span>
                  <span className="val">
                    <span className="cg-um-role-chip">
                      {account.roleProtected ? "Protected Root" : "Standard Account"}
                    </span>
                  </span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Access Model</span>
                  <span className="val">
                    {account.roleProtected ? "Foundation Root Scope (Protected)" : "Role-Based Access Control"}
                  </span>
                </div>
              </div>

              <div className="cg-um-policy-banner-box">
                <div className="cg-um-policy-banner-header">
                  <ShieldIcon size={18} />
                  <strong>Authoritative Server-Side RBAC Enforcement</strong>
                </div>
                <p className="cg-um-policy-desc">
                  CareGanga Foundation access capabilities are strictly evaluated and enforced by the server on each API call.
                  Client applications do not fabricate permission flags from display strings.
                </p>
                <ul className="cg-um-policy-bullet-list">
                  <li>Effective capabilities are bound to the role definition catalog in the backend.</li>
                  <li>Security policies and cryptographic session tokens govern realm permissions.</li>
                  <li>
                    {account.roleProtected
                      ? "Protected root accounts have immutable platform rights and cannot be downgraded or deleted."
                      : "Role assignments are managed through the centralized Roles & Permissions module."}
                  </li>
                </ul>
                {actions.includes("roles.view") && (
                  <div className="cg-um-policy-actions">
                    <a
                      href="/admin/roles"
                      className="cg-um-btn cg-um-btn-secondary cg-um-btn-sm"
                      style={{ textDecoration: "none", display: "inline-flex" }}
                    >
                      <span>Inspect Role Catalog in Roles &amp; Permissions</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 5: DOCUMENTS (REFLECTS CG-19 DOCUMENT VAULT)                 */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "documents" && (
            <div className="cg-um-section-card">
              <div className="cg-um-section-card-header">
                <h3>Documents</h3>
              </div>
              <div className="cg-um-documents-empty-wrap">
                <div className="cg-um-empty-doc-icon-box" aria-hidden="true">
                  <FileTextIcon size={32} />
                </div>
                <h4>No documents attached to this account.</h4>
                <p className="cg-um-text-muted">
                  Staff identity verification records and credentials are managed securely within the CG-19 Document Vault.
                </p>
                {actions.includes("documents.files.view") ? (
                  <a
                    href="/admin/documents"
                    className="cg-um-btn cg-um-btn-secondary cg-um-btn-sm"
                    style={{ marginTop: "0.75rem", display: "inline-flex", textDecoration: "none" }}
                  >
                    <span>Open Document Vault (CG-19)</span>
                  </a>
                ) : (
                  <span className="cg-um-text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                    Document management requires CG-19 Document Vault permissions.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 6: ACTIVITY LOG (AUTHENTIC AUDIT TRAIL)                     */}
          {/* --------------------------------------------------------------- */}
          {activeTab === "activity" && (
            <div className="cg-um-section-card">
              <div className="cg-um-section-card-header">
                <div>
                  <h3>Activity Log</h3>
                  <p className="cg-um-section-card-desc">
                    Verified security audit events recorded for this user account.
                  </p>
                </div>
                {canAudit && (
                  <button
                    type="button"
                    className="cg-um-icon-btn"
                    onClick={handleRefreshHistory}
                    disabled={refreshingHistory}
                    title="Refresh activity history"
                  >
                    <RefreshCwIcon size={14} className={refreshingHistory ? "cg-um-rotating" : ""} />
                  </button>
                )}
              </div>

              <div className="cg-um-activity-timeline full">
                {!canAudit ? (
                  <p className="cg-um-text-muted">Viewing audit trails requires access.audit.view permission.</p>
                ) : !history ? (
                  <div className="cg-um-loading-inline">
                    <span className="cg-um-spinner" />
                    <span>Loading complete verified audit history…</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="cg-um-empty-state-box">
                    <ClockIcon size={36} className="cg-um-empty-clock-icon" />
                    <p className="cg-um-text-muted">No activity recorded yet for this account.</p>
                  </div>
                ) : (
                  history.map(event => (
                    <div key={event.eventRef} className="cg-um-timeline-item">
                      <div className="cg-um-timeline-marker" aria-hidden="true" />
                      <div className="cg-um-timeline-content">
                        <strong className="cg-um-timeline-action">{event.actionLabel}</strong>
                        <div className="cg-um-timeline-meta">
                          <span className={`cg-um-outcome-pill ${event.outcome.toLowerCase()}`}>
                            {auditOutcomeLabel(event.outcome)}
                          </span>
                          <span>by {event.actorDisplay}</span>
                          <span>·</span>
                          <span>{formatDisplayDateTime(event.occurredAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
