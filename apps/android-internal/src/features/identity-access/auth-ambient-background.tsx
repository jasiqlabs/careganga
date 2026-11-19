import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

export function AuthAmbientBackground() {
  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 3500,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 3500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden={true}>
      {/* Base Solid Deep Navy Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#03132B" }]} />

      {/* Top-Left Glowing Cyan Wave 1 */}
      <Animated.View
        style={[
          styles.topLeftWaveGlow,
          {
            opacity: pulseAnim
          }
        ]}
      />
      <View style={styles.topLeftWaveArc1} />
      <View style={styles.topLeftWaveArc2} />

      {/* Top-Right Soft Blue Glow */}
      <View style={styles.topRightBlueGlow} />
      <View style={styles.topRightWaveArc} />

      {/* Mid-Left Luminous Flare */}
      <View style={styles.midLeftCyanStreak} />

      {/* Mid-Right Subtle Teal Wave */}
      <View style={styles.midRightTealStreak} />

      {/* Bottom Ambient Glow */}
      <View style={styles.bottomTealGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  topLeftWaveGlow: {
    position: "absolute",
    top: -80,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#00E5FF",
    opacity: 0.16
  },
  topLeftWaveArc1: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: "rgba(0, 229, 255, 0.45)",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "-15deg" }]
  },
  topLeftWaveArc2: {
    position: "absolute",
    top: -30,
    left: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.6)",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: "10deg" }]
  },
  topRightBlueGlow: {
    position: "absolute",
    top: -90,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#1D4ED8",
    opacity: 0.22
  },
  topRightWaveArc: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.35)",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent"
  },
  midLeftCyanStreak: {
    position: "absolute",
    top: "35%",
    left: -70,
    width: 180,
    height: 300,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: "rgba(6, 182, 212, 0.28)",
    borderRightColor: "transparent",
    transform: [{ rotate: "25deg" }]
  },
  midRightTealStreak: {
    position: "absolute",
    top: "28%",
    right: -60,
    width: 160,
    height: 280,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.22)",
    borderLeftColor: "transparent",
    transform: [{ rotate: "-20deg" }]
  },
  bottomTealGlow: {
    position: "absolute",
    bottom: -60,
    left: "20%",
    width: 260,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#0284C7",
    opacity: 0.1
  }
});
