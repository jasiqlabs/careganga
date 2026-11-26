import React from "react";
import { View, StyleSheet, Text } from "react-native";

export interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Premium Lucide-compatible vector icons for CareGanga Foundation Internal Android.
 * Pure React Native component implementation for 100% reliability across all Android devices and Expo runtimes.
 */

export function IconMenu({ size = 22, color = "#FFFFFF" }: IconProps) {
  const barWidth = Math.round(size * 0.85);
  const barHeight = Math.max(2, Math.round(size * 0.09));
  const barSpacing = Math.round(size * 0.18);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: barHeight / 2, marginBottom: barSpacing }} />
      <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: barHeight / 2, marginBottom: barSpacing }} />
      <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: barHeight / 2 }} />
    </View>
  );
}

export function IconSearch({ size = 20, color = "#FFFFFF" }: IconProps) {
  const circleSize = Math.round(size * 0.6);
  const handleLength = Math.round(size * 0.32);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderWidth: 2,
          borderColor: color,
          marginTop: -2,
          marginLeft: -2
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 2,
          bottom: 2,
          width: handleLength,
          height: 2.2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconBell({ size = 20, color = "#FFFFFF", hasBadge = false }: IconProps & { hasBadge?: boolean }) {
  const domeWidth = Math.round(size * 0.64);
  const domeHeight = Math.round(size * 0.58);
  const rimWidth = Math.round(size * 0.82);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 3, height: 2.5, backgroundColor: color, borderRadius: 1.5, marginBottom: -1 }} />
      <View
        style={{
          width: domeWidth,
          height: domeHeight,
          borderTopLeftRadius: domeWidth / 2,
          borderTopRightRadius: domeWidth / 2,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0
        }}
      />
      <View style={{ width: rimWidth, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 4, height: 2.5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: color, marginTop: 1 }} />
      {hasBadge && (
        <View
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: "#EF4444",
            borderWidth: 1.2,
            borderColor: "#03132B"
          }}
        />
      )}
    </View>
  );
}

export function IconClose({ size = 20, color = "#FFFFFF" }: IconProps) {
  const lineLength = Math.round(size * 0.75);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          position: "absolute",
          width: lineLength,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: "45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          width: lineLength,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconHome({ size = 20, color = "#64748B" }: IconProps) {
  const roofW = Math.round(size * 0.85);
  const bodyW = Math.round(size * 0.65);
  const bodyH = Math.round(size * 0.45);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Roof chevron */}
      <View
        style={{
          width: roofW * 0.7,
          height: roofW * 0.7,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderColor: color,
          borderRadius: 2,
          transform: [{ rotate: "45deg" }],
          marginTop: 2
        }}
      />
      {/* House body */}
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderWidth: 1.8,
          borderColor: color,
          borderTopWidth: 0,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          marginTop: -roofW * 0.28,
          alignItems: "center",
          justifyContent: "flex-end"
        }}
      >
        <View style={{ width: bodyW * 0.38, height: bodyH * 0.6, backgroundColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
      </View>
    </View>
  );
}

export function IconUser({ size = 20, color = "#64748B" }: IconProps) {
  const headSize = Math.round(size * 0.36);
  const bodyW = Math.round(size * 0.65);
  const bodyH = Math.round(size * 0.34);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ alignItems: "center" }}>
        <View style={{ width: headSize, height: headSize, borderRadius: headSize / 2, borderWidth: 1.8, borderColor: color, marginBottom: 1.5 }} />
        <View style={{ width: bodyW, height: bodyH, borderTopLeftRadius: bodyW / 2, borderTopRightRadius: bodyW / 2, borderWidth: 1.8, borderColor: color, borderBottomWidth: 0 }} />
      </View>
    </View>
  );
}

export function IconUsers({ size = 20, color = "#64748B" }: IconProps) {
  const headSize = Math.round(size * 0.34);
  const bodyW = Math.round(size * 0.55);
  const bodyH = Math.round(size * 0.3);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {/* Main User */}
        <View style={{ alignItems: "center", zIndex: 2 }}>
          <View style={{ width: headSize, height: headSize, borderRadius: headSize / 2, borderWidth: 1.8, borderColor: color, marginBottom: 1 }} />
          <View style={{ width: bodyW, height: bodyH, borderTopLeftRadius: bodyW / 2, borderTopRightRadius: bodyW / 2, borderWidth: 1.8, borderColor: color, borderBottomWidth: 0 }} />
        </View>
        {/* Secondary user behind */}
        <View style={{ alignItems: "center", marginLeft: -5, marginBottom: 2, opacity: 0.85 }}>
          <View style={{ width: headSize * 0.8, height: headSize * 0.8, borderRadius: (headSize * 0.8) / 2, borderWidth: 1.6, borderColor: color, marginBottom: 1 }} />
          <View style={{ width: bodyW * 0.75, height: bodyH * 0.8, borderTopLeftRadius: (bodyW * 0.75) / 2, borderTopRightRadius: (bodyW * 0.75) / 2, borderWidth: 1.6, borderColor: color, borderBottomWidth: 0 }} />
        </View>
      </View>
    </View>
  );
}

