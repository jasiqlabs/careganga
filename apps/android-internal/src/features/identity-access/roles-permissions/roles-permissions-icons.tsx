import React from "react";
import { View, StyleSheet, Text } from "react-native";

export interface IconProps {
  size?: number;
  color?: string;
}

// -------------------------------------------------------------
// Pure React Native Vector Icons for Mobile Roles & Permissions
// -------------------------------------------------------------

export function IconUsersTotal({ size = 18, color = "#2563EB" }: IconProps) {
  const r = Math.round(size * 0.28);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, marginBottom: 1 }} />
      <View style={{ width: Math.round(size * 0.76), height: Math.round(size * 0.38), borderTopLeftRadius: Math.round(size * 0.38), borderTopRightRadius: Math.round(size * 0.38), borderWidth: 1.6, borderColor: color, borderBottomWidth: 0 }} />
    </View>
  );
}

export function IconActionsKey({ size = 18, color = "#059669" }: IconProps) {
  const r = Math.round(size * 0.3);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 2.5, height: 2.5, borderRadius: 1.2, backgroundColor: color }} />
        </View>
        <View style={{ width: Math.round(size * 0.38), height: 1.8, backgroundColor: color, marginLeft: -1 }} />
      </View>
    </View>
  );
}

export function IconActiveCheck({ size = 18, color = "#16A34A" }: IconProps) {
  const r = Math.round(size * 0.45);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 4, height: 7, borderBottomWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: "45deg" }], marginTop: -2 }} />
      </View>
    </View>
  );
}

export function IconInactivePause({ size = 18, color = "#DC2626" }: IconProps) {
  const r = Math.round(size * 0.45);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ flexDirection: "row", gap: 2.5 }}>
          <View style={{ width: 2, height: 6, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: 2, height: 6, backgroundColor: color, borderRadius: 1 }} />
        </View>
      </View>
    </View>
  );
}

export function IconCustomLayers({ size = 18, color = "#9333EA" }: IconProps) {
  const w = Math.round(size * 0.78);
  const h = Math.round(size * 0.34);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, height: h, borderWidth: 1.5, borderColor: color, borderRadius: 2, marginBottom: 2 }} />
      <View style={{ width: w, height: h, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />
    </View>
  );
}

