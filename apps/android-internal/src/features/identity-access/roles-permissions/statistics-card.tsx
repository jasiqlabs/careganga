import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  IconUsersTotal,
  IconActionsKey,
  IconActiveCheck,
  IconInactivePause,
  IconCustomLayers,
  IconSystemShield
} from "./roles-permissions-icons";
import type { RoleSummary } from "./roles-permissions-types";

export interface StatisticsGridProps {
  summary: RoleSummary | null;
}

export function StatisticsGrid({ summary }: StatisticsGridProps) {
  const cards: {
    label: string;
    value: number | undefined;
    icon: React.ReactNode;
    iconBg: string;
  }[] = [
    {
      label: "Total Roles",
      value: summary?.totalRoles,
      icon: <IconUsersTotal size={18} color="#2563EB" />,
      iconBg: "#EFF6FF"
    },
    {
      label: "Permission Actions",
      value: summary?.implementedActions,
      icon: <IconActionsKey size={18} color="#059669" />,
      iconBg: "#ECFDF5"
    },
    {
      label: "Active Roles",
      value: summary?.activeRoles,
      icon: <IconActiveCheck size={18} color="#16A34A" />,
      iconBg: "#F0FDF4"
    },
    {
      label: "Inactive Roles",
      value: summary?.inactiveRoles,
      icon: <IconInactivePause size={18} color="#DC2626" />,
      iconBg: "#FEF2F2"
    },
    {
      label: "Custom Roles",
      value: summary?.customRoles,
      icon: <IconCustomLayers size={18} color="#9333EA" />,
      iconBg: "#FAF5FF"
    },
    {
      label: "System Roles",
      value: summary?.systemRoles,
      icon: <IconSystemShield size={18} color="#0F172A" />,
      iconBg: "#F1F5F9"
    }
  ];

  return (
    <View style={styles.gridContainer} accessibilityLabel="Roles and permissions metrics">
      {cards.map(card => (
        <View key={card.label} style={styles.card}>
          <View style={[styles.iconContainer, { backgroundColor: card.iconBg }]}>
            {card.icon}
          </View>
          <Text style={styles.metricLabel}>{card.label}</Text>
          <Text style={styles.metricValue}>
            {card.value !== undefined ? String(card.value) : "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  card: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 13,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: -0.1
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4
  }
});
