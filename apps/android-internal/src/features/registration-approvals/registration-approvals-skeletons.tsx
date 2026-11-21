import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

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
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 800,
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

export function ApprovalStatsSkeleton() {
  return (
    <View style={styles.statsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={styles.statCard}>
          <SkeletonBlock width={32} height={32} borderRadius={16} />
          <SkeletonBlock width="65%" height={10} borderRadius={3} style={{ marginTop: 6 }} />
          <SkeletonBlock width="45%" height={18} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

export function ApprovalListSkeleton() {
  return (
    <View style={styles.listWrap}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.cardSkeleton}>
          <View style={styles.cardHeader}>
            <SkeletonBlock width={120} height={16} borderRadius={4} />
            <SkeletonBlock width={20} height={20} borderRadius={10} />
          </View>
          <SkeletonBlock width="75%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
          <View style={styles.cardFooter}>
            <SkeletonBlock width={90} height={24} borderRadius={12} />
            <SkeletonBlock width={70} height={12} borderRadius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ApprovalDetailSkeleton() {
  return (
    <View style={styles.detailWrap}>
      <View style={styles.cardSkeleton}>
        <SkeletonBlock width="40%" height={20} borderRadius={4} />
        <SkeletonBlock width="60%" height={14} borderRadius={4} style={{ marginTop: 10 }} />
      </View>
      <View style={styles.gridRow}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.gridCell}>
            <SkeletonBlock width="80%" height={12} borderRadius={3} />
            <SkeletonBlock width="50%" height={18} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <View style={styles.cardSkeleton}>
        <SkeletonBlock width="90%" height={40} borderRadius={8} />
      </View>
    </View>
  );
}

export function ProcessVersionSkeleton() {
  return (
    <View style={styles.detailWrap}>
      {/* Workflow Card Skeleton */}
      <View style={styles.cardSkeleton}>
        <View style={styles.cardHeader}>
          <SkeletonBlock width={160} height={20} borderRadius={4} />
          <SkeletonBlock width={64} height={22} borderRadius={11} />
        </View>
        <SkeletonBlock width="80%" height={14} borderRadius={4} style={{ marginTop: 10 }} />
        <View style={{ marginTop: 14, gap: 10 }}>
          <SkeletonBlock width="100%" height={44} borderRadius={8} />
          <SkeletonBlock width="100%" height={44} borderRadius={8} />
          <SkeletonBlock width="100%" height={44} borderRadius={8} />
        </View>
      </View>

      {/* Version History Card Skeleton */}
      <View style={[styles.cardSkeleton, { marginTop: 4 }]}>
        <SkeletonBlock width={150} height={18} borderRadius={4} />
        <SkeletonBlock width="70%" height={12} borderRadius={3} style={{ marginTop: 6 }} />
        <View style={{ marginTop: 14, gap: 10 }}>
          <SkeletonBlock width="100%" height={68} borderRadius={10} />
          <SkeletonBlock width="100%" height={68} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: "#CBD5E1"
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    alignItems: "center"
  },
  listWrap: {
    gap: 10,
    marginTop: 10
  },
  cardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12
  },
  detailWrap: {
    gap: 12,
    marginTop: 12
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  gridCell: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12
  }
});
