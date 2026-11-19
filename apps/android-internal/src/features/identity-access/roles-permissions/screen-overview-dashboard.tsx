import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert
} from "react-native";
import { StatisticsGrid } from "./statistics-card";
import { StatisticsGridSkeleton } from "./roles-permissions-skeletons";
import { FeedbackBanner } from "./feedback-banner";
import { roleColor } from "../../../../../../packages/design-tokens/src/index";
import {
  IconPlus,
  IconClock,
  IconDownload,
  IconChevronRight,
  IconShield,
  IconUsersTotal
} from "./roles-permissions-icons";
import { useBottomNavPadding } from "../../dashboard/authenticated-bottom-navigation";
import type { Role, RoleSummary, AuditEvent } from "./roles-permissions-types";

export interface ScreenOverviewDashboardProps {
  summary: RoleSummary | null;
  roles: Role[];
  history?: AuditEvent[] | null;
  busy: boolean;
  error?: string;
  canEdit: boolean;
  canAudit: boolean;
  onCreateRole: () => void;
  onOpenHistory: () => void;
  onSelectRole?: (role: Role) => void;
  onViewAllRoles?: () => void;
}

/**
 * Roles & Permissions Overview Screen
 * Provides the complete command center dashboard matching the Web CareGanga portal:
 * - 6 responsive statistics cards (with skeleton loading)
 * - Quick action triggers (Create Role, Access History, Export)
 * - Active Foundation Roles summary list from actual backend data
 * - Recent security activity audit summary if available
 * - Guaranteed dynamic clearance above floating bottom navigation bar
 */
