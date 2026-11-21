import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Modal
} from "react-native";
import {
  IconSearch,
  IconClose,
  IconSliders,
  IconCheck,
  IconRotateCcw
} from "./registration-approvals-icons";
import type { ApprovalFilters } from "./registration-approvals-types";

export interface ApprovalSearchFilterProps {
  filters: ApprovalFilters;
  onFiltersChange: (newFilters: ApprovalFilters) => void;
  availableRoles: string[];
}

export function ApprovalSearchFilter({
  filters,
  onFiltersChange,
  availableRoles
}: ApprovalSearchFilterProps) {
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const activeFilterCount =
    (filters.status !== "ALL" ? 1 : 0) + (filters.role !== "ALL" ? 1 : 0);

  const statusOptions = [
    { key: "ALL", label: "All Statuses" },
    { key: "SUBMITTED", label: "Submitted for review" },
    { key: "IN_REVIEW", label: "In Review" },
    { key: "RETURNED", label: "Returned for correction" },
    { key: "FINAL_APPROVED", label: "Access change confirmed" },
    { key: "REJECTED", label: "Rejected" }
  ];

  const handleReset = () => {
    onFiltersChange({
      search: "",
      status: "ALL",
      role: "ALL"
    });
    setFilterModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Search Input Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchFieldWrap}>
          <IconSearch size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search application..."
            placeholderTextColor="#94A3B8"
            value={filters.search}
            onChangeText={text => onFiltersChange({ ...filters, search: text })}
            accessibilityLabel="Search application by ID, account or role"
            autoCapitalize="none"
          />
            {filters.search.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => onFiltersChange({ ...filters, search: "" })}
                style={styles.clearBtn}
              >
                <IconClose size={16} color="#64748B" />
              </Pressable>
            )}
        </View>

        {/* Filter Trigger Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ""}`}
          onPress={() => setFilterModalVisible(true)}
          style={({ pressed }) => [
            styles.filterTrigger,
            activeFilterCount > 0 && styles.filterTriggerActive,
            pressed && styles.pressed
          ]}
        >
          <IconSliders
            size={18}
            color={activeFilterCount > 0 ? "#1E53DC" : "#475569"}
          />
          {activeFilterCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Filter Bottom Sheet / Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFilterModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTitleRow}>
                <IconSliders size={20} color="#1E53DC" />
                <Text style={styles.sheetTitle}>Filter Applications</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filter panel"
                onPress={() => setFilterModalVisible(false)}
                style={styles.sheetCloseBtn}
              >
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Status Section */}
            <Text style={styles.sectionHeading}>Filter by Status</Text>
            <View style={styles.optionsWrap}>
              {statusOptions.map(opt => {
                const isSelected = filters.status === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onFiltersChange({ ...filters, status: opt.key })}
                    style={[
                      styles.optionChip,
                      isSelected && styles.optionChipSelected
                    ]}
                  >
                    {isSelected && <IconCheck size={14} color="#1E53DC" />}
                    <Text
                      style={[
                        styles.optionChipText,
                        isSelected && styles.optionChipTextSelected
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Role Section (if roles exist) */}
            {availableRoles.length > 0 && (
              <>
                <Text style={styles.sectionHeading}>Filter by Proposed Role</Text>
                <View style={styles.optionsWrap}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: filters.role === "ALL" }}
                    onPress={() => onFiltersChange({ ...filters, role: "ALL" })}
                    style={[
                      styles.optionChip,
                      filters.role === "ALL" && styles.optionChipSelected
                    ]}
                  >
                    {filters.role === "ALL" && <IconCheck size={14} color="#1E53DC" />}
                    <Text
                      style={[
                        styles.optionChipText,
                        filters.role === "ALL" && styles.optionChipTextSelected
                      ]}
                    >
                      All Roles
                    </Text>
                  </Pressable>
                  {availableRoles.map(role => {
                    const isSelected = filters.role === role;
                    return (
                      <Pressable
                        key={role}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => onFiltersChange({ ...filters, role })}
                        style={[
                          styles.optionChip,
                          isSelected && styles.optionChipSelected
                        ]}
                      >
                        {isSelected && <IconCheck size={14} color="#1E53DC" />}
                        <Text
                          style={[
                            styles.optionChipText,
                            isSelected && styles.optionChipTextSelected
                          ]}
                        >
                          {role}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Actions */}
            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handleReset}
                style={styles.resetBtn}
              >
                <IconRotateCcw size={16} color="#64748B" />
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilterModalVisible(false)}
                style={styles.applyBtn}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchFieldWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    height: 44,
    paddingVertical: 0
  },
  clearBtn: {
    padding: 4
  },
  filterTrigger: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  filterTriggerActive: {
    borderColor: "#1E53DC",
    backgroundColor: "#EFF6FF"
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#1E53DC",
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: "80%"
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  sheetHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A"
  },
  sheetCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginTop: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  optionChipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#1E53DC"
  },
  optionChipText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500"
  },
  optionChipTextSelected: {
    color: "#1E53DC",
    fontWeight: "700"
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    gap: 12
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569"
  },
  applyBtn: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  pressed: {
    opacity: 0.75
  }
});
