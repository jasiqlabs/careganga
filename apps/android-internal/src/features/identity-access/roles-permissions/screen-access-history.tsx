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
import { AuthenticatedScreenHeader } from "../../dashboard/authenticated-screen-header";
import { useBottomNavPadding } from "../../dashboard/authenticated-bottom-navigation";
import { AuditRecordItem } from "./audit-record-item";
import { AccessHistorySkeleton } from "./roles-permissions-skeletons";
import {
  IconSearch,
  IconFilter,
  IconCalendar,
  IconClose,
  IconSystemShield
} from "./roles-permissions-icons";
import type { AuditEvent } from "./roles-permissions-types";

export interface ScreenAccessHistoryProps {
  history: AuditEvent[] | null;
  historyCursor: string | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onLoadMore: () => void;
}

export function ScreenAccessHistory({
  history,
  historyCursor,
  busy,
  error,
  onClose,
  onLoadMore
}: ScreenAccessHistoryProps) {
  const bottomPadding = useBottomNavPadding(28);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Filter audit records locally by search query and action
  const filteredEvents = (history ?? []).filter(e => {
    const matchesSearch =
      !searchQuery.trim() ||
      e.actionLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actorDisplay.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.targetDisplay.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction =
      filterAction === "all" ||
      (filterAction === "sign_in" && e.actionLabel.toLowerCase().includes("sign")) ||
      (filterAction === "security" && e.actionLabel.toLowerCase().includes("security")) ||
      (filterAction === "role" && e.actionLabel.toLowerCase().includes("role"));

    return matchesSearch && matchesAction;
  });

  return (
    <View style={styles.container}>
      {/* Workflow Navigation Header */}
      <AuthenticatedScreenHeader
        variant="workflow"
        title="Access History"
        onBack={onClose}
        onClose={onClose}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Foundation Access History Title Card */}
        <View style={styles.titleCard}>
          <View style={styles.titleIconBox}>
            <IconSystemShield size={22} color="#1D4ED8" />
          </View>
          <View style={styles.titleTextWrap}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Foundation Access History
            </Text>
            <Text style={styles.cardSubtitle}>
              Audit trail of role, permission and access related activities.
            </Text>
          </View>
        </View>

        {/* Search & Filter Controls Bar */}
        <View style={styles.controlsBar}>
          <View style={styles.searchWrap}>
            <IconSearch size={16} color="#64748B" />
            <TextInput
              accessibilityLabel="Search access history"
              placeholder="Search history…"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearchQuery("")}
                style={styles.clearBtn}
              >
                <IconClose size={15} color="#64748B" />
              </Pressable>
            )}
          </View>

          {/* Filter button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter history by event type"
            onPress={() => setShowFilters(prev => !prev)}
            style={[styles.iconActionBtn, (showFilters || filterAction !== "all") && styles.iconActionBtnActive]}
          >
            <IconFilter size={18} color={filterAction !== "all" ? "#1D4ED8" : "#0F172A"} />
          </Pressable>

          {/* Calendar button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter history by date"
            style={styles.iconActionBtn}
          >
            <IconCalendar size={18} color="#0F172A" />
          </Pressable>
        </View>

        {/* Filter Chips */}
        {showFilters && (
          <View style={styles.filterChipsRow}>
            {[
              { key: "all", label: "All Events" },
              { key: "sign_in", label: "Sign In" },
              { key: "security", label: "Security" },
              { key: "role", label: "Role Changes" }
            ].map(f => {
              const isSelected = filterAction === f.key;
              return (
                <Pressable
                  key={f.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setFilterAction(f.key)}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Error Notice */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        {/* Loading Indicator / Skeleton */}
        {busy && (!history || history.length === 0) && (
          <AccessHistorySkeleton />
        )}

        {/* Empty State */}
        {!busy && filteredEvents.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No access history records</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? `No events matched "${searchQuery}".` : "No audit records found."}
            </Text>
          </View>
        )}

        {/* Audit Record Items List */}
        {filteredEvents.map((event, index) => (
          <AuditRecordItem key={`${event.occurredAt}-${index}`} event={event} />
        ))}

        {/* Load More Button */}
        {historyCursor && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load more audit history"
            disabled={busy}
            onPress={onLoadMore}
            style={styles.loadMoreBtn}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <Text style={styles.loadMoreBtnText}>Load more history</Text>
            )}
          </Pressable>
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
    paddingBottom: 40
  },
  titleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  titleTextWrap: {
    flex: 1
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#0F172A",
    padding: 0
  },
  clearBtn: {
    padding: 2
  },
  iconActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center"
  },
  iconActionBtnActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  filterChipActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8"
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B91C1C"
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B"
  },
  emptyWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    marginVertical: 10
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
  loadMoreBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10
  },
  loadMoreBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D4ED8"
  }
});
