import React from "react";
import { View, StyleSheet, Text } from "react-native";

export interface IconProps {
  size?: number;
  color?: string;
  style?: object;
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
});

export function IconSearch({ size = 18, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.32);
  const handleLen = Math.round(size * 0.3);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.8,
          borderColor: color,
          marginTop: -2,
          marginLeft: -2
        }}
      />
      <View
        style={{
          position: "absolute",
          width: handleLen,
          height: 1.8,
          backgroundColor: color,
          bottom: 2,
          right: 2,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconClose({ size = 18, color = "#64748B" }: IconProps) {
  const len = Math.round(size * 0.65);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: "absolute", width: len, height: 1.8, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", width: len, height: 1.8, backgroundColor: color, transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

export const IconX = IconClose;

export function IconSlidersHorizontal({ size = 18, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.8, height: 1.5, backgroundColor: color, marginBottom: 3, borderRadius: 1 }} />
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: "absolute", left: size * 0.25, top: size * 0.2 }} />
      <View style={{ width: size * 0.8, height: 1.5, backgroundColor: color, marginBottom: 3, borderRadius: 1 }} />
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: "absolute", right: size * 0.25, top: size * 0.45 }} />
      <View style={{ width: size * 0.8, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, position: "absolute", left: size * 0.45, bottom: size * 0.2 }} />
    </View>
  );
}

export function IconRotateCcw({ size = 18, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.38);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.8,
          borderColor: color,
          borderTopColor: "transparent"
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 1,
          left: 1,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderBottomWidth: 4,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export const IconRefreshCw = IconRotateCcw;

export function IconUsers({ size = 18, color = "#2563EB" }: IconProps) {
  const r = Math.round(size * 0.26);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, marginBottom: 1 }} />
      <View
        style={{
          width: Math.round(size * 0.72),
          height: Math.round(size * 0.36),
          borderTopLeftRadius: Math.round(size * 0.36),
          borderTopRightRadius: Math.round(size * 0.36),
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0
        }}
      />
    </View>
  );
}

export function IconUserCheck({ size = 18, color = "#059669" }: IconProps) {
  const r = Math.round(size * 0.24);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, marginBottom: 1 }} />
      <View
        style={{
          width: Math.round(size * 0.62),
          height: Math.round(size * 0.32),
          borderTopLeftRadius: Math.round(size * 0.32),
          borderTopRightRadius: Math.round(size * 0.32),
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 1,
          width: 3.5,
          height: 6,
          borderBottomWidth: 1.6,
          borderRightWidth: 1.6,
          borderColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconUserX({ size = 18, color = "#E11D48" }: IconProps) {
  const r = Math.round(size * 0.24);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, marginBottom: 1 }} />
      <View
        style={{
          width: Math.round(size * 0.62),
          height: Math.round(size * 0.32),
          borderTopLeftRadius: Math.round(size * 0.32),
          borderTopRightRadius: Math.round(size * 0.32),
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 1,
          bottom: 2,
          width: 5,
          height: 1.5,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 1,
          bottom: 2,
          width: 5,
          height: 1.5,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconHourglass({ size = 18, color = "#7C3AED" }: IconProps) {
  const w = Math.round(size * 0.58);
  const h = Math.round(size * 0.72);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, height: 1.8, backgroundColor: color }} />
      <View
        style={{
          width: w,
          height: h - 3.6,
          borderLeftWidth: 1.6,
          borderRightWidth: 1.6,
          borderColor: color,
          borderRadius: 2
        }}
      />
      <View style={{ width: w, height: 1.8, backgroundColor: color }} />
    </View>
  );
}

export function IconTrendingUp({ size = 18, color = "#0891B2" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderRightWidth: 1.8,
          borderTopWidth: 1.8,
          borderColor: color
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.7,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }]
        }}
      />
    </View>
  );
}

export function IconClipboardList({ size = 18, color = "#D97706" }: IconProps) {
  const w = Math.round(size * 0.65);
  const h = Math.round(size * 0.82);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.6,
          borderColor: color,
          borderRadius: 3,
          paddingHorizontal: 2,
          paddingTop: 4,
          gap: 2
        }}
      >
        <View style={{ width: "80%", height: 1.4, backgroundColor: color }} />
        <View style={{ width: "60%", height: 1.4, backgroundColor: color }} />
        <View style={{ width: "70%", height: 1.4, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconMail({ size = 16, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.85);
  const h = Math.round(size * 0.62);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.6,
          borderColor: color,
          borderRadius: 3,
          overflow: "hidden"
        }}
      >
        <View
          style={{
            width: w * 0.68,
            height: w * 0.68,
            borderBottomWidth: 1.4,
            borderRightWidth: 1.4,
            borderColor: color,
            transform: [{ rotate: "45deg" }],
            marginTop: -w * 0.45,
            alignSelf: "center"
          }}
        />
      </View>
    </View>
  );
}

export function IconPhone({ size = 16, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.52);
  const h = Math.round(size * 0.85);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.6,
          borderColor: color,
          borderRadius: 4,
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

export function IconCalendar({ size = 16, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.78);
  const h = Math.round(size * 0.78);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.6,
          borderColor: color,
          borderRadius: 3,
          marginTop: 2
        }}
      >
        <View style={{ width: "100%", height: 3, borderBottomWidth: 1.4, borderColor: color }} />
      </View>
      <View style={{ position: "absolute", top: 1, left: size * 0.28, width: 1.6, height: 3, backgroundColor: color }} />
      <View style={{ position: "absolute", top: 1, right: size * 0.28, width: 1.6, height: 3, backgroundColor: color }} />
    </View>
  );
}

