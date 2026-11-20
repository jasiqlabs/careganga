import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator
} from "react-native";
import type { CG01AccountView } from "@careganga/api-contracts";
import { AuthenticatedScreenHeader } from "../../dashboard/authenticated-screen-header";
import { useBottomNavPadding } from "../../dashboard/authenticated-bottom-navigation";
import {
  IconArrowLeft,
  IconClose,
  IconMail,
  IconPhone,
  IconCalendar,
  IconClock,
  IconShield,
  IconKey,
  IconEdit,
  IconTrash2,
  IconCopy,
  IconCheck,
  IconVerifiedBadge,
  IconUsers,
  IconFileText,
  IconRefreshCw,
  IconSend,
  IconChevronDown,
  IconArrowRight,
  IconAlertTriangle,
  IconUserCheck
} from "./users-management-icons";
import {
  formatEmployeeId,
  formatDisplayDate,
  formatDisplayDateTime,
  formatRelativeTime,
  accountStatusLabel,
  auditOutcomeLabel,
  getInitials,
  getAvatarColor,
  type DetailTab,
  type UserInternalNote
} from "./users-management-types";

export interface ScreenUserDetailsProps {
  account: CG01AccountView;
  actions: string[];
  history: Array<{
    eventRef: string;
    occurredAt: string;
    actionLabel: string;
    outcome: string;
    actorDisplay?: string;
  }> | null;
  onLoadHistory: (accountRef: string) => void;
  onEditProfile: (account: CG01AccountView) => void;
  onAssignRole: (account: CG01AccountView) => void;
  onStatusChange: (account: CG01AccountView, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => void;
  onDeleteAccount: (account: CG01AccountView) => void;
  onClose: () => void;
  busy?: boolean;
}

export function ScreenUserDetails({
  account,
  actions,
  history,
  onLoadHistory,
  onEditProfile,
  onAssignRole,
  onStatusChange,
  onDeleteAccount,
  onClose,
  busy = false
}: ScreenUserDetailsProps) {
  const bottomPadding = useBottomNavPadding(24);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [copiedContact, setCopiedContact] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [notes, setNotes] = useState<UserInternalNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const empId = formatEmployeeId(account);
  const avatarTheme = getAvatarColor(account.displayName);
  const canAssign = actions.includes("roles.assign");
  const canStatus = actions.includes("accounts.status.manage");
  const canAudit = actions.includes("access.audit.view");
  const isProtected = Boolean(account.roleProtected);
  const hasContact = Boolean(account.phone || account.email);

  // Automatically load history if authorized
  useEffect(() => {
    if (canAudit && !history) {
      onLoadHistory(account.accountRef);
    }
  }, [canAudit, history, account.accountRef, onLoadHistory]);

  const handleCopyContact = () => {
    const text = account.phone || account.email || account.displayName;
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 2000);
  };

  const handleRefreshHistory = () => {
    if (refreshingHistory) return;
    setRefreshingHistory(true);
    onLoadHistory(account.accountRef);
    setTimeout(() => setRefreshingHistory(false), 600);
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const note: UserInternalNote = {
      id: String(Date.now()),
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

  // Authoritative timestamps from audit history
  const loginAudit = history?.find(
    e =>
      e.actionLabel.toLowerCase().includes("login") ||
      e.actionLabel.toLowerCase().includes("signed in") ||
      e.eventRef.toLowerCase().includes("login")
  );
  const lastLoginTime = loginAudit ? formatDisplayDateTime(loginAudit.occurredAt) : "Not recorded";
  const latestAudit = history && history.length > 0 ? history[0] : null;
  const lastSeenRelative = latestAudit ? formatRelativeTime(latestAudit.occurredAt) : "Not recorded";

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "personal", label: "Personal Info" },
    { id: "employment", label: "Employment" },
    { id: "roles", label: "Roles & Permissions" },
    { id: "documents", label: "Documents" },
    { id: "activity", label: "Activity Log" }
  ];