export function IconShield({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.78);
  const h = Math.round(size * 0.88);

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
      />
    </View>
  );
}

export function IconShieldCheck({ size = 20, color = "#16A34A" }: IconProps) {
  const w = Math.round(size * 0.82);
  const h = Math.round(size * 0.92);

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
        <Text style={{ fontSize: size * 0.52, color, fontWeight: "900", marginTop: -1 }}>✓</Text>
      </View>
    </View>
  );
}

export function IconLock({ size = 20, color = "#64748B" }: IconProps) {
  const shackleW = Math.round(size * 0.48);
  const shackleH = Math.round(size * 0.36);
  const bodyW = Math.round(size * 0.72);
  const bodyH = Math.round(size * 0.48);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: shackleW,
          height: shackleH,
          borderTopLeftRadius: shackleW / 2,
          borderTopRightRadius: shackleW / 2,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0,
          marginBottom: -1
        }}
      />
      <View
        style={{
          width: bodyW,
          height: bodyH,
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

export function IconApprovals({ size = 20, color = "#64748B" }: IconProps) {
  const clipW = Math.round(size * 0.68);
  const clipH = Math.round(size * 0.82);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Top Clip Tab */}
      <View style={{ width: clipW * 0.45, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: color, marginBottom: -1.5, zIndex: 2 }} />
      {/* Board */}
      <View
        style={{
          width: clipW,
          height: clipH,
          borderRadius: 3.5,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 2
        }}
      >
        <Text style={{ fontSize: size * 0.48, color, fontWeight: "900" }}>✓</Text>
      </View>
    </View>
  );
}

export function IconFileText({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.68);
  const h = Math.round(size * 0.84);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 3.5,
          borderWidth: 1.8,
          borderColor: color,
          padding: 3,
          justifyContent: "center",
          gap: 2.5
        }}
      >
        <View style={{ width: "75%", height: 1.6, backgroundColor: color, borderRadius: 0.8 }} />
        <View style={{ width: "85%", height: 1.6, backgroundColor: color, borderRadius: 0.8 }} />
        <View style={{ width: "55%", height: 1.6, backgroundColor: color, borderRadius: 0.8 }} />
      </View>
    </View>
  );
}

export function IconCoins({ size = 20, color = "#64748B" }: IconProps) {
  const coinW = Math.round(size * 0.66);
  const coinH = Math.round(size * 0.28);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: coinW, height: coinH, borderRadius: coinH / 2, borderWidth: 1.6, borderColor: color, marginBottom: -2 }} />
      <View style={{ width: coinW, height: coinH, borderRadius: coinH / 2, borderWidth: 1.6, borderColor: color, marginBottom: -2 }} />
      <View style={{ width: coinW, height: coinH, borderRadius: coinH / 2, borderWidth: 1.6, borderColor: color }} />
    </View>
  );
}

export function IconReceipt({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.68);
  const h = Math.round(size * 0.84);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.8,
          borderColor: color,
          borderRadius: 3,
          paddingHorizontal: 3,
          paddingVertical: 4,
          justifyContent: "space-between"
        }}
      >
        <View style={{ width: "60%", height: 1.6, backgroundColor: color, borderRadius: 0.8 }} />
        <View style={{ width: "80%", height: 1.6, backgroundColor: color, borderRadius: 0.8 }} />
        <View style={{ width: "40%", height: 1.6, backgroundColor: color, borderRadius: 0.8 }} />
        <View style={{ width: "85%", height: 1.6, backgroundColor: color, borderRadius: 0.8, marginTop: 1 }} />
      </View>
    </View>
  );
}

