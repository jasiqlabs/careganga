import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  IconUsersTotal,
  IconSystemShield,
  IconCustomLayers,
  IconActionsKey,
  IconChevronRight
} from "./roles-permissions-icons";
import type { AuditEvent } from "./roles-permissions-types";

export interface AuditRecordItemProps {
  event: AuditEvent;
  onPress?: () => void;
}

export function AuditRecordItem({ event, onPress }: AuditRecordItemProps) {
  const isSignIn = event.actionLabel.toLowerCase().includes("sign") || event.actionLabel.toLowerCase().includes("login");
  const isSecurity = event.actionLabel.toLowerCase().includes("security") || event.actionLabel.toLowerCase().includes("policy");
  const isRole = event.actionLabel.toLowerCase().includes("role");

  // Determine icon & theme color
  let icon = <IconActionsKey size={18} color="#059669" />;
  let iconBg = "#ECFDF5";

  if (isSignIn) {
    icon = <IconUsersTotal size={18} color="#16A34A" />;
    iconBg = "#F0FDF4";
  } else if (isSecurity) {
    icon = <IconSystemShield size={18} color="#2563EB" />;
    iconBg = "#EFF6FF";
  } else if (isRole) {
    icon = <IconCustomLayers size={18} color="#9333EA" />;
    iconBg = "#FAF5FF";
  }

  // Format timestamp safely
  let formattedTime = event.occurredAt;
  try {
    const d = new Date(event.occurredAt);
    if (!isNaN(d.getTime())) {
      formattedTime = d.toLocaleString();
    }
  } catch {
    // Keep raw string
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Audit event: ${event.actionLabel} by ${event.actorDisplay}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardContainer,
        pressed && styles.cardPressed
      ]}
    >
      {/* Event Icon */}
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        {icon}
      </View>

      {/* Event Details */}
      <View style={styles.contentWrap}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {event.actionLabel}
        </Text>
        <Text style={styles.actorName} numberOfLines={1}>
          {event.actorDisplay}
        </Text>
        <Text style={styles.timestampText} numberOfLines={1}>
          {formattedTime}
        </Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {event.outcome ? event.outcome.charAt(0).toUpperCase() + event.outcome.slice(1).toLowerCase() : "Confirmed"}
          </Text>
        </View>
      </View>

      {/* Chevron Navigation */}
      <IconChevronRight size={18} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  cardPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1"
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  contentWrap: {
    flex: 1,
    justifyContent: "center"
  },
  actionTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2
  },
  actorName: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 2
  },
  timestampText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginBottom: 5
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#15803D"
  }
});
