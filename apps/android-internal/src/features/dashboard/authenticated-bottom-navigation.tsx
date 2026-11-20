import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type RolesNavTab = "overview" | "roles" | "permissions" | "history";

export interface AuthenticatedBottomNavItem {
  id: string;
  label: string;
  icon: (color: string) => React.ReactNode;
}

export interface AuthenticatedBottomNavigationProps {
  activeTab: RolesNavTab | string;
  onSelectTab: (tab: any) => void;
  /** RBAC capability gates — never exposes unauthorized tabs */
  canViewRoles?: boolean;
  canAudit?: boolean;
  /** Optional custom tabs to render for different authorized modules (e.g. User Management) */
  customTabs?: AuthenticatedBottomNavItem[];
}

// -------------------------------------------------------------
// Pure Vector Icons for the 4 Bottom Navigation Tabs
// -------------------------------------------------------------

function IconNavOverview({ size = 22, color = "#64748B" }: { size?: number; color?: string }) {
  const box = Math.round(size * 0.38);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", gap: 3, marginBottom: 3 }}>
        <View style={{ width: box, height: box, borderRadius: 2.5, backgroundColor: color }} />
        <View style={{ width: box, height: box, borderRadius: 2.5, backgroundColor: color }} />
      </View>
      <View style={{ flexDirection: "row", gap: 3 }}>
        <View style={{ width: box, height: box, borderRadius: 2.5, backgroundColor: color }} />
        <View style={{ width: box, height: box, borderRadius: 2.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

function IconNavRoles({ size = 22, color = "#64748B" }: { size?: number; color?: string }) {
  const r = Math.round(size * 0.28);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Head */}
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.8,
          borderColor: color,
          marginBottom: 1
        }}
      />
      {/* Body Torso */}
      <View
        style={{
          width: Math.round(size * 0.72),
          height: Math.round(size * 0.36),
          borderTopLeftRadius: Math.round(size * 0.36),
          borderTopRightRadius: Math.round(size * 0.36),
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0
        }}
      />
    </View>
  );
}

function IconNavPermissions({ size = 22, color = "#64748B" }: { size?: number; color?: string }) {
  const w = Math.round(size * 0.7);
  const h = Math.round(size * 0.82);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Shield shape */}
      <View
        style={{
          width: w,
          height: h,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderBottomLeftRadius: w / 2,
          borderBottomRightRadius: w / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {/* Checkmark inside shield */}
        <View
          style={{
            width: 4,
            height: 7,
            borderBottomWidth: 1.8,
            borderRightWidth: 1.8,
            borderColor: color,
            transform: [{ rotate: "45deg" }],
            marginTop: -2
          }}
        />
      </View>
    </View>
  );
}

function IconNavHistory({ size = 22, color = "#64748B" }: { size?: number; color?: string }) {
  const r = Math.round(size * 0.42);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ position: "absolute", top: r * 0.32, width: 1.8, height: r * 0.68, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: "absolute", left: r - 1, width: r * 0.55, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

/**
 * Reusable Authenticated Bottom Navigation for CareGanga Roles & Permissions Module.
 * Strictly implements the 4-tab wireframe:
 * 1. Overview
 * 2. Roles
 * 3. Permissions
 * 4. History (Permission-aware: rendered ONLY when canAudit is true)
 */
export function AuthenticatedBottomNavigation({
  activeTab,
  onSelectTab,
  canViewRoles = true,
  canAudit = false,
  customTabs
}: AuthenticatedBottomNavigationProps) {
  const insets = useSafeAreaInsets();

  // Compute authorized navigation items according to effective RBAC or custom tabs
  const tabItems: { id: string; label: string; icon: (color: string) => React.ReactNode }[] = [];

  if (customTabs && customTabs.length > 0) {
    tabItems.push(...customTabs);
  } else {
    if (canViewRoles) {
      tabItems.push({
        id: "overview",
        label: "Overview",
        icon: color => <IconNavOverview size={21} color={color} />
      });
      tabItems.push({
        id: "roles",
        label: "Roles",
        icon: color => <IconNavRoles size={21} color={color} />
      });
      tabItems.push({
        id: "permissions",
        label: "Permissions",
        icon: color => <IconNavPermissions size={21} color={color} />
      });
    }

    // History tab requires access.audit.view permission
    if (canAudit) {
      tabItems.push({
        id: "history",
        label: "History",
        icon: color => <IconNavHistory size={21} color={color} />
      });
    }
  }

  if (tabItems.length === 0) return null;

  return (
    <View
      style={[
        styles.navContainer,
        { paddingBottom: Math.max(10, insets.bottom + 4) }
      ]}
      accessibilityRole="tablist"
    >
      <View style={styles.tabsRow}>
        {tabItems.map(item => {
          const isActive = item.id === activeTab;
          const iconColor = isActive ? "#1D4ED8" : "#64748B";

          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectTab(item.id)}
              style={styles.tabButton}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <View style={[styles.tabContentWrap, isActive && styles.tabContentActive]}>
                {item.icon(iconColor)}
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {item.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Layout helper hook that calculates the exact bottom clearance required
 * so scrollable content is NEVER covered by the floating bottom navigation bar.
 * Adds `extraClearance` (default 24dp) for comfortable spacing above the bar.
 */
export function useBottomNavPadding(extraClearance = 24): number {
  const insets = useSafeAreaInsets();
  return 54 + Math.max(10, insets.bottom + 4) + extraClearance;
}

/**
 * Static calculation helper for bottom navigation clearance padding.
 */
export function getBottomNavPadding(bottomInset: number, extraClearance = 24): number {
  return 54 + Math.max(10, bottomInset + 4) + extraClearance;
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
    paddingHorizontal: 12,
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
  },
  vectorBox: {
    alignItems: "center",
    justifyContent: "center"
  }
});
