import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator
} from "react-native";
import type { CG01AccountView } from "@careganga/api-contracts";
import {
  IconClose,
  IconAlertTriangle,
  IconTrash2
} from "./users-management-icons";
import type { UserNotice } from "./users-management-types";

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CG01AccountView | null;
  busy: boolean;
  uncertain: boolean;
  notice: UserNotice | null;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  account,
  busy,
  uncertain,
  notice,
  onConfirm
}: DeleteConfirmationModalProps) {
  if (!isOpen || !account) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconBoxDanger}>
                <IconAlertTriangle size={18} color="#DC2626" />
              </View>
              <Text style={styles.titleDanger}>Deactivate User Account</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconClose size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.warningBigIconBox}>
              <IconAlertTriangle size={32} color="#DC2626" />
            </View>

            <Text style={styles.confirmPrompt}>
              Are you sure you want to deactivate the account for{" "}
              <Text style={styles.targetName}>{account.displayName}</Text>?
            </Text>

            <Text style={styles.targetContact}>
              {account.email || account.phone || "No contact registered"}
            </Text>

            <View style={styles.warningBanner}>
              <IconAlertTriangle size={15} color="#B45309" />
              <Text style={styles.warningBannerText}>
                Warning: This action will set the account status to Deactivated and revoke all portal access rights.
              </Text>
            </View>

            {/* Notice / Uncertain */}
            {notice && (
              <View
                style={[
                  styles.noticeBox,
                  notice.kind === "success"
                    ? styles.noticeBoxSuccess
                    : styles.noticeBoxError
                ]}
              >
                <Text
                  style={[
                    styles.noticeText,
                    notice.kind === "success"
                      ? styles.noticeTextSuccess
                      : styles.noticeTextError
                  ]}
                >
                  {notice.text}
                </Text>
              </View>
            )}

            {uncertain && (
              <View style={styles.noticeBoxUncertain}>
                <Text style={styles.noticeTextUncertain}>
                  This request may have been processed. Refresh before another attempt.
                </Text>
              </View>
            )}
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              disabled={busy}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              disabled={busy || uncertain}
              style={[styles.dangerBtn, (busy || uncertain) && styles.dangerBtnDisabled]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.dangerBtnContent}>
                  <IconTrash2 size={16} color="#FFFFFF" />
                  <Text style={styles.dangerBtnText}>Yes, Deactivate</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconBoxDanger: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center"
  },
  titleDanger: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626"
  },
  closeBtn: {
    padding: 6
  },
  body: {
    padding: 20,
    alignItems: "center",
    gap: 12
  },
  warningBigIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  confirmPrompt: {
    fontSize: 14.5,
    color: "#1E293B",
    textAlign: "center",
    lineHeight: 20
  },
  targetName: {
    fontWeight: "800",
    color: "#0F172A"
  },
  targetContact: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: -4
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 4
  },
  warningBannerText: {
    fontSize: 11.5,
    color: "#B45309",
    flex: 1,
    lineHeight: 16
  },
  noticeBox: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  noticeBoxSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  noticeBoxError: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3"
  },
  noticeBoxUncertain: {
    width: "100%",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  noticeText: {
    fontSize: 12,
    textAlign: "center"
  },
  noticeTextSuccess: {
    color: "#059669"
  },
  noticeTextError: {
    color: "#E11D48"
  },
  noticeTextUncertain: {
    fontSize: 12,
    color: "#B45309",
    textAlign: "center"
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#475569"
  },
  dangerBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center"
  },
  dangerBtnDisabled: {
    opacity: 0.5
  },
  dangerBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  dangerBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