  return (
    <View style={styles.screenContainer}>
      {/* Reusable Workflow Header */}
      <AuthenticatedScreenHeader
        variant="workflow"
        title="User Details"
        subtitle={account.displayName}
        onBack={onClose}
        onClose={onClose}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* IDENTITY BANNER (COMPACT NATIVE MOBILE PRESENTATION)              */}
        {/* ================================================================= */}
        <View style={styles.identityBanner}>
          <View style={styles.identityTopRow}>
            <View
              style={[
                styles.largeAvatar,
                { backgroundColor: avatarTheme.bg }
              ]}
            >
              <Text style={[styles.largeAvatarText, { color: avatarTheme.text }]}>
                {getInitials(account.displayName)}
              </Text>
            </View>

            <View style={styles.identityMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {account.displayName}
                </Text>
                <IconVerifiedBadge size={16} color="#2563EB" />
              </View>

              <View style={styles.identityIdsRow}>
                <Text style={styles.accountRefBadge}>{account.accountRef}</Text>
                {empId !== "Not assigned" && (
                  <Text style={styles.empIdBadge}>ID: {empId}</Text>
                )}
              </View>

              <View style={styles.identityRolesRow}>
                <View
                  style={[
                    styles.roleBadge,
                    isProtected ? styles.roleBadgeProtected : styles.roleBadgePrimary
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      isProtected ? styles.roleBadgeTextProtected : styles.roleBadgeTextPrimary
                    ]}
                  >
                    {account.roleName || "Staff"}
                  </Text>
                </View>

                {isProtected && (
                  <View style={styles.protectedBadge}>
                    <Text style={styles.protectedBadgeText}>Protected Root</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Contact Details & Status Row */}
          <View style={styles.identityBottomRow}>
            <View style={styles.contactsWrap}>
              {!!account.phone && (
                <View style={styles.contactItem}>
                  <IconPhone size={13} color="#475569" />
                  <Text style={styles.contactItemText}>{account.phone}</Text>
                </View>
              )}
              <View style={styles.contactItem}>
                <IconMail size={13} color="#475569" />
                <Text style={styles.contactItemText} numberOfLines={1}>
                  {account.email || "No email registered"}
                </Text>
              </View>
            </View>

            <View style={styles.identityActionsWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy contact information"
                onPress={handleCopyContact}
                style={[styles.copyBtn, copiedContact && styles.copyBtnSuccess]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {copiedContact ? (
                  <IconCheck size={14} color="#16A34A" />
                ) : (
                  <IconCopy size={14} color="#2563EB" />
                )}
                <Text style={[styles.copyBtnText, copiedContact && styles.copyBtnTextSuccess]}>
                  {copiedContact ? "Copied" : "Copy"}
                </Text>
              </Pressable>

              {/* Status Pill with Quick Dropdown */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Account status: ${accountStatusLabel(account.status)}`}
                onPress={() => {
                  if (canStatus && !isProtected) setStatusMenuOpen(true);
                }}
                style={[
                  styles.statusPillLarge,
                  account.status === "ACTIVE"
                    ? styles.statusPillActive
                    : account.status === "SUSPENDED"
                    ? styles.statusPillSuspended
                    : styles.statusPillDeactivated
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    account.status === "ACTIVE"
                      ? styles.statusDotActive
                      : account.status === "SUSPENDED"
                      ? styles.statusDotSuspended
                      : styles.statusDotDeactivated
                  ]}
                />
                <Text
                  style={[
                    styles.statusTextLarge,
                    account.status === "ACTIVE"
                      ? styles.statusTextActive
                      : account.status === "SUSPENDED"
                      ? styles.statusTextSuspended
                      : styles.statusTextDeactivated
                  ]}
                >
                  {accountStatusLabel(account.status)}
                </Text>
                {canStatus && !isProtected && (
                  <IconChevronDown size={11} color="#64748B" />
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 6 HORIZONTAL NAVIGATION TABS                                      */}
        {/* ================================================================= */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsStrip}
        >
          {tabs.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW                                                   */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <View style={styles.tabContentContainer}>
            {/* 4 Summary Metric Cells */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}>
                  <IconUserCheck size={16} color="#059669" />
                </View>
                <Text style={styles.metricLabel}>User Type</Text>
                <Text style={styles.metricVal} numberOfLines={1}>
                  {account.roleName || "Staff"}
                </Text>
              </View>

              <View style={styles.metricCell}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <IconShield size={16} color="#2563EB" />
                </View>
                <Text style={styles.metricLabel}>Account Status</Text>
                <Text style={styles.metricVal} numberOfLines={1}>
                  {accountStatusLabel(account.status)}
                </Text>
              </View>

              <View style={styles.metricCell}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#F5F3FF" }]}>
                  <IconUsers size={16} color="#7C3AED" />
                </View>
                <Text style={styles.metricLabel}>Access Scope</Text>
                <Text style={styles.metricVal} numberOfLines={1}>
                  {isProtected ? "Root Scope" : "Role Policy"}
                </Text>
              </View>

              <View style={styles.metricCell}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#ECFEFF" }]}>
                  <IconCalendar size={16} color="#0891B2" />
                </View>
                <Text style={styles.metricLabel}>Joined On</Text>
                <Text style={styles.metricVal} numberOfLines={1}>
                  {formatDisplayDate(account.assignedAt)}
                </Text>
              </View>
            </View>

            {/* Account Information Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <Text style={styles.sectionCardTitle}>Account Information</Text>
                {!isProtected && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                    onPress={() => onEditProfile(account)}
                    style={styles.editLinkBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IconEdit size={13} color="#2563EB" />
                    <Text style={styles.editLinkText}>Edit</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.keyValGrid}>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Account Ref</Text>
                  <Text style={[styles.keyVal, styles.fontMono]}>{account.accountRef}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Employee ID</Text>
                  <Text style={styles.keyVal}>{empId}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Full Name</Text>
                  <Text style={[styles.keyVal, styles.fontBold]}>{account.displayName}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Email</Text>
                  <Text style={styles.keyVal}>{account.email || "Not registered"}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Mobile</Text>
                  <Text style={styles.keyVal}>{account.phone || "Not registered"}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Password</Text>
                  <Text style={[styles.keyVal, styles.textMuted]}>•••••••• (Secured)</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Last Login</Text>
                  <Text style={styles.keyVal}>{lastLoginTime}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Last Activity</Text>
                  <Text style={styles.keyVal}>{lastSeenRelative}</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onEditProfile(account)}
                  disabled={isProtected || busy}
                  style={[styles.qaBtn, (isProtected || busy) && styles.qaBtnDisabled]}
                >
                  <IconEdit size={14} color={isProtected ? "#94A3B8" : "#2563EB"} />
                  <Text style={[styles.qaBtnText, isProtected && styles.qaBtnTextDisabled]}>
                    Update Profile
                  </Text>
                </Pressable>

                {canAssign && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onAssignRole(account)}
                    disabled={isProtected || busy}
                    style={[styles.qaBtn, (isProtected || busy) && styles.qaBtnDisabled]}
                  >
                    <IconShield size={14} color={isProtected ? "#94A3B8" : "#7C3AED"} />
                    <Text style={[styles.qaBtnText, isProtected && styles.qaBtnTextDisabled]}>
                      Change Role
                    </Text>
                  </Pressable>
                )}

                {canStatus && account.status !== "DEACTIVATED" && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onStatusChange(account, account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
                    disabled={isProtected || busy}
                    style={[styles.qaBtn, (isProtected || busy) && styles.qaBtnDisabled]}
                  >
                    <IconClock size={14} color={isProtected ? "#94A3B8" : "#D97706"} />
                    <Text style={[styles.qaBtnText, isProtected && styles.qaBtnTextDisabled]}>
                      {account.status === "ACTIVE" ? "Suspend User" : "Reactivate"}
                    </Text>
                  </Pressable>
                )}

                {canStatus && account.status !== "DEACTIVATED" && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onDeleteAccount(account)}
                    disabled={isProtected || busy}
                    style={[styles.qaBtn, styles.qaBtnDanger, (isProtected || busy) && styles.qaBtnDisabled]}
                  >
                    <IconTrash2 size={14} color={isProtected ? "#94A3B8" : "#DC2626"} />
                    <Text style={[styles.qaBtnText, styles.qaBtnTextDanger, isProtected && styles.qaBtnTextDisabled]}>
                      Deactivate User
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  accessibilityRole="button"
                  onPress={handleCopyContact}
                  disabled={!hasContact}
                  style={[styles.qaBtn, !hasContact && styles.qaBtnDisabled]}
                >
                  {copiedContact ? (
                    <IconCheck size={14} color="#16A34A" />
                  ) : (
                    <IconCopy size={14} color="#2563EB" />
                  )}
                  <Text style={styles.qaBtnText}>
                    {copiedContact ? "Copied!" : "Copy Contact"}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled
                  style={[styles.qaBtn, styles.qaBtnDisabled]}
                >
                  <IconKey size={14} color="#94A3B8" />
                  <Text style={[styles.qaBtnText, styles.qaBtnTextDisabled]}>
                    Reset Password
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.qaHint}>
                Password reset requires user self-service via recovery flow at /admin/recovery.
              </Text>
            </View>

            {/* Session Notes Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={styles.notesTitleWrap}>
                  <Text style={styles.sectionCardTitle}>Notes &amp; Comments</Text>
                  <View style={styles.sessionBadge}>
                    <Text style={styles.sessionBadgeText}>Session Only</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.sessionNotice}>
                Internal notes entered here are temporary to this active session and are not stored in the database.
              </Text>

              {notes.length === 0 ? (
                <Text style={styles.emptyNotesText}>No session notes added yet.</Text>
              ) : (
                <View style={styles.notesList}>
                  {notes.map(n => (
                    <View key={n.id} style={styles.noteBubble}>
                      <View style={styles.noteHeader}>
                        <Text style={styles.noteAuthor}>{n.author}</Text>
                        <Text style={styles.noteTime}>{formatDisplayDateTime(n.createdAt)}</Text>
                        <Pressable
                          onPress={() => handleDeleteNote(n.id)}
                          style={styles.deleteNoteBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconClose size={12} color="#94A3B8" />
                        </Pressable>
                      </View>
                      <Text style={styles.noteText}>{n.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.addNoteForm}>
                <TextInput
                  value={newNoteText}
                  onChangeText={setNewNoteText}
                  placeholder="Add a temporary session note…"
                  placeholderTextColor="#94A3B8"
                  style={styles.noteInput}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={handleAddNote}
                  disabled={!newNoteText.trim()}
                  style={[styles.addNoteBtn, !newNoteText.trim() && styles.addNoteBtnDisabled]}
                >
                  <IconSend size={13} color="#FFFFFF" />
                  <Text style={styles.addNoteBtnText}>Add</Text>
                </Pressable>
              </View>
            </View>

            {/* Recent Activity Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <Text style={styles.sectionCardTitle}>Recent Activity Log</Text>
                <View style={styles.activityHeaderActions}>
                  {canAudit && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleRefreshHistory}
                      disabled={refreshingHistory}
                      style={styles.iconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <IconRefreshCw size={13} color="#475569" />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setActiveTab("activity")}
                    style={styles.editLinkBtn}
                  >
                    <Text style={styles.editLinkText}>View All</Text>
                  </Pressable>
                </View>
              </View>

              {!canAudit ? (
                <Text style={styles.textMuted}>Activity audit logs require Security Audit permission.</Text>
              ) : !history ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.textMuted}>Loading activity history…</Text>
                </View>
              ) : history.length === 0 ? (
                <Text style={styles.textMuted}>No activity recorded yet for this account.</Text>
              ) : (
                <View style={styles.timelineList}>
                  {history.slice(0, 3).map(event => (
                    <View key={event.eventRef} style={styles.timelineItem}>
                      <View style={styles.timelineMarker} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineAction}>{event.actionLabel}</Text>
                        <View style={styles.timelineMeta}>
                          <View
                            style={[
                              styles.outcomePill,
                              event.outcome === "Confirmed"
                                ? styles.outcomePillSuccess
                                : event.outcome === "Denied"
                                ? styles.outcomePillDenied
                                : styles.outcomePillPending
                            ]}
                          >
                            <Text
                              style={[
                                styles.outcomePillText,
                                event.outcome === "Confirmed"
                                  ? styles.outcomePillTextSuccess
                                  : event.outcome === "Denied"
                                  ? styles.outcomePillTextDenied
                                  : styles.outcomePillTextPending
                              ]}
                            >
                              {auditOutcomeLabel(event.outcome)}
                            </Text>
                          </View>
                          <Text style={styles.timelineTime}>
                            {formatDisplayDateTime(event.occurredAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: PERSONAL INFO                                              */}
        {/* ================================================================= */}
        {activeTab === "personal" && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View>
                  <Text style={styles.sectionCardTitle}>Personal Information</Text>
                  <Text style={styles.sectionCardSubtitle}>
                    Identity details recorded in the primary account registry.
                  </Text>
                </View>
                {!isProtected && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onEditProfile(account)}
                    style={styles.editLinkBtn}
                  >
                    <IconEdit size={13} color="#2563EB" />
                    <Text style={styles.editLinkText}>Edit</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.keyValGrid}>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Full Name</Text>
                  <Text style={[styles.keyVal, styles.fontBold]}>{account.displayName}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Account Reference</Text>
                  <Text style={[styles.keyVal, styles.fontMono, styles.fontBold]}>
                    {account.accountRef}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Mobile Number</Text>
                  <Text style={styles.keyVal}>{account.phone || "Not provided"}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Email Address</Text>
                  <Text style={styles.keyVal}>{account.email || "Not provided"}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Registration Date</Text>
                  <Text style={styles.keyVal}>
                    {formatDisplayDateTime(account.assignedAt, "Not recorded")}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Account Revision</Text>
                  <Text style={[styles.keyVal, styles.fontMono]}>Revision {account.revision}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 3: EMPLOYMENT                                                 */}
        {/* ================================================================= */}
        {activeTab === "employment" && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View>
                  <Text style={styles.sectionCardTitle}>Staff Assignment &amp; Designation</Text>
                  <Text style={styles.sectionCardSubtitle}>
                    Current role classification and assignment records.
                  </Text>
                </View>
                {!isProtected && canAssign && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onAssignRole(account)}
                    style={styles.editLinkBtn}
                  >
                    <IconEdit size={13} color="#2563EB" />
                    <Text style={styles.editLinkText}>Change Role</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.keyValGrid}>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Designation / Role</Text>
                  <Text style={[styles.keyVal, styles.fontBold]}>{account.roleName || "Staff"}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Role Reference</Text>
                  <Text style={[styles.keyVal, styles.fontMono]}>
                    {account.roleRef || "Not assigned"}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Assignment Date</Text>
                  <Text style={styles.keyVal}>{formatDisplayDate(account.assignedAt)}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Account Classification</Text>
                  <Text style={styles.keyVal}>
                    {isProtected ? "Protected Foundation Root Staff" : "Standard Foundation Staff"}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Access Scope</Text>
                  <Text style={styles.keyVal}>
                    {isProtected ? "Foundation Root Scope" : "Assigned Role Policy"}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Account Status</Text>
                  <Text style={styles.keyVal}>{accountStatusLabel(account.status)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ROLES & PERMISSIONS                                        */}
        {/* ================================================================= */}
        {activeTab === "roles" && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View>
                  <Text style={styles.sectionCardTitle}>Roles &amp; Permissions</Text>
                  <Text style={styles.sectionCardSubtitle}>
                    Server-enforced role-based access control and security policies.
                  </Text>
                </View>
                {!isProtected && canAssign && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onAssignRole(account)}
                    style={styles.editLinkBtn}
                  >
                    <IconEdit size={13} color="#2563EB" />
                    <Text style={styles.editLinkText}>Edit Role</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.keyValGrid}>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Assigned Role</Text>
                  <Text style={[styles.keyVal, styles.fontBold]}>{account.roleName || "Staff"}</Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Role Reference</Text>
                  <Text style={[styles.keyVal, styles.fontMono]}>
                    {account.roleRef || "Not assigned"}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>User Classification</Text>
                  <Text style={styles.keyVal}>
                    {isProtected ? "Protected Root" : "Standard Account"}
                  </Text>
                </View>
                <View style={styles.keyValRow}>
                  <Text style={styles.keyLabel}>Access Model</Text>
                  <Text style={styles.keyVal}>
                    {isProtected ? "Foundation Root (Protected)" : "Role-Based Access Control"}
                  </Text>
                </View>
              </View>

              <View style={styles.policyBannerBox}>
                <View style={styles.policyBannerHeader}>
                  <IconShield size={18} color="#1D4ED8" />
                  <Text style={styles.policyBannerTitle}>
                    Authoritative Server-Side RBAC Enforcement
                  </Text>
                </View>
                <Text style={styles.policyDesc}>
                  CareGanga Foundation access capabilities are strictly evaluated and enforced by the server on each API call.
                </Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>
                    • Effective capabilities are bound to the role definition catalog in the backend.
                  </Text>
                  <Text style={styles.bulletItem}>
                    • Security policies and cryptographic session tokens govern realm permissions.
                  </Text>
                  <Text style={styles.bulletItem}>
                    • {isProtected
                      ? "Protected root accounts have immutable platform rights and cannot be downgraded."
                      : "Role assignments are managed through the centralized Roles & Permissions module."}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 5: DOCUMENTS                                                  */}
        {/* ================================================================= */}
        {activeTab === "documents" && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>Documents</Text>
              <View style={styles.emptyDocWrap}>
                <View style={styles.emptyDocIconBox}>
                  <IconFileText size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyDocHeading}>No documents attached to this account.</Text>
                <Text style={styles.emptyDocText}>
                  Staff identity verification records and credentials are managed securely within the CG-19 Document Vault.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 6: ACTIVITY LOG                                               */}
        {/* ================================================================= */}
        {activeTab === "activity" && (
          <View style={styles.tabContentContainer}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View>
                  <Text style={styles.sectionCardTitle}>Activity Log</Text>
                  <Text style={styles.sectionCardSubtitle}>
                    Verified security audit events recorded for this user account.
                  </Text>
                </View>
                {canAudit && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRefreshHistory}
                    disabled={refreshingHistory}
                    style={styles.iconBtn}
                  >
                    <IconRefreshCw size={14} color="#475569" />
                  </Pressable>
                )}
              </View>

              {!canAudit ? (
                <Text style={styles.textMuted}>Viewing audit trails requires access.audit.view permission.</Text>
              ) : !history ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.textMuted}>Loading complete verified audit history…</Text>
                </View>
              ) : history.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <IconClock size={36} color="#CBD5E1" />
                  <Text style={styles.textMuted}>No activity recorded yet for this account.</Text>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {history.map(event => (
                    <View key={event.eventRef} style={styles.timelineItem}>
                      <View style={styles.timelineMarker} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineAction}>{event.actionLabel}</Text>
                        <View style={styles.timelineMeta}>
                          <View
                            style={[
                              styles.outcomePill,
                              event.outcome === "Confirmed"
                                ? styles.outcomePillSuccess
                                : event.outcome === "Denied"
                                ? styles.outcomePillDenied
                                : styles.outcomePillPending
                            ]}
                          >
                            <Text
                              style={[
                                styles.outcomePillText,
                                event.outcome === "Confirmed"
                                  ? styles.outcomePillTextSuccess
                                  : event.outcome === "Denied"
                                  ? styles.outcomePillTextDenied
                                  : styles.outcomePillTextPending
                              ]}
                            >
                              {auditOutcomeLabel(event.outcome)}
                            </Text>
                          </View>
                          {!!event.actorDisplay && (
                            <Text style={styles.timelineActor}>by {event.actorDisplay}</Text>
                          )}
                          <Text style={styles.timelineTime}>
                            {formatDisplayDateTime(event.occurredAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Status Menu Modal Sheet */}
      <Modal
        visible={statusMenuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setStatusMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusMenuOpen(false)}>
          <View style={styles.statusMenuSheet}>
            <Text style={styles.statusMenuTitle}>Change Account Status</Text>

            <Pressable
              style={styles.statusMenuItem}
              onPress={() => {
                setStatusMenuOpen(false);
                if (account.status !== "ACTIVE") onStatusChange(account, "ACTIVE");
              }}
            >
              <View style={[styles.statusDot, styles.statusDotActive]} />
              <Text style={styles.statusMenuItemText}>Active</Text>
            </Pressable>

            <Pressable
              style={styles.statusMenuItem}
              onPress={() => {
                setStatusMenuOpen(false);
                if (account.status !== "SUSPENDED") onStatusChange(account, "SUSPENDED");
              }}
            >
              <View style={[styles.statusDot, styles.statusDotSuspended]} />
              <Text style={styles.statusMenuItemText}>Suspended</Text>
            </Pressable>

            <Pressable
              style={[styles.statusMenuItem, { borderTopWidth: 1, borderTopColor: "#F1F5F9" }]}
              onPress={() => {
                setStatusMenuOpen(false);
                if (account.status !== "DEACTIVATED") onStatusChange(account, "DEACTIVATED");
              }}
            >
              <View style={[styles.statusDot, styles.statusDotDeactivated]} />
              <Text style={[styles.statusMenuItemText, { color: "#E11D48" }]}>Deactivated</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  scrollContent: {
    padding: 16,
    gap: 14
  },
  identityBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 14
  },
  identityTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  largeAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center"
  },
  largeAvatarText: {
    fontSize: 20,
    fontWeight: "800"
  },
  identityMeta: {
    flex: 1,
    gap: 4
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  identityName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
    flexShrink: 1
  },
  identityIdsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  accountRefBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    fontFamily: "monospace"
  },
  empIdBadge: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8"
  },
  identityRolesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  roleBadgePrimary: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  roleBadgeProtected: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700"
  },
  roleBadgeTextPrimary: {
    color: "#1D4ED8"
  },
  roleBadgeTextProtected: {
    color: "#B45309"
  },
  protectedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  protectedBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#B45309"
  },
  identityBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexWrap: "wrap",
    gap: 10
  },
  contactsWrap: {
    gap: 4,
    flex: 1,
    minWidth: 160
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  contactItemText: {
    fontSize: 12.5,
    color: "#475569"
  },
  identityActionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  copyBtnSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  copyBtnTextSuccess: {
    color: "#16A34A"
  },
  statusPillLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1
  },
  statusPillActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  statusPillSuspended: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A"
  },
  statusPillDeactivated: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3"
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  statusDotActive: {
    backgroundColor: "#059669"
  },
  statusDotSuspended: {
    backgroundColor: "#D97706"
  },
  statusDotDeactivated: {
    backgroundColor: "#E11D48"
  },
  statusTextLarge: {
    fontSize: 11.5,
    fontWeight: "700"
  },
  statusTextActive: {
    color: "#059669"
  },
  statusTextSuspended: {
    color: "#B45309"
  },
  statusTextDeactivated: {
    color: "#E11D48"
  },
  tabsStrip: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  tabButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB"
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569"
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  tabContentContainer: {
    gap: 14
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCell: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B"
  },
  metricVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A"
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    gap: 12
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  sectionCardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  editLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4
  },
  editLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#2563EB"
  },
  keyValGrid: {
    gap: 10
  },
  keyValRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC"
  },
  keyLabel: {
    fontSize: 12.5,
    color: "#64748B",
    fontWeight: "500"
  },
  keyVal: {
    fontSize: 13,
    color: "#1E293B",
    textAlign: "right",
    flex: 1,
    marginLeft: 16
  },
  fontMono: {
    fontFamily: "monospace"
  },
  fontBold: {
    fontWeight: "700"
  },
  textMuted: {
    color: "#94A3B8"
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  qaBtn: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  qaBtnDisabled: {
    opacity: 0.5
  },
  qaBtnDanger: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3"
  },
  qaBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  qaBtnTextDanger: {
    color: "#DC2626"
  },
  qaBtnTextDisabled: {
    color: "#94A3B8"
  },
  qaHint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 15
  },
  notesTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sessionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#EFF6FF"
  },
  sessionBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#2563EB"
  },
  sessionNotice: {
    fontSize: 11.5,
    color: "#64748B",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  emptyNotesText: {
    fontSize: 12.5,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 6
  },
  notesList: {
    gap: 8
  },
  noteBubble: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  noteAuthor: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#334155"
  },
  noteTime: {
    fontSize: 10.5,
    color: "#94A3B8"
  },
  deleteNoteBtn: {
    padding: 2
  },
  noteText: {
    fontSize: 12.5,
    color: "#1E293B"
  },
  addNoteForm: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  noteInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: "#0F172A",
    backgroundColor: "#FFFFFF"
  },
  addNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#2563EB"
  },
  addNoteBtnDisabled: {
    opacity: 0.5
  },
  addNoteBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  activityHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconBtn: {
    padding: 6
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12
  },
  timelineList: {
    gap: 12,
    marginTop: 4
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12
  },
  timelineMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    marginTop: 5
  },
  timelineContent: {
    flex: 1,
    gap: 4
  },
  timelineAction: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  timelineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  outcomePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  outcomePillSuccess: {
    backgroundColor: "#ECFDF5"
  },
  outcomePillDenied: {
    backgroundColor: "#FFF1F2"
  },
  outcomePillPending: {
    backgroundColor: "#FFFBEB"
  },
  outcomePillText: {
    fontSize: 10.5,
    fontWeight: "700"
  },
  outcomePillTextSuccess: {
    color: "#059669"
  },
  outcomePillTextDenied: {
    color: "#DC2626"
  },
  outcomePillTextPending: {
    color: "#D97706"
  },
  timelineActor: {
    fontSize: 11,
    color: "#64748B"
  },
  timelineTime: {
    fontSize: 11,
    color: "#94A3B8"
  },
  policyBannerBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 8
  },
  policyBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  policyBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8",
    flex: 1
  },
  policyDesc: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 16
  },
  bulletList: {
    gap: 4
  },
  bulletItem: {
    fontSize: 11.5,
    color: "#475569",
    lineHeight: 16
  },
  emptyDocWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8
  },
  emptyDocIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  emptyDocHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center"
  },
  emptyDocText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 16
  },
  emptyStateBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  statusMenuSheet: {
    width: "100%",
    maxWidth: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  statusMenuTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  statusMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  statusMenuItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155"
  }
});
