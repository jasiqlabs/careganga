import React from "react";
import { View, StyleSheet } from "react-native";

export interface IconProps {
  size?: number;
  color?: string;
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center"
  }
});

/**
 * Premium Lucide-compatible pure React Native vector icons.
 * Consistent 1.8px - 2.0px stroke weights, crisp geometry, zero external dependencies.
 */

export function IconSearch({ size = 20, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.58);
  const handle = Math.round(size * 0.32);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r,
          height: r,
          borderRadius: r / 2,
          borderWidth: 1.8,
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
          width: handle,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

/**
 * Clean Lucide Layers Icon:
 * 3 stacked isometric diamond planes with proper perspective.
 */
export function IconLayers({ size = 20, color = "#4F46E5" }: IconProps) {
  const w = Math.round(size * 0.76);
  const h = Math.round(size * 0.36);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Top Diamond */}
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.8,
          borderColor: color,
          borderRadius: 2,
          transform: [{ rotate: "45deg" }],
          marginTop: -6
        }}
      />
      {/* Middle Chevron */}
      <View
        style={{
          position: "absolute",
          top: size * 0.44,
          width: w * 0.85,
          height: h * 0.85,
          borderBottomWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          borderRadius: 1,
          transform: [{ rotate: "45deg" }]
        }}
      />
      {/* Bottom Chevron */}
      <View
        style={{
          position: "absolute",
          top: size * 0.62,
          width: w * 0.85,
          height: h * 0.85,
          borderBottomWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          borderRadius: 1,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

/**
 * Clean Lucide Hourglass Icon:
 * Top rim, symmetrical top and bottom bulbs, bottom rim.
 */
export function IconHourglass({ size = 20, color = "#D97706" }: IconProps) {
  const rimW = Math.round(size * 0.72);
  const halfH = Math.round(size * 0.35);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Top Rim */}
      <View style={{ width: rimW, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      {/* Upper Bulb */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: rimW / 2,
          borderRightWidth: rimW / 2,
          borderTopWidth: halfH,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          opacity: 0.85
        }}
      />
      {/* Lower Bulb */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: rimW / 2,
          borderRightWidth: rimW / 2,
          borderBottomWidth: halfH,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          opacity: 0.85
        }}
      />
      {/* Bottom Rim */}
      <View style={{ width: rimW, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

/**
 * Clean Lucide RefreshCw Icon:
 * Circular arrow with two synchronized curved arcs and crisp arrowheads.
 */
export function IconRefreshCw({ size = 20, color = "#0284C7" }: IconProps) {
  const r = Math.round(size * 0.72);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r,
          height: r,
          borderRadius: r / 2,
          borderWidth: 1.8,
          borderColor: color,
          borderTopColor: "transparent",
          borderBottomColor: "transparent"
        }}
      />
      {/* Top Right Arrow Head */}
      <View
        style={{
          position: "absolute",
          top: 2,
          right: 3,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderBottomWidth: 5,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
      {/* Bottom Left Arrow Head */}
      <View
        style={{
          position: "absolute",
          bottom: 2,
          left: 3,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderTopWidth: 5,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

/**
 * Clean Lucide CheckCircle Icon:
 * Outer circle with centered checkmark.
 */
export function IconCheckCircle({ size = 20, color = "#16A34A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View
          style={{
            width: size * 0.44,
            height: size * 0.22,
            borderLeftWidth: 1.8,
            borderBottomWidth: 1.8,
            borderColor: color,
            transform: [{ rotate: "-45deg" }],
            marginTop: -2
          }}
        />
      </View>
    </View>
  );
}

/**
 * Clean Lucide XCircle Icon:
 * Outer circle with centered X.
 */
export function IconXCircle({ size = 20, color = "#DC2626" }: IconProps) {
  const arm = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: arm, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
        <View style={{ position: "absolute", width: arm, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "-45deg" }] }} />
      </View>
    </View>
  );
}

/**
 * Clean Lucide Sliders (Filter) Icon:
 * 3 tracks with staggered slider knobs.
 */
export function IconSliders({ size = 20, color = "#64748B" }: IconProps) {
  const trackW = size * 0.8;
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      {/* Track 1 */}
      <View style={{ position: "absolute", top: size * 0.22, width: trackW, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", top: size * 0.12, left: size * 0.25, width: 4.5, height: 5.5, backgroundColor: color, borderRadius: 1.5 }} />

      {/* Track 2 */}
      <View style={{ position: "absolute", top: size * 0.48, width: trackW, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", top: size * 0.38, right: size * 0.25, width: 4.5, height: 5.5, backgroundColor: color, borderRadius: 1.5 }} />

      {/* Track 3 */}
      <View style={{ position: "absolute", top: size * 0.74, width: trackW, height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", top: size * 0.64, left: size * 0.4, width: 4.5, height: 5.5, backgroundColor: color, borderRadius: 1.5 }} />
    </View>
  );
}

export function IconArrowLeft({ size = 20, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.62, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{
          position: "absolute",
          left: 2,
          width: size * 0.32,
          height: size * 0.32,
          borderLeftWidth: 2,
          borderTopWidth: 2,
          borderColor: color,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconArrowRight({ size = 20, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.62, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{
          position: "absolute",
          right: 2,
          width: size * 0.32,
          height: size * 0.32,
          borderRightWidth: 2,
          borderTopWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconChevronRight({ size = 18, color = "#94A3B8" }: IconProps) {
  const arm = Math.round(size * 0.36);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: arm,
          height: arm,
          borderTopWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginLeft: -3
        }}
      />
    </View>
  );
}

export function IconChevronLeft({ size = 18, color = "#94A3B8" }: IconProps) {
  const arm = Math.round(size * 0.36);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: arm,
          height: arm,
          borderBottomWidth: 1.8,
          borderLeftWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginRight: -3
        }}
      />
    </View>
  );
}

export function IconChevronDown({ size = 18, color = "#64748B" }: IconProps) {
  const arm = Math.round(size * 0.36);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: arm,
          height: arm,
          borderBottomWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -3
        }}
      />
    </View>
  );
}

export function IconPlus({ size = 20, color = "#FFFFFF" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.68, height: 2.2, backgroundColor: color, borderRadius: 1.1 }} />
      <View style={{ position: "absolute", width: 2.2, height: size * 0.68, backgroundColor: color, borderRadius: 1.1 }} />
    </View>
  );
}

export function IconUser({ size = 20, color = "#64748B" }: IconProps) {
  const headSize = Math.round(size * 0.42);
  const bodyWidth = Math.round(size * 0.74);
  const bodyHeight = Math.round(size * 0.34);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
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

export function IconShield({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.72,
          height: size * 0.82,
          borderWidth: 1.8,
          borderColor: color,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderBottomLeftRadius: size * 0.36,
          borderBottomRightRadius: size * 0.36
        }}
      />
    </View>
  );
}

export function IconInfo({ size = 20, color = "#1D4ED8" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2.2, height: 2.2, borderRadius: 1.1, backgroundColor: color, marginBottom: 2 }} />
        <View style={{ width: 1.8, height: size * 0.36, backgroundColor: color, borderRadius: 0.9 }} />
      </View>
    </View>
  );
}

export function IconAlertTriangle({ size = 20, color = "#D97706" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.44,
          borderRightWidth: size * 0.44,
          borderBottomWidth: size * 0.76,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          borderRadius: 2
        }}
      />
      <View style={{ position: "absolute", top: size * 0.36, width: 2, height: size * 0.22, backgroundColor: "#FFFFFF", borderRadius: 1 }} />
      <View style={{ position: "absolute", bottom: size * 0.18, width: 2, height: 2, borderRadius: 1, backgroundColor: "#FFFFFF" }} />
    </View>
  );
}

