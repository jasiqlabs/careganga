import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import {
  IconUsers,
  IconUserCheck,
  IconHourglass,
  IconUserX,
  IconTrendingUp
} from "./users-management-icons";

export interface UsersSummaryStatsProps {
  summary?: {
    total: number;
    active: number;
    suspended: number;
    deactivated: number;
    assigned: number;
  };
}

export function UsersSummaryStats({ summary }: UsersSummaryStatsProps) {
  const cards = [
    {
      id: "total",
      label: "Total Employees",
      value: summary?.total ?? 0,
      icon: (color: string) => <IconUsers size={20} color={color} />,
      bg: "#EFF6FF",
      iconColor: "#2563EB",
      badgeText: "Directory"
    },
    {
      id: "active",
      label: "Active",
      value: summary?.active ?? 0,
      icon: (color: string) => <IconUserCheck size={20} color={color} />,
      bg: "#ECFDF5",
      iconColor: "#059669",
      badgeText: "Operational"
    },
    {
      id: "suspended",
      label: "On Hold",
      value: summary?.suspended ?? 0,
      icon: (color: string) => <IconHourglass size={20} color={color} />,
      bg: "#F5F3FF",
      iconColor: "#7C3AED",
      badgeText: "Suspended"
    },
    {
      id: "inactive",
      label: "Inactive",
      value: summary?.deactivated ?? 0,
      icon: (color: string) => <IconUserX size={20} color={color} />,
      bg: "#FFF1F2",
      iconColor: "#E11D48",
      badgeText: "Deactivated"
    },
    {
      id: "assigned",
      label: "Assigned Roles",
      value: summary?.assigned ?? 0,
      icon: (color: string) => <IconTrendingUp size={20} color={color} />,
      bg: "#ECFEFF",
      iconColor: "#0891B2",
      badgeText: "Active Roles"
    }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      accessibilityLabel="Employee Summary Statistics"
    >
      {cards.map(card => (
        <View key={card.id} style={styles.card}>
          <View style={styles.cardTopRow}>
            <View style={[styles.iconWrap, { backgroundColor: card.bg }]}>
              {card.icon(card.iconColor)}
            </View>
            <View style={[styles.badgeWrap, { backgroundColor: card.bg }]}>
              <Text style={[styles.badgeText, { color: card.iconColor }]}>
                {card.badgeText}
              </Text>
            </View>
          </View>
          <Text style={styles.label}>{card.label}</Text>
          <Text style={styles.value}>{card.value.toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10
  },
  card: {
    width: 148,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    gap: 4
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeWrap: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.1
  },
  label: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B"
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5
  }
});
