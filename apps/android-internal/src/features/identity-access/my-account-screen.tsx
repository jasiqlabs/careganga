import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CG01SessionView } from "@careganga/api-contracts";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import {
  IconShield,
  IconShieldCheck,
  IconLock,
  IconKey,
  IconLogOut
} from "../dashboard/dashboard-icons";

export interface MyAccountScreenProps {
  actor: CG01SessionView;
  token: string;
  roleActions: string[];
  onExit: () => void;
  onOpenChangePassword: () => void;
  onSignOut: () => void;
  onExpired: () => void;
}

/**
 * CareGanga Foundation Internal Android — My Account Screen
 * Provides parity with Web's `/admin` My Account page:
 * - Admin User Profile & Credentials
 * - Role & Administrative Privileges
 * - Security & Access Scope
 * - Direct Change Password and Sign Out actions
 */
export function MyAccountScreen({
  actor,
  roleActions,
  onExit,
  onOpenChangePassword,
  onSignOut
}: MyAccountScreenProps) {
  const initials = (actor.displayName || actor.roleName || "SA")
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={onExit}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            My account
          </Text>
        </View>

        <Text style={styles.subtitle}>
          Admin User Profile &amp; Credentials
        </Text>
        <Text style={styles.helperText}>
          Manage your administrator profile, view authorized governance scope, and update account security credentials.
        </Text>

        {/* Card 1: Identity & Profile Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>1. Personal Identity &amp; Profile</Text>

          <View style={styles.profileHeroRow}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>

            <View style={styles.profileMeta}>
              <Text style={styles.displayName}>{actor.displayName}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{actor.roleName}</Text>
                </View>
                <View style={styles.scopePill}>
                  <Text style={styles.scopePillText}>{actor.scope}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registered Name</Text>
            <Text style={styles.detailValue}>{actor.displayName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Assigned Role</Text>
            <Text style={styles.detailValue}>{actor.roleName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Organization Scope</Text>
            <Text style={styles.detailValue}>{actor.scope} Management</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Session</Text>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedText}>Active &amp; Verified</Text>
            </View>
          </View>
        </View>

        {/* Card 2: Role & Administrative Privileges */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>2. Role &amp; Administrative Privileges</Text>

          <View style={styles.privilegeSubcard}>
            <View style={styles.privilegeHeaderRow}>
              <IconShield size={18} color="#1E293B" />
              <Text style={styles.privilegeTitle}>
                {actor.roleName.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.privilegeDesc}>
              Authorized operational role within the CareGanga {actor.scope} administrative domain.
            </Text>
            <View style={styles.privilegeStatsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{roleActions.length}</Text>
                <Text style={styles.statPillLabel}>Effective Capabilities</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>Enforced</Text>
                <Text style={styles.statPillLabel}>Server RBAC</Text>
              </View>
            </View>
          </View>

          <View style={styles.privilegeSubcard}>
            <View style={styles.privilegeHeaderRow}>
              <IconShieldCheck size={18} color="#16A34A" />
              <Text style={[styles.privilegeTitle, { color: "#16A34A" }]}>
                Verified Active Session
              </Text>
            </View>
            <Text style={styles.privilegeDesc}>
              Multi-factor token authentication active. Password change and session revoking can be triggered anytime.
            </Text>
          </View>
        </View>

        {/* Card 3: Security & Credentials */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>3. Account Security &amp; Credentials</Text>

          <View style={styles.actionRow}>
            <View style={styles.actionIconBox}>
              <IconKey size={20} color="#1D4ED8" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Account Password</Text>
              <Text style={styles.actionDesc}>
                Update your staff account password and credentials.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change Account Password"
              onPress={onOpenChangePassword}
              style={styles.changePasswordButton}
            >
              <Text style={styles.changePasswordButtonText}>Change</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.actionRow}>
            <View style={[styles.actionIconBox, { backgroundColor: "#FEF2F2" }]}>
              <IconLogOut size={20} color="#DC2626" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Sign Out</Text>
              <Text style={styles.actionDesc}>
                Securely revoke active session on this device.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
              onPress={onSignOut}
              style={styles.signOutButton}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: careGangaTheme.background
  },
  content: {
    padding: 18,
    paddingBottom: 48,
    gap: 14,
    maxWidth: 640,
    alignSelf: "center",
    width: "100%"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: careGangaTheme.surface,
    borderWidth: 1,
    borderColor: careGangaTheme.border,
    alignItems: "center",
    justifyContent: "center"
  },
  backButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: careGangaTheme.text
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: careGangaTheme.text,
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: careGangaTheme.text,
    marginTop: -4
  },
  helperText: {
    fontSize: 12.5,
    color: careGangaTheme.mutedText,
    lineHeight: 18,
    marginTop: -6
  },
  card: {
    backgroundColor: careGangaTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: careGangaTheme.border,
    padding: 16,
    gap: 12
  },
  cardHeaderTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: careGangaTheme.text,
    letterSpacing: -0.1
  },
  profileHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4
  },
  avatarBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1E53DC",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  profileMeta: {
    flex: 1,
    gap: 4
  },
  displayName: {
    fontSize: 17,
    fontWeight: "800",
    color: careGangaTheme.text
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  rolePill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D"
  },
  scopePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569"
  },
  divider: {
    height: 1,
    backgroundColor: careGangaTheme.border
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  detailLabel: {
    fontSize: 13,
    color: careGangaTheme.mutedText,
    fontWeight: "500"
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: careGangaTheme.text
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  verifiedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#22C55E"
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16A34A"
  },
  privilegeSubcard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 6
  },
  privilegeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  privilegeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: careGangaTheme.text
  },
  privilegeDesc: {
    fontSize: 12,
    color: careGangaTheme.mutedText,
    lineHeight: 16
  },
  privilegeStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  statPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center"
  },
  statPillValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E53DC"
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: careGangaTheme.mutedText
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  actionTextWrap: {
    flex: 1
  },
  actionTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: careGangaTheme.text
  },
  actionDesc: {
    fontSize: 11.5,
    color: careGangaTheme.mutedText,
    marginTop: 1
  },
  changePasswordButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1E53DC"
  },
  changePasswordButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  signOutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  signOutButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#DC2626"
  }
});