export function IconClock({ size = 16, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.42);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.6,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ position: "absolute", top: r * 0.35, width: 1.5, height: r * 0.65, backgroundColor: color }} />
        <View style={{ position: "absolute", left: r - 1, width: r * 0.55, height: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconShield({ size = 16, color = "#0F172A" }: IconProps) {
  const w = Math.round(size * 0.72);
  const h = Math.round(size * 0.82);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderBottomLeftRadius: w / 2,
          borderBottomRightRadius: w / 2,
          borderWidth: 1.6,
          borderColor: color
        }}
      />
    </View>
  );
}

export function IconKey({ size = 16, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.26);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color }} />
        <View style={{ width: Math.round(size * 0.4), height: 1.8, backgroundColor: color, marginLeft: -1 }} />
      </View>
    </View>
  );
}

export function IconEdit({ size = 16, color = "#2563EB" }: IconProps) {
  const len = Math.round(size * 0.6);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: len,
          height: 2.2,
          borderWidth: 1.4,
          borderColor: color,
          borderRadius: 1,
          transform: [{ rotate: "-45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 2,
          left: 2,
          width: size * 0.6,
          height: 1.5,
          backgroundColor: color
        }}
      />
    </View>
  );
}

export function IconTrash2({ size = 16, color = "#DC2626" }: IconProps) {
  const w = Math.round(size * 0.62);
  const h = Math.round(size * 0.72);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w + 4, height: 1.6, backgroundColor: color, marginBottom: 1 }} />
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.6,
          borderColor: color,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3
        }}
      />
    </View>
  );
}

export function IconEye({ size = 16, color = "#2563EB" }: IconProps) {
  const w = Math.round(size * 0.85);
  const h = Math.round(size * 0.5);
  const pupil = Math.round(size * 0.22);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderRadius: h,
          borderWidth: 1.6,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: pupil * 2, height: pupil * 2, borderRadius: pupil, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconMoreVertical({ size = 16, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, marginVertical: 1.5 }} />
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, marginVertical: 1.5 }} />
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, marginVertical: 1.5 }} />
    </View>
  );
}

export function IconCopy({ size = 16, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.58);
  const h = Math.round(size * 0.68);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          position: "absolute",
          top: 1,
          left: 1,
          width: w,
          height: h,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 2
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 1,
          right: 1,
          width: w,
          height: h,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 2,
          backgroundColor: "#FFFFFF"
        }}
      />
    </View>
  );
}

export function IconCheck({ size = 16, color = "#16A34A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.35,
          height: size * 0.65,
          borderBottomWidth: 2,
          borderRightWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -size * 0.15
        }}
      />
    </View>
  );
}

export function IconCheckCircle({ size = 18, color = "#16A34A" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.6,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <IconCheck size={Math.round(size * 0.6)} color={color} />
      </View>
    </View>
  );
}

export function IconChevronDown({ size = 14, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderBottomWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -size * 0.2
        }}
      />
    </View>
  );
}

export function IconChevronLeft({ size = 16, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderBottomWidth: 1.8,
          borderLeftWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginLeft: size * 0.2
        }}
      />
    </View>
  );
}

export function IconChevronRight({ size = 16, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderTopWidth: 1.8,
          borderRightWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
          marginRight: size * 0.2
        }}
      />
    </View>
  );
}

export function IconArrowLeft({ size = 18, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.65, height: 1.8, backgroundColor: color }} />
      <View
        style={{
          position: "absolute",
          left: 2,
          width: size * 0.38,
          height: size * 0.38,
          borderLeftWidth: 1.8,
          borderBottomWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconArrowRight({ size = 16, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: size * 0.65, height: 1.8, backgroundColor: color }} />
      <View
        style={{
          position: "absolute",
          right: 2,
          width: size * 0.38,
          height: size * 0.38,
          borderRightWidth: 1.8,
          borderTopWidth: 1.8,
          borderColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

export function IconPlus({ size = 16, color = "#FFFFFF" }: IconProps) {
  const len = Math.round(size * 0.68);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: "absolute", width: len, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", height: len, width: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function IconFileText({ size = 20, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.68);
  const h = Math.round(size * 0.85);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 1.6,
          borderColor: color,
          borderRadius: 3,
          paddingHorizontal: 2,
          paddingTop: 3,
          gap: 2
        }}
      >
        <View style={{ width: "80%", height: 1.4, backgroundColor: color }} />
        <View style={{ width: "60%", height: 1.4, backgroundColor: color }} />
        <View style={{ width: "70%", height: 1.4, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconVerifiedBadge({ size = 17, color = "#2563EB" }: IconProps) {
  const r = Math.round(size * 0.45);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <IconCheck size={Math.round(size * 0.55)} color="#FFFFFF" />
      </View>
    </View>
  );
}

export function IconAlertTriangle({ size = 18, color = "#D97706" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.42,
          borderRightWidth: size * 0.42,
          borderBottomWidth: size * 0.74,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color
        }}
      />
      <View style={{ position: "absolute", width: 1.6, height: 4, backgroundColor: "#FFFFFF", top: size * 0.38 }} />
      <View style={{ position: "absolute", width: 1.8, height: 1.8, borderRadius: 0.9, backgroundColor: "#FFFFFF", bottom: size * 0.2 }} />
    </View>
  );
}

export function IconInfo({ size = 18, color = "#1D4ED8" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1.6,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 1.8, height: 1.8, borderRadius: 0.9, backgroundColor: color, marginBottom: 2 }} />
        <View style={{ width: 1.8, height: 5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconSend({ size = 14, color = "#FFFFFF" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.35,
          borderBottomWidth: size * 0.35,
          borderLeftWidth: size * 0.65,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: color
        }}
      />
    </View>
  );
}
