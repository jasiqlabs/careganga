import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { IconShieldCheck } from "./auth-icons";

interface SecureAccessFooterProps {
  onContactSupport?: () => void;
}

export function SecureAccessFooter({ onContactSupport }: SecureAccessFooterProps) {
  return (
    <View style={styles.container}>
      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <View style={styles.badgeContainer}>
          <IconShieldCheck size={16} color="#16A34A" />
          <Text style={styles.badgeText}>Secure Access</Text>
        </View>
        <View style={styles.dividerLine} />
      </View>

      {/* Security Statement */}
      <Text style={styles.subtext}>
        Your information is protected with industry-standard security.
      </Text>

      {/* Support Link */}
      <View style={styles.supportRow}>
        <Text style={styles.supportPrefix}>Need Help? </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Contact Support"
          onPress={onContactSupport}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.supportLink}>Contact Support</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 20,
    width: "100%"
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 10
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0"
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.2
  },
  subtext: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8
  },
  supportPrefix: {
    fontSize: 12.5,
    color: "#64748B",
    fontWeight: "500"
  },
  supportLink: {
    fontSize: 12.5,
    color: "#1D4ED8",
    fontWeight: "700"
  }
});
