"use client";

import { useState, useEffect } from "react";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  XIcon,
  ArrowLeftIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  MapPinIcon,
  EditIcon,
  ShieldIcon,
  KeyIcon,
  Trash2Icon,
  UserCheckIcon,
  ClockIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  ArrowRightIcon,
  CheckIcon,
  SlidersHorizontalIcon
} from "./users-management-icons";
import {
  formatEmployeeId,
  formatDisplayDate,
  accountStatusLabel,
  auditOutcomeLabel,
  getInitials,
  getAvatarColor
} from "./users-management-types";
import type { DetailTab } from "./users-management-types";

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
  onDeleteAccount
}: UserDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [copiedContact, setCopiedContact] = useState(false);

  useEffect(() => {
    if (account && actions.includes("access.audit.view")) {
      onLoadHistory(account.accountRef);
    }
  }, [account, actions, onLoadHistory]);

  if (!isOpen || !account) return null;

  const empId = formatEmployeeId(account);
  const avatarTheme = getAvatarColor(account.displayName);
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");
  const canAudit = actions.includes("access.audit.view");

  const handleCopyContact = () => {
    const text = account.email || account.phone || account.displayName;
    navigator.clipboard?.writeText(text);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 2000);
  };

  return (
    <div className="cg-um-drawer-backdrop" role="presentation" onClick={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-profile-title"
        className="cg-um-drawer cg-um-profile-drawer"
      >
        {/* Top Header */}
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
            <span className={`cg-um-status-pill ${account.status.toLowerCase()}`}>
              <span className="cg-um-status-dot" aria-hidden="true" />
              <span>{accountStatusLabel(account.status)}</span>
            </span>

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

        {/* Profile Card Banner */}
        <section className="cg-um-profile-banner" aria-label="Staff Identity Banner">
          <div className="cg-um-profile-banner-left">
            <div
              className="cg-um-profile-large-avatar"
              style={{ backgroundColor: avatarTheme.bg, color: avatarTheme.text }}
              aria-hidden="true"
            >
              {getInitials(account.displayName)}
            </div>

            <div className="cg-um-profile-meta-wrap">
              <div className="cg-um-profile-name-row">
                <h2 id="um-profile-title" className="cg-um-profile-name">
                  {account.displayName}
                </h2>
                <span className="cg-um-role-chip">
                  {account.roleName || "Volunteer"}
                </span>
                <span className="cg-um-profile-category-tag">Member</span>
              </div>

              <span className="cg-um-profile-empid">{empId}</span>

              <div className="cg-um-profile-contacts-row">
                <div className="cg-um-contact-item">
                  <MailIcon size={14} className="cg-um-profile-icon" />
                  <span>{account.email || "No email registered"}</span>
                </div>
                {account.phone && (
                  <div className="cg-um-contact-item">
                    <PhoneIcon size={14} className="cg-um-profile-icon" />
                    <span>{account.phone}</span>
                  </div>
                )}
              </div>

              <div className="cg-um-profile-info-strip">
                <div className="cg-um-contact-item">
                  <CalendarIcon size={14} className="cg-um-profile-icon" />
                  <span>08 Jun 2000 (26 Y) · Male</span>
                </div>
                <div className="cg-um-contact-item">
                  <MapPinIcon size={14} className="cg-um-profile-icon" />
                  <span>Murshidabad, West Bengal</span>
                </div>
              </div>
            </div>
          </div>

          {/* User QR Code Card */}
          <div className="cg-um-profile-qr-box" aria-label="Digital Employee QR Card">
            <div className="cg-um-qr-matrix" aria-hidden="true">
              {/* Decorative Authentic QR pattern representation */}
              <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 2h7v7H2V2zm2 2v3h3V4H4zm9-2h7v7h-7V2zm2 2v3h3V4h-3zM2 15h7v7H2v-7zm2 2v3h3v-3H4zm7-5h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4-4h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 0h2v2h-2v-2zM5 5h1v1H5V5zm13 0h1v1h-1V5zM5 18h1v1H5v-1z" />
              </svg>
            </div>
            <span className="cg-um-qr-label">User QR</span>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav className="cg-um-profile-tabs" role="tablist" aria-label="Profile Sections">
          {(["overview", "personal", "employment", "roles", "documents", "activity"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`cg-um-tab-btn ${activeTab === tab ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "overview" ? "Overview" :
               tab === "personal" ? "Personal Info" :
               tab === "employment" ? "Employment" :
               tab === "roles" ? "Roles & Permissions" :
               tab === "documents" ? "Documents" : "Activity Log"}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="cg-um-profile-tab-content">
          {activeTab === "overview" && (
            <div className="cg-um-overview-tab">
              {/* 4 Metrics Strip */}
              <div className="cg-um-metrics-strip">
                <div className="cg-um-metric-cell">
                  <span className="cg-um-metric-label">User Type</span>
                  <strong className="cg-um-metric-val">{account.roleName || "Volunteer"}</strong>
                </div>
                <div className="cg-um-metric-cell">
                  <span className="cg-um-metric-label">Department</span>
                  <strong className="cg-um-metric-val">—</strong>
                </div>
                <div className="cg-um-metric-cell">
                  <span className="cg-um-metric-label">Reporting To</span>
                  <strong className="cg-um-metric-val">Sampa Sarkar (Coordinator)</strong>
                </div>
                <div className="cg-um-metric-cell">
                  <span className="cg-um-metric-label">Joined On</span>
                  <strong className="cg-um-metric-val">{formatDisplayDate(account.assignedAt)}</strong>
                </div>
              </div>

              {/* 2-Column Info Cards */}
              <div className="cg-um-cards-two-col">
                {/* Card 1: Account Information */}
                <div className="cg-um-section-card">
                  <div className="cg-um-section-card-header">
                    <h3>Account Information</h3>
                    {!account.roleProtected && (
                      <button
                        type="button"
                        className="cg-um-btn-edit-link"
                        onClick={() => onEditProfile(account)}
                      >
                        <EditIcon size={13} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <div className="cg-um-keyval-grid">
                    <div className="cg-um-keyval-row">
                      <span className="key">User ID</span>
                      <span className="val bold">{empId}</span>
                    </div>
                    <div className="cg-um-keyval-row">
                      <span className="key">Email</span>
                      <span className="val">{account.email || "—"}</span>
                    </div>
                    <div className="cg-um-keyval-row">
                      <span className="key">Mobile</span>
                      <span className="val">{account.phone || "—"}</span>
                    </div>
                    <div className="cg-um-keyval-row">
                      <span className="key">Password</span>
                      <span className="val">
                        ••••••••
                        <button
                          type="button"
                          className="cg-um-inline-action-btn"
                          onClick={() => onEditProfile(account)}
                        >
                          (Change)
                        </button>
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
                    <div className="cg-um-keyval-row">
                      <span className="key">Last Login</span>
                      <span className="val">Today, 10:56 AM (5 hr ago)</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Role & Permission */}
                <div className="cg-um-section-card">
                  <div className="cg-um-section-card-header">
                    <h3>Role &amp; Permission</h3>
                    {!account.roleProtected && canAssign && (
                      <button
                        type="button"
                        className="cg-um-btn-edit-link"
                        onClick={() => onAssignRole(account)}
                      >
                        <EditIcon size={13} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <div className="cg-um-keyval-grid">
                    <div className="cg-um-keyval-row">
                      <span className="key">Role</span>
                      <span className="val">
                        <span className="cg-um-role-chip">
                          {account.roleName || "Volunteer"}
                        </span>
                      </span>
                    </div>
                    <div className="cg-um-keyval-row">
                      <span className="key">Access Level</span>
                      <span className="val">District - Murshidabad</span>
                    </div>
                    <div className="cg-um-keyval-row">
                      <span className="key">Permissions</span>
                      <span className="val">
                        <button
                          type="button"
                          className="cg-um-permissions-link"
                          onClick={() => setActiveTab("roles")}
                        >
                          <span>View All Permissions</span>
                          <ArrowRightIcon size={12} />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="cg-um-quick-actions-card">
                <span className="cg-um-quick-actions-title">Quick Actions</span>
                <div className="cg-um-quick-actions-row">
                  <button
                    type="button"
                    className="cg-um-qa-btn update-profile"
                    onClick={() => onEditProfile(account)}
                    disabled={account.roleProtected}
                  >
                    <EditIcon size={14} />
                    <span>Update Profile</span>
                  </button>

                  <button
                    type="button"
                    className="cg-um-qa-btn reset-pass"
                    onClick={() => onEditProfile(account)}
                  >
                    <KeyIcon size={14} />
                    <span>Reset Pass...</span>
                  </button>

                  {canAssign && (
                    <button
                      type="button"
                      className="cg-um-qa-btn change-role"
                      onClick={() => onAssignRole(account)}
                      disabled={account.roleProtected}
                    >
                      <ShieldIcon size={14} />
                      <span>Change Role</span>
                    </button>
                  )}

                  {canStatus && account.status !== "DEACTIVATED" && (
                    <button
                      type="button"
                      className="cg-um-qa-btn block-user"
                      onClick={() => onStatusChange(account, account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                      disabled={account.roleProtected}
                    >
                      <ClockIcon size={14} />
                      <span>{account.status === "ACTIVE" ? "Block User" : "Unblock User"}</span>
                    </button>
                  )}

                  {canStatus && account.status !== "DEACTIVATED" && (
                    <button
                      type="button"
                      className="cg-um-qa-btn delete-user"
                      onClick={() => onDeleteAccount(account)}
                      disabled={account.roleProtected}
                    >
                      <Trash2Icon size={14} />
                      <span>Delete User</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="cg-um-qa-btn send-message"
                    onClick={handleCopyContact}
                    title="Copy staff contact information"
                  >
                    <MessageSquareIcon size={14} />
                    <span>{copiedContact ? "Copied!" : "Send Mes..."}</span>
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
                    <span className="key">Registered On</span>
                    <span className="val">{formatDisplayDate(account.assignedAt)}, 10:21 PM</span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Last Login</span>
                    <span className="val">Today, 10:56 AM</span>
                  </div>
                  <div className="cg-um-keyval-row">
                    <span className="key">Last Updated</span>
                    <span className="val">12 Nov 2026, 09:53 PM</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Log */}
              {canAudit && (
                <div className="cg-um-section-card">
                  <div className="cg-um-section-card-header">
                    <h3>Recent Activity Log</h3>
                    <button
                      type="button"
                      className="cg-um-icon-btn"
                      onClick={() => onLoadHistory(account.accountRef)}
                      title="Refresh activity log"
                    >
                      <RefreshCwIcon size={13} />
                    </button>
                  </div>

                  <div className="cg-um-activity-timeline">
                    {!history ? (
                      <p className="cg-um-text-muted">Loading verified activity log…</p>
                    ) : history.length === 0 ? (
                      <p className="cg-um-text-muted">No recent account events recorded.</p>
                    ) : (
                      history.slice(0, 5).map(event => (
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
                              <span>{new Date(event.occurredAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "personal" && (
            <div className="cg-um-section-card">
              <h3>Personal Information</h3>
              <div className="cg-um-keyval-grid">
                <div className="cg-um-keyval-row">
                  <span className="key">Full Name</span>
                  <span className="val bold">{account.displayName}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Mobile Username</span>
                  <span className="val">{account.phone || "—"}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Official Email</span>
                  <span className="val">{account.email || "—"}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Account Status</span>
                  <span className="val">{accountStatusLabel(account.status)}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Data Revision</span>
                  <span className="val">{account.revision}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "employment" && (
            <div className="cg-um-section-card">
              <h3>Employment &amp; Operations</h3>
              <div className="cg-um-keyval-grid">
                <div className="cg-um-keyval-row">
                  <span className="key">Employee ID</span>
                  <span className="val bold">{empId}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Current Role</span>
                  <span className="val">{account.roleName || "Volunteer"}</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Jurisdiction / Scope</span>
                  <span className="val">Foundation Root Scope</span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Assigned Date</span>
                  <span className="val">{formatDisplayDate(account.assignedAt)}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "roles" && (
            <div className="cg-um-section-card">
              <h3>Roles &amp; Access Rights</h3>
              <div className="cg-um-keyval-grid">
                <div className="cg-um-keyval-row">
                  <span className="key">Assigned Role</span>
                  <span className="val">
                    <span className="cg-um-role-chip">{account.roleName || "Volunteer"}</span>
                  </span>
                </div>
                <div className="cg-um-keyval-row">
                  <span className="key">Protected Administrator</span>
                  <span className="val">{account.roleProtected ? "Yes (Protected)" : "No (Standard)"}</span>
                </div>
              </div>
              <div className="cg-um-drawer-banner green" style={{ marginTop: "1rem" }}>
                <span>Role assignments follow strict server RBAC controls. Only permitted roles are eligible.</span>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="cg-um-section-card">
              <h3>Verified Documents</h3>
              <p className="cg-um-text-muted">Staff identity verification documents are securely archived in CG-19 Document Vault.</p>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="cg-um-section-card">
              <div className="cg-um-section-card-header">
                <h3>Full Activity Trail</h3>
                <button
                  type="button"
                  className="cg-um-icon-btn"
                  onClick={() => onLoadHistory(account.accountRef)}
                  title="Refresh activity log"
                >
                  <RefreshCwIcon size={14} />
                </button>
              </div>

              <div className="cg-um-activity-timeline">
                {!history ? (
                  <p className="cg-um-text-muted">Loading verified activity log…</p>
                ) : history.length === 0 ? (
                  <p className="cg-um-text-muted">No account events recorded for this user.</p>
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
                          <span>{new Date(event.occurredAt).toLocaleString()}</span>
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
