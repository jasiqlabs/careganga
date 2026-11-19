import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator
} from "react-native";
import { PermissionManagerTabs } from "./permission-manager-tabs";
import { PermissionMatrixSkeleton } from "./roles-permissions-skeletons";
import { useBottomNavPadding } from "../../dashboard/authenticated-bottom-navigation";
import {
  IconChevronDown,
  IconChevronUp,
  IconCollapseAll,
  IconCheck,
  IconCheckboxChecked,
  IconCheckboxUnchecked
} from "./roles-permissions-icons";
import type {
  Role,
  Group,
  PermissionManagerTab,
  MatrixActionColumn
} from "./roles-permissions-types";

export interface ScreenPermissionMatrixProps {
  roles: Role[];
  selectedRole: Role | null;
  groups: Group[];
  busy: boolean;
  canEdit: boolean;
  onSelectRole: (role: Role) => void;
  onSelectTab: (tab: PermissionManagerTab) => void;
  onToggleAction: (role: Role, actionKey: string, grant: boolean) => void;
  onQuickActionApply?: (role: Role, actionType: string) => void;
}

export function ScreenPermissionMatrix({
  roles,
  selectedRole,
  groups,
  busy,
  canEdit,
  onSelectRole,
  onSelectTab,
  onToggleAction,
  onQuickActionApply
}: ScreenPermissionMatrixProps) {
  const bottomPadding = useBottomNavPadding(28);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Expand the first group by default
    const initial: Record<string, boolean> = {};
    if (groups[0]) initial[groups[0].group] = true;
    return initial;
  });
  const [selectedQuickAction, setSelectedQuickAction] = useState<string>("grant_view");
  const [quickActionDropdownOpen, setQuickActionDropdownOpen] = useState(false);

  // Fallback to first role if none explicitly selected
  const activeRole = selectedRole || roles[0] || null;

  // Compute total and granted capabilities for the active role
  const { totalActions, grantedActions } = useMemo(() => {
    const allActions = groups.flatMap(g => g.actions);
    const total = allActions.length;
    const granted = allActions.filter(a => activeRole?.actionKeys.includes(a.key)).length;
    return { totalActions: total, grantedActions: granted };
  }, [groups, activeRole]);

  // Toggle all groups expand/collapse
  const allExpanded = useMemo(() => {
    return groups.length > 0 && groups.every(g => expandedGroups[g.group]);
  }, [groups, expandedGroups]);

  const handleToggleCollapseAll = () => {
    const nextState = !allExpanded;
    const updated: Record<string, boolean> = {};
    groups.forEach(g => {
      updated[g.group] = nextState;
    });
    setExpandedGroups(updated);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Standard column actions from wireframe
  const actionColumns: MatrixActionColumn[] = ["view", "add", "edit", "delete", "approve", "export"];

  // Quick action options
  const quickActions = [
    { key: "grant_view", label: "Grant Read-Only View" },
    { key: "grant_all", label: "Grant All In Module" },
    { key: "revoke_all", label: "Revoke All Actions" }
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title & Subtitle */}
      <View style={styles.headerSection}>
        <Text accessibilityRole="header" style={styles.title}>
          Permission Manager
        </Text>
        <Text style={styles.subtitle}>Manage role permissions</Text>
      </View>

      {/* Tabs: Matrix | Module | Set */}
      <PermissionManagerTabs activeTab="matrix" onSelectTab={onSelectTab} />

      {/* Select Role Section */}
      <View style={styles.selectRoleSection}>
        <Text style={styles.fieldLabel}>Select Role</Text>
        <Pressable
          accessibilityRole="combobox"
          accessibilityLabel={`Select role: currently ${activeRole?.name ?? "None"}`}
          onPress={() => setRoleDropdownOpen(prev => !prev)}
          style={styles.roleDropdownBtn}
        >
          <View style={styles.roleDropdownTextWrap}>
            <Text style={styles.roleDropdownName} numberOfLines={1}>
              {activeRole?.name ?? "Select Role"}
            </Text>
            {activeRole && (
              <View style={styles.roleStatusDotRow}>
                <View style={[styles.statusDot, { backgroundColor: activeRole.active ? "#16A34A" : "#DC2626" }]} />
                <Text style={styles.roleStatusText}>
                  {activeRole.active ? "Active" : "Retired"}
                </Text>
              </View>
            )}
          </View>
          {roleDropdownOpen ? (
            <IconChevronUp size={18} color="#64748B" />
          ) : (
            <IconChevronDown size={18} color="#64748B" />
          )}
        </Pressable>

        {/* Role Dropdown List */}
        {roleDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {roles.map(r => (
              <Pressable
                key={r.roleRef}
                accessibilityRole="button"
                accessibilityLabel={r.name}
                onPress={() => {
                  onSelectRole(r);
                  setRoleDropdownOpen(false);
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

      {/* Quick Action Row */}
      <View style={styles.quickActionSection}>
        <Text style={styles.fieldLabel}>Quick Action</Text>
        <View style={styles.quickActionRow}>
          {/* Action Selector */}
          <Pressable
            accessibilityRole="combobox"
            accessibilityLabel="Select quick action"
            onPress={() => setQuickActionDropdownOpen(prev => !prev)}
            style={styles.quickActionSelectBtn}
          >
            <Text style={styles.quickActionSelectText} numberOfLines={1}>
              {quickActions.find(q => q.key === selectedQuickAction)?.label ?? "Select Action"}
            </Text>
            <IconChevronDown size={16} color="#64748B" />
          </Pressable>

          {/* Apply Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply quick action"
            disabled={!canEdit || activeRole?.protected}
            onPress={() => {
              if (activeRole && onQuickActionApply) {
                onQuickActionApply(activeRole, selectedQuickAction);
              }
            }}
            style={[
              styles.applyBtn,
              (!canEdit || activeRole?.protected) && styles.applyBtnDisabled
            ]}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </View>

        {/* Quick Action Dropdown Menu */}
        {quickActionDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {quickActions.map(q => (
              <Pressable
                key={q.key}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedQuickAction(q.key);
                  setQuickActionDropdownOpen(false);
                }}
                style={styles.dropdownMenuItem}
              >
                <Text style={styles.dropdownMenuText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Matrix Controls Row: Collapse All + Granted Badge */}
      <View style={styles.matrixControlsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={allExpanded ? "Collapse all modules" : "Expand all modules"}
          onPress={handleToggleCollapseAll}
          style={styles.collapseAllBtn}
        >
          <IconCollapseAll size={16} color="#0F172A" />
          <Text style={styles.collapseAllText}>
            {allExpanded ? "Collapse All" : "Expand All"}
          </Text>
        </Pressable>

        <View style={styles.grantedBadge}>
          <IconCheck size={13} color="#15803D" />
          <Text style={styles.grantedBadgeText}>
            {grantedActions} of {totalActions} granted
          </Text>
        </View>
      </View>

      {/* System Role Protection Notice */}
      {activeRole?.protected && (
        <View style={styles.protectedNoticeBox}>
          <Text style={styles.protectedNoticeText}>
            Protected Foundation System Role: authorities are fixed and managed by the platform.
          </Text>
        </View>
      )}

      {/* Loading Skeleton */}
      {busy && groups.length === 0 && (
        <PermissionMatrixSkeleton />
      )}
      {busy && groups.length > 0 && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1D4ED8" />
        </View>
      )}

      {/* Expandable Module Groups */}
      {!busy && groups.map(group => {
        const isExpanded = !!expandedGroups[group.group];
        const groupActions = group.actions;
        const groupGranted = groupActions.filter(a => activeRole?.actionKeys.includes(a.key)).length;

        return (
          <View key={group.group} style={styles.moduleCard}>
            {/* Module Accordion Header */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${group.group}: ${groupGranted} of ${groupActions.length} granted. Tap to ${isExpanded ? "collapse" : "expand"}`}
              onPress={() => toggleGroup(group.group)}
              style={styles.moduleHeader}
            >
              <View style={styles.moduleHeaderLeft}>
                {isExpanded ? (
                  <IconChevronDown size={17} color="#0F172A" />
                ) : (
                  <IconChevronUp size={17} color="#0F172A" />
                )}
                <Text style={styles.moduleTitle}>
                  {group.group}
                </Text>
                <Text style={styles.moduleCount}>
                  ({groupGranted}/{groupActions.length})
                </Text>
              </View>
            </Pressable>

            {/* Expanded Content: Matrix Table */}
            {isExpanded && (
              <View style={styles.moduleTableWrap}>
                {/* Horizontal Action Headers */}
                <View style={styles.actionColumnsHeaderRow}>
                  <Text style={styles.capabilityNameColHeader}>Capability</Text>
                  {actionColumns.map(col => (
                    <Text key={col} style={styles.actionColHeader}>
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                    </Text>
                  ))}
                </View>

                {/* Individual Capability Rows */}
                {groupActions.map(action => {
                  const isGranted = activeRole?.actionKeys.includes(action.key) ?? false;
                  const isAssignable = action.assignable || action.key === "roles.manage";
                  const canModify = canEdit && !activeRole?.protected && isAssignable;

                  // Determine which column matches this action
                  const keyLower = action.key.toLowerCase();
                  const isView = keyLower.includes("view") || keyLower.includes("read");
                  const isAdd = keyLower.includes("create") || keyLower.includes("add") || keyLower.includes("new");
                  const isEdit = keyLower.includes("manage") || keyLower.includes("edit") || keyLower.includes("update");
                  const isDelete = keyLower.includes("delete") || keyLower.includes("remove") || keyLower.includes("retire");
                  const isApprove = keyLower.includes("approve") || keyLower.includes("review");
                  const isExport = keyLower.includes("export") || keyLower.includes("report");

                  return (
                    <View key={action.key} style={styles.capabilityRow}>
                      <Text style={styles.capabilityLabel} numberOfLines={2}>
                        {action.businessLabel}
                      </Text>

                      {/* 6 Action Checkbox Columns */}
                      <View style={styles.checkboxColsRow}>
                        {actionColumns.map(col => {
                          // Check if this action corresponds to this column or default check
                          let applies = false;
                          if (col === "view" && isView) applies = true;
                          else if (col === "add" && isAdd) applies = true;
                          else if (col === "edit" && isEdit) applies = true;
                          else if (col === "delete" && isDelete) applies = true;
                          else if (col === "approve" && isApprove) applies = true;
                          else if (col === "export" && isExport) applies = true;
                          else if (!isView && !isAdd && !isEdit && !isDelete && !isApprove && !isExport && col === "view") {
                            applies = true;
                          }

                          const checked = applies && isGranted;

                          return (
                            <Pressable
                              key={col}
                              accessibilityRole="checkbox"
                              accessibilityLabel={`${action.businessLabel} ${col}`}
                              accessibilityState={{ checked }}
                              disabled={!canModify || !applies}
                              onPress={() => {
                                if (activeRole && canModify) {
                                  onToggleAction(activeRole, action.key, !isGranted);
                                }
                              }}
                              style={styles.checkboxCell}
                              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                            >
                              {applies ? (
                                checked ? (
                                  <IconCheckboxChecked size={18} />
                                ) : (
                                  <IconCheckboxUnchecked size={18} />
                                )
                              ) : (
                                <View style={styles.emptyCheckboxPlaceholder} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
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
  selectRoleSection: {
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6
  },
  roleDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  roleDropdownTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  roleDropdownName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  roleStatusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  roleStatusText: {
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
  quickActionSection: {
    marginBottom: 14
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  quickActionSelectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  quickActionSelectText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A"
  },
  applyBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  applyBtnDisabled: {
    backgroundColor: "#94A3B8"
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  matrixControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  collapseAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6
  },
  collapseAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0F172A"
  },
  grantedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5
  },
  grantedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D"
  },
  protectedNoticeBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  protectedNoticeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF"
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: "center"
  },
  moduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  moduleHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  moduleCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  moduleTableWrap: {
    paddingVertical: 8
  },
  actionColumnsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  capabilityNameColHeader: {
    flex: 1.2,
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase"
  },
  actionColHeader: {
    width: 32,
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center"
  },
  capabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  capabilityLabel: {
    flex: 1.2,
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
    paddingRight: 6
  },
  checkboxColsRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  checkboxCell: {
    width: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyCheckboxPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#F1F5F9"
  }
});
