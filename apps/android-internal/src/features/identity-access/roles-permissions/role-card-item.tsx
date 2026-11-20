import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { roleColor } from "../../../../../../packages/design-tokens/src/index";
import { IconChevronRight } from "./roles-permissions-icons";
import type { Role } from "./roles-permissions-types";

export interface RoleCardItemProps {
  role: Role;
  onPress: () => void;
}

export function RoleCardItem({ role, onPress }: RoleCardItemProps) {
  // Extract 2 initials for the avatar
  const initials = role.name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "RO";

  const isSystem = role.protected;
  const isRetired = !role.active;
  const avatarBg = roleColor(role.colorKey);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View details for ${role.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardContainer,
        pressed && styles.cardPressed
      ]}
    >
      {/* Role Avatar */}
      <View style={[styles.avatarBox, { backgroundColor: avatarBg }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Role Information */}
      <View style={styles.infoWrap}>
        <Text style={styles.roleName} numberOfLines={1}>
          {role.name}
        </Text>
        <Text style={styles.metaLine} numberOfLines={1}>
          {isRetired ? "Retired" : "Active"} · {role.assignedCount} assigned
        </Text>
      </View>

      {/* Role Badges & Navigation */}
      <View style={styles.actionsWrap}>
        <View style={[styles.typeBadge, isSystem ? styles.systemBadge : styles.customBadge]}>
          <Text style={isSystem ? styles.systemBadgeText : styles.customBadgeText}>
            {isSystem ? "System" : "Custom"}
          </Text>
        </View>
        <IconChevronRight size={18} color="#94A3B8" />
      </View>
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
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  infoWrap: {
    flex: 1,
    justifyContent: "center"
  },
  roleName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 3
  },
  metaLine: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B"
  },
  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  },
  customBadge: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF"
  },
  customBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7E22CE"
  },
  systemBadge: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE"
  },
  systemBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D4ED8"
  }
});
