import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator
} from "react-native";
import { RoleCardItem } from "./role-card-item";
import { RolesListSkeleton } from "./roles-permissions-skeletons";
import { useBottomNavPadding } from "../../dashboard/authenticated-bottom-navigation";
import { IconSearch, IconFilter, IconClose } from "./roles-permissions-icons";
import type { Role, RoleStatus, RoleKind } from "./roles-permissions-types";

export interface ScreenRolesListProps {
  roles: Role[];
  total: number;
  offset: number;
  busy: boolean;
  status: RoleStatus;
  roleKind: RoleKind;
  search: string;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: RoleStatus) => void;
  onRoleKindChange: (kind: RoleKind) => void;
  onSelectRole: (role: Role) => void;
  onPageChange: (newOffset: number) => void;
}

export function ScreenRolesList({
  roles,
  total,
  offset,
  busy,
  status,
  roleKind,
  search,
  onSearchChange,
  onStatusChange,
  onRoleKindChange,
  onSelectRole,
  onPageChange
}: ScreenRolesListProps) {
  const bottomPadding = useBottomNavPadding(28);
  const [showSearchInput, setShowSearchInput] = useState(search.length > 0);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Status labels for dropdown pill
  const statusLabels: Record<RoleStatus, string> = {
    all: "All Roles",
    active: "Active Roles",
    retired: "Retired Roles"
  };

  // Next status in rotation or dropdown
  const cycleStatus = () => {
    if (status === "all") onStatusChange("active");
    else if (status === "active") onStatusChange("retired");
    else onStatusChange("all");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Roles
            </Text>
            <Text style={styles.counterText}>({total} roles)</Text>
          </View>

          {/* Search Toggle Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search roles"
            onPress={() => setShowSearchInput(prev => !prev)}
            style={[styles.searchIconButton, showSearchInput && styles.searchIconButtonActive]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSearch size={18} color={showSearchInput ? "#1D4ED8" : "#0F172A"} />
          </Pressable>
        </View>

        {/* Collapsible Search Input */}
        {showSearchInput && (
          <View style={styles.searchBarWrap}>
            <IconSearch size={17} color="#64748B" />
            <TextInput
              accessibilityLabel="Search role name"
              placeholder="Search by role name…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={onSearchChange}
              style={styles.searchInput}
              autoCapitalize="none"
              autoFocus
            />
            {search.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => onSearchChange("")}
                style={styles.clearSearchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IconClose size={16} color="#64748B" />
              </Pressable>
            )}
          </View>
        )}

        {/* Filters Controls Row */}
        <View style={styles.filtersRow}>
          {/* Status Dropdown Pill */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filter by status: currently ${statusLabels[status]}`}
            onPress={cycleStatus}
            style={styles.statusPillBtn}
          >
            <Text style={styles.statusPillText}>{statusLabels[status]}</Text>
            <View style={styles.dropdownCaret}>
              <View style={styles.caretShape} />
            </View>
          </Pressable>

          {/* Filter Options Toggle Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter by role type"
            onPress={() => setShowFilterSheet(prev => !prev)}
            style={[styles.filterIconButton, (roleKind !== "all" || showFilterSheet) && styles.filterIconButtonActive]}
          >
            <IconFilter size={18} color={roleKind !== "all" ? "#1D4ED8" : "#0F172A"} />
          </Pressable>
        </View>

        {/* Secondary Filter Chips (Role Type) */}
        {showFilterSheet && (
          <View style={styles.chipRow}>
            {(["all", "custom", "system"] as const).map(k => {
              const isSelected = roleKind === k;
              const label = k === "all" ? "All Types" : k === "custom" ? "Custom Roles" : "System Roles";
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onRoleKindChange(k)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Loading Skeleton */}
        {busy && roles.length === 0 && (
          <RolesListSkeleton />
        )}
        {busy && roles.length > 0 && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#1D4ED8" />
          </View>
        )}

        {/* Empty State */}
        {!busy && roles.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matching roles</Text>
            <Text style={styles.emptySubtitle}>
              {search ? `No roles matched "${search}".` : "No roles are currently available in this category."}
            </Text>
          </View>
        )}

        {/* Roles List */}
        {!busy && roles.map(role => (
          <RoleCardItem
            key={role.roleRef}
            role={role}
            onPress={() => onSelectRole(role)}
          />
        ))}

        {/* Pagination Controls */}
        {!busy && total > 30 && (
          <View style={styles.paginationRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              disabled={offset === 0}
              onPress={() => onPageChange(Math.max(0, offset - 30))}
              style={[styles.pageButton, offset === 0 && styles.pageButtonDisabled]}
            >
              <Text style={[styles.pageButtonText, offset === 0 && styles.pageButtonTextDisabled]}>
                Previous
              </Text>
            </Pressable>

            <Text style={styles.pageInfoText}>
              {offset + 1}–{Math.min(offset + 30, total)} of {total}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next page"
              disabled={offset + 30 >= total}
              onPress={() => onPageChange(offset + 30)}
              style={[styles.pageButton, offset + 30 >= total && styles.pageButtonDisabled]}
            >
              <Text style={[styles.pageButtonText, offset + 30 >= total && styles.pageButtonTextDisabled]}>
                Next
              </Text>
            </Pressable>
          </View>
        )}
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
    paddingBottom: 110 // Avoid overlap with bottom nav
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  counterText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  searchIconButtonActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0
  },
  clearSearchBtn: {
    padding: 4
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  statusPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  dropdownCaret: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2
  },
  caretShape: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#64748B"
  },
  filterIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  filterIconButtonActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  chipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8"
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: "center"
  },
  emptyWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center"
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 8
  },
  pageButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  pageButtonDisabled: {
    opacity: 0.5,
    backgroundColor: "#F1F5F9"
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A"
  },
  pageButtonTextDisabled: {
    color: "#94A3B8"
  },
  pageInfoText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#64748B"
  }
});
