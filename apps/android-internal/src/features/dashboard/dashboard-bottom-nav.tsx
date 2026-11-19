import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomNavTabItem } from "./dashboard-modules";
import {
  IconHome,
  IconUser,
  IconUsers,
  IconApprovals,
  IconCoins,
  IconBuilding,
  IconReceipt,
  IconBell,
  IconHelpCircle,
  IconShield,
  IconMoreHorizontal
} from "./dashboard-icons";

export interface DashboardBottomNavProps {
  tabs: BottomNavTabItem[];
  activeTabId: string;
}

export function DashboardBottomNav({ tabs, activeTabId }: DashboardBottomNavProps) {
  const insets = useSafeAreaInsets();

  const renderTabIcon = (iconName: BottomNavTabItem["iconName"], isActive: boolean) => {
    const color = isActive ? "#1D4ED8" : "#64748B";

    switch (iconName) {
      case "home":
        return <IconHome size={21} color={color} />;
      case "user":
        return <IconUser size={21} color={color} />;
      case "users":
        return <IconUsers size={21} color={color} />;
      case "approvals":
        return <IconApprovals size={21} color={color} />;
      case "coins":
        return <IconCoins size={21} color={color} />;
      case "building":
        return <IconBuilding size={21} color={color} />;
      case "receipt":
        return <IconReceipt size={21} color={color} />;
      case "notifications":
        return <IconBell size={21} color={color} />;
      case "support":
        return <IconHelpCircle size={21} color={color} />;
      case "shield":
        return <IconShield size={21} color={color} />;
      case "more":
      default:
        return <IconMoreHorizontal size={21} color={color} />;
    }
  };

  return (
    <View
      style={[
        styles.navContainer,
        {
          paddingBottom: Math.max(10, insets.bottom + 4)
        }
      ]}
      accessibilityRole="tablist"
    >
      <View style={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              onPress={tab.onPress}
              style={styles.tabButton}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <View style={[styles.tabContentWrap, isActive && styles.tabContentActive]}>
                {renderTabIcon(tab.iconName, isActive)}
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  tabContentWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 3
  },
  tabContentActive: {
    backgroundColor: "#EFF6FF"
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: -0.1
  },
  tabLabelActive: {
    color: "#1D4ED8",
    fontWeight: "800"
  }
});
