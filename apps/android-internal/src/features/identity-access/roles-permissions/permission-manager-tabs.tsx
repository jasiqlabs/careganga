import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { PermissionManagerTab } from "./roles-permissions-types";

export interface PermissionManagerTabsProps {
  activeTab: PermissionManagerTab;
  onSelectTab: (tab: PermissionManagerTab) => void;
}

export function PermissionManagerTabs({ activeTab, onSelectTab }: PermissionManagerTabsProps) {
  const tabs: { key: PermissionManagerTab; label: string }[] = [
    { key: "matrix", label: "Matrix" },
    { key: "module", label: "Module" },
    { key: "set", label: "Set" }
  ];

  return (
    <View style={styles.tabsContainer} accessibilityRole="tablist">
      {tabs.map(t => {
        const isActive = activeTab === t.key;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={`${t.label} view`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectTab(t.key)}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 3,
    marginBottom: 14
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#64748B"
  },
  tabTextActive: {
    color: "#1D4ED8",
    fontWeight: "800"
  }
});
