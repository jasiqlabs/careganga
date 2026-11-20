import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert
} from "react-native";
import { roleColor } from "../../../../../../packages/design-tokens/src/index";
import { AuthenticatedScreenHeader } from "../../dashboard/authenticated-screen-header";
import {
  IconEye,
  IconPencil,
  IconCopy,
  IconBan,
  IconClock
} from "./roles-permissions-icons";
import type { Role } from "./roles-permissions-types";

export interface ScreenRoleDetailsProps {
  role: Role;
  canEdit: boolean;
  canAudit: boolean;
  onClose: () => void;
  onViewPermissions: (role: Role) => void;
  onEditRole: (role: Role) => void;
  onCopyRole: (role: Role) => void;
  onRetireRole: (role: Role) => void;
  onViewActivity: (role: Role) => void;
}

export function ScreenRoleDetails({
  role,
  canEdit,
  canAudit,
  onClose,
  onViewPermissions,
  onEditRole,
  onCopyRole,
  onRetireRole,
  onViewActivity
}: ScreenRoleDetailsProps) {
  const initials = role.name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "RO";

  const isSystem = role.protected;
  const isRetired = !role.active;
  const avatarBg = roleColor(role.colorKey);
  const canRetire = canEdit && !isSystem && role.active && role.assignedCount === 0;

  const handleRetireClick = () => {
    if (!canRetire) return;
    Alert.alert(
      "Retire role?",
      `Are you sure you want to retire "${role.name}"? This role cannot be assigned again after retirement.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retire role",
          style: "destructive",
          onPress: () => onRetireRole(role)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Workflow Navigation Header */}
      <AuthenticatedScreenHeader
        variant="workflow"
        title="Role Details"
        onBack={onClose}
        onClose={onClose}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity Section */}
        <View style={styles.identitySection}>
          <View style={[styles.largeAvatarBox, { backgroundColor: avatarBg }]}>
            <Text style={styles.largeAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.roleNameText} numberOfLines={2}>
            {role.name}
          </Text>

          {/* Badges Row */}
          <View style={styles.badgesRow}>
            <View style={[styles.statusPill, isRetired ? styles.statusPillRetired : styles.statusPillActive]}>
              <View style={[styles.statusDot, { backgroundColor: isRetired ? "#DC2626" : "#16A34A" }]} />
              <Text style={[styles.statusPillText, isRetired ? styles.statusTextRetired : styles.statusTextActive]}>
                {isRetired ? "Retired" : "Active"}
              </Text>
            </View>

            <View style={[styles.typePill, isSystem ? styles.typePillSystem : styles.typePillCustom]}>
              <Text style={[styles.typePillText, isSystem ? styles.typeTextSystem : styles.typeTextCustom]}>
                {isSystem ? "Protected System Role" : "Custom Role"}
              </Text>
            </View>
          </View>
        </View>

        {/* Role Information Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Scope</Text>
            <Text style={styles.infoValue}>Foundation</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned accounts</Text>
            <Text style={styles.infoValue}>{role.assignedCount}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Allowed actions</Text>
            <Text style={styles.infoValue}>
              {isSystem ? "Protected authority" : `${role.actionKeys.length}`}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Description</Text>
            <Text style={styles.descriptionValue}>
              {role.description || "Full system access"}
            </Text>
          </View>
        </View>

        {/* Assigned Users Section */}
        <View style={styles.usersSection}>
          <View style={styles.usersHeaderRow}>
            <Text style={styles.usersSectionTitle}>
              Assigned Users ({role.assignedCount})
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all assigned accounts"
              onPress={() => onViewActivity(role)}
            >
              <Text style={styles.viewAllLink}>View All</Text>
            </Pressable>
          </View>

          {role.assignedCount > 0 ? (
            <View style={styles.userPreviewCard}>
              <View style={styles.userAvatarBox}>
                <Text style={styles.userAvatarText}>S</Text>
              </View>
              <View style={styles.userTextWrap}>
                <Text style={styles.userNameText}>Super Admin</Text>
                <Text style={styles.userRoleSubtitle}>Managing Trustee & Admin</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noUsersCard}>
              <Text style={styles.noUsersText}>No accounts currently assigned to this role.</Text>
            </View>
          )}
        </View>

        {/* Role Actions Stack */}
        <View style={styles.actionsStack}>
          {/* View Details / Matrix */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View role permissions"
            onPress={() => onViewPermissions(role)}
            style={styles.actionBtn}
          >
            <IconEye size={18} color="#0F172A" />
            <Text style={styles.actionBtnText}>View Details</Text>
          </Pressable>

          {/* Edit Role */}
          {canEdit && !isSystem && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit role"
              onPress={() => onEditRole(role)}
              style={styles.actionBtn}
            >
              <IconPencil size={18} color="#0F172A" />
              <Text style={styles.actionBtnText}>Edit Role</Text>
            </Pressable>
          )}

          {/* Copy Role */}
          {canEdit && !isSystem && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy role"
              onPress={() => onCopyRole(role)}
              style={styles.actionBtn}
            >
              <IconCopy size={18} color="#0F172A" />
              <Text style={styles.actionBtnText}>Copy Role</Text>
            </Pressable>
          )}

          {/* Retire Role */}
          {canEdit && !isSystem && role.active && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retire role"
              disabled={!canRetire}
              onPress={handleRetireClick}
              style={[styles.actionBtn, !canRetire && styles.actionBtnDisabled]}
            >
              <IconBan size={18} color={canRetire ? "#DC2626" : "#94A3B8"} />
              <Text style={[styles.actionBtnText, canRetire ? styles.retireText : styles.actionBtnTextDisabled]}>
                Retire Role
              </Text>
            </Pressable>
          )}

          {/* View Role Activity */}
          {canAudit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View role activity"
              onPress={() => onViewActivity(role)}
              style={styles.actionBtn}
            >
              <IconClock size={18} color="#0F172A" />
              <Text style={styles.actionBtnText}>View Role Activity</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  scrollView: {
    flex: 1
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40
  },
  identitySection: {
    alignItems: "center",
    marginBottom: 20
  },
  largeAvatarBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  largeAvatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  roleNameText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5
  },
  statusPillActive: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0"
  },
  statusPillRetired: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA"
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700"
  },
  statusTextActive: {
    color: "#15803D"
  },
  statusTextRetired: {
    color: "#B91C1C"
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1
  },
  typePillCustom: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF"
  },
  typePillSystem: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE"
  },
  typePillText: {
    fontSize: 12,
    fontWeight: "700"
  },
  typeTextCustom: {
    color: "#7E22CE"
  },
  typeTextSystem: {
    color: "#1D4ED8"
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10
  },
  infoCol: {
    paddingVertical: 10
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B"
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  descriptionValue: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#334155",
    marginTop: 4,
    lineHeight: 19
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9"
  },
  usersSection: {
    marginBottom: 20
  },
  usersHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  usersSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  userPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10
  },
  userAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center"
  },
  userAvatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#15803D"
  },
  userTextWrap: {
    flex: 1
  },
  userNameText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A"
  },
  userRoleSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1
  },
  noUsersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "center"
  },
  noUsersText: {
    fontSize: 13,
    color: "#64748B"
  },
  actionsStack: {
    gap: 10
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1
  },
  actionBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#F8FAFC"
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A"
  },
  actionBtnTextDisabled: {
    color: "#94A3B8"
  },
  retireText: {
    color: "#DC2626"
  }
});
