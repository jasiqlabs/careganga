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
          duration: 850,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 850,
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

export function StatsCardsSkeleton() {
  return (
    <View style={styles.statsSkeletonRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={styles.statCardSkeleton}>
          <SkeletonBlock width={36} height={36} borderRadius={18} />
          <SkeletonBlock width="70%" height={12} borderRadius={4} />
          <SkeletonBlock width="45%" height={22} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

export function UserCardsSkeleton() {
  return (
    <View style={styles.listSkeletonWrap}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={styles.userCardSkeleton}>
          <View style={styles.cardHeaderSkeleton}>
            <SkeletonBlock width={44} height={44} borderRadius={22} />
            <View style={styles.cardTitlesSkeleton}>
              <SkeletonBlock width="55%" height={16} borderRadius={4} />
              <SkeletonBlock width="35%" height={12} borderRadius={4} />
            </View>
          </View>
          <View style={styles.cardBodySkeleton}>
            <SkeletonBlock width="80%" height={13} borderRadius={4} />
            <SkeletonBlock width="60%" height={13} borderRadius={4} />
            <SkeletonBlock width="45%" height={13} borderRadius={4} />
          </View>
          <View style={styles.cardFooterSkeleton}>
            <View style={styles.cardBadgesSkeleton}>
              <SkeletonBlock width={64} height={22} borderRadius={11} />
              <SkeletonBlock width={54} height={22} borderRadius={11} />
            </View>
            <View style={styles.cardActionsSkeleton}>
              <SkeletonBlock width={32} height={32} borderRadius={16} />
              <SkeletonBlock width={32} height={32} borderRadius={16} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function UserDetailsSkeleton() {
  return (
    <View style={styles.detailsSkeletonWrap}>
      {/* Identity Banner Skeleton */}
      <View style={styles.identityBannerSkeleton}>
        <SkeletonBlock width={64} height={64} borderRadius={32} />
        <View style={styles.identityMetaSkeleton}>
          <SkeletonBlock width="60%" height={20} borderRadius={4} />
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 4 }}>
            <SkeletonBlock width={80} height={18} borderRadius={9} />
            <SkeletonBlock width={60} height={18} borderRadius={9} />
          </View>
          <SkeletonBlock width="75%" height={13} borderRadius={4} />
        </View>
      </View>

      {/* Tabs Strip Skeleton */}
      <View style={styles.tabsStripSkeleton}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <SkeletonBlock key={i} width={72} height={28} borderRadius={14} />
        ))}
      </View>

      {/* Metrics Strip Skeleton */}
      <View style={styles.metricsStripSkeleton}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.metricCellSkeleton}>
            <SkeletonBlock width={32} height={32} borderRadius={8} />
            <SkeletonBlock width="80%" height={11} borderRadius={3} />
            <SkeletonBlock width="60%" height={16} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Content Card Skeleton */}
      <View style={styles.sectionCardSkeleton}>
        <SkeletonBlock width="40%" height={18} borderRadius={4} />
        <SkeletonBlock width="100%" height={14} borderRadius={4} />
        <SkeletonBlock width="100%" height={14} borderRadius={4} />
        <SkeletonBlock width="90%" height={14} borderRadius={4} />
        <SkeletonBlock width="75%" height={14} borderRadius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: "#E2E8F0"
  },
  statsSkeletonRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginVertical: 10
  },
  statCardSkeleton: {
    width: 140,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8
  },
  listSkeletonWrap: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8
  },
  userCardSkeleton: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12
  },
  cardHeaderSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  cardTitlesSkeleton: {
    flex: 1,
    gap: 6
  },
  cardBodySkeleton: {
    gap: 8,
    paddingVertical: 4
  },
  cardFooterSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10
  },
  cardBadgesSkeleton: {
    flexDirection: "row",
    gap: 6
  },
  cardActionsSkeleton: {
    flexDirection: "row",
    gap: 8
  },
  detailsSkeletonWrap: {
    padding: 16,
    gap: 16
  },
  identityBannerSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  identityMetaSkeleton: {
    flex: 1,
    gap: 6
  },
  tabsStripSkeleton: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4
  },
  metricsStripSkeleton: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCellSkeleton: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6
  },
  sectionCardSkeleton: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12
  }
});
