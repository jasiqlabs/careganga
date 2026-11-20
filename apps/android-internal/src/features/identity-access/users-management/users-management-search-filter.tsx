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
  IconSlidersHorizontal,
  IconCheck
} from "./users-management-icons";

export interface UsersSearchFilterProps {
  search: string;
  onSearchChange: (q: string) => void;
  onSubmitSearch: () => void;
  filter: string;
  onFilterChange: (status: string) => void;
  loading?: boolean;
}

export function UsersSearchFilter({
  search,
  onSearchChange,
  onSubmitSearch,
  filter,
  onFilterChange,
  loading = false
}: UsersSearchFilterProps) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState(filter);

  const filterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "ACTIVE", label: "Active Only" },
    { value: "SUSPENDED", label: "Suspended Only" },
    { value: "DEACTIVATED", label: "Deactivated Only" }
  ];

  const activeFilterCount = filter !== "all" ? 1 : 0;

  const handleOpenModal = () => {
    setPendingFilter(filter);
    setFilterModalOpen(true);
  };

  const handleApply = () => {
    onFilterChange(pendingFilter);
    setFilterModalOpen(false);
  };

  const handleClear = () => {
    setPendingFilter("all");
    onFilterChange("all");
    setFilterModalOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchIconWrap}>
          <IconSearch size={16} color="#64748B" />
        </View>

        <TextInput
          accessibilityLabel="Search staff by name, mobile or email"
          placeholder="Search by name, ID, email, mob…"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={onSearchChange}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />

        {search.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search input"
            onPress={() => {
              onSearchChange("");
              onSubmitSearch();
            }}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconClose size={14} color="#64748B" />
          </Pressable>
        )}
      </View>

      {/* Filter Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter accounts by status"
        onPress={handleOpenModal}
        style={[
          styles.filterBtn,
          activeFilterCount > 0 && styles.filterBtnActive
        ]}
      >
        <IconSlidersHorizontal
          size={16}
          color={activeFilterCount > 0 ? "#1D4ED8" : "#475569"}
        />
        {activeFilterCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>

      {/* Filter Modal Sheet */}
      <Modal
        visible={filterModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleWrap}>
                <IconSlidersHorizontal size={18} color="#0F172A" />
                <Text style={styles.sheetTitle}>Filter Accounts</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filter sheet"
                onPress={() => setFilterModalOpen(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconClose size={16} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.filterSectionTitle}>Account Status</Text>
            <View style={styles.filterOptionsList}>
              {filterOptions.map(opt => {
                const isSelected = pendingFilter === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => setPendingFilter(opt.value)}
                    style={[
                      styles.filterOptionItem,
                      isSelected && styles.filterOptionItemSelected
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterOptionLabel,
                        isSelected && styles.filterOptionLabelSelected
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <IconCheck size={16} color="#1D4ED8" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sheetActionsRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleClear}
                style={styles.clearFiltersBtn}
              >
                <Text style={styles.clearFiltersText}>Reset</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleApply}
                style={styles.applyFiltersBtn}
              >
                <Text style={styles.applyFiltersText}>Apply Filter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginVertical: 4
  },
  searchBarWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 46,
    paddingHorizontal: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  searchIconWrap: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#0F172A",
    paddingVertical: 0
  },
  clearBtn: {
    padding: 4
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  filterBtnActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  filterBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end"
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 14
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 4
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sheetTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  closeBtn: {
    padding: 6
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4
  },
  filterOptionsList: {
    gap: 8
  },
  filterOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC"
  },
  filterOptionItemSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF"
  },
  filterOptionLabel: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#334155"
  },
  filterOptionLabelSelected: {
    fontWeight: "700",
    color: "#1D4ED8"
  },
  sheetActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  clearFiltersBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569"
  },
  applyFiltersBtn: {
    flex: 2,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  applyFiltersText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