export function IconBuilding({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.72);
  const h = Math.round(size * 0.84);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 2,
          padding: 2.5,
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <View style={{ flexDirection: "row", gap: 3 }}>
          <View style={{ width: 2.5, height: 2.5, backgroundColor: color, borderRadius: 0.5 }} />
          <View style={{ width: 2.5, height: 2.5, backgroundColor: color, borderRadius: 0.5 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 3 }}>
          <View style={{ width: 2.5, height: 2.5, backgroundColor: color, borderRadius: 0.5 }} />
          <View style={{ width: 2.5, height: 2.5, backgroundColor: color, borderRadius: 0.5 }} />
        </View>
        <View style={{ width: 4, height: 5, backgroundColor: color, borderTopLeftRadius: 1, borderTopRightRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconHelpCircle({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: (size * 0.85) / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text style={{ fontSize: size * 0.54, color, fontWeight: "900", marginTop: -1 }}>?</Text>
      </View>
    </View>
  );
}

export function IconMoreHorizontal({ size = 20, color = "#64748B" }: IconProps) {
  const dotSize = Math.max(3.5, Math.round(size * 0.18));

  return (
    <View style={[styles.iconBox, { width: size, height: size, flexDirection: "row", gap: 3.5 }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
    </View>
  );
}

export function IconChevronRight({ size = 18, color = "#94A3B8" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.85, color, fontWeight: "700", lineHeight: size }}>›</Text>
    </View>
  );
}

export function IconBarChart3({ size = 20, color = "#0284C7" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size, flexDirection: "row", alignItems: "flex-end", gap: 2.5 }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 3, height: size * 0.38, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: 3, height: size * 0.72, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: 3, height: size * 0.52, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: 3, height: size * 0.9, backgroundColor: color, borderRadius: 1.5 }} />
    </View>
  );
}

export function IconLayers({ size = 20, color = "#9333EA" }: IconProps) {
  const layerW = Math.round(size * 0.75);
  const layerH = Math.round(size * 0.35);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: layerW,
          height: layerH,
          borderRadius: 2,
          borderWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }, { scaleY: 0.55 }],
          marginBottom: -4
        }}
      />
      <View
        style={{
          width: layerW,
          height: layerH,
          borderRadius: 2,
          borderWidth: 1.8,
          borderColor: color,
          borderTopWidth: 0,
          borderRightWidth: 0,
          transform: [{ rotate: "45deg" }, { scaleY: 0.55 }]
        }}
      />
    </View>
  );
}

export function IconGrid({ size = 20, color = "#0284C7" }: IconProps) {
  const boxSize = Math.round(size * 0.35);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", gap: 2.5, marginBottom: 2.5 }}>
        <View style={{ width: boxSize, height: boxSize, borderRadius: 2, borderWidth: 1.6, borderColor: color }} />
        <View style={{ width: boxSize, height: boxSize, borderRadius: 2, borderWidth: 1.6, borderColor: color }} />
      </View>
      <View style={{ flexDirection: "row", gap: 2.5 }}>
        <View style={{ width: boxSize, height: boxSize, borderRadius: 2, borderWidth: 1.6, borderColor: color }} />
        <View style={{ width: boxSize, height: boxSize, borderRadius: 2, borderWidth: 1.6, borderColor: color }} />
      </View>
    </View>
  );
}

export function IconExternalLink({ size = 14, color = "#1D4ED8" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.95, color, fontWeight: "700", lineHeight: size }}>↗</Text>
    </View>
  );
}

export function IconLogOut({ size = 18, color = "#EF4444" }: IconProps) {
  const boxW = Math.round(size * 0.65);
  const boxH = Math.round(size * 0.82);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: boxW,
          height: boxH,
          borderRadius: 3,
          borderWidth: 1.8,
          borderColor: color,
          borderRightWidth: 0,
          alignSelf: "flex-start",
          justifyContent: "center"
        }}
      />
      <View style={{ position: "absolute", right: 1, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontSize: size * 0.7, color, fontWeight: "800", marginLeft: 4 }}>→</Text>
      </View>
    </View>
  );
}

export function IconKey({ size = 20, color = "#64748B" }: IconProps) {
  const headSize = Math.round(size * 0.45);

  return (
    <View style={[styles.iconBox, { width: size, height: size, flexDirection: "row", alignItems: "center" }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: headSize, height: headSize, borderRadius: headSize / 2, borderWidth: 1.8, borderColor: color }} />
      <View style={{ width: size * 0.4, height: 2, backgroundColor: color, marginLeft: -1 }} />
      <View style={{ width: 2, height: 4, backgroundColor: color, marginLeft: -3, marginTop: 3 }} />
    </View>
  );
}

export function IconMail({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.78);
  const h = Math.round(size * 0.58);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 3,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center"
        }}
      >
        <Text style={{ fontSize: 8, color, fontWeight: "800", marginTop: -2 }}>▾</Text>
      </View>
    </View>
  );
}

