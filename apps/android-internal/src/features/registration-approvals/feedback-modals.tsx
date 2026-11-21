import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator
} from "react-native";
import {
  IconCheckCircle,
  IconXCircle,
  IconAlertTriangle,
  IconClose,
  IconRotateCcw
} from "./registration-approvals-icons";
import type { FeedbackModalState } from "./registration-approvals-types";

export interface FeedbackModalsProps {
  modalState: FeedbackModalState;
  busy?: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  onCheckPrevious?: () => void;
}

export function FeedbackModals({
  modalState,
  busy = false,
  onDismiss,
  onRetry,
  onCheckPrevious
}: FeedbackModalsProps) {
  if (!modalState.type) return null;

  const isSuccess = modalState.type === "SUCCESS";
  const isError = modalState.type === "ERROR";
  const isUncertain = modalState.type === "UNCERTAIN";

  return (
    <Modal
      visible={Boolean(modalState.type)}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onDismiss();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          {/* Close button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss dialog"
            disabled={busy}
            onPress={onDismiss}
            style={styles.closeBtn}
          >
            <IconClose size={18} color="#94A3B8" />
          </Pressable>

          {/* Top Status Icon */}
          <View style={styles.iconWrap}>
            {isSuccess && (
              <View style={[styles.iconCircle, styles.successCircle]}>
                <IconCheckCircle size={40} color="#16A34A" />
              </View>
            )}
            {isError && (
              <View style={[styles.iconCircle, styles.errorCircle]}>
                <IconXCircle size={40} color="#DC2626" />
              </View>
            )}
            {isUncertain && (
              <View style={[styles.iconCircle, styles.uncertainCircle]}>
                <IconAlertTriangle size={36} color="#D97706" />
              </View>
            )}
          </View>

          {/* Title */}
          <Text accessibilityRole="header" style={styles.title}>
            {modalState.title}
          </Text>

          {/* Message */}
          <Text style={styles.message}>{modalState.message}</Text>

          {/* Buttons */}
          <View style={styles.actionsWrap}>
            {isSuccess && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Acknowledge success"
                disabled={busy}
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.primarySuccessBtn,
                  pressed && styles.btnPressed
                ]}
              >
                <Text style={styles.btnText}>OK</Text>
              </Pressable>
            )}

            {isError && (
              <>
                {modalState.canRetry && onRetry ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry action"
                    disabled={busy}
                    onPress={onRetry}
                    style={({ pressed }) => [
                      styles.primaryErrorBtn,
                      busy && styles.disabledBtn,
                      pressed && styles.btnPressed
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnText}>Try Again</Text>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                  disabled={busy}
                  onPress={onDismiss}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.btnPressed
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>Dismiss</Text>
                </Pressable>
              </>
            )}

            {isUncertain && (
              <>
                {onCheckPrevious && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Check previous submission status"
                    disabled={busy}
                    onPress={onCheckPrevious}
                    style={({ pressed }) => [
                      styles.primaryUncertainBtn,
                      busy && styles.disabledBtn,
                      pressed && styles.btnPressed
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <IconRotateCcw size={16} color="#FFFFFF" />
                        <Text style={styles.btnText}>Check Previous Request</Text>
                      </>
                    )}
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss uncertain dialog"
                  disabled={busy}
                  onPress={onDismiss}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.btnPressed
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>Close</Text>
                </Pressable>
              </>
            )}
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
    padding: 24
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F8FAFC"
  },
  iconWrap: {
    marginBottom: 16
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  successCircle: {
    backgroundColor: "#DCFCE7"
  },
  errorCircle: {
    backgroundColor: "#FEE2E2"
  },
  uncertainCircle: {
    backgroundColor: "#FEF3C7"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center"
  },
  message: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 20
  },
  actionsWrap: {
    width: "100%",
    gap: 10
  },
  primarySuccessBtn: {
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%"
  },
  primaryErrorBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%"
  },
  primaryUncertainBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#D97706",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%"
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%"
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  secondaryBtnText: {
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
