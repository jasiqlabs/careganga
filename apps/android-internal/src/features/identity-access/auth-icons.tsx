import React from "react";
import { View, StyleSheet, Text } from "react-native";

interface IconProps {
  size?: number;
  color?: string;
}

/**
 * High-precision vector icon components matching Lucide React icons
 * Built with pure React Native components for maximum reliability across Expo and Android.
 */

export function IconUserRound({ size = 20, color = "#64748B" }: IconProps) {
  const headSize = Math.round(size * 0.44);
  const bodyWidth = Math.round(size * 0.82);
  const bodyHeight = Math.round(size * 0.38);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: headSize,
          height: headSize,
          borderRadius: headSize / 2,
          borderWidth: 1.8,
          borderColor: color,
          marginBottom: 1.5
        }}
      />
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderTopLeftRadius: bodyWidth / 2,
          borderTopRightRadius: bodyWidth / 2,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0
        }}
      />
    </View>
  );
}

export function IconLockKeyhole({ size = 20, color = "#64748B" }: IconProps) {
  const shackleWidth = Math.round(size * 0.52);
  const shackleHeight = Math.round(size * 0.38);
  const bodyWidth = Math.round(size * 0.74);
  const bodyHeight = Math.round(size * 0.5);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: shackleWidth,
          height: shackleHeight,
          borderTopLeftRadius: shackleWidth / 2,
          borderTopRightRadius: shackleWidth / 2,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0,
          marginBottom: -1
        }}
      />
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderRadius: 3.5,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2, height: 3.5, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconEye({ size = 20, color = "#64748B" }: IconProps) {
  const width = Math.round(size * 0.9);
  const height = Math.round(size * 0.55);
  const pupil = Math.round(size * 0.28);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width,
          height,
          borderRadius: height / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View
          style={{
            width: pupil,
            height: pupil,
            borderRadius: pupil / 2,
            backgroundColor: color
          }}
        />
      </View>
    </View>
  );
}

export function IconEyeOff({ size = 20, color = "#64748B" }: IconProps) {
  const width = Math.round(size * 0.9);
  const height = Math.round(size * 0.55);
  const pupil = Math.round(size * 0.28);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width,
          height,
          borderRadius: height / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View
          style={{
            width: pupil,
            height: pupil,
            borderRadius: pupil / 2,
            backgroundColor: color
          }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          width: size * 0.95,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconHeartPulse({ size = 18, color = "#FFFFFF" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.85, color, fontWeight: "900", lineHeight: size }}>♥</Text>
    </View>
  );
}

export function IconUsersRound({ size = 18, color = "#FFFFFF" }: IconProps) {
  const primaryHead = Math.round(size * 0.35);
  const primaryBodyW = Math.round(size * 0.62);
  const primaryBodyH = Math.round(size * 0.3);

  return (
    <View style={[styles.iconBox, { width: size, height: size, flexDirection: "row", alignItems: "flex-end", justifyContent: "center" }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ alignItems: "center" }}>
        <View style={{ width: primaryHead, height: primaryHead, borderRadius: primaryHead / 2, borderWidth: 1.6, borderColor: color, marginBottom: 1 }} />
        <View style={{ width: primaryBodyW, height: primaryBodyH, borderTopLeftRadius: primaryBodyW / 2, borderTopRightRadius: primaryBodyW / 2, borderWidth: 1.6, borderColor: color, borderBottomWidth: 0 }} />
      </View>
    </View>
  );
}

export function IconLeaf({ size = 18, color = "#FFFFFF" }: IconProps) {
  const w = Math.round(size * 0.65);
  const h = Math.round(size * 0.75);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderTopRightRadius: w,
          borderBottomLeftRadius: w,
          borderWidth: 1.8,
          borderColor: color,
          backgroundColor: "transparent",
          transform: [{ rotate: "15deg" }]
        }}
      />
    </View>
  );
}

export function IconArrowRight({ size = 20, color = "#FFFFFF" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.9, color, fontWeight: "800", lineHeight: size }}>→</Text>
    </View>
  );
}

export function IconArrowLeft({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.9, color, fontWeight: "800", lineHeight: size }}>←</Text>
    </View>
  );
}

export function IconShieldCheck({ size = 18, color = "#16A34A" }: IconProps) {
  const w = Math.round(size * 0.85);
  const h = Math.round(size * 0.95);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderBottomLeftRadius: w / 2,
          borderBottomRightRadius: w / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ fontSize: size * 0.55, color, fontWeight: "900", marginTop: -2 }}>✓</Text>
      </View>
    </View>
  );
}

export function IconMail({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.88);
  const h = Math.round(size * 0.62);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 3.5,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "flex-start"
        }}
      >
        <Text style={{ fontSize: 9, color, fontWeight: "800", marginTop: -1 }}>▾</Text>
      </View>
    </View>
  );
}

export function IconSmartphone({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.58);
  const h = Math.round(size * 0.88);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 4,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 2
        }}
      >
        <View style={{ width: 4, height: 1.2, backgroundColor: color, borderRadius: 0.6 }} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconCheckCircle2({ size = 20, color = "#10B981" }: IconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center"
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={{ fontSize: size * 0.6, color: "#FFFFFF", fontWeight: "900" }}>✓</Text>
    </View>
  );
}

export function IconAlertCircle({ size = 16, color = "#DC2626" }: IconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center"
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={{ fontSize: size * 0.65, color, fontWeight: "900", marginTop: -1 }}>!</Text>
    </View>
  );
}

/**
 * Prominent circular lock badge displayed at the top of the login card
 */
export function IconPadlockShieldLarge({ size = 52 }: { size?: number }) {
  const shackleW = Math.round(size * 0.32);
  const shackleH = Math.round(size * 0.24);
  const bodyW = Math.round(size * 0.44);
  const bodyH = Math.round(size * 0.3);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#E0F2FE",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#0284C7",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 2
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <View
        style={{
          width: shackleW,
          height: shackleH,
          borderTopLeftRadius: shackleW / 2,
          borderTopRightRadius: shackleW / 2,
          borderWidth: 2.2,
          borderColor: "#1D4ED8",
          borderBottomWidth: 0,
          marginBottom: -1
        }}
      />
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderRadius: 4,
          borderWidth: 2.2,
          borderColor: "#1D4ED8",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2.4, height: 4, backgroundColor: "#1D4ED8", borderRadius: 1.2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: "center",
    justifyContent: "center"
  }
});
