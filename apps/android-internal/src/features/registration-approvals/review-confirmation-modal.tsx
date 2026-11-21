import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator
} from "react-native";
import type { CG03CaseDetail } from "@careganga/api-contracts";
import {
  IconEye,
  IconClose,
  IconCheck,
  IconUser,
  IconShield
} from "./registration-approvals-icons";
import type { DecisionAction } from "./registration-approvals-types";

export interface ReviewConfirmationModalProps {
  visible: boolean;
  detail: CG03CaseDetail | null;
  action: DecisionAction | null;
  remarks: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReviewConfirmationModal({
  visible,
  detail,
  action,
  remarks,
  busy,
  onConfirm,
  onCancel
}: ReviewConfirmationModalProps) {
  if (!visible || !detail || !action) return null;

  const actionDetails = {
    APPROVE: { label: "Approve", color: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
    FORWARD: { label: "Forward", color: "#2563EB", bg: "#DBEAFE", border: "#93C5FD" },
    RETURN: { label: "Send Back", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
    REJECT: { label: "Reject", color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5" }
  }[action];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          {/* Top Eye Icon */}
          <View style={styles.topIconWrap}>
            <View style={styles.topIconCircle}>
              <IconEye size={24} color="#1E53DC" />
            </View>
          </View>

          {/* Close button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close confirmation dialog"
            disabled={busy}
            onPress={onCancel}
            style={styles.closeBtn}
          >
            <IconClose size={18} color="#94A3B8" />
          </Pressable>

          {/* Title & Subtitle */}
          <Text accessibilityRole="header" style={styles.title}>
            Review Application
          </Text>
          <Text style={styles.subtitle}>
            Verify the details before submitting.
          </Text>

          {/* Summary Details */}
          <View style={styles.summaryBox}>
            {/* Application ID */}
            <View style={styles.itemRow}>
              <Text style={styles.itemLabel}>Application ID</Text>
              <Text style={styles.itemValueBold}>{detail.reference}</Text>
            </View>

            <View style={styles.divider} />

            {/* Account */}
            <View style={styles.itemRow}>
              <View style={styles.labelWithIcon}>
                <IconUser size={14} color="#64748B" />
                <Text style={styles.itemLabel}>Account</Text>
              </View>
              <Text style={styles.itemValue}>{detail.accountName}</Text>
            </View>

            <View style={styles.divider} />

            {/* Proposed Role */}
            <View style={styles.itemRow}>
              <View style={styles.labelWithIcon}>
                <IconShield size={14} color="#64748B" />
                <Text style={styles.itemLabel}>Proposed Role</Text>
              </View>
              <Text style={styles.itemValue}>{detail.roleName}</Text>
            </View>

            <View style={styles.divider} />

            {/* Selected Decision */}
            <View style={styles.itemRow}>
              <Text style={styles.itemLabel}>Decision</Text>
              <View
                style={[
                  styles.decisionChip,
                  {
                    backgroundColor: actionDetails.bg,
                    borderColor: actionDetails.border
                  }
                ]}
              >
                <IconCheck size={12} color={actionDetails.color} />
                <Text
                  style={[styles.decisionChipText, { color: actionDetails.color }]}
                >
                  {actionDetails.label}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Remarks */}
            <View style={styles.remarksSection}>
              <Text style={styles.itemLabel}>Remarks</Text>
              <Text style={styles.remarksText}>
                {remarks.trim() || "No remarks provided."}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel decision submission"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm and submit review decision"
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                busy && styles.disabledBtn,
                pressed && styles.btnPressed
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconCheck size={16} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>Confirm & Submit</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  dialogCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6
  },
  topIconWrap: {
    alignItems: "center",
    marginTop: -4,
    marginBottom: 10
  },
  topIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F8FAFC"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 14
  },
  summaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 8
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  itemValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B"
  },
  itemValueBold: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF2F7"
  },
  decisionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1
  },
  decisionChipText: {
    fontSize: 12,
    fontWeight: "700"
  },
  remarksSection: {
    gap: 4
  },
  remarksText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18
  },
  actionsWrap: {
    gap: 10,
    marginTop: 18
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF"
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569"
  },
  disabledBtn: {
    opacity: 0.6
  },
  btnPressed: {
    opacity: 0.75
  }
});
