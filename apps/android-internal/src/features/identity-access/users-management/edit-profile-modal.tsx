import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator
} from "react-native";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  IconClose,
  IconEdit,
  IconShield,
  IconCheck
} from "./users-management-icons";
import {
  accountStatusLabel,
  formatEmployeeId,
  type RoleOption,
  type UserNotice
} from "./users-management-types";

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  roles: RoleOption[];
  rolesLoading: boolean;
  roleRef: string;
  onRoleRefChange: (val: string) => void;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  onStatusChange: (status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => void;
  busy: boolean;
  uncertain: boolean;
  notice: UserNotice | null;
  onSave: () => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  account,
  roles,
  rolesLoading,
  roleRef,
  onRoleRefChange,
  status,
  onStatusChange,
  busy,
  uncertain,
  notice,
  onSave
}: EditProfileModalProps) {
  if (!isOpen || !account) return null;

  const empId = formatEmployeeId(account);
  const isStatusActive = status === "ACTIVE";
  const isProtected = Boolean(account.roleProtected);

  const handleToggleStatus = () => {
    if (busy || isProtected) return;
    onStatusChange(isStatusActive ? "SUSPENDED" : "ACTIVE");
  };

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
                <IconEdit size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.title}>Edit Account Profile</Text>
                <Text style={styles.subtitle}>
                  Update role assignment and account status
                </Text>
              </View>
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

          {/* Form Content */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputBox, styles.inputBoxReadOnly]}>
                <Text style={styles.readOnlyText}>{account.displayName}</Text>
              </View>
              <Text style={styles.fieldHint}>
                Primary name is verified via Foundation registration
              </Text>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Work Email Address</Text>
              <View style={[styles.inputBox, styles.inputBoxReadOnly]}>
                <Text style={styles.readOnlyText}>
                  {account.email || "No email registered"}
                </Text>
              </View>
            </View>

            {/* Mobile */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <View style={[styles.inputBox, styles.inputBoxReadOnly]}>
                <Text style={styles.readOnlyText}>
                  {account.phone || "No mobile registered"}
                </Text>
              </View>
            </View>

            {/* Role Selection */}
            {!isProtected ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ASSIGNED ROLE</Text>
                {rolesLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text style={styles.fieldHint}>Loading eligible roles…</Text>
                  </View>
                ) : (
                  <View style={styles.rolesList}>
                    {roles.map(r => {
                      const isSelected = roleRef === r.value;
                      return (
                        <Pressable
                          key={r.value}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                          onPress={() => onRoleRefChange(r.value)}
                          disabled={busy}
                          style={[
                            styles.roleOptionCard,
                            isSelected && styles.roleOptionCardSelected
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleOptionText,
                              isSelected && styles.roleOptionTextSelected
                            ]}
                          >
                            {r.label}
                          </Text>
                          {isSelected && <IconCheck size={16} color="#1D4ED8" />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Text style={styles.fieldHint}>
                  Only server-permitted roles in realm are eligible
                </Text>
              </View>
            ) : (
              <View style={styles.protectedBanner}>
                <IconShield size={16} color="#D97706" />
                <Text style={styles.protectedBannerText}>
                  Protected Administrator account role cannot be reassigned.
                </Text>
              </View>
            )}

            {/* Account Status Toggle Switch */}
            {!isProtected && (
              <View style={styles.toggleCard}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleTitle}>Login Account Status</Text>
                  <Text style={styles.toggleDesc}>
                    {isStatusActive
                      ? "Account is Active and permitted to log in"
                      : "Account is Suspended and cannot log in"}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isStatusActive }}
                  onPress={handleToggleStatus}
                  disabled={busy}
                  style={[
                    styles.switchTrack,
                    isStatusActive ? styles.switchTrackActive : styles.switchTrackInactive
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      isStatusActive ? styles.switchThumbActive : styles.switchThumbInactive
                    ]}
                  />
                </Pressable>
              </View>
            )}

            {/* Notice / Uncertain Alert */}
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
              onPress={onSave}
              disabled={busy || uncertain}
              style={[styles.saveBtn, (busy || uncertain) && styles.saveBtnDisabled]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
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
    maxHeight: "90%",
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
    gap: 12,
    flex: 1
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#0F172A"
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  closeBtn: {
    padding: 6
  },
  body: {
    padding: 18,
    gap: 14
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  requiredStar: {
    color: "#E11D48"
  },
  inputBox: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  inputBoxReadOnly: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0"
  },
  readOnlyText: {
    fontSize: 13,
    color: "#475569"
  },
  fieldHint: {
    fontSize: 11,
    color: "#64748B"
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8
  },
  rolesList: {
    gap: 6
  },
  roleOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF"
  },
  roleOptionCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF"
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#334155"
  },
  roleOptionTextSelected: {
    fontWeight: "700",
    color: "#1D4ED8"
  },
  protectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  protectedBannerText: {
    fontSize: 12,
    color: "#B45309",
    flex: 1
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 12
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  toggleDesc: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: "center"
  },
  switchTrackActive: {
    backgroundColor: "#16A34A"
  },
  switchTrackInactive: {
    backgroundColor: "#CBD5E1"
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF"
  },
  switchThumbActive: {
    alignSelf: "flex-end"
  },
  switchThumbInactive: {
    alignSelf: "flex-start"
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
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  saveBtnDisabled: {
    opacity: 0.5
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
