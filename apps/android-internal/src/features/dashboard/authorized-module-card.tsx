import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { DashboardModuleItem } from "./dashboard-modules";
import {
  IconUser,
  IconHome,
  IconUsers,
  IconShield,
  IconLock,
  IconApprovals,
  IconFileText,
  IconCoins,
  IconReceipt,
  IconBuilding,
  IconHelpCircle,
  IconBarChart3,
  IconWallet,
  IconSliders,
  IconKey,
  IconMail,
  IconSend,
  IconBell,
  IconChevronRight
} from "./dashboard-icons";

export interface AuthorizedModuleCardProps {
  module: DashboardModuleItem;
}

export function AuthorizedModuleCard({ module }: AuthorizedModuleCardProps) {
  const renderIcon = () => {
    switch (module.iconName) {
      case "home":
        return <IconHome size={20} color={module.iconColor} />;
      case "user":
        return <IconUser size={20} color={module.iconColor} />;
      case "users":
        return <IconUsers size={20} color={module.iconColor} />;
      case "shield":
        return <IconShield size={20} color={module.iconColor} />;
      case "lock":
        return <IconLock size={20} color={module.iconColor} />;
      case "approvals":
        return <IconApprovals size={20} color={module.iconColor} />;
      case "documents":
      case "file-text":
        return <IconFileText size={20} color={module.iconColor} />;
      case "coins":
        return <IconCoins size={20} color={module.iconColor} />;
      case "receipt":
        return <IconReceipt size={20} color={module.iconColor} />;
      case "building":
        return <IconBuilding size={20} color={module.iconColor} />;
      case "support":
        return <IconHelpCircle size={20} color={module.iconColor} />;
      case "bar-chart":
        return <IconBarChart3 size={20} color={module.iconColor} />;
      case "wallet":
        return <IconWallet size={20} color={module.iconColor} />;
      case "sliders":
        return <IconSliders size={20} color={module.iconColor} />;
      case "key":
        return <IconKey size={20} color={module.iconColor} />;
      case "mail":
        return <IconMail size={20} color={module.iconColor} />;
      case "send":
        return <IconSend size={20} color={module.iconColor} />;
      case "notifications":
        return <IconBell size={20} color={module.iconColor} />;
      default:
        return <IconFileText size={20} color={module.iconColor} />;
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${module.title}`}
      onPress={module.onOpen}
      style={({ pressed }) => [
        styles.cardContainer,
        pressed && styles.cardPressed
      ]}
    >
      {/* Icon Container with Pastel Theme Background */}
      <View style={[styles.iconWrap, { backgroundColor: module.iconBg }]}>
        {renderIcon()}
      </View>

      {/* Title & Description */}
      <View style={styles.contentWrap}>
        {!!module.category && (
          <Text style={styles.categoryLabel}>{module.category}</Text>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {module.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {module.description}
        </Text>
      </View>

      {/* Navigation Indicator */}
      <View style={styles.chevronWrap}>
        <IconChevronRight size={20} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1
  },
  cardPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    transform: [{ scale: 0.995 }]
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  contentWrap: {
    flex: 1,
    justifyContent: "center"
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 2
  },
  title: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.1
  },
  description: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16
  },
  chevronWrap: {
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center"
  }
});
