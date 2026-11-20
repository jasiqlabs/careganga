import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator
} from "react-native";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  IconClose,
  IconShield,
  IconCheck
} from "./users-management-icons";
import type { RoleOption, UserNotice } from "./users-management-types";

export interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  roles: RoleOption[];
  rolesLoading: boolean;
  selectedRoleRef: string;
  onSelectRoleRef: (roleRef: string) => void;
  busy: boolean;
  uncertain: boolean;
  notice: UserNotice | null;
  onConfirm: () => void;
}

export function AssignRoleModal({
  isOpen,
  onClose,
  account,
  roles,
  rolesLoading,
  selectedRoleRef,
  onSelectRoleRef,
  busy,
  uncertain,
  notice,
  onConfirm
}: AssignRoleModalProps) {
  if (!isOpen || !account) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconBox}>
                <IconShield size={18} color="#2563EB" />
              </View>
              <Text style={styles.title}>Assign Role</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconClose size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Target Account Summary */}
            <View style={styles.userCard}>
              <Text style={styles.userCardLabel}>TARGET USER</Text>
              <Text style={styles.userName}>{account.displayName}</Text>
              <Text style={styles.userSub}>
                {account.email || account.phone || "Mobile login"}
              </Text>
              <View style={styles.currentRoleRow}>
                <Text style={styles.currentRoleLabel}>Current Role:</Text>
                <View style={styles.currentRoleBadge}>
                  <Text style={styles.currentRoleText}>{account.roleName || "Staff"}</Text>
                </View>
              </View>
            </View>

            {/* Role Options */}
            <Text style={styles.sectionLabel}>Select New Role</Text>
            {rolesLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Loading permitted roles…</Text>
              </View>
            ) : (
              <View style={styles.rolesGrid}>
                {roles.map(r => {
                  const isSelected = selectedRoleRef === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => onSelectRoleRef(r.value)}
                      disabled={busy}
                      style={[
                        styles.roleChip,
                        isSelected && styles.roleChipSelected
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleChipLabel,
                          isSelected && styles.roleChipLabelSelected
                        ]}
                      >
                        {r.label}
                      </Text>
                      {isSelected && <IconCheck size={14} color="#1D4ED8" />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Notice / Uncertain */}
            {notice && (
              <View
                style={[
                  styles.noticeBox,
                  notice.kind === "success"
                    ? styles.noticeBoxSuccess
                    : styles.noticeBoxError
                ]}
              >
                <Text
                  style={[
                    styles.noticeText,
                    notice.kind === "success"
                      ? styles.noticeTextSuccess
                      : styles.noticeTextError
                  ]}
                >
                  {notice.text}
                </Text>
              </View>
            )}

            {uncertain && (
              <View style={styles.noticeBoxUncertain}>
                <Text style={styles.noticeTextUncertain}>
                  Request status is uncertain. Refresh the directory before retrying.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={busy}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              disabled={!selectedRoleRef || selectedRoleRef === account.roleRef || busy || uncertain}
              style={[
                styles.confirmBtn,
                (!selectedRoleRef || selectedRoleRef === account.roleRef || busy || uncertain) &&
                  styles.confirmBtnDisabled
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Role</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end"
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  closeBtn: {
    padding: 6
  },
  body: {
    padding: 18,
    gap: 12
  },
  userCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4
  },
  userCardLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  userSub: {
    fontSize: 12.5,
    color: "#475569"
  },
  currentRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6
  },
  currentRoleLabel: {
    fontSize: 12,
    color: "#64748B"
  },
  currentRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  currentRoleText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 6
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10
  },
  loadingText: {
    fontSize: 12.5,
    color: "#64748B"
  },
  rolesGrid: {
    gap: 8
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF"
  },
  roleChipSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF"
  },
  roleChipLabel: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#334155"
  },
  roleChipLabelSelected: {
    fontWeight: "700",
    color: "#1D4ED8"
  },
  noticeBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  noticeBoxSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  noticeBoxError: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3"
  },
  noticeBoxUncertain: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  noticeText: {
    fontSize: 12
  },
  noticeTextSuccess: {
    color: "#059669"
  },
  noticeTextError: {
    color: "#E11D48"
  },
  noticeTextUncertain: {
    fontSize: 12,
    color: "#B45309"
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569"
  },
  confirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  confirmBtnDisabled: {
    opacity: 0.5
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
