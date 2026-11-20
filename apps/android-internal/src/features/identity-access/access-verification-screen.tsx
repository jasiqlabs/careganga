import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  BackHandler,
  ActivityIndicator,
  AccessibilityInfo,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { IconUserRound, IconArrowLeft } from "./auth-icons";

export type NativeAccessVerificationMode = "unverified-access" | "unconfirmed-session";

export interface AccessVerificationScreenProps {
  mode?: NativeAccessVerificationMode;
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCta: () => void | Promise<void>;
}

export function AccessVerificationScreen({
  mode = "unverified-access",
  title,
  description,
  ctaLabel,
  onCta
}: AccessVerificationScreenProps) {
  const isAccessUnverified = mode === "unverified-access";

  const resolvedTitle =
    title ??
    (isAccessUnverified
      ? "Access cannot be verified"
      : "Cannot confirm your access");

  const resolvedDescription =
    description ??
    (isAccessUnverified
      ? "Staff information is hidden until your current permissions are confirmed."
      : "Protected information is unavailable until your session can be verified.");

  const resolvedCtaLabel =
    ctaLabel ?? (isAccessUnverified ? "Return to my account" : "Sign in");

  const loadingLabel = isAccessUnverified ? "Returning…" : "Redirecting…";

  const [isBusy, setIsBusy] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Check reduced motion preference
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (isMounted) setReduceMotion(enabled);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (!isBusy) {
        handlePress();
      }
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [isBusy, onCta]);

  // Entrance animation
  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
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
  }, [fadeAnim, slideAnim, reduceMotion]);

  const handlePressIn = () => {
    if (isBusy || reduceMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  const handlePress = () => {
    if (isBusy) return;
    setIsBusy(true);
    Promise.resolve(onCta())
      .catch(() => {})
      .finally(() => {
        setIsBusy(false);
      });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Decorative Ambient Waves (Light Theme sky blue) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden={true}>
        {/* Top-Right Ambient Glow & Arc */}
        <View style={styles.topRightBlueGlow} />
        <View style={styles.topRightWaveArc} />

        {/* Bottom-Left Ambient Glow & Arc */}
        <View style={styles.bottomLeftBlueGlow} />
        <View style={styles.bottomLeftWaveArc} />

        {/* Bottom-Right Ambient Curve */}
        <View style={styles.bottomRightWaveArc} />
      </View>

      {/* Top Left CareGanga Brand Header */}
      <View style={styles.headerContainer} accessibilityRole="header">
        <View style={styles.brandRow}>
          <Image
            source={require("../../../assets/careganga-mark.png")}
            style={styles.brandLogo}
            accessibilityLabel="CareGanga Foundation Logo"
          />
          <View style={styles.brandTextBox}>
            <Text style={styles.brandTitleText}>CareGanga</Text>
            <Text style={styles.brandSubText}>FOUNDATION</Text>
          </View>
        </View>
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
          {/* Centered Graphic Illustration matching wireframe */}
          <View style={styles.illustrationWrap} aria-hidden={true}>
            {/* Soft Pastel Blue Semi-Circle Arch Base */}
            <View style={styles.archBase} />

            {/* Top-Left Ray Accent Ticks */}
            <View style={styles.sparkleContainer}>
              <View style={[styles.sparkleRay, styles.sparkleRayTop]} />
              <View style={[styles.sparkleRay, styles.sparkleRayMid]} />
              <View style={[styles.sparkleRay, styles.sparkleRayBottom]} />
            </View>

            {isAccessUnverified ? (
              /* State 1: 3D Blue Shield with White Padlock & Pink Exclamation Badge */
              <View style={styles.graphicCenterWrap}>
                <View style={styles.shieldWrapper}>
                  <LinearGradient
                    colors={["#60A5FA", "#3B82F6", "#1D4ED8"]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.shieldGradient}
                  >
                    {/* Inner highlight ring */}
                    <View style={styles.shieldInnerHighlight} />

                    {/* White Padlock Shackle */}
                    <View style={styles.lockShackle} />
                    {/* White Padlock Body */}
                    <View style={styles.lockBody}>
                      <View style={styles.keyholeHead} />
                      <View style={styles.keyholeSlot} />
                    </View>
                  </LinearGradient>
                </View>

                {/* Pinkish-Red Exclamation Badge at Bottom Right */}
                <View style={styles.exclaimBadgeWrap}>
                  <LinearGradient
                    colors={["#FB7185", "#F43F5E", "#E11D48"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.exclaimBadge}
                  >
                    <View style={styles.exclaimBar} />
                    <View style={styles.exclaimDot} />
                  </LinearGradient>
                </View>
              </View>
            ) : (
              /* State 2: ID Card with Lanyard Clip, Avatar, and Blue Lock Badge */
              <View style={styles.graphicCenterWrap}>
                {/* Lanyard Top Clip */}
                <View style={styles.clipContainer}>
                  <View style={styles.clipBody}>
                    <View style={styles.clipSlot} />
                  </View>
                </View>

                {/* ID Card */}
                <View style={styles.idCardBody}>
                  {/* Avatar box */}
                  <View style={styles.avatarBox}>
                    <View style={styles.avatarHead} />
                    <View style={styles.avatarBody} />
                  </View>
                  {/* Credential lines */}
                  <View style={styles.credentialLinesBox}>
                    <View style={styles.credLine1} />
                    <View style={styles.credLine2} />
                    <View style={styles.credLine3} />
                  </View>
                </View>

                {/* Royal Blue Lock Badge at Bottom Right */}
                <View style={styles.lockBadgeWrap}>
                  <LinearGradient
                    colors={["#2563EB", "#1D4ED8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.lockBadge}
                  >
                    <View style={styles.miniLockShackle} />
                    <View style={styles.miniLockBody}>
                      <View style={styles.miniKeyhole} />
                    </View>
                  </LinearGradient>
                </View>
              </View>
            )}
          </View>

          {/* Heading */}
          <Text style={styles.headingTitle} accessibilityRole="header">
            {resolvedTitle}
          </Text>

          {/* Supporting Text */}
          <Text style={styles.descriptionText}>
            {resolvedDescription}
          </Text>

          {/* Action Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }], width: "100%", alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isBusy ? loadingLabel : resolvedCtaLabel}
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
              disabled={isBusy}
              onPress={handlePress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[styles.buttonWrapper, isBusy && styles.buttonDisabled]}
            >
              <LinearGradient
                colors={["#1D4ED8", "#1E40AF"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.buttonGradient}
              >
                {isBusy ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>{loadingLabel}</Text>
                  </>
                ) : isAccessUnverified ? (
                  <>
                    <IconArrowLeft size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>{resolvedCtaLabel}</Text>
                  </>
                ) : (
                  <>
                    <IconUserRound size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>{resolvedCtaLabel}</Text>
                  </>
                )}
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
    backgroundColor: "#FFFFFF"
  },
  headerContainer: {
    paddingTop: 14,
    paddingHorizontal: 22,
    zIndex: 10
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  brandLogo: {
    width: 42,
    height: 42,
    resizeMode: "contain"
  },
  brandTextBox: {
    marginLeft: 10
  },
  brandTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A1F44",
    letterSpacing: -0.3,
    lineHeight: 21
  },
  brandSubText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0A1F44",
    letterSpacing: 2.4,
    marginTop: 1,
    lineHeight: 12
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20
  },
  cardContainer: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    paddingHorizontal: 12
  },
  illustrationWrap: {
    width: 180,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative"
  },
  archBase: {
    position: "absolute",
    bottom: 0,
    width: 140,
    height: 70,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    backgroundColor: "#E0F2FE"
  },
  sparkleContainer: {
    position: "absolute",
    top: 26,
    left: 20,
    zIndex: 2,
    alignItems: "flex-start",
    gap: 4
  },
  sparkleRay: {
    height: 2.6,
    borderRadius: 1.3,
    backgroundColor: "#38BDF8"
  },
  sparkleRayTop: {
    width: 9,
    transform: [{ rotate: "35deg" }]
  },
  sparkleRayMid: {
    width: 10,
    marginLeft: -2
  },
  sparkleRayBottom: {
    width: 8,
    transform: [{ rotate: "-35deg" }]
  },
  graphicCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },

  /* State 1: Shield */
  shieldWrapper: {
    width: 76,
    height: 88,
    borderRadius: 38,
    overflow: "hidden",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4
  },
  shieldGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    borderRadius: 38
  },
  shieldInnerHighlight: {
    position: "absolute",
    top: 4,
    left: 8,
    right: 8,
    height: 28,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderBottomWidth: 0
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
    width: 28,
    height: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 4.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2
  },
  keyholeHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1D4ED8"
  },
  keyholeSlot: {
    width: 2.2,
    height: 4,
    backgroundColor: "#1D4ED8",
    marginTop: -0.5
  },
  exclaimBadgeWrap: {
    position: "absolute",
    bottom: -6,
    right: -14,
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4
  },
  exclaimBadge: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  exclaimBar: {
    width: 3.2,
    height: 9.5,
    borderRadius: 1.6,
    backgroundColor: "#FFFFFF"
  },
  exclaimDot: {
    width: 3.2,
    height: 3.2,
    borderRadius: 1.6,
    backgroundColor: "#FFFFFF",
    marginTop: 2
  },

  /* State 2: ID Card */
  clipContainer: {
    width: 18,
    height: 14,
    backgroundColor: "#2563EB",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -4,
    zIndex: 3
  },
  clipBody: {
    width: 18,
    height: 14,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  clipSlot: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF"
  },
  idCardBody: {
    width: 96,
    height: 68,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 2.2,
    borderColor: "#93C5FD",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3
  },
  avatarBox: {
    width: 26,
    height: 32,
    borderRadius: 5,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarHead: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#93C5FD",
    marginBottom: 2
  },
  avatarBody: {
    width: 18,
    height: 10,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: "#93C5FD"
  },
  credentialLinesBox: {
    marginLeft: 7,
    gap: 4
  },
  credLine1: {
    width: 40,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: "#60A5FA"
  },
  credLine2: {
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#93C5FD"
  },
  credLine3: {
    width: 20,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "#BFDBFE"
  },
  lockBadgeWrap: {
    position: "absolute",
    bottom: -6,
    right: -12,
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4
  },
  lockBadge: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  miniLockShackle: {
    width: 10,
    height: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderBottomWidth: 0,
    marginBottom: -1
  },
  miniLockBody: {
    width: 13,
    height: 9,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  miniKeyhole: {
    width: 2,
    height: 3.5,
    backgroundColor: "#1D4ED8",
    borderRadius: 1
  },

  /* Typography */
  headingTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A1F44",
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 29
  },
  descriptionText: {
    fontSize: 14.5,
    fontWeight: "400",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320
  },

  /* Button */
  buttonWrapper: {
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 26,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4
  },
  buttonDisabled: {
    opacity: 0.82
  },
  buttonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 8
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF"
  },

  /* Ambient Curves */
  topRightBlueGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#E0F2FE",
    opacity: 0.7
  },
  topRightWaveArc: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: "rgba(186, 230, 253, 0.45)",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "15deg" }]
  },
  bottomLeftBlueGlow: {
    position: "absolute",
    bottom: -70,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#BAE6FD",
    opacity: 0.35
  },
  bottomLeftWaveArc: {
    position: "absolute",
    bottom: -50,
    left: -50,
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
    borderColor: "rgba(147, 197, 253, 0.35)",
    borderRightColor: "transparent",
    borderTopColor: "transparent",
    transform: [{ rotate: "-20deg" }]
  },
  bottomRightWaveArc: {
    position: "absolute",
    bottom: -30,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "rgba(224, 242, 254, 0.6)",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    transform: [{ rotate: "25deg" }]
  }
});
