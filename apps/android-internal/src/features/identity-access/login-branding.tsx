import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";

export function LoginBranding() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
      accessibilityRole="header"
    >
      {/* Top Brand Emblem & Text Row */}
      <View style={styles.logoRow}>
        <Image
          source={require("../../../assets/careganga-mark.png")}
          accessibilityLabel="CareGanga Foundation Logo"
          style={styles.logoImage}
        />
        <View style={styles.brandTitleBox}>
          <Text style={styles.brandMainText}>
            Care<Text style={styles.brandMainGanga}>Ganga</Text>
          </Text>
          <Text style={styles.brandSubText}>FOUNDATION</Text>
        </View>
      </View>

      {/* Welcome Prefix */}
      <Text style={styles.welcomePrefix}>Welcome to</Text>

      {/* Main Large Title */}
      <View style={styles.mainHeadingRow}>
        <Text style={styles.mainHeadingWhite}>CareGanga </Text>
        <Text style={styles.mainHeadingGreen}>Foundation</Text>
      </View>

      {/* Tagline */}
      <Text style={styles.tagline}>Accessible Healthcare, Healthier Communities</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 12
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    resizeMode: "contain"
  },
  brandTitleBox: {
    justifyContent: "center"
  },
  brandMainText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3
  },
  brandMainGanga: {
    color: "#22C55E"
  },
  brandSubText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#CBD5E1",
    letterSpacing: 3.5,
    marginTop: -1
  },
  welcomePrefix: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 2
  },
  mainHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  mainHeadingWhite: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2
  },
  mainHeadingGreen: {
    fontSize: 24,
    fontWeight: "800",
    color: "#22C55E",
    letterSpacing: 0.2
  },
  tagline: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18
  }
});
