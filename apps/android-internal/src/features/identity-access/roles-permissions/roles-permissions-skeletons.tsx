import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

/**
 * Reusable animated skeleton box that pulses subtly.
 */
export function SkeletonBlock({
  width,
  height,
  borderRadius = 6,
  style
}: {
  width?: number | `${number}%` | "auto";
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true
        })
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width: width ?? "100%",
          height,
          borderRadius,
          opacity: opacityAnim
        },
        style
      ]}
    />
  );
}

/**
 * Skeleton for the 6 Statistics Cards on Overview.
 */
export function StatisticsGridSkeleton() {
  return (
    <View style={styles.gridContainer}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View key={i} style={styles.kpiCardSkeleton}>
          <SkeletonBlock width={34} height={34} borderRadius={8} />
          <SkeletonBlock width="65%" height={12} borderRadius={4} />
          <SkeletonBlock width="40%" height={24} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for Roles List.
 */
export function RolesListSkeleton() {
  return (
    <View style={styles.listSkeletonWrap}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={styles.roleCardSkeleton}>
          <SkeletonBlock width={42} height={42} borderRadius={21} />
          <View style={styles.roleTextSkeletonWrap}>
            <SkeletonBlock width="50%" height={15} borderRadius={4} />
            <SkeletonBlock width="70%" height={12} borderRadius={4} />
          </View>
          <SkeletonBlock width={56} height={22} borderRadius={11} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for Permission Matrix / Modules.
 */
export function PermissionMatrixSkeleton() {
  return (
    <View style={styles.matrixSkeletonWrap}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.moduleCardSkeleton}>
          <View style={styles.moduleHeaderSkeleton}>
            <SkeletonBlock width={18} height={18} borderRadius={9} />
            <SkeletonBlock width="50%" height={15} borderRadius={4} />
          </View>
          <View style={styles.moduleBodySkeleton}>
            <SkeletonBlock width="100%" height={24} borderRadius={4} />
            <SkeletonBlock width="100%" height={24} borderRadius={4} />
            <SkeletonBlock width="100%" height={24} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for Access History.
 */
export function AccessHistorySkeleton() {
  return (
    <View style={styles.listSkeletonWrap}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.historyCardSkeleton}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <View style={styles.historyTextSkeletonWrap}>
            <SkeletonBlock width="60%" height={15} borderRadius={4} />
            <SkeletonBlock width="45%" height={12} borderRadius={4} />
            <SkeletonBlock width="35%" height={11} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: "#E2E8F0"
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiCardSkeleton: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 13,
    gap: 8
  },
  listSkeletonWrap: {
    gap: 8
  },
  roleCardSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12
  },
  roleTextSkeletonWrap: {
    flex: 1,
    gap: 6
  },
  matrixSkeletonWrap: {
    gap: 10
  },
  moduleCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  moduleHeaderSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  moduleBodySkeleton: {
    padding: 14,
    gap: 10
  },
  historyCardSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  historyTextSkeletonWrap: {
    flex: 1,
    gap: 6
  }
});
