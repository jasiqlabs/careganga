import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CG03CaseDetail } from "@careganga/api-contracts";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconRotateCcw,
  IconXCircle,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertTriangle
} from "./registration-approvals-icons";
import type { DecisionAction } from "./registration-approvals-types";

export interface ReviewDecisionViewProps {
  detail: CG03CaseDetail;
  decisionAction: DecisionAction | null;
  decisionRemarks: string;
  decisionPassword: string;
  busy: boolean;
  onSelectAction: (action: DecisionAction) => void;
  onChangeRemarks: (text: string) => void;
  onChangePassword: (text: string) => void;
  onProceedToConfirm: () => void;
  onBack: () => void;
}

export function ReviewDecisionView({
  detail,
  decisionAction,
  decisionRemarks,
  decisionPassword,
  busy,
  onSelectAction,
  onChangeRemarks,
  onChangePassword,
  onProceedToConfirm,
  onBack
}: ReviewDecisionViewProps) {
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);

  // Decision options definitions
  const allDecisions: {
    action: DecisionAction;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    activeBorder: string;
  }[] = [
    {
      action: "APPROVE",
      label: "Approve",
      description: "Confirm and move application forward",
      icon: <IconCheck size={16} color="#16A34A" />,
      color: "#16A34A",
      bg: "#F0FDF4",
      activeBorder: "#16A34A"
    },
    {
      action: "FORWARD",
      label: "Forward",
      description: "Route to the next reviewer in sequence",
      icon: <IconArrowRight size={16} color="#2563EB" />,
      color: "#2563EB",
      bg: "#EFF6FF",
      activeBorder: "#2563EB"
    },
    {
      action: "RETURN",
      label: "Send Back",
      description: "Return to proposer for corrections",
      icon: <IconRotateCcw size={16} color="#D97706" />,
      color: "#D97706",
      bg: "#FFFBEB",
      activeBorder: "#D97706"
    },
    {
      action: "REJECT",
      label: "Reject",
      description: "Permanently deny this role change request",
      icon: <IconXCircle size={16} color="#DC2626" />,
      color: "#DC2626",
      bg: "#FEF2F2",
      activeBorder: "#DC2626"
    }
  ];

  // RBAC: Only show decisions allowed for current user/case
  const availableDecisions = allDecisions.filter(d =>
    detail.allowedDecisions.includes(d.action)
  );

  const actionValid = Boolean(decisionAction);
  const remarksValid = decisionRemarks.trim().length > 0;
  const passwordValid =
    !detail.requiresCurrentPassword || decisionPassword.length >= 8;

  const handleProceed = () => {
    setSubmittedOnce(true);
    if (!actionValid || !remarksValid || !passwordValid || busy) {
      return;
    }
    onProceedToConfirm();
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + 24, 48) }
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {/* Back navigation within sheet */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to overview"
        disabled={busy}
        onPress={onBack}
        style={({ pressed }) => [styles.backRow, pressed && styles.btnPressed]}
      >
        <IconArrowLeft size={16} color="#1E53DC" />
        <Text style={styles.backRowText}>Back to Overview</Text>
      </Pressable>

      {/* Decision Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Select Decision <Text style={styles.requiredAsterisk}>*</Text>
        </Text>
        {availableDecisions.length === 0 ? (
          <Text style={styles.noDecisionsText}>
            No review decisions are permitted for your account on this case.
          </Text>
        ) : (
          <View style={styles.decisionsList}>
            {availableDecisions.map(d => {
              const isSelected = decisionAction === d.action;
              return (
                <Pressable
                  key={d.action}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${d.label}: ${d.description}`}
                  disabled={busy}
                  onPress={() => onSelectAction(d.action)}
                  style={({ pressed }) => [
                    styles.decisionOption,
                    isSelected && {
                      borderColor: d.activeBorder,
                      backgroundColor: d.bg
                    },
                    pressed && styles.btnPressed
                  ]}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && { borderColor: d.color, backgroundColor: d.color }
                    ]}
                  >
                    {isSelected ? (
                      <View style={styles.radioDotInner} />
                    ) : (
                      <View style={styles.radioEmpty} />
                    )}
                  </View>

                  <View style={styles.decisionContent}>
                    <View style={styles.decisionTitleRow}>
                      <Text
                        style={[
                          styles.decisionLabel,
                          isSelected && { color: d.color, fontWeight: "700" }
                        ]}
                      >
                        {d.label}
                      </Text>
                      <View style={styles.decisionIconWrap}>{d.icon}</View>
                    </View>
                    <Text style={styles.decisionDesc}>{d.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {submittedOnce && !actionValid && (
          <View style={styles.fieldErrorRow}>
            <IconAlertTriangle size={14} color="#DC2626" />
            <Text style={styles.fieldErrorText}>
              Please select a review decision.
            </Text>
          </View>
        )}
      </View>

      {/* Reviewer Remarks Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Reviewer Remarks <Text style={styles.requiredAsterisk}>*</Text>
        </Text>
        <TextInput
          accessibilityLabel="Reviewer remarks"
          multiline
          numberOfLines={4}
          maxLength={300}
          editable={!busy}
          placeholder="Enter review notes, checks completed, or reason..."
          placeholderTextColor="#94A3B8"
          value={decisionRemarks}
          onChangeText={onChangeRemarks}
          style={[
            styles.textareaInput,
            submittedOnce && !remarksValid && styles.inputErrorBorder
          ]}
        />
        <View style={styles.counterRow}>
          {submittedOnce && !remarksValid ? (
            <View style={styles.fieldErrorRow}>
              <IconAlertTriangle size={14} color="#DC2626" />
              <Text style={styles.fieldErrorText}>
                Please provide reviewer remarks.
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.counterText}>{decisionRemarks.length} / 300</Text>
        </View>
      </View>

      {/* Current Password Field (if required) */}
      {detail.requiresCurrentPassword && (
        <View style={styles.section}>
          <View style={styles.passwordLabelRow}>
            <Text style={styles.sectionLabel}>
              Current Password <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <Text style={styles.passwordHint}>Super Admin verification</Text>
          </View>
          <View
            style={[
              styles.passwordInputWrap,
              submittedOnce && !passwordValid && styles.inputErrorBorder
            ]}
          >
            <IconLock size={16} color="#64748B" />
            <TextInput
              accessibilityLabel="Current account password"
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              maxLength={1024}
              editable={!busy}
              placeholder="Enter current password..."
              placeholderTextColor="#94A3B8"
              value={decisionPassword}
              onChangeText={onChangePassword}
              style={styles.passwordInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
            >
              {showPassword ? (
                <IconEyeOff size={18} color="#64748B" />
              ) : (
                <IconEye size={18} color="#64748B" />
              )}
            </Pressable>
          </View>

          {submittedOnce && !passwordValid && (
            <View style={styles.fieldErrorRow}>
              <IconAlertTriangle size={14} color="#DC2626" />
              <Text style={styles.fieldErrorText}>
                Enter current password (at least 8 characters).
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Review Decision Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review Decision and proceed to confirmation"
        disabled={busy || availableDecisions.length === 0}
        onPress={handleProceed}
        style={({ pressed }) => [
          styles.proceedBtn,
          (busy || availableDecisions.length === 0) && styles.disabledBtn,
          pressed && styles.btnPressed
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.proceedBtnText}>Review Decision</Text>
            <IconArrowRight size={18} color="#FFFFFF" />
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 32
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4
  },
  backRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E53DC"
  },
  section: {
    gap: 6
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B"
  },
  requiredAsterisk: {
    color: "#DC2626"
  },
  decisionsList: {
    gap: 8
  },
  decisionOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF"
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
  radioDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF"
  },
  radioEmpty: {},
  decisionContent: {
    flex: 1,
    gap: 1
  },
  decisionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  decisionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B"
  },
  decisionIconWrap: {},
  decisionDesc: {
    fontSize: 12,
    color: "#64748B"
  },
  textareaInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
    minHeight: 85
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  passwordHint: {
    fontSize: 11,
    color: "#64748B"
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
  eyeBtn: {
    padding: 6
  },
  inputErrorBorder: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2"
  },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2
  },
  fieldErrorText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500"
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  counterText: {
    fontSize: 11,
    color: "#94A3B8"
  },
  proceedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 6,
    minHeight: 48
  },
  proceedBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  noDecisionsText: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
    padding: 8
  },
  disabledBtn: {
    opacity: 0.5
  },
  btnPressed: {
    opacity: 0.75
  }
});
