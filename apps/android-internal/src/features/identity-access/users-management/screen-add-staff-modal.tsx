import React, { useState } from "react";
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
import {
  IconClose,
  IconPlus,
  IconShield,
  IconEye,
  IconCheck,
  IconSearch
} from "./users-management-icons";
import type { RoleOption, UserNotice } from "./users-management-types";

export interface ScreenAddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleOption[];
  rolesLoading: boolean;
  onSearchRoles: (q: string) => void;
  busy: boolean;
  uncertain: boolean;
  notice: UserNotice | null;
  onSubmit: (data: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    roleRef: string;
  }) => void;
}

export function ScreenAddStaffModal({
  isOpen,
  onClose,
  roles,
  rolesLoading,
  onSearchRoles,
  busy,
  uncertain,
  notice,
  onSubmit
}: ScreenAddStaffModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleRef, setRoleRef] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [formError, setFormError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    setFormError("");
    if (!name.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (phone.length !== 10) {
      setFormError("A valid 10-digit mobile number is required.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }
    if (!roleRef) {
      setFormError("Please select an eligible role.");
      return;
    }

    onSubmit({
      fullName: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase() || undefined,
      password,
      roleRef
    });
  };

  const handleRoleQueryChange = (q: string) => {
    setRoleQuery(q);
    onSearchRoles(q);
  };

  const canSubmit =
    Boolean(name.trim()) &&
    phone.length === 10 &&
    password.length >= 8 &&
    Boolean(roleRef) &&
    !busy &&
    !uncertain;

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
                <IconPlus size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.title}>Add New Staff Account</Text>
                <Text style={styles.subtitle}>
                  Create login credentials and assign foundation role
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

          {/* Form Body */}
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                accessibilityLabel="Full name"
                placeholder="Enter full name"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                maxLength={160}
                style={styles.textInput}
              />
            </View>

            {/* Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Mobile Number (Username) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                accessibilityLabel="Mobile number"
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={val => setPhone(val.replace(/[^0-9]/g, "").slice(0, 10))}
                style={styles.textInput}
              />
              <Text style={styles.fieldHint}>
                Used as the primary username for authentication
              </Text>
            </View>

            {/* Email Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Work Email (Optional)</Text>
              <TextInput
                accessibilityLabel="Work email"
                placeholder="staff@careganga.org"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={254}
                value={email}
                onChangeText={setEmail}
                style={styles.textInput}
              />
            </View>

            {/* Initial Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Initial Password <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  accessibilityLabel="Initial password"
                  placeholder="Min 8 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  maxLength={1024}
                  style={[styles.textInput, styles.passwordInput]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword(prev => !prev)}
                  style={styles.showPassBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.showPassText}>{showPassword ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldHint}>
                User will sign in immediately with this password
              </Text>
            </View>

            {/* Find Eligible Roles */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Assign Initial Role <Text style={styles.requiredStar}>*</Text>
              </Text>

              {/* Role Search */}
              <View style={styles.roleSearchBox}>
                <IconSearch size={14} color="#64748B" />
                <TextInput
                  placeholder="Find eligible roles…"
                  placeholderTextColor="#94A3B8"
                  value={roleQuery}
                  onChangeText={handleRoleQueryChange}
                  style={styles.roleSearchInput}
                />
              </View>

              {rolesLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.fieldHint}>Loading eligible roles…</Text>
                </View>
              ) : (
                <View style={styles.rolesGrid}>
                  {roles.map(r => {
                    const isSelected = roleRef === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        onPress={() => setRoleRef(r.value)}
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
                  {roles.length === 0 && !rolesLoading && (
                    <Text style={styles.emptyRolesText}>No eligible roles found.</Text>
                  )}
                </View>
              )}
            </View>

            {/* Form Error */}
            {!!formError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{formError}</Text>
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
                  The account creation result is uncertain. Refresh the directory before retrying.
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
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create Staff Account</Text>
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
    maxHeight: "92%",
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
  textInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: "#0F172A",
    backgroundColor: "#FFFFFF"
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative"
  },
  passwordInput: {
    flex: 1,
    paddingRight: 56
  },
  showPassBtn: {
    position: "absolute",
    right: 12,
    padding: 4
  },
  showPassText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB"
  },
  fieldHint: {
    fontSize: 11,
    color: "#64748B"
  },
  roleSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC"
  },
  roleSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#0F172A",
    paddingVertical: 0
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8
  },
  rolesGrid: {
    gap: 6,
    maxHeight: 180
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
  emptyRolesText: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 6
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3"
  },
  errorBannerText: {
    fontSize: 12,
    color: "#E11D48",
    fontWeight: "600"
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
  submitBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  submitBtnDisabled: {
    opacity: 0.5
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
