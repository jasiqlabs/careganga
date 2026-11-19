import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from "react-native";
import { useBottomNavPadding } from "../../dashboard/authenticated-bottom-navigation";
import { PermissionManagerTabs } from "./permission-manager-tabs";
import {
  IconInfo,
  IconChevronDown,
  IconChevronUp,
  IconRadioChecked,
  IconRadioUnchecked
} from "./roles-permissions-icons";
import type {
  Role,
  Group,
  PermissionManagerTab
} from "./roles-permissions-types";

export interface ScreenSetPermissionProps {
  roles: Role[];
  selectedRole: Role | null;
  groups: Group[];
  canEdit: boolean;
  onSelectRole: (role: Role) => void;
  onSelectTab: (tab: PermissionManagerTab) => void;
  onToggleAction: (role: Role, actionKey: string, grant: boolean) => void;
}

export function ScreenSetPermission({
  roles,
  selectedRole,
  groups,
  canEdit,
  onSelectRole,
  onSelectTab,
  onToggleAction
}: ScreenSetPermissionProps) {
  const bottomPadding = useBottomNavPadding(28);
  const activeRole = selectedRole || roles[0] || null;

  // Dropdown states
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string>(groups[0]?.group ?? "");
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);

  const selectedGroup = groups.find(g => g.group === selectedGroupName) || groups[0];

  const [selectedActionKey, setSelectedActionKey] = useState<string>(
    selectedGroup?.actions[0]?.key ?? ""
  );
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false);

  // Permission State radio (Grant vs Revoke)
  const [permissionState, setPermissionState] = useState<"grant" | "revoke">("grant");
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const selectedAction = selectedGroup?.actions.find(a => a.key === selectedActionKey) || selectedGroup?.actions[0];

  const handleApply = () => {
    if (!activeRole) {
      setFeedbackMessage({ text: "Please select a role.", error: true });
      return;
    }
    if (activeRole.protected) {
      setFeedbackMessage({ text: "Protected system roles cannot be modified.", error: true });
      return;
    }
    if (!canEdit) {
      setFeedbackMessage({ text: "You do not have permission to modify roles.", error: true });
      return;
    }
    if (!selectedAction) {
      setFeedbackMessage({ text: "Please select a capability.", error: true });
      return;
    }

    const grant = permissionState === "grant";
    onToggleAction(activeRole, selectedAction.key, grant);
    setFeedbackMessage({
      text: `Successfully ${grant ? "granted" : "revoked"} "${selectedAction.businessLabel}" for ${activeRole.name}.`,
      error: false
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text accessibilityRole="header" style={styles.title}>
          Permission Manager
        </Text>
        <Text style={styles.subtitle}>Manage role permissions</Text>
      </View>

      {/* Tabs: Matrix | Module | Set */}
      <PermissionManagerTabs activeTab="set" onSelectTab={onSelectTab} />

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <IconInfo size={18} color="#1D4ED8" />
        <Text style={styles.infoBannerText}>
          Grant or revoke a specific permission action for a role and module.
        </Text>
      </View>

      {/* Feedback banner */}
      {feedbackMessage && (
        <View style={[styles.feedbackBox, feedbackMessage.error ? styles.feedbackBoxError : styles.feedbackBoxSuccess]}>
          <Text style={[styles.feedbackText, feedbackMessage.error ? styles.feedbackTextError : styles.feedbackTextSuccess]}>
            {feedbackMessage.text}
          </Text>
        </View>
      )}

      {/* Form Field 1: Select Role */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Select Role</Text>
        <Pressable
          accessibilityRole="combobox"
          accessibilityLabel={`Select role: currently ${activeRole?.name ?? "None"}`}
          onPress={() => setRoleMenuOpen(prev => !prev)}
          style={styles.dropdownBtn}
        >
          <View style={styles.dropdownValueRow}>
            <Text style={styles.dropdownValueText} numberOfLines={1}>
              {activeRole?.name ?? "Select Role"}
            </Text>
            {activeRole && (
              <View style={styles.statusDotRow}>
                <View style={[styles.statusDot, { backgroundColor: activeRole.active ? "#16A34A" : "#DC2626" }]} />
                <Text style={styles.statusDotText}>
                  {activeRole.active ? "Active" : "Retired"}
                </Text>
              </View>
            )}
          </View>
          {roleMenuOpen ? (
            <IconChevronUp size={18} color="#64748B" />
          ) : (
            <IconChevronDown size={18} color="#64748B" />
          )}
        </Pressable>

        {roleMenuOpen && (
          <View style={styles.dropdownMenu}>
            {roles.map(r => (
              <Pressable
                key={r.roleRef}
                accessibilityRole="button"
                onPress={() => {
                  onSelectRole(r);
                  setRoleMenuOpen(false);
                  setFeedbackMessage(null);
                }}
                style={[
                  styles.dropdownMenuItem,
                  activeRole?.roleRef === r.roleRef && styles.dropdownMenuItemActive
                ]}
              >
                <Text
                  style={[
                    styles.dropdownMenuText,
                    activeRole?.roleRef === r.roleRef && styles.dropdownMenuTextActive
                  ]}
                >
                  {r.name}
                </Text>
                <Text style={styles.dropdownMenuMeta}>
                  {r.protected ? "System" : "Custom"} · {r.actionKeys.length} actions
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Form Field 2: Select Module */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Select Module</Text>
        <Pressable
          accessibilityRole="combobox"
          accessibilityLabel={`Select module: currently ${selectedGroup?.group ?? "None"}`}
          onPress={() => setModuleMenuOpen(prev => !prev)}
          style={styles.dropdownBtn}
        >
          <Text style={styles.dropdownValueText} numberOfLines={1}>
            {selectedGroup?.group ?? "Select Module"}
          </Text>
          {moduleMenuOpen ? (
            <IconChevronUp size={18} color="#64748B" />
          ) : (
            <IconChevronDown size={18} color="#64748B" />
          )}
        </Pressable>

        {moduleMenuOpen && (
          <View style={styles.dropdownMenu}>
            {groups.map(g => (
              <Pressable
                key={g.group}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedGroupName(g.group);
                  setSelectedActionKey(g.actions[0]?.key ?? "");
                  setModuleMenuOpen(false);
                  setFeedbackMessage(null);
                }}
                style={[
                  styles.dropdownMenuItem,
                  selectedGroupName === g.group && styles.dropdownMenuItemActive
                ]}
              >
                <Text
                  style={[
                    styles.dropdownMenuText,
                    selectedGroupName === g.group && styles.dropdownMenuTextActive
                  ]}
                >
                  {g.group}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Form Field 3: Select Permission */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Select Permission</Text>
        <Pressable
          accessibilityRole="combobox"
          accessibilityLabel={`Select permission: currently ${selectedAction?.businessLabel ?? "None"}`}
          onPress={() => setPermissionMenuOpen(prev => !prev)}
          style={styles.dropdownBtn}
        >
          <Text style={styles.dropdownValueText} numberOfLines={1}>
            {selectedAction?.businessLabel ?? "Select Permission"}
          </Text>
          {permissionMenuOpen ? (
            <IconChevronUp size={18} color="#64748B" />
          ) : (
            <IconChevronDown size={18} color="#64748B" />
          )}
        </Pressable>

        {permissionMenuOpen && (
          <View style={styles.dropdownMenu}>
            {selectedGroup?.actions.map(a => (
              <Pressable
                key={a.key}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedActionKey(a.key);
                  setPermissionMenuOpen(false);
                  setFeedbackMessage(null);
                }}
                style={[
                  styles.dropdownMenuItem,
                  selectedActionKey === a.key && styles.dropdownMenuItemActive
                ]}
              >
                <Text
                  style={[
                    styles.dropdownMenuText,
                    selectedActionKey === a.key && styles.dropdownMenuTextActive
                  ]}
                >
                  {a.businessLabel}
                </Text>
                <Text style={styles.dropdownMenuMeta}>{a.key}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Form Field 4: Select Action (Read-only / action type representation) */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Select Action</Text>
        <View style={styles.dropdownBtn}>
          <Text style={styles.dropdownValueText}>
            {selectedAction ? selectedAction.key.split(".").pop()?.toUpperCase() ?? "VIEW" : "VIEW"}
          </Text>
        </View>
      </View>

      {/* Form Field 5: Permission State Radios */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Permission State</Text>
        <View style={styles.radiosGroup}>
          {/* Radio 1: Grant Permission */}
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Grant Permission"
            accessibilityState={{ checked: permissionState === "grant" }}
            onPress={() => setPermissionState("grant")}
            style={styles.radioOption}
          >
            {permissionState === "grant" ? (
              <IconRadioChecked size={20} />
            ) : (
              <IconRadioUnchecked size={20} />
            )}
            <Text style={styles.radioLabel}>Grant Permission</Text>
          </Pressable>

          {/* Radio 2: Revoke Permission */}
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Revoke Permission"
            accessibilityState={{ checked: permissionState === "revoke" }}
            onPress={() => setPermissionState("revoke")}
            style={styles.radioOption}
          >
            {permissionState === "revoke" ? (
              <IconRadioChecked size={20} />
            ) : (
              <IconRadioUnchecked size={20} />
            )}
            <Text style={styles.radioLabel}>Revoke Permission</Text>
          </Pressable>
        </View>
      </View>

      {/* Apply Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply permission changes"
        disabled={!canEdit || activeRole?.protected}
        onPress={handleApply}
        style={[
          styles.applyButton,
          (!canEdit || activeRole?.protected) && styles.applyButtonDisabled
        ]}
      >
        <Text style={styles.applyButtonText}>Apply</Text>
      </Pressable>
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
    paddingTop: 16,
    paddingBottom: 110
  },
  headerSection: {
    marginBottom: 12
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 14
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "500",
    color: "#1E40AF",
    lineHeight: 17
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14
  },
  feedbackBoxSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0"
  },
  feedbackBoxError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA"
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "600"
  },
  feedbackTextSuccess: {
    color: "#15803D"
  },
  feedbackTextError: {
    color: "#B91C1C"
  },
  fieldSection: {
    marginBottom: 14
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  dropdownValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  dropdownValueText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A"
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  statusDotText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden"
  },
  dropdownMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  dropdownMenuItemActive: {
    backgroundColor: "#EFF6FF"
  },
  dropdownMenuText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0F172A"
  },
  dropdownMenuTextActive: {
    color: "#1D4ED8",
    fontWeight: "700"
  },
  dropdownMenuMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  radiosGroup: {
    gap: 10,
    marginTop: 4
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A"
  },
  applyButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2
  },
  applyButtonDisabled: {
    backgroundColor: "#94A3B8"
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
