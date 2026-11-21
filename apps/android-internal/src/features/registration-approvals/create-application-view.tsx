import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator
} from "react-native";
import type { CG03Option } from "@careganga/api-contracts";
import {
  IconArrowLeft,
  IconArrowRight,
  IconUser,
  IconShield,
  IconInfo,
  IconSearch,
  IconClose,
  IconCheck,
  IconAlertTriangle
} from "./registration-approvals-icons";

export interface CreateApplicationViewProps {
  isCorrection?: boolean;
  accounts: CG03Option[];
  roles: CG03Option[];
  accountQuery: string;
  roleQuery: string;
  selectedAccount: string;
  selectedRole: string;
  requestReason: string;
  busy: boolean;
  onSearchAccount: (text: string) => void;
  onSearchRole: (text: string) => void;
  onSelectAccount: (value: string) => void;
  onSelectRole: (value: string) => void;
  onChangeReason: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateApplicationView({
  isCorrection,
  accounts,
  roles,
  accountQuery,
  roleQuery,
  selectedAccount,
  selectedRole,
  requestReason,
  busy,
  onSearchAccount,
  onSearchRole,
  onSelectAccount,
  onSelectRole,
  onChangeReason,
  onSubmit,
  onCancel
}: CreateApplicationViewProps) {
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);

  // Field validation
  const accountValid = Boolean(selectedAccount);
  const roleValid = Boolean(selectedRole);
  const reasonValid = requestReason.trim().length > 0;

  const handleSubmit = () => {
    setSubmittedOnce(true);
    if (!accountValid || !roleValid || !reasonValid || busy) {
      return;
    }
    onSubmit();
  };

  const selectedAccountLabel =
    accounts.find(a => a.value === selectedAccount)?.label ??
    (selectedAccount ? selectedAccount : "Select eligible account");

