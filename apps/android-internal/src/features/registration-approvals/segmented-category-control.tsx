import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  LayoutChangeEvent
} from "react-native";
import type { HomeTab } from "./registration-approvals-types";

export interface SegmentedCategoryControlProps {
  activeTab: HomeTab;
  applicationsCount: number;
  processVersion?: number;
  onTabChange: (tab: HomeTab) => void;
}

export function SegmentedCategoryControl({
  activeTab,
  applicationsCount,
  processVersion,
  onTabChange
}: SegmentedCategoryControlProps) {
  const containerWidthRef = useRef(0);
  const indicatorLeftAnim = useRef(new Animated.Value(0)).current;

  // Animate sliding indicator when activeTab changes
  useEffect(() => {
    if (containerWidthRef.current <= 0) return;
    const tabWidth = containerWidthRef.current / 2;
    const targetX = activeTab === "APPLICATIONS" ? 0 : tabWidth;

    Animated.spring(indicatorLeftAnim, {
      toValue: targetX,
      damping: 22,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true
    }).start();
  }, [activeTab, indicatorLeftAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width - 6; // minus padding
    containerWidthRef.current = width;
    const tabWidth = width / 2;
    const initialX = activeTab === "APPLICATIONS" ? 0 : tabWidth;
    indicatorLeftAnim.setValue(initialX);
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Animated Sliding Pill Indicator */}
      <Animated.View
        style={[
          styles.activeIndicatorPill,
          {
            width: "50%",
            transform: [{ translateX: indicatorLeftAnim }]
          }
        ]}
      />

      {/* Tab 1: Applications */}
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={`Applications tab, ${applicationsCount} total`}
        accessibilityState={{ selected: activeTab === "APPLICATIONS" }}
        onPress={() => {
          if (activeTab !== "APPLICATIONS") onTabChange("APPLICATIONS");
        }}
        style={styles.tabBtn}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "APPLICATIONS" && styles.tabTextActive
          ]}
        >
          Applications
        </Text>
        <View
          style={[
            styles.badge,
            activeTab === "APPLICATIONS" ? styles.badgeActive : styles.badgeInactive
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              activeTab === "APPLICATIONS"
                ? styles.badgeTextActive
                : styles.badgeTextInactive
            ]}
          >
            {applicationsCount}
          </Text>
        </View>
      </Pressable>

      {/* Tab 2: Version Process */}
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={`Version Process tab${processVersion ? `, version ${processVersion}` : ""}`}
        accessibilityState={{ selected: activeTab === "PROCESS" }}
        onPress={() => {
          if (activeTab !== "PROCESS") onTabChange("PROCESS");
        }}
        style={styles.tabBtn}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "PROCESS" && styles.tabTextActive
          ]}
        >
          Version Process
        </Text>
        {processVersion !== undefined && (
          <View
            style={[
              styles.badge,
              activeTab === "PROCESS" ? styles.badgeActive : styles.badgeInactive
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                activeTab === "PROCESS"
                  ? styles.badgeTextActive
                  : styles.badgeTextInactive
              ]}
            >
              {processVersion}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    padding: 3,
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  activeIndicatorPill: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    zIndex: 1
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B"
  },
  tabTextActive: {
    color: "#16A34A",
    fontWeight: "700"
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 999
  },
  badgeActive: {
    backgroundColor: "#DCFCE7"
  },
  badgeInactive: {
    backgroundColor: "#E2E8F0"
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700"
  },
  badgeTextActive: {
    color: "#16A34A"
  },
  badgeTextInactive: {
    color: "#64748B"
  }
});
