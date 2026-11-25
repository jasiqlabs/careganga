import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { IconChevronRight, IconClose, IconSearch, IconCheck } from "../features/dashboard/dashboard-icons";

export interface NativeDropdownOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

export interface NativeCustomDropdownProps {
  label?: string;
  options: NativeDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export function NativeCustomDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  searchable = false
}: NativeCustomDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (opt.subtitle && opt.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  const handleSelect = (option: NativeDropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setModalVisible(false);
    setSearchQuery("");
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Trigger Button */}
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label || placeholder}
        disabled={disabled}
        onPress={() => setModalVisible(true)}
        style={[
          styles.trigger,
          modalVisible && styles.triggerActive,
          disabled && styles.triggerDisabled
        ]}
      >
        <View style={styles.triggerContent}>
          <Text
            style={[
              styles.triggerText,
              !selectedOption && styles.placeholderText
            ]}
            numberOfLines={1}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
          {selectedOption?.badge && (
            <View
              style={[
                styles.badge,
                selectedOption.badgeColor
                  ? { backgroundColor: selectedOption.badgeColor + "20" }
                  : undefined
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  selectedOption.badgeColor ? { color: selectedOption.badgeColor } : undefined
                ]}
              >
                {selectedOption.badge}
              </Text>
            </View>
          )}
        </View>

        <View style={{ transform: [{ rotate: modalVisible ? "-90deg" : "90deg" }] }}>
          <IconChevronRight size={16} color="#64748B" />
        </View>
      </Pressable>

      {/* Modal Dialog for Dropdown Selection */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          setSearchQuery("");
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setModalVisible(false);
            setSearchQuery("");
          }}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || placeholder}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => {
                  setModalVisible(false);
                  setSearchQuery("");
                }}
                style={styles.closeBtn}
              >
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Optional Search Bar */}
            {searchable && (
              <View style={styles.searchContainer}>
                <IconSearch size={16} color="#94A3B8" />
                <TextInput
                  placeholder="Search options..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Options List */}
            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {filteredOptions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matching options found</Text>
                </View>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      disabled={opt.disabled}
                      onPress={() => handleSelect(opt)}
                      style={[
                        styles.optionItem,
                        isSelected && styles.optionItemSelected,
                        opt.disabled && styles.optionItemDisabled
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.subtitle && (
                          <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                        )}
                      </View>

                      {opt.badge && (
                        <View
                          style={[
                            styles.badge,
                            opt.badgeColor ? { backgroundColor: opt.badgeColor + "20" } : undefined
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              opt.badgeColor ? { color: opt.badgeColor } : undefined
                            ]}
                          >
                            {opt.badge}
                          </Text>
                        </View>
                      )}

                      {isSelected && (
                        <View style={styles.checkIcon}>
                          <IconCheck size={14} color="#2563EB" />
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 5,
    letterSpacing: 0.2
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 46
  },
  triggerActive: {
    borderColor: "#4F46E5",
    backgroundColor: "#FFFFFF"
  },
  triggerDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0"
  },
  triggerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8
  },
  triggerText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0F172A",
    flexShrink: 1
  },
  placeholderText: {
    color: "#94A3B8",
    fontWeight: "400"
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#EEF2FF"
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4338CA"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#F8FAFC"
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    padding: 0
  },
  optionsList: {
    maxHeight: 320
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 8
  },
  optionItemSelected: {
    backgroundColor: "#EEF2FF"
  },
  optionItemDisabled: {
    opacity: 0.4
  },
  optionLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1E293B"
  },
  optionLabelSelected: {
    color: "#4338CA",
    fontWeight: "700"
  },
  optionSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2
  },
  checkIcon: {
    marginLeft: 6
  },
  checkText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4338CA"
  }
});
