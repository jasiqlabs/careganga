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
import { IconMenu, IconBell } from "./dashboard-icons";

export interface DashboardHeaderProps {
  displayName: string;
  roleName: string;
  hasNotifications?: boolean;
  hideWelcome?: boolean;
  onOpenDrawer: () => void;
  onOpenNotifications: () => void;
}

export function DashboardHeader({
  displayName,
  roleName,
  hasNotifications = true,
  hideWelcome = false,
  onOpenDrawer,
  onOpenNotifications
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const glowAnim = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, [glowAnim]);

  return (
    <View
      style={[
        styles.headerContainer,
        { paddingTop: insets.top + 8 },
        hideWelcome && styles.headerContainerCompact
      ]}
    >
      {/* Background Deep Navy Base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#03132B" }]} />

      {/* Wireframe Glowing Emerald-to-Cyan Ambient Wave (Top-Right / Mid-Right) */}
      <Animated.View
        style={[
          styles.glowAmbientBlob,
          {
            opacity: glowAnim
          }
        ]}
        pointerEvents="none"
      />
      <View style={styles.glowWaveArc1} pointerEvents="none" />
      <View style={styles.glowWaveArc2} pointerEvents="none" />
      <View style={styles.glowWaveArc3} pointerEvents="none" />

      {/* Top Bar Row: Hamburger - Branding - Notification */}
      <View style={[styles.topBar, hideWelcome && styles.topBarCompact]}>
        <View style={styles.brandCluster}>
          {/* Left: Hamburger Menu Icon */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation menu"
            onPress={onOpenDrawer}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconMenu size={22} color="#FFFFFF" />
          </Pressable>

          {/* CareGanga Logo Emblem + Wordmark immediately beside hamburger */}
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

        {/* Right: Notifications Button (STRICT: NO Search icon, NO SY Avatar) */}
        <View style={styles.rightActionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View notices and notifications"
            onPress={onOpenNotifications}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconBell size={20} color="#FFFFFF" hasBadge={hasNotifications} />
          </Pressable>
        </View>
      </View>

      {/* Welcome Section */}
      {!hideWelcome && (
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomePrefix}>Welcome back,</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName || "Staff Member"} 👋
          </Text>

          {/* Role Pill Badge */}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleName || "Authorized Staff"}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#03132B",
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden"
  },
  headerContainerCompact: {
    paddingBottom: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0
  },
  topBarCompact: {
    marginBottom: 0
  },
  glowAmbientBlob: {
    position: "absolute",
    right: -50,
    top: 20,
    width: 240,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#059669",
    opacity: 0.35
  },
  glowWaveArc1: {
    position: "absolute",
    right: -30,
    top: 30,
    width: 280,
    height: 200,
    borderRadius: 100,
    borderWidth: 2.5,
    borderColor: "rgba(16, 185, 129, 0.45)",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "15deg" }]
  },
  glowWaveArc2: {
    position: "absolute",
    right: 10,
    bottom: -20,
    width: 200,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "rgba(6, 182, 212, 0.4)",
    borderLeftColor: "transparent",
    borderTopColor: "transparent",
    transform: [{ rotate: "-25deg" }]
  },
  glowWaveArc3: {
    position: "absolute",
    right: -60,
    bottom: 10,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#0284C7",
    opacity: 0.22
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  brandCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1
  },
  iconButton: {
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2
  },
  brandGanga: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.2
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
    letterSpacing: 0.8,
    marginTop: -1
  },
  rightActionsRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  welcomeSection: {
    marginTop: 2
  },
  welcomePrefix: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8"
  },
  userName: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
    marginTop: 2
  },
  roleBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 14,
    alignSelf: "flex-start",
    marginTop: 7,
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D"
  }
});
