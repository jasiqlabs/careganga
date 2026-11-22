import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import type { CG03CaseView } from "@careganga/api-contracts";
import {
  IconChevronRight,
  IconClock,
  IconRotateCcw
} from "./registration-approvals-icons";
import {
  friendlyStatus,
  getStatusChipTheme
} from "./registration-approvals-types";

export interface ApprovalCardItemProps {
  item: CG03CaseView;
  canPropose: boolean;
  onPress: (item: CG03CaseView) => void;
  onCorrection?: (item: CG03CaseView) => void;
}

export function ApprovalCardItem({
  item,
  canPropose,
  onPress,
  onCorrection
}: ApprovalCardItemProps) {
  const chipTheme = getStatusChipTheme(item.status);
  const formattedDate = item.submittedAt
    ? new Date(item.submittedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : "";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Application ${item.reference}, for ${item.accountName}, proposed role ${item.roleName}, status ${friendlyStatus(item.status)}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.referenceText}>{item.reference}</Text>
        <IconChevronRight size={18} color="#94A3B8" />
      </View>

      {/* Account & Proposed Role */}
      <View style={styles.identityRow}>
        <Text style={styles.accountText} numberOfLines={1}>
          {item.accountName}
        </Text>
        <Text style={styles.dotSeparator}>·</Text>
        <Text style={styles.roleText} numberOfLines={1}>
          {item.roleName}
        </Text>
      </View>

      {/* Meta & Status Row */}
      <View style={styles.footerRow}>
        {/* Status Chip */}
        <View
          style={[
            styles.statusChip,
            { backgroundColor: chipTheme.bg, borderColor: chipTheme.border }
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: chipTheme.dot }]} />
          <Text style={[styles.statusText, { color: chipTheme.text }]}>
            {friendlyStatus(item.status)}
          </Text>
        </View>

        {/* Date and Step */}
        <View style={styles.metaRow}>
          {item.currentStep > 0 && (
            <Text style={styles.stepText}>Step {item.currentStep}</Text>
          )}
          {formattedDate ? (
            <View style={styles.dateWrap}>
              <IconClock size={12} color="#94A3B8" />
              <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Correction action for returned applications */}
      {canPropose && item.status === "RETURNED" && (
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit correction for returned proposal"
            onPress={e => {
              e.stopPropagation();
              onCorrection?.(item);
            }}
            style={({ pressed }) => [
              styles.correctionBtn,
              pressed && styles.btnPressed
            ]}
          >
            <IconRotateCcw size={14} color="#C2410C" />
            <Text style={styles.correctionBtnText}>Submit Correction</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1
  },
  cardPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  referenceText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.2
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6
  },
  accountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B"
  },
  dotSeparator: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94A3B8"
  },
  roleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569"
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  stepText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  dateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  dateText: {
    fontSize: 12,
    color: "#64748B"
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  correctionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  correctionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C2410C"
  },
  btnPressed: {
    opacity: 0.75
  }
});
