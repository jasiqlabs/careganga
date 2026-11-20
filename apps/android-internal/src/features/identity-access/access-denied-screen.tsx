import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  BackHandler,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { IconUserRound, IconArrowRight } from "./auth-icons";
export {
  AccessVerificationScreen,
  type AccessVerificationScreenProps,
  type NativeAccessVerificationMode
} from "./access-verification-screen";

export interface AccessDeniedScreenProps {
  title?: string;
  reason?: string;
  accountLabel?: string;
  onMyAccount: () => void;
}

export function AccessDeniedScreen({
  title = "Access Denied",
  reason = "Security Policy is restricted to the Foundation Super Admin.",
  accountLabel = "My Account",
  onMyAccount
}: AccessDeniedScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Handle hardware back button
  useEffect(() => {
    const onBackPress = () => {
      onMyAccount();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [onMyAccount]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Decorative Ambient Waves (Light Theme Cyan & Emerald) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden={true}>
        {/* Top-Left Ambient Waves */}
        <View style={styles.topLeftCyanGlow} />
        <View style={styles.topLeftWaveArc1} />
        <View style={styles.topLeftWaveArc2} />

        {/* Bottom-Right Ambient Waves */}
        <View style={styles.bottomRightEmeraldGlow} />
        <View style={styles.bottomRightWaveArc1} />
        <View style={styles.bottomRightWaveArc2} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
          accessibilityRole="alert"
        >
          {/* Top Border Accent Line */}
          <LinearGradient
            colors={["#1E53DC", "#0284C7", "#10B981"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.topAccentBar}
          />

          {/* Branding Section */}
          <View style={styles.brandRow} accessibilityRole="header">
            <Image
              source={require("../../../assets/careganga-mark.png")}
              style={styles.brandLogo}
              accessibilityLabel="CareGanga Foundation Logo"
            />
            <View style={styles.brandTextBox}>
              <Text style={styles.brandTitleText}>CAREGANGA</Text>
              <Text style={styles.brandSubText}>FOUNDATION</Text>
            </View>
          </View>

          {/* Security Shield Illustration */}
          <View style={styles.illustrationWrap} aria-hidden={true}>
            {/* Soft Cyan Circular Glow Aura */}
            <View style={styles.glowCircle} />

            {/* Sparkle / Accent Rays at Top Right */}
            <View style={styles.sparkleContainer}>
              <View style={[styles.sparkleRay, styles.sparkleRayTop]} />
              <View style={[styles.sparkleRay, styles.sparkleRayMid]} />
              <View style={[styles.sparkleRay, styles.sparkleRayBottom]} />
            </View>

            {/* Vibrant Blue Shield */}
            <View style={styles.shieldWrapper}>
              <LinearGradient
                colors={["#38BDF8", "#2563EB", "#1D4ED8"]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={styles.shieldGradient}
              >
                {/* White Padlock Shackle */}
                <View style={styles.lockShackle} />
                {/* White Padlock Body */}
                <View style={styles.lockBody}>
                  {/* Lock Keyhole Cutout */}
                  <View style={styles.keyholeHead} />
                  <View style={styles.keyholeSlot} />
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.headingTitle} accessibilityRole="header">
            {title}
          </Text>

          {/* Restriction Reason */}
          <Text style={styles.reasonText}>
            {reason}
          </Text>

          {/* My Account CTA Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }], width: "100%", alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={accountLabel}
              onPress={onMyAccount}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={["#0284C7", "#1D4ED8"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.buttonGradient}
              >
                <IconUserRound size={17} color="#FFFFFF" />
                <Text style={styles.buttonText}>{accountLabel}</Text>
                <IconArrowRight size={17} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20
  },
  cardContainer: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 42,
    paddingHorizontal: 28,
    shadowColor: "#0A1F44",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4
  },
  topAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24
  },
  brandLogo: {
    width: 44,
    height: 44,
    resizeMode: "contain"
  },
  brandTextBox: {
    marginLeft: 12
  },
  brandTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0A1F44",
    letterSpacing: 1.1,
    lineHeight: 20
  },
  brandSubText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#475569",
    letterSpacing: 2.8,
    marginTop: 2,
    lineHeight: 12
  },
  illustrationWrap: {
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    position: "relative"
  },
  glowCircle: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(224, 242, 254, 0.85)"
  },
  sparkleContainer: {
    position: "absolute",
    top: 14,
    right: 12,
    zIndex: 2,
    alignItems: "flex-end",
    gap: 4
  },
  sparkleRay: {
    height: 2.4,
    borderRadius: 1.2,
    backgroundColor: "#38BDF8"
  },
  sparkleRayTop: {
    width: 9,
    transform: [{ rotate: "-35deg" }]
  },
  sparkleRayMid: {
    width: 10,
    marginRight: -2
  },
  sparkleRayBottom: {
    width: 8,
    transform: [{ rotate: "35deg" }]
  },
  shieldWrapper: {
    width: 72,
    height: 84,
    borderRadius: 36,
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4
  },
  shieldGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 36
  },
  lockShackle: {
    width: 22,
    height: 16,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    borderWidth: 3.8,
    borderColor: "#FFFFFF",
    borderBottomWidth: 0,
    marginBottom: -1
  },
  lockBody: {
    width: 26,
    height: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  keyholeHead: {
    width: 3.6,
    height: 3.6,
    borderRadius: 1.8,
    backgroundColor: "#1D4ED8"
  },
  keyholeSlot: {
    width: 2,
    height: 3.5,
    backgroundColor: "#1D4ED8",
    marginTop: -0.5
  },
  headingTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0A1F44",
    textAlign: "center",
    letterSpacing: -0.4,
    lineHeight: 32
  },
  reasonText: {
    fontSize: 14.5,
    fontWeight: "400",
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 360
  },
  buttonWrapper: {
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 28,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4
  },
  buttonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },

  /* Decorative Ambient Waves (Light Theme) */
  topLeftCyanGlow: {
    position: "absolute",
    top: -70,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#38BDF8",
    opacity: 0.14
  },
  topLeftWaveArc1: {
    position: "absolute",
    top: -50,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2.5,
    borderColor: "rgba(6, 182, 212, 0.38)",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "-20deg" }]
  },
  topLeftWaveArc2: {
    position: "absolute",
    top: -20,
    left: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.38)",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "15deg" }]
  },
  bottomRightEmeraldGlow: {
    position: "absolute",
    bottom: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#10B981",
    opacity: 0.12
  },
  bottomRightWaveArc1: {
    position: "absolute",
    bottom: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2.5,
    borderColor: "rgba(2, 132, 199, 0.35)",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    transform: [{ rotate: "-15deg" }]
  },
  bottomRightWaveArc2: {
    position: "absolute",
    bottom: -30,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    transform: [{ rotate: "20deg" }]
  }
});