export function ScreenOverviewDashboard({
  summary,
  roles,
  history,
  busy,
  error,
  canEdit,
  canAudit,
  onCreateRole,
  onOpenHistory,
  onSelectRole,
  onViewAllRoles
}: ScreenOverviewDashboardProps) {
  const bottomPadding = useBottomNavPadding(28);

  const handleExport = async () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalRoles: summary?.totalRoles ?? roles.length,
        activeRoles: summary?.activeRoles ?? 0,
        customRoles: summary?.customRoles ?? 0,
        systemRoles: summary?.systemRoles ?? 0,
        roles: roles.map(r => ({
          name: r.name,
          active: r.active,
          protected: r.protected,
          assignedCount: r.assignedCount,
          actionCount: r.actionKeys.length,
          description: r.description
        }))
      };

      await Share.share({
        title: "CareGanga Roles & Permissions Export",
        message: JSON.stringify(exportData, null, 2)
      });
    } catch {
      Alert.alert("Export", "Could not complete export at this time.");
    }
  };

  // Top active roles preview (up to 4)
  const activeRolesPreview = roles
    .filter(r => r.active)
    .slice(0, 4);

  // Recent audit events preview (up to 3)
  const recentEvents = (history ?? []).slice(0, 3);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Title Section */}
      <View style={styles.titleSection}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          Roles & Permissions
        </Text>
        <Text style={styles.pageSubtitle}>
          Complete Command Center & Control Panel
        </Text>
      </View>

      {/* Error Feedback Banner */}
      {!!error && <FeedbackBanner type="error" message={error} />}

      {/* 6 Statistics Cards Grid (or Skeleton during initial load) */}
      {busy && !summary ? (
        <StatisticsGridSkeleton />
      ) : (
        <StatisticsGrid summary={summary} />
      )}

      {/* Quick Actions Section */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionsStack}>
          {/* Create Role Button */}
          {canEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new role"
              onPress={onCreateRole}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed
              ]}
            >
              <IconPlus size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Create Role</Text>
            </Pressable>
          )}

          {/* Access History Button */}
          {canAudit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View access history"
              onPress={onOpenHistory}
              style={({ pressed }) => [
                styles.outlineButton,
                pressed && styles.outlineButtonPressed
              ]}
            >
              <IconClock size={17} color="#0F172A" />
              <Text style={styles.outlineButtonText}>Access History</Text>
            </Pressable>
          )}

          {/* Export Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export roles summary"
            onPress={handleExport}
            style={({ pressed }) => [
              styles.outlineButton,
              pressed && styles.outlineButtonPressed
            ]}
          >
            <IconDownload size={17} color="#0F172A" />
            <Text style={styles.outlineButtonText}>Export</Text>
          </Pressable>
        </View>
      </View>

      {/* Active Roles Summary Preview Section (Web Parity) */}
      {activeRolesPreview.length > 0 && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Foundation Roles</Text>
            {onViewAllRoles && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all roles"
                onPress={onViewAllRoles}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.viewAllLink}>View All ({roles.length})</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.previewCardStack}>
            {activeRolesPreview.map(role => {
              const initials = role.name
                .split(/\s+/)
                .map(w => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "RO";
              const isSystem = role.protected;

              return (
                <Pressable
                  key={role.roleRef}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${role.name}`}
                  onPress={() => onSelectRole?.(role)}
                  style={({ pressed }) => [
                    styles.previewRoleCard,
                    pressed && styles.previewRoleCardPressed
                  ]}
                >
                  <View
                    style={[
                      styles.previewAvatarBox,
                      { backgroundColor: roleColor(role.colorKey) }
                    ]}
                  >
                    <Text style={styles.previewAvatarText}>{initials}</Text>
                  </View>

                  <View style={styles.previewRoleInfo}>
                    <Text style={styles.previewRoleName} numberOfLines={1}>
                      {role.name}
                    </Text>
                    <Text style={styles.previewRoleMeta} numberOfLines={1}>
                      {role.assignedCount} assigned · {role.actionKeys.length} actions
                    </Text>
                  </View>

                  <View style={styles.previewBadgeWrap}>
                    <View
                      style={[
                        styles.typeBadge,
                        isSystem ? styles.systemBadge : styles.customBadge
                      ]}
                    >
                      <Text
                        style={
                          isSystem ? styles.systemBadgeText : styles.customBadgeText
                        }
                      >
                        {isSystem ? "System" : "Custom"}
                      </Text>
                    </View>
                    <IconChevronRight size={16} color="#94A3B8" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Recent Security Activity Preview (if available) */}
      {recentEvents.length > 0 && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Security Events</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View full access history"
              onPress={onOpenHistory}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.viewAllLink}>View History</Text>
            </Pressable>
          </View>

          <View style={styles.previewCardStack}>
            {recentEvents.map((event, idx) => (
              <View key={`${event.occurredAt}-${idx}`} style={styles.recentEventCard}>
                <View style={styles.recentEventIconBox}>
                  <IconShield size={16} color="#1D4ED8" />
                </View>
                <View style={styles.recentEventInfo}>
                  <Text style={styles.recentEventTitle} numberOfLines={1}>
                    {event.actionLabel}
                  </Text>
                  <Text style={styles.recentEventMeta} numberOfLines={1}>
                    {event.actorDisplay} · {new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <View style={styles.confirmedPill}>
                  <Text style={styles.confirmedPillText}>Confirmed</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16
  },
  titleSection: {
    marginBottom: 16
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2
  },
  sectionWrap: {
    marginTop: 20
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  viewAllLink: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  actionsStack: {
    gap: 10
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  primaryButtonPressed: {
    backgroundColor: "#1E40AF"
  },
  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8
  },
  outlineButtonPressed: {
    backgroundColor: "#F1F5F9",
    borderColor: "#94A3B8"
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A"
  },
  previewCardStack: {
    gap: 8
  },
  previewRoleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  previewRoleCardPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1"
  },
  previewAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  previewAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  previewRoleInfo: {
    flex: 1
  },
  previewRoleName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2
  },
  previewRoleMeta: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B"
  },
  previewBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1
  },
  customBadge: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF"
  },
  customBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#7E22CE"
  },
  systemBadge: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE"
  },
  systemBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  recentEventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10
  },
  recentEventIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  recentEventInfo: {
    flex: 1
  },
  recentEventTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 1
  },
  recentEventMeta: {
    fontSize: 11,
    color: "#64748B"
  },
  confirmedPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  confirmedPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D"
  }
});