export function IconSystemShield({ size = 18, color = "#0F172A" }: IconProps) {
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

export const IconShield = IconSystemShield;

export function IconPlus({ size = 16, color = "#FFFFFF" }: IconProps) {
  const len = Math.round(size * 0.68);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: "absolute", width: len, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: "absolute", height: len, width: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function IconClock({ size = 16, color = "#0F172A" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", top: r * 0.32, width: 1.6, height: r * 0.68, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: "absolute", left: r - 1, width: r * 0.55, height: 1.6, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconDownload({ size = 16, color = "#0F172A" }: IconProps) {
  const w = Math.round(size * 0.72);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 1.8, height: Math.round(size * 0.45), backgroundColor: color, marginBottom: 1 }} />
      <View style={{ width: 5, height: 5, borderBottomWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: "45deg" }], marginTop: -4, marginBottom: 2 }} />
      <View style={{ width: w, height: 5, borderBottomWidth: 1.8, borderLeftWidth: 1.8, borderRightWidth: 1.8, borderColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
}

export function IconSearch({ size = 18, color = "#64748B" }: IconProps) {
  const circleSize = Math.round(size * 0.6);
  const handleLength = Math.round(size * 0.3);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2, borderWidth: 1.8, borderColor: color, marginTop: -2, marginLeft: -2 }} />
      <View style={{ position: "absolute", right: 2, bottom: 2, width: handleLength, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

export function IconFilter({ size = 18, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
      <View style={{ width: 9, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
      <View style={{ width: 4, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function IconCalendar({ size = 18, color = "#64748B" }: IconProps) {
  const w = Math.round(size * 0.78);
  const h = Math.round(size * 0.72);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ flexDirection: "row", justifyContent: "space-between", width: w - 4, marginBottom: -1 }}>
        <View style={{ width: 2, height: 3, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 2, height: 3, backgroundColor: color, borderRadius: 1 }} />
      </View>
      <View style={{ width: w, height: h, borderWidth: 1.6, borderColor: color, borderRadius: 3, paddingTop: 3, alignItems: "center" }}>
        <View style={{ width: w - 2, height: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconChevronRight({ size = 16, color = "#94A3B8" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 6, height: 6, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

export function IconChevronDown({ size = 16, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 6, height: 6, borderBottomWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

export function IconChevronUp({ size = 16, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 6, height: 6, borderTopWidth: 2, borderLeftWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

export function IconCollapseAll({ size = 16, color = "#64748B" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: 13, fontWeight: "700", color, marginTop: -2 }}>≈</Text>
    </View>
  );
}

export function IconCheck({ size = 14, color = "#FFFFFF" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 4, height: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginTop: -2 }} />
    </View>
  );
}

export function IconCheckCircle({ size = 18, color = "#10B981" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 4.5, height: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginTop: -2 }} />
      </View>
    </View>
  );
}

export function IconShieldAlert({ size = 20, color = "#1D4ED8" }: IconProps) {
  const w = Math.round(size * 0.72);
  const h = Math.round(size * 0.84);
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
          borderWidth: 1.8,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2, height: 6, backgroundColor: color, borderRadius: 1, marginBottom: 1.5 }} />
        <View style={{ width: 2, height: 2, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconLock({ size = 16, color = "#94A3B8" }: IconProps) {
  const w = Math.round(size * 0.65);
  const h = Math.round(size * 0.48);
  const shackleW = Math.round(w * 0.62);
  const shackleH = Math.round(size * 0.35);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: shackleW,
          height: shackleH,
          borderTopLeftRadius: shackleW / 2,
          borderTopRightRadius: shackleW / 2,
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0,
          marginBottom: -1
        }}
      />
      <View
        style={{
          width: w,
          height: h,
          borderRadius: 2.5,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2, height: 2.5, backgroundColor: "#FFFFFF", borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function IconEye({ size = 18, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 14, height: 8, borderRadius: 4, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 3.5, height: 3.5, borderRadius: 1.8, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconPencil({ size = 18, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 3.5, height: 11, borderWidth: 1.5, borderColor: color, borderRadius: 1, transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

export function IconCopy({ size = 18, color = "#0F172A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: "absolute", top: 1, left: 1, width: 10, height: 10, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderWidth: 1.5, borderColor: color, borderRadius: 2, backgroundColor: "#FFFFFF" }} />
    </View>
  );
}

export function IconBan({ size = 18, color = "#64748B" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: r * 1.5, height: 1.8, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
      </View>
    </View>
  );
}

export function IconClose({ size = 18, color = "#64748B" }: IconProps) {
  const len = Math.round(size * 0.68);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: "absolute", width: len, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", width: len, height: 1.8, backgroundColor: color, borderRadius: 1, transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

export function IconInfo({ size = 18, color = "#1D4ED8" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.8, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color, marginBottom: 1.5 }} />
        <View style={{ width: 2, height: 5, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// Form Controls: Checkbox & Radio
// -------------------------------------------------------------

export function IconCheckboxChecked({ size = 20 }: { size?: number }) {
  return (
    <View style={[styles.checkboxBase, styles.checkboxChecked, { width: size, height: size }]}>
      <View style={{ width: 4.5, height: 8.5, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#FFFFFF", transform: [{ rotate: "45deg" }], marginTop: -2 }} />
    </View>
  );
}

export function IconCheckboxUnchecked({ size = 20 }: { size?: number }) {
  return <View style={[styles.checkboxBase, styles.checkboxUnchecked, { width: size, height: size }]} />;
}

export function IconRadioChecked({ size = 20 }: { size?: number }) {
  const r = size / 2;
  return (
    <View style={[styles.radioBase, { width: size, height: size, borderRadius: r, borderColor: "#1D4ED8" }]}>
      <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: "#1D4ED8" }} />
    </View>
  );
}

export function IconRadioUnchecked({ size = 20 }: { size?: number }) {
  const r = size / 2;
  return <View style={[styles.radioBase, { width: size, height: size, borderRadius: r, borderColor: "#CBD5E1" }]} />;
}

// -------------------------------------------------------------
// Accordion Category Icons (Screen 8)
// -------------------------------------------------------------

export function IconCategoryRoles({ size = 18, color = "#1D4ED8" }: IconProps) {
  return <IconUsersTotal size={size} color={color} />;
}

export function IconCategoryAccounts({ size = 18, color = "#059669" }: IconProps) {
  const w = Math.round(size * 0.72);
  const h = Math.round(size * 0.55);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 7, height: 6, borderTopLeftRadius: 3.5, borderTopRightRadius: 3.5, borderWidth: 1.6, borderColor: color, borderBottomWidth: 0, marginBottom: -1 }} />
      <View style={{ width: w, height: h, borderWidth: 1.6, borderColor: color, borderRadius: 2 }} />
    </View>
  );
}

export function IconCategorySecurity({ size = 18, color = "#0284C7" }: IconProps) {
  return <IconSystemShield size={size} color={color} />;
}

export function IconCategoryFinance({ size = 18, color = "#D97706" }: IconProps) {
  const w = Math.round(size * 0.65);
  const h = Math.round(size * 0.82);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, height: h, borderWidth: 1.6, borderColor: color, borderRadius: 2, padding: 2, gap: 2 }}>
        <View style={{ width: w - 6, height: 1.5, backgroundColor: color }} />
        <View style={{ width: w - 8, height: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function IconCategoryWebsite({ size = 18, color = "#7C3AED" }: IconProps) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: 1.6, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: r * 2, height: 1.5, backgroundColor: color }} />
        <View style={{ width: r * 1.1, height: r * 2, borderRadius: r, borderWidth: 1.5, borderColor: color }} />
      </View>
    </View>
  );
}

export function IconCategoryApprovals({ size = 18, color = "#16A34A" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 14, height: 14, borderWidth: 1.6, borderColor: color, borderRadius: 2.5, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 3.5, height: 6.5, borderBottomWidth: 1.8, borderRightWidth: 1.8, borderColor: color, transform: [{ rotate: "45deg" }], marginTop: -1 }} />
      </View>
    </View>
  );
}

export function IconCategoryMembers({ size = 18, color = "#2563EB" }: IconProps) {
  return <IconUsersTotal size={size} color={color} />;
}

export function IconCategoryVolunteers({ size = 18, color = "#EC4899" }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: 12, height: 12, transform: [{ rotate: "-45deg" }], alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2 }} />
        <View style={{ position: "absolute", top: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <View style={{ position: "absolute", right: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxBase: {
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxChecked: {
    backgroundColor: "#1D4ED8",
    borderWidth: 1.5,
    borderColor: "#1D4ED8"
  },
  checkboxUnchecked: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1"
  },
  radioBase: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  }
});
