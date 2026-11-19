import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import { IconHeartPulse, IconUsersRound, IconLeaf } from "./auth-icons";

export function LoginHeroSection() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        delay: 100,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: 100,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.heroContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
      accessibilityLabel="CareGanga Foundation Healthcare and Community Support"
    >
      {/* Background Image: Doctor and smiling student high-fiving */}
      <Image
        source={require("../../../assets/careganga-hero-community.jpg")}
        style={styles.heroImage}
        accessibilityLabel="CareGanga healthcare worker and community youth"
      />

      {/* Subtle top-down gradient shadow inside image */}
      <View style={styles.topVignette} pointerEvents="none" />

      {/* Frosted Glass Overlay Bar at Bottom */}
      <View style={styles.frostedBar}>
        {/* Service 1: Healthcare Services */}
        <View style={styles.serviceItem}>
          <View style={[styles.serviceIconBadge, { backgroundColor: "#10B981" }]}>
            <IconHeartPulse size={15} color="#FFFFFF" />
          </View>
          <Text style={styles.serviceText}>
            Healthcare{"\n"}Services
          </Text>
        </View>

        {/* Divider 1 */}
        <View style={styles.serviceDivider} />

        {/* Service 2: Community Support */}
        <View style={styles.serviceItem}>
          <View style={[styles.serviceIconBadge, { backgroundColor: "#2563EB" }]}>
            <IconUsersRound size={15} color="#FFFFFF" />
          </View>
          <Text style={styles.serviceText}>
            Community{"\n"}Support
          </Text>
        </View>

        {/* Divider 2 */}
        <View style={styles.serviceDivider} />

        {/* Service 3: Wellness & Care */}
        <View style={styles.serviceItem}>
          <View style={[styles.serviceIconBadge, { backgroundColor: "#8B5CF6" }]}>
            <IconLeaf size={15} color="#FFFFFF" />
          </View>
          <Text style={styles.serviceText}>
            Wellness{"\n"}& Care
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    width: "100%",
    height: 195,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(56, 189, 248, 0.28)",
    backgroundColor: "#071B3B",
    shadowColor: "#00E5FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 16
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  topVignette: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "rgba(3, 19, 43, 0.25)"
  },
  frostedBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: "rgba(4, 19, 43, 0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8
  },
  serviceItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  serviceIconBadge: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  serviceText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 13
  },
  serviceDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  }
});
