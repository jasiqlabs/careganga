import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal
} from "react-native";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  IconMail,
  IconPhone,
  IconCalendar,
  IconEye,
  IconEdit,
  IconMoreVertical,
  IconShield,
  IconClock,
  IconUserCheck,
  IconTrash2,
  IconClose,
  IconVerifiedBadge
} from "./users-management-icons";
import {
  formatEmployeeId,
  formatDisplayDate,
  accountStatusLabel,
  getInitials,
  getAvatarColor
} from "./users-management-types";

export interface UserCardItemProps {
  account: CG01AccountView;
  canAssign: boolean;
  canStatus: boolean;
  onViewDetails: (account: CG01AccountView) => void;
  onEditAccount: (account: CG01AccountView) => void;
  onAssignRole: (account: CG01AccountView) => void;
  onStatusChange: (account: CG01AccountView, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => void;
  onDeleteAccount: (account: CG01AccountView) => void;
}

export function UserCardItem({
  account,
  canAssign,
  canStatus,
  onViewDetails,
  onEditAccount,
  onAssignRole,
  onStatusChange,
  onDeleteAccount
}: UserCardItemProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const empId = formatEmployeeId(account);
  const avatarTheme = getAvatarColor(account.displayName);
  const isProtected = Boolean(account.roleProtected);

  const statusStyleKey = account.status.toLowerCase();

  return (
    <View style={styles.cardContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${account.displayName}`}
        onPress={() => onViewDetails(account)}
        style={styles.cardMainPressable}
      >
        {/* Header: Avatar, Name, IDs */}
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.avatarWrap,
              { backgroundColor: avatarTheme.bg }
            ]}
          >
            <Text style={[styles.avatarText, { color: avatarTheme.text }]}>
              {getInitials(account.displayName)}
            </Text>
          </View>

          <View style={styles.cardTitlesWrap}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {account.displayName}
              </Text>
              <IconVerifiedBadge size={14} color="#2563EB" />
            </View>

            <View style={styles.idRow}>
              <Text style={styles.accountRefText} numberOfLines={1}>
                {account.accountRef}
              </Text>
              {empId !== "Not assigned" && (
                <Text style={styles.empIdText}>ID: {empId}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Body: Contact items */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <IconMail size={13} color="#64748B" />
            <Text style={styles.infoText} numberOfLines={1}>
              {account.email || account.phone || "Mobile login"}
            </Text>
          </View>

          {!!account.phone && (
            <View style={styles.infoRow}>
              <IconPhone size={13} color="#64748B" />
              <Text style={styles.infoText}>{account.phone}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <IconCalendar size={13} color="#64748B" />
            <Text style={styles.infoText}>
              Joined {formatDisplayDate(account.assignedAt)}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Footer: Role & Status Badges, Quick Actions */}
      <View style={styles.cardFooter}>
        <View style={styles.badgesWrap}>
          <View
            style={[
              styles.roleChip,
              isProtected ? styles.roleChipProtected : styles.roleChipPrimary
            ]}
          >
            <Text
              style={[
                styles.roleChipText,
                isProtected ? styles.roleChipTextProtected : styles.roleChipTextPrimary
              ]}
              numberOfLines={1}
            >
              {account.roleName || "Staff"}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              statusStyleKey === "active"
                ? styles.statusPillActive
                : statusStyleKey === "suspended"
                ? styles.statusPillSuspended
                : styles.statusPillDeactivated
            ]}
          >
            <View
              style={[
                styles.statusDot,
                statusStyleKey === "active"
                  ? styles.statusDotActive
                  : statusStyleKey === "suspended"
                  ? styles.statusDotSuspended
                  : styles.statusDotDeactivated
              ]}
            />
            <Text
              style={[
                styles.statusText,
                statusStyleKey === "active"
                  ? styles.statusTextActive
                  : statusStyleKey === "suspended"
                  ? styles.statusTextSuspended
                  : styles.statusTextDeactivated
              ]}
            >
              {accountStatusLabel(account.status)}
            </Text>
          </View>
        </View>

        <View style={styles.actionsWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${account.displayName}`}
            onPress={() => onViewDetails(account)}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <IconEye size={15} color="#2563EB" />
          </Pressable>

          {!isProtected && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${account.displayName}`}
              onPress={() => onEditAccount(account)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <IconEdit size={15} color="#475569" />
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${account.displayName}`}
            onPress={() => setActionMenuOpen(true)}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <IconMoreVertical size={15} color="#475569" />
          </Pressable>
        </View>
      </View>

      {/* Action Menu Modal Sheet */}
      <Modal
        visible={actionMenuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setActionMenuOpen(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setActionMenuOpen(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {account.displayName}
              </Text>
              <Pressable
                onPress={() => setActionMenuOpen(false)}
                style={styles.menuCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IconClose size={16} color="#64748B" />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setActionMenuOpen(false);
                onViewDetails(account);
              }}
              style={styles.menuItem}
            >
              <IconEye size={16} color="#2563EB" />
              <Text style={styles.menuItemText}>View Full Details</Text>
            </Pressable>

            {!isProtected && canAssign && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setActionMenuOpen(false);
                  onAssignRole(account);
                }}
                style={styles.menuItem}
              >
                <IconShield size={16} color="#475569" />
                <Text style={styles.menuItemText}>Assign Role</Text>
              </Pressable>
            )}

            {!isProtected && canStatus && (
              <>
                {account.status === "ACTIVE" ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setActionMenuOpen(false);
                      onStatusChange(account, "SUSPENDED");
                    }}
                    style={styles.menuItem}
                  >
                    <IconClock size={16} color="#D97706" />
                    <Text style={[styles.menuItemText, { color: "#D97706" }]}>
                      Suspend Account
                    </Text>
                  </Pressable>
                ) : account.status === "SUSPENDED" ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setActionMenuOpen(false);
                      onStatusChange(account, "ACTIVE");
                    }}
                    style={styles.menuItem}
                  >
                    <IconUserCheck size={16} color="#16A34A" />
                    <Text style={[styles.menuItemText, { color: "#16A34A" }]}>
                      Reactivate Account
                    </Text>
                  </Pressable>
                ) : null}

                {account.status !== "DEACTIVATED" && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setActionMenuOpen(false);
                      onDeleteAccount(account);
                    }}
                    style={[styles.menuItem, styles.menuItemDanger]}
                  >
                    <IconTrash2 size={16} color="#DC2626" />
                    <Text style={[styles.menuItemText, { color: "#DC2626" }]}>
                      Deactivate User
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: "hidden"
  },
  cardMainPressable: {
    padding: 14,
    gap: 10
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2
  },
  cardTitlesWrap: {
    flex: 1,
    gap: 2
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  displayName: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
    flexShrink: 1
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  accountRefText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    fontFamily: "monospace"
  },
  empIdText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8"
  },
  cardBody: {
    gap: 5,
    paddingTop: 2
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  infoText: {
    fontSize: 12.5,
    color: "#475569",
    flex: 1
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  badgesWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  roleChipPrimary: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  roleChipProtected: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A"
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: "700"
  },
  roleChipTextPrimary: {
    color: "#1D4ED8"
  },
  roleChipTextProtected: {
    color: "#B45309"
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
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
  statusText: {
    fontSize: 11,
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
  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  menuContainer: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  menuTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1
  },
  menuCloseBtn: {
    padding: 4
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  menuItemDanger: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  menuItemText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#334155"
  }
});
