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
  IconCategoryRoles,
  IconCheckboxChecked,
  IconCheckboxUnchecked
} from "./roles-permissions-icons";
import type {
  Role,
  Group,
  PermissionManagerTab,
  MatrixActionColumn
} from "./roles-permissions-types";

export interface ScreenModulePermissionsProps {
  roles: Role[];
  selectedRole: Role | null;
  groups: Group[];
  canEdit: boolean;
  onSelectTab: (tab: PermissionManagerTab) => void;
  onToggleAction: (role: Role, actionKey: string, grant: boolean) => void;
}

export function ScreenModulePermissions({
  roles,
  selectedRole,
  groups,
  canEdit,
  onSelectTab,
  onToggleAction
}: ScreenModulePermissionsProps) {
  const bottomPadding = useBottomNavPadding(28);
  const activeRole = selectedRole || roles[0] || null;

  // Selected module index or group name
  const [selectedGroupName, setSelectedGroupName] = useState<string>(
    groups[0]?.group ?? "User & Access Management"
  );
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);

  const selectedGroup = groups.find(g => g.group === selectedGroupName) || groups[0];

  // Action column types
  const actionColumns: MatrixActionColumn[] = ["view", "add", "edit", "delete", "approve"];

  // Module stats
  const totalInModule = selectedGroup?.actions.length ?? 0;
  const grantedInModule = selectedGroup?.actions.filter(a => activeRole?.actionKeys.includes(a.key)).length ?? 0;
  const notGrantedInModule = totalInModule - grantedInModule;

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
      <PermissionManagerTabs activeTab="module" onSelectTab={onSelectTab} />

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <IconInfo size={18} color="#1D4ED8" />
        <Text style={styles.infoBannerText}>
          Manage permissions for a single module with detailed controls.
        </Text>
      </View>

      {/* Select Module Dropdown */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Select Module</Text>
        <Pressable
          accessibilityRole="combobox"
          accessibilityLabel={`Select module: currently ${selectedGroup?.group ?? "None"}`}
          onPress={() => setModuleDropdownOpen(prev => !prev)}
          style={styles.dropdownBtn}
        >
          <Text style={styles.dropdownBtnText} numberOfLines={1}>
            {selectedGroup?.group ?? "Select Module"}
          </Text>
          {moduleDropdownOpen ? (
            <IconChevronUp size={18} color="#64748B" />
          ) : (
            <IconChevronDown size={18} color="#64748B" />
          )}
        </Pressable>

        {/* Dropdown Menu */}
        {moduleDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {groups.map(g => (
              <Pressable
                key={g.group}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedGroupName(g.group);
                  setModuleDropdownOpen(false);
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
                <Text style={styles.dropdownMenuMeta}>
                  {g.actions.length} total capabilities
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Selected Module Summary Card */}
      {selectedGroup && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconContainer}>
            <IconCategoryRoles size={20} color="#16A34A" />
          </View>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {selectedGroup.group}
            </Text>
            <Text style={styles.summarySubtitle}>
              Total: {totalInModule} | Granted: {grantedInModule} | Not Granted: {notGrantedInModule}
            </Text>
          </View>
        </View>
      )}

      {/* Individual Permission Cards */}
      <View style={styles.cardsStack}>
        {selectedGroup?.actions.map(action => {
          const isGranted = activeRole?.actionKeys.includes(action.key) ?? false;
          const isAssignable = action.assignable || action.key === "roles.manage";
          const canModify = canEdit && !activeRole?.protected && isAssignable;

          const keyLower = action.key.toLowerCase();
          const isView = keyLower.includes("view") || keyLower.includes("read");
          const isAdd = keyLower.includes("create") || keyLower.includes("add") || keyLower.includes("new");
          const isEdit = keyLower.includes("manage") || keyLower.includes("edit") || keyLower.includes("update");
          const isDelete = keyLower.includes("delete") || keyLower.includes("remove") || keyLower.includes("retire");
          const isApprove = keyLower.includes("approve") || keyLower.includes("review");

          return (
            <View key={action.key} style={styles.permissionCard}>
              <Text style={styles.permissionCardTitle}>{action.businessLabel}</Text>

              {/* Action Checkbox Row */}
              <View style={styles.actionsRow}>
                {actionColumns.map(col => {
                  let applies = false;
                  if (col === "view" && isView) applies = true;
                  else if (col === "add" && isAdd) applies = true;
                  else if (col === "edit" && isEdit) applies = true;
                  else if (col === "delete" && isDelete) applies = true;
                  else if (col === "approve" && isApprove) applies = true;
                  else if (!isView && !isAdd && !isEdit && !isDelete && !isApprove && col === "view") applies = true;

                  const checked = applies && isGranted;

                  return (
                    <View key={col} style={styles.actionColItem}>
                      <Text style={styles.actionColLabel}>
                        {col.charAt(0).toUpperCase() + col.slice(1)}
                      </Text>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${action.businessLabel} ${col}`}
                        accessibilityState={{ checked }}
                        disabled={!canModify || !applies}
                        onPress={() => {
                          if (activeRole && canModify) {
                            onToggleAction(activeRole, action.key, !isGranted);
                          }
                        }}
                        style={styles.checkboxTouch}
                      >
                        {applies ? (
                          checked ? (
                            <IconCheckboxChecked size={19} />
                          ) : (
                            <IconCheckboxUnchecked size={19} />
                          )
                        ) : (
                          <View style={styles.emptyCheckboxPlaceholder} />
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
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
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  dropdownBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A"
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
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10
  },
  summaryIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center"
  },
  summaryTextWrap: {
    flex: 1
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803D",
    marginBottom: 2
  },
  summarySubtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#16A34A"
  },
  cardsStack: {
    gap: 10
  },
  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  permissionCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  actionColItem: {
    alignItems: "center",
    gap: 6
  },
  actionColLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B"
  },
  checkboxTouch: {
    padding: 2
  },
  emptyCheckboxPlaceholder: {
    width: 19,
    height: 19,
    borderRadius: 4,
    backgroundColor: "#F1F5F9"
  }
});