export function IconEye({ size = 20, color = "#2563EB" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.82,
          height: size * 0.48,
          borderRadius: size * 0.3,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: size * 0.24, height: size * 0.24, borderRadius: size * 0.12, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconEyeOff({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <IconEye size={size} color={color} />
      <View
        style={{
          position: "absolute",
          width: size * 0.88,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconRotateCcw({ size = 18, color = "#D97706" }: IconProps) {
  const r = Math.round(size * 0.68);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r,
          height: r,
          borderRadius: r / 2,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomColor: "transparent"
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 1,
          left: 1,
          width: 0,
          height: 0,
          borderRightWidth: 4,
          borderBottomWidth: 4,
          borderTopWidth: 4,
          borderRightColor: color,
          borderBottomColor: "transparent",
          borderTopColor: "transparent"
        }}
      />
    </View>
  );
}

export function IconCheck({ size = 18, color = "#16A34A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.52,
          height: size * 0.26,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: "-45deg" }],
          marginTop: -2
        }}
      />
    </View>
  );
}

export function IconClose({ size = 18, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.65, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", width: size * 0.65, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

export function IconLock({ size = 20, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.48,
          height: size * 0.38,
          borderTopLeftRadius: size * 0.24,
          borderTopRightRadius: size * 0.24,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0,
          marginBottom: -1
        }}
      />
      <View
        style={{
          width: size * 0.72,
          height: size * 0.44,
          borderRadius: 3,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2, height: 3.5, backgroundColor: "#FFFFFF", borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconClock({ size = 18, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 1.8, height: size * 0.32, backgroundColor: color, borderRadius: 1, marginTop: -size * 0.1 }} />
        <View
          style={{
            position: "absolute",
            width: size * 0.24,
            height: 1.8,
            backgroundColor: color,
            borderRadius: 1,
            right: size * 0.22,
            top: size * 0.44
          }}
        />
      </View>
    </View>
  );
}

export function IconFileText({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.72);
  const h = Math.round(size * 0.88);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 3,
          borderWidth: 1.8,
          borderColor: color,
          padding: 3,
          gap: 2.5
        }}
      >
        <View style={{ width: "70%", height: 1.8, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: "85%", height: 1.8, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: "50%", height: 1.8, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}