export function IconSend({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.85, color, fontWeight: "900", transform: [{ rotate: "-45deg" }], marginTop: -2 }}>➤</Text>
    </View>
  );
}

export function IconWallet({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.8);
  const h = Math.round(size * 0.6);

  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 3.5,
          borderWidth: 1.8,
          borderColor: color,
          justifyContent: "center",
          alignItems: "flex-end",
          paddingRight: 2
        }}
      >
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconSliders({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size, justifyContent: "space-around", paddingVertical: 2 }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.8, height: 2, backgroundColor: color, borderRadius: 1, alignItems: "flex-start" }}>
        <View style={{ width: 4, height: 6, backgroundColor: color, borderRadius: 1.5, marginTop: -2, marginLeft: 3 }} />
      </View>
      <View style={{ width: size * 0.8, height: 2, backgroundColor: color, borderRadius: 1, alignItems: "flex-end" }}>
        <View style={{ width: 4, height: 6, backgroundColor: color, borderRadius: 1.5, marginTop: -2, marginRight: 3 }} />
      </View>
    </View>
  );
}

export function IconMegaphone({ size = 20, color = "#64748B" }: IconProps) {
  const coneW = Math.round(size * 0.55);
  const coneH = Math.round(size * 0.45);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Back horn piece */}
        <View style={{ width: 3, height: coneH * 0.5, backgroundColor: color, borderRadius: 1 }} />
        {/* Cone body */}
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: coneH * 0.4,
            borderTopColor: "transparent",
            borderBottomWidth: coneH * 0.4,
            borderBottomColor: "transparent",
            borderRightWidth: coneW,
            borderRightColor: color,
            marginLeft: 1
          }}
        />
        {/* Front bell rim */}
        <View style={{ width: 2.5, height: coneH + 4, backgroundColor: color, borderRadius: 1.25, marginLeft: 1 }} />
      </View>
      {/* Handle */}
      <View
        style={{
          position: "absolute",
          bottom: 2,
          left: Math.round(size * 0.35),
          width: 2.5,
          height: Math.round(size * 0.3),
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: "-20deg" }]
        }}
      />
    </View>
  );
}

export function IconCalendar({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.75);
  const h = Math.round(size * 0.7);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Top pins */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: w * 0.6, marginBottom: -2, zIndex: 1 }}>
        <View style={{ width: 2, height: 3.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 2, height: 3.5, backgroundColor: color, borderRadius: 1 }} />
      </View>
      {/* Calendar body */}
      <View style={{ width: w, height: h, borderWidth: 1.8, borderColor: color, borderRadius: 3.5, overflow: "hidden" }}>
        <View style={{ width: "100%", height: 3.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconRefresh({ size = 20, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.65);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r,
          height: r,
          borderRadius: r / 2,
          borderWidth: 2,
          borderColor: color,
          borderTopColor: "transparent",
          transform: [{ rotate: "45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 2,
          right: Math.round(size * 0.2),
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderLeftColor: "transparent",
          borderRightWidth: 3,
          borderRightColor: "transparent",
          borderBottomWidth: 4,
          borderBottomColor: color,
          transform: [{ rotate: "35deg" }]
        }}
      />
    </View>
  );
}

export function IconInbox({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.8);
  const h = Math.round(size * 0.65);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, height: h, borderWidth: 1.8, borderColor: color, borderRadius: 3.5, justifyContent: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", width: "100%", height: Math.round(h * 0.4) }}>
          <View style={{ flex: 1, height: 1.8, backgroundColor: color }} />
          <View style={{ width: Math.round(w * 0.35), height: 3.5, borderWidth: 1.8, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
          <View style={{ flex: 1, height: 1.8, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

export function IconPlusCircle({ size = 20, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.85);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r, height: r, borderRadius: r / 2, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: Math.round(r * 0.5), height: 1.8, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: "absolute", height: Math.round(r * 0.5), width: 1.8, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconCheckCircle({ size = 20, color = "#16A34A" }: IconProps) {
  const r = Math.round(size * 0.85);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r, height: r, borderRadius: r / 2, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: Math.round(r * 0.28),
            height: Math.round(r * 0.45),
            borderBottomWidth: 1.8,
            borderRightWidth: 1.8,
            borderColor: color,
            transform: [{ rotate: "45deg" }],
            marginTop: -2,
            marginLeft: 1
          }}
        />
      </View>
    </View>
  );
}

export function IconXCircle({ size = 20, color = "#EF4444" }: IconProps) {
  const r = Math.round(size * 0.85);
  const l = Math.round(r * 0.45);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r, height: r, borderRadius: r / 2, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: l, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
        <View style={{ position: "absolute", width: l, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "-45deg" }] }} />
      </View>
    </View>
  );
}

export function IconBarChart2({ size = 20, color = "#64748B" }: IconProps) {
  const h = Math.round(size * 0.7);
  return (
    <View style={[styles.iconBox, { width: size, height: size, flexDirection: "row", alignItems: "flex-end", gap: 2.5, paddingBottom: 2 }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 2.5, height: h * 0.4, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 2.5, height: h * 0.95, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 2.5, height: h * 0.65, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function IconSmartphone({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.55);
  const h = Math.round(size * 0.8);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, height: h, borderWidth: 1.8, borderColor: color, borderRadius: 3.5, alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}>
        <View style={{ width: 4, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, borderWidth: 1, borderColor: color }} />
      </View>
    </View>
  );
}

export function IconClock({ size = 20, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.8);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r, height: r, borderRadius: r / 2, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: 1.8, height: r * 0.35, backgroundColor: color, top: r * 0.15, borderRadius: 1 }} />
        <View style={{ position: "absolute", height: 1.8, width: r * 0.28, backgroundColor: color, right: r * 0.2, top: r * 0.45, borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconCheck({ size = 20, color = "#16A34A" }: IconProps) {
  const w = Math.round(size * 0.35);
  const h = Math.round(size * 0.6);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderBottomWidth: 2,
          borderRightWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -3,
          marginLeft: 1
        }}
      />
    </View>
  );
}

export function IconFilter({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size, alignItems: "center" }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.75, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 2.5 }} />
      <View style={{ width: size * 0.5, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 2.5 }} />
      <View style={{ width: size * 0.25, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function IconChevronDown({ size = 18, color = "#64748B" }: IconProps) {
  const s = Math.round(size * 0.35);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: s,
          height: s,
          borderBottomWidth: 2,
          borderRightWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -2
        }}
      />
    </View>
  );
}

