import React, { useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CG03ProcessView, CG03CaseView } from "@careganga/api-contracts";
import {
  IconShield,
  IconLock,
  IconCheck,
  IconSliders,
  IconLayers,
  IconRefreshCw
} from "./registration-approvals-icons";
import { ProcessVersionSkeleton } from "./registration-approvals-skeletons";

export interface VersionProcessViewProps {
  route: CG03ProcessView | null;
  cases?: CG03CaseView[];
  loading?: boolean;
  canConfigure: boolean;
  busy: boolean;
  onOpenRouteForm: () => void;
  onRefresh?: () => void;
}

export function VersionProcessView({
  route,
  cases = [],
  loading = false,
  canConfigure,
  busy,
  onOpenRouteForm,
  onRefresh
}: VersionProcessViewProps) {
  const currentVersion = route?.version ?? (route?.active ? 1 : 0);

  // Compute version items from current active route and historical cases
  const versionHistory = useMemo(() => {
    if (!route || currentVersion <= 0) return [];

    const items: {
      version: number;
      versionLabel: string;
      title: string;
      description: string;
      route: string;
      status: "Active" | "Archived";
      applicationsCount: number;
    }[] = [];

    // 1. Current Active Version
    const activeRouteDesc = route.firstReviewer
      ? "Access Manager, then Super Admin"
      : "Different Super Admin only";
    const activeCasesCount = cases.filter(
      c => c.processVersion === currentVersion
    ).length;

    items.push({
      version: currentVersion,
      versionLabel: `v${currentVersion}`,
      title: "Active Configuration",
      description: "Protected role-change process",
      route: activeRouteDesc,
      status: "Active",
      applicationsCount: activeCasesCount
    });

    // 2. Previous Archived Versions
    for (let v = currentVersion - 1; v >= 1; v--) {
      const vCasesCount = cases.filter(c => c.processVersion === v).length;
      items.push({
        version: v,
        versionLabel: `v${v}`,
        title: `Version ${v}`,
        description: v === 1 ? "Initial approval route" : "Previous route revision",
        route: "Direct Super Admin review",
        status: "Archived",
        applicationsCount: vCasesCount
      });
    }

    return items;
  }, [route, currentVersion, cases]);

  if (loading) {
    return <ProcessVersionSkeleton />;
  }

  return (
    <View style={styles.container}>
      {/* 1. Current Active Process Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <IconShield size={20} color="#1E53DC" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Approval Process Workflow</Text>
              <Text style={styles.cardSubtitle}>
                {route?.active
                  ? `Active Version ${route.version}`
                  : "Starts with first eligible application"}
              </Text>
            </View>
          </View>
          {route?.active && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Steps List */}
        <View style={styles.stepsWrap}>
          {/* Step 1 */}
          <View style={styles.stepItem}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Initial Verification</Text>
              <Text style={styles.stepDesc}>
                {route?.firstReviewer
                  ? `Permitted access manager (${route.firstReviewer})`
                  : "Directly reviewed by Foundation Super Admin"}
              </Text>
            </View>
          </View>

          {/* Step 2 */}
          <View style={styles.stepItem}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Final Authorization</Text>
              <Text style={styles.stepDesc}>
                Different Foundation Super Admin (enforcing self-review prevention)
              </Text>
            </View>
          </View>

          {/* Security Gate */}
          <View style={styles.stepItem}>
            <View style={[styles.stepNumberBadge, styles.lockBadge]}>
              <IconLock size={12} color="#D97706" />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Security Verification</Text>
              <Text style={styles.stepDesc}>
                Current password confirmation required at decision time
              </Text>
            </View>
          </View>
        </View>

        {/* Configure Process Button */}
        {canConfigure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configure new process version"
            disabled={busy}
            onPress={onOpenRouteForm}
            style={({ pressed }) => [
              styles.configureBtn,
              pressed && styles.btnPressed
            ]}
          >
            <IconSliders size={16} color="#1E53DC" />
            <Text style={styles.configureBtnText}>Configure New Process Version</Text>
          </Pressable>
        )}
      </View>

      {/* 2. Process Version History Card (Restored with real data) */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBox, { backgroundColor: "#F5F3FF" }]}>
              <IconLayers size={20} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Process Version History</Text>
              <Text style={styles.cardSubtitle}>
                Audit trail of reviewer routes and workflow configuration
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {versionHistory.length === 0 ? (
          <View style={styles.emptyVersionWrap}>
            <Text style={styles.emptyVersionTitle}>No Process Versions Recorded</Text>
            <Text style={styles.emptyVersionDesc}>
              The approval route is initialized with the first eligible submission.
            </Text>
            {onRefresh && (
              <Pressable
                accessibilityRole="button"
                onPress={onRefresh}
                style={({ pressed }) => [
                  styles.refreshVersionBtn,
                  pressed && styles.btnPressed
                ]}
              >
                <IconRefreshCw size={14} color="#1E53DC" />
                <Text style={styles.refreshVersionBtnText}>Refresh</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.versionsList}>
            {versionHistory.map(item => {
              const isActive = item.status === "Active";
              return (
                <View
                  key={item.version}
                  style={[
                    styles.versionItemCard,
                    isActive && styles.versionItemCardActive
                  ]}
                >
                  <View style={styles.versionTopRow}>
                    <View style={styles.versionBadgeWrap}>
                      <View
                        style={[
                          styles.versionPill,
                          isActive
                            ? styles.versionPillActive
                            : styles.versionPillArchived
                        ]}
                      >
                        <Text
                          style={[
                            styles.versionPillText,
                            isActive
                              ? styles.versionPillTextActive
                              : styles.versionPillTextArchived
                          ]}
                        >
                          {item.versionLabel}
                        </Text>
                      </View>
                      <Text style={styles.versionItemTitle}>{item.title}</Text>
                    </View>

                    {/* Status Chip */}
                    <View
                      style={[
                        styles.statusChip,
                        isActive
                          ? styles.statusChipActive
                          : styles.statusChipArchived
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          isActive ? styles.statusDotActive : styles.statusDotArchived
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          isActive
                            ? styles.statusTextActive
                            : styles.statusTextArchived
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.versionItemDesc}>{item.description}</Text>

                  {/* Route & Applications meta row */}
                  <View style={styles.versionMetaRow}>
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeLabel}>Route:</Text>
                      <Text style={styles.metaBadgeValue}>{item.route}</Text>
                    </View>

                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeLabel}>Applications:</Text>
                      <Text style={styles.metaBadgeValue}>
                        {item.applicationsCount}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

export interface VersionProcessFormProps {
  firstReviewer: "NONE" | "ACCESS_MANAGER";
  currentPassword: string;
  busy: boolean;
  onSelectFirstReviewer: (value: "NONE" | "ACCESS_MANAGER") => void;
  onChangePassword: (password: string) => void;
  onSubmitVersion: () => void;
  onCancel: () => void;
}

export function VersionProcessForm({
  firstReviewer,
  currentPassword,
  busy,
  onSelectFirstReviewer,
  onChangePassword,
  onSubmitVersion,
  onCancel
}: VersionProcessFormProps) {
  const insets = useSafeAreaInsets();
  const passwordValid = currentPassword.length >= 8;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.formContent,
        { paddingBottom: Math.max(insets.bottom + 24, 48) }
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.formSubtitle}>
        Update the reviewer chain for future applications. Existing applications
        keep their frozen process version.
      </Text>

      {/* Radio 1: Super Admin Only */}
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: firstReviewer === "NONE" }}
        onPress={() => onSelectFirstReviewer("NONE")}
        style={[
          styles.radioOption,
          firstReviewer === "NONE" && styles.radioOptionSelected
        ]}
      >
        <View
          style={[
            styles.radioCircle,
            firstReviewer === "NONE" && styles.radioCircleSelected
          ]}
        >
          {firstReviewer === "NONE" && <View style={styles.radioDot} />}
        </View>
        <View style={styles.radioTextGroup}>
          <Text style={styles.radioTitle}>Different Super Admin Only</Text>
          <Text style={styles.radioDesc}>
            Direct single-tier approval by a second Super Admin
          </Text>
        </View>
      </Pressable>

      {/* Radio 2: Access Manager then Super Admin */}
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: firstReviewer === "ACCESS_MANAGER" }}
        onPress={() => onSelectFirstReviewer("ACCESS_MANAGER")}
        style={[
          styles.radioOption,
          firstReviewer === "ACCESS_MANAGER" && styles.radioOptionSelected
        ]}
      >
        <View
          style={[
            styles.radioCircle,
            firstReviewer === "ACCESS_MANAGER" && styles.radioCircleSelected
          ]}
        >
          {firstReviewer === "ACCESS_MANAGER" && <View style={styles.radioDot} />}
        </View>
        <View style={styles.radioTextGroup}>
          <Text style={styles.radioTitle}>Access Manager, then Super Admin</Text>
          <Text style={styles.radioDesc}>
            Two-tier review: Access Manager forwards to Super Admin
          </Text>
        </View>
      </Pressable>

      {/* Current Password Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          Current Password <Text style={styles.requiredAsterisk}>*</Text>
        </Text>
        <View style={styles.passwordInputWrap}>
          <IconLock size={16} color="#64748B" />
          <TextInput
            accessibilityLabel="Current Super Admin password"
            secureTextEntry
            autoComplete="current-password"
            maxLength={1024}
            editable={!busy}
            placeholder="Enter password to authorize change..."
            placeholderTextColor="#94A3B8"
            value={currentPassword}
            onChangeText={onChangePassword}
            style={styles.passwordInput}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.formActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel process configuration"
          disabled={busy}
          onPress={onCancel}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save new process version"
          disabled={busy || !passwordValid}
          onPress={onSubmitVersion}
          style={({ pressed }) => [
            styles.saveVersionBtn,
            (busy || !passwordValid) && styles.disabledBtn,
            pressed && styles.btnPressed
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <IconCheck size={16} color="#FFFFFF" />
              <Text style={styles.saveVersionBtnText}>Save Version</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16A34A"
  },
  activeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A"
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9"
  },
  stepsWrap: {
    gap: 12
  },
  stepItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  lockBadge: {
    backgroundColor: "#FEF3C7"
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569"
  },
  stepContent: {
    flex: 1
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B"
  },
  stepDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
    lineHeight: 16
  },
  configureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4
  },
  configureBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E53DC"
  },
  emptyVersionWrap: {
    padding: 20,
    alignItems: "center",
    gap: 6
  },
  emptyVersionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  },
  emptyVersionDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center"
  },
  refreshVersionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginTop: 8
  },
  refreshVersionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E53DC"
  },
  versionsList: {
    gap: 10
  },
  versionItemCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 8
  },
  versionItemCardActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0"
  },
  versionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  versionBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  versionPillActive: {
    backgroundColor: "#16A34A"
  },
  versionPillArchived: {
    backgroundColor: "#E2E8F0"
  },
  versionPillText: {
    fontSize: 11,
    fontWeight: "700"
  },
  versionPillTextActive: {
    color: "#FFFFFF"
  },
  versionPillTextArchived: {
    color: "#475569"
  },
  versionItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  statusChipActive: {
    backgroundColor: "#DCFCE7"
  },
  statusChipArchived: {
    backgroundColor: "#F1F5F9"
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  statusDotActive: {
    backgroundColor: "#16A34A"
  },
  statusDotArchived: {
    backgroundColor: "#94A3B8"
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700"
  },
  statusTextActive: {
    color: "#16A34A"
  },
  statusTextArchived: {
    color: "#64748B"
  },
  versionItemDesc: {
    fontSize: 12,
    color: "#475569"
  },
  versionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.6)"
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metaBadgeLabel: {
    fontSize: 11,
    color: "#64748B"
  },
  metaBadgeValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E293B"
  },
  formContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: -4
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#F8FAFC"
  },
  radioOptionSelected: {
    borderColor: "#1E53DC",
    backgroundColor: "#EFF6FF"
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center"
  },
  radioCircleSelected: {
    borderColor: "#1E53DC"
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1E53DC"
  },
  radioTextGroup: {
    flex: 1
  },
  radioTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B"
  },
  radioDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B"
  },
  requiredAsterisk: {
    color: "#DC2626"
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    height: 48,
    paddingVertical: 0
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF"
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569"
  },
  saveVersionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#16A34A"
  },
  saveVersionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  disabledBtn: {
    opacity: 0.5
  },
  btnPressed: {
    opacity: 0.75
  }
});
