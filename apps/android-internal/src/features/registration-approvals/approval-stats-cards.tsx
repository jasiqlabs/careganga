import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import type { CG03CaseView } from "@careganga/api-contracts";
import {
  IconLayers,
  IconHourglass,
  IconRefreshCw,
  IconCheckCircle,
  IconXCircle
} from "./registration-approvals-icons";

export interface ApprovalStatsCardsProps {
  cases: CG03CaseView[];
  activeFilter?: string;
  onSelectFilter?: (statusKey: string) => void;
}

export function ApprovalStatsCards({
  cases,
  activeFilter,
  onSelectFilter
}: ApprovalStatsCardsProps) {
  const total = cases.length;
  const awaiting = cases.filter(c => c.status === "SUBMITTED").length;
  const inReview = cases.filter(c => c.status === "IN_REVIEW").length;
  const approved = cases.filter(
    c =>
      c.status === "FINAL_APPROVED" ||
      c.status === "OWNER_COMPLETED" ||
      c.status === "PENDING_OWNER"
  ).length;
  const rejected = cases.filter(
    c => c.status === "REJECTED" || c.status === "OWNER_BLOCKED"
  ).length;

  const stats = [
    {
      key: "ALL",
      label: "Total",
      count: total,
      icon: <IconLayers size={16} color="#4F46E5" />,
      accentColor: "#4F46E5",
      iconBg: "#EEF2FF"
    },
    {
      key: "SUBMITTED",
      label: "Awaiting",
      count: awaiting,
      icon: <IconHourglass size={16} color="#D97706" />,
      accentColor: "#D97706",
      iconBg: "#FEF3C7"
    },
    {
      key: "IN_REVIEW",
      label: "In Review",
      count: inReview,
      icon: <IconRefreshCw size={16} color="#0284C7" />,
      accentColor: "#0284C7",
      iconBg: "#E0F2FE"
    },
    {
      key: "FINAL_APPROVED",
      label: "Approved",
      count: approved,
      icon: <IconCheckCircle size={16} color="#16A34A" />,
      accentColor: "#16A34A",
      iconBg: "#DCFCE7"
    },
    {
      key: "REJECTED",
      label: "Rejected",
      count: rejected,
      icon: <IconXCircle size={16} color="#DC2626" />,
      accentColor: "#DC2626",
      iconBg: "#FEE2E2"
    }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {stats.map(item => {
        const isSelected = activeFilter === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} applications: ${item.count}`}
            onPress={() => onSelectFilter?.(item.key)}
            style={({ pressed }) => [
              styles.card,
              isSelected && {
                borderColor: item.accentColor,
                backgroundColor: item.iconBg
              },
              pressed && styles.pressed
            ]}
          >
            {/* Icon + Label Row */}
            <View style={styles.topRow}>
              <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                {item.icon}
              </View>
              <Text style={styles.label}>{item.label}</Text>
            </View>

            {/* Bold Count */}
            <Text
              style={[
                styles.count,
                { color: isSelected ? item.accentColor : "#0F172A" }
              ]}
            >
              {item.count}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4
  },
  card: {
    minWidth: 84,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B"
  },
  count: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }]
  }
});