export function IconArrowLeft({ size = 20, color = "#334155" }: IconProps) {
  const stemW = Math.round(size * 0.55);
  const headS = Math.round(size * 0.32);
  return (
    <View style={[styles.iconBox, { width: size, height: size, flexDirection: "row", alignItems: "center" }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Arrow head */}
      <View
        style={{
          width: headS,
          height: headS,
          borderLeftWidth: 2,
          borderTopWidth: 2,
          borderColor: color,
          transform: [{ rotate: "-45deg" }],
          marginLeft: 2
        }}
      />
      {/* Stem */}
      <View
        style={{
          width: stemW,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          marginLeft: -headS * 0.5
        }}
      />
    </View>
  );
}

export function IconFolder({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.8);
  const h = Math.round(size * 0.6);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Folder tab */}
      <View
        style={{
          width: w * 0.45,
          height: 3,
          backgroundColor: color,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          alignSelf: "flex-start",
          marginLeft: Math.round(size * 0.1),
          marginBottom: -1
        }}
      />
      {/* Folder body */}
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.8,
          borderColor: color,
          borderRadius: 3.5
        }}
      />
    </View>
  );
}

export function IconPhone({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: Math.round(size * 0.7),
          height: Math.round(size * 0.7),
          borderWidth: 2,
          borderColor: color,
          borderRadius: Math.round(size * 0.22),
          borderTopRightRadius: 2,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconPencil({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: Math.round(size * 0.75),
          height: Math.round(size * 0.25),
          borderWidth: 1.8,
          borderColor: color,
          borderRadius: 2,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconDownload({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 2, height: Math.round(size * 0.5), backgroundColor: color, marginBottom: -2 }} />
      <View
        style={{
          width: Math.round(size * 0.35),
          height: Math.round(size * 0.35),
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -Math.round(size * 0.15)
        }}
      />
      <View
        style={{
          width: Math.round(size * 0.75),
          height: 2,
          backgroundColor: color,
          marginTop: 4
        }}
      />
    </View>
  );
}

export function IconMapPin({ size = 20, color = "#64748B" }: IconProps) {
  const pinSize = Math.round(size * 0.55);
  return (
    <View style={[styles.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: pinSize,
          height: pinSize,
          borderRadius: pinSize / 2,
          borderWidth: 2,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderTopWidth: 5,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          marginTop: -1
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: "center",
    justifyContent: "center"
  }
});