  const selectedRoleLabel =
    roles.find(r => r.value === selectedRole)?.label ??
    (selectedRole ? selectedRole : "Select protected role");

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Navigation Header */}
      <View style={styles.topHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to applications list"
          disabled={busy}
          onPress={onCancel}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
        >
          <IconArrowLeft size={20} color="#0F172A" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {isCorrection ? "Correct Returned Proposal" : "Request Protected Role Access"}
        </Text>
      </View>

      <Text style={styles.subtitle}>
        Submit a protected role-change request for Super Admin authorization.
      </Text>

      {/* Form Card */}
      <View style={styles.formCard}>
        {/* Field 1: Select Account */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Select Account <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <Pressable
            accessibilityRole="combobox"
            accessibilityLabel={`Selected account: ${selectedAccountLabel}`}
            disabled={busy}
            onPress={() => setAccountModalOpen(true)}
            style={({ pressed }) => [
              styles.selectorTrigger,
              submittedOnce && !accountValid && styles.inputErrorBorder,
              pressed && styles.btnPressed
            ]}
          >
            <View style={styles.selectorLeft}>
              <IconUser size={18} color="#2563EB" />
              <Text
                style={[
                  styles.selectorText,
                  !selectedAccount && styles.selectorPlaceholder
                ]}
                numberOfLines={1}
              >
                {selectedAccount ? selectedAccountLabel : "Choose an eligible account"}
              </Text>
            </View>
            <Text style={styles.changeActionText}>
              {selectedAccount ? "Change" : "Select"}
            </Text>
          </Pressable>
          {submittedOnce && !accountValid && (
            <View style={styles.fieldErrorRow}>
              <IconAlertTriangle size={14} color="#DC2626" />
              <Text style={styles.fieldErrorText}>Please select an eligible account.</Text>
            </View>
          )}
        </View>

        {/* Field 2: Proposed Role */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Proposed Role <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <Pressable
            accessibilityRole="combobox"
            accessibilityLabel={`Selected role: ${selectedRoleLabel}`}
            disabled={busy}
            onPress={() => setRoleModalOpen(true)}
            style={({ pressed }) => [
              styles.selectorTrigger,
              submittedOnce && !roleValid && styles.inputErrorBorder,
              pressed && styles.btnPressed
            ]}
          >
            <View style={styles.selectorLeft}>
              <IconShield size={18} color="#0F172A" />
              <Text
                style={[
                  styles.selectorText,
                  !selectedRole && styles.selectorPlaceholder
                ]}
                numberOfLines={1}
              >
                {selectedRole ? selectedRoleLabel : "Choose a protected custom role"}
              </Text>
            </View>
            <Text style={styles.changeActionText}>
              {selectedRole ? "Change" : "Select"}
            </Text>
          </Pressable>
          {submittedOnce && !roleValid && (
            <View style={styles.fieldErrorRow}>
              <IconAlertTriangle size={14} color="#DC2626" />
              <Text style={styles.fieldErrorText}>Please select a protected role.</Text>
            </View>
          )}
        </View>

        {/* Field 3: Request Reason */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Request Reason <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <TextInput
            accessibilityLabel="Request reason"
            multiline
            numberOfLines={4}
            maxLength={300}
            editable={!busy}
            placeholder="Explain why this role is required (e.g., responsibilities, scope, etc.)"
            placeholderTextColor="#94A3B8"
            value={requestReason}
            onChangeText={onChangeReason}
            style={[
              styles.textareaInput,
              submittedOnce && !reasonValid && styles.inputErrorBorder
            ]}
          />
          <View style={styles.counterRow}>
            {submittedOnce && !reasonValid ? (
              <View style={styles.fieldErrorRow}>
                <IconAlertTriangle size={14} color="#DC2626" />
                <Text style={styles.fieldErrorText}>
                  Please explain why this access is required.
                </Text>
              </View>
            ) : (
              <View />
            )}
            <Text style={styles.counterText}>{requestReason.length} / 300</Text>
          </View>
        </View>

        {/* Information Banner (Wireframe Blue Card) */}
        <View style={styles.infoBanner}>
          <View style={styles.infoIconWrap}>
            <IconInfo size={18} color="#1D4ED8" />
          </View>
          <Text style={styles.infoBannerText}>
            Current account and role revisions will be frozen when you submit. Corrections
            will create a new application; earlier decisions are kept.
          </Text>
        </View>

        {/* Submit Actions */}
        <View style={styles.actionsWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit proposal for approval"
            disabled={busy}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              busy && styles.disabledBtn,
              pressed && styles.btnPressed
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Submit for Approval</Text>
                <IconArrowRight size={18} color="#FFFFFF" />
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel proposal"
            disabled={busy}
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>

      {/* Account Picker Modal */}
      <Modal
        visible={accountModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAccountModalOpen(false)}
        >
          <Pressable style={styles.pickerSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Foundation Account</Text>
              <Pressable
                onPress={() => setAccountModalOpen(false)}
                style={styles.pickerCloseBtn}
              >
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.pickerSearchWrap}>
              <IconSearch size={16} color="#64748B" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search staff name or account ID..."
                placeholderTextColor="#94A3B8"
                value={accountQuery}
                onChangeText={text => {
                  onSearchAccount(text);
                }}
              />
            </View>

            <ScrollView style={styles.optionsList}>
              {accounts.length === 0 ? (
                <Text style={styles.noOptionsText}>No matching accounts found.</Text>
              ) : (
                accounts.map(opt => {
                  const isSelected = opt.value === selectedAccount;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelectAccount(opt.value);
                        setAccountModalOpen(false);
                      }}
                      style={[
                        styles.optionItem,
                        isSelected && styles.optionItemSelected
                      ]}
                    >
                      <View style={styles.optionItemContent}>
                        <IconUser
                          size={16}
                          color={isSelected ? "#1E53DC" : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.optionItemText,
                            isSelected && styles.optionItemTextSelected
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && <IconCheck size={16} color="#1E53DC" />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Role Picker Modal */}
      <Modal
        visible={roleModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setRoleModalOpen(false)}
        >
          <Pressable style={styles.pickerSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Protected Role</Text>
              <Pressable
                onPress={() => setRoleModalOpen(false)}
                style={styles.pickerCloseBtn}
              >
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.pickerSearchWrap}>
              <IconSearch size={16} color="#64748B" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search protected role..."
                placeholderTextColor="#94A3B8"
                value={roleQuery}
                onChangeText={text => {
                  onSearchRole(text);
                }}
              />
            </View>

            <ScrollView style={styles.optionsList}>
              {roles.length === 0 ? (
                <Text style={styles.noOptionsText}>No matching roles found.</Text>
              ) : (
                roles.map(opt => {
                  const isSelected = opt.value === selectedRole;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        onSelectRole(opt.value);
                        setRoleModalOpen(false);
                      }}
                      style={[
                        styles.optionItem,
                        isSelected && styles.optionItemSelected
                      ]}
                    >
                      <View style={styles.optionItemContent}>
                        <IconShield
                          size={16}
                          color={isSelected ? "#1E53DC" : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.optionItemText,
                            isSelected && styles.optionItemTextSelected
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && <IconCheck size={16} color="#1E53DC" />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 40
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: -4
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1
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
  selectorTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48
  },
  selectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  selectorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1
  },
  selectorPlaceholder: {
    color: "#94A3B8",
    fontWeight: "400"
  },
  changeActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E53DC",
    marginLeft: 8
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
    minHeight: 90
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
  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start"
  },
  infoIconWrap: {
    marginTop: 2
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 18
  },
  actionsWrap: {
    gap: 10,
    marginTop: 8
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48
  },
  submitBtnText: {
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end"
  },
  pickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: "80%",
    gap: 12
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  pickerCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  pickerSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    height: 42,
    paddingVertical: 0
  },
  optionsList: {
    maxHeight: 280
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  optionItemSelected: {
    backgroundColor: "#EFF6FF"
  },
  optionItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  optionItemText: {
    fontSize: 14,
    color: "#334155"
  },
  optionItemTextSelected: {
    color: "#1E53DC",
    fontWeight: "700"
  },
  noOptionsText: {
    padding: 16,
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13
  }
});
