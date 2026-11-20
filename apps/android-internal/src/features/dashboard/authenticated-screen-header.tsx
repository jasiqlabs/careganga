import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconMenu, IconBell, IconClose } from "./dashboard-icons";
import { IconArrowLeft } from "../identity-access/auth-icons";

export interface AuthenticatedScreenHeaderProps {
  /**
   * "standard" = Dark navy branding header with hamburger menu, CareGanga logo, and notification bell (Screens 1-5)
   * "workflow" = Sub-screen / modal header with back button, screen title, and close button (Screens 6-10)
   */
  variant?: "standard" | "workflow";
  title?: string;
  subtitle?: string;
  hasNotifications?: boolean;
  onOpenDrawer?: () => void;
  onOpenNotifications?: () => void;
  onBack?: () => void;
  onClose?: () => void;
}

/**
 * Reusable Authenticated Screen Header for CareGanga Internal Android.
 * Strictly adheres to the 10-screen wireframe visual target:
 * - Screens 1-5: Dark navy bar with hamburger icon, CareGanga emblem & wordmark, and notification bell.
 * - Screens 6-10: Clean workflow navigation header with back button, title, and close action.
 */
export function AuthenticatedScreenHeader({
  variant = "standard",
  title = "Roles & Permissions",
  subtitle,
  hasNotifications = false,
  onOpenDrawer,
  onOpenNotifications,
  onBack,
  onClose
}: AuthenticatedScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const glowAnim = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (variant !== "standard") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.98,
          duration: 3200,
          useNativeDriver: true
        }),
        Animated.timing(glowAnim, {
          toValue: 0.75,
          duration: 3200,
          useNativeDriver: true
        })
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [variant, glowAnim]);

  // WORKFLOW VARIANT (Screens 6, 7, 8, 9, 10)
  if (variant === "workflow") {
    return (
      <View
        style={[
          styles.workflowHeaderContainer,
          { paddingTop: Math.max(12, insets.top + 6) }
        ]}
      >
        <View style={styles.workflowRow}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Navigate back"
              onPress={onBack}
              style={styles.workflowIconButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <IconArrowLeft size={22} color="#0F172A" />
            </Pressable>
          ) : (
            <View style={styles.workflowSpacer} />
          )}

          <View style={styles.workflowTitleWrap}>
            <Text accessibilityRole="header" style={styles.workflowTitle} numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={styles.workflowSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          {onClose ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close screen"
              onPress={onClose}
              style={styles.workflowIconButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <IconClose size={20} color="#0F172A" />
            </Pressable>
          ) : (
            <View style={styles.workflowSpacer} />
          )}
        </View>
      </View>
    );
  }

  // STANDARD BRANDING VARIANT (Screens 1, 2, 3, 4, 5)
  return (
    <View
      style={[
        styles.standardHeaderContainer,
        { paddingTop: insets.top + 8 }
      ]}
    >
      {/* Background Deep Navy Base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#03132B" }]} />

      {/* Wireframe Glowing Emerald-to-Cyan Ambient Wave */}
      <Animated.View
        style={[styles.glowAmbientBlob, { opacity: glowAnim }]}
        pointerEvents="none"
      />
      <View style={styles.glowWaveArc1} pointerEvents="none" />
      <View style={styles.glowWaveArc2} pointerEvents="none" />

      {/* Top Bar Row: [ Hamburger ] [ CareGanga Logo + Foundation ] ... [ Notifications ] */}
      <View style={styles.topBar}>
        {/* Left: Hamburger Menu Icon + CareGanga Branding immediately beside it */}
        <View style={styles.leftGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            onPress={onOpenDrawer}
            style={styles.standardIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconMenu size={22} color="#FFFFFF" />
          </Pressable>

          {/* CareGanga Logo Emblem + Wordmark */}
          <View style={styles.brandingBox}>
            <Image
              source={require("../../../assets/careganga-mark.png")}
              accessibilityLabel="CareGanga Foundation"
              style={styles.logoMark}
            />
            <View style={styles.brandTextBox}>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandCare}>Care</Text>
                <Text style={styles.brandGanga}>Ganga</Text>
              </View>
              <Text style={styles.brandSubtitle}>Foundation</Text>
            </View>
          </View>
        </View>

        {/* Right: Notifications Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View notices and notifications"
          onPress={onOpenNotifications}
          style={styles.standardIconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconBell size={20} color="#FFFFFF" hasBadge={hasNotifications} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  standardHeaderContainer: {
    backgroundColor: "#03132B",
    paddingHorizontal: 18,
    paddingBottom: 14,
    overflow: "hidden"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  standardIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  brandingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    resizeMode: "contain"
  },
  brandTextBox: {
    justifyContent: "center"
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  brandCare: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2
  },
  brandGanga: {
    fontSize: 17,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.2
  },
  brandSubtitle: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#E2E8F0",
    letterSpacing: 0.8,
    marginTop: -1
  },
  glowAmbientBlob: {
    position: "absolute",
    right: -50,
    top: 15,
    width: 220,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#059669",
    opacity: 0.35
  },
  glowWaveArc1: {
    position: "absolute",
    right: -20,
    top: 20,
    width: 240,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.45)",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "15deg" }]
  },
  glowWaveArc2: {
    position: "absolute",
    right: 10,
    bottom: -15,
    width: 180,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.8,
    borderColor: "rgba(6, 182, 212, 0.4)",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    transform: [{ rotate: "-25deg" }]
  },
  workflowHeaderContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  workflowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  workflowIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9"
  },
  workflowSpacer: {
    width: 40,
    height: 40
  },
  workflowTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  workflowTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  workflowSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1
  }
});
