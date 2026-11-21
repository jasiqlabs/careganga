import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CG03CaseDetail, CG03OwnerOutcome } from "@careganga/api-contracts";
import {
  IconArrowRight,
  IconUser,
  IconShield,
  IconAlertTriangle,
  IconClock,
  IconCheck,
  IconRotateCcw
} from "./registration-approvals-icons";
import {
  type DetailTab
} from "./registration-approvals-types";

export interface ApplicationDetailViewProps {
  detail: CG03CaseDetail;
  ownerOutcome: CG03OwnerOutcome | null;
  ownerBusy: boolean;
  canReview: boolean;
  onOpenDecision: () => void;
  onRetryOwner: () => void;
  onBack?: () => void;
}

export function ApplicationDetailView({
  detail,
  ownerOutcome,
  ownerBusy,
  canReview,
  onOpenDecision,
  onRetryOwner
}: ApplicationDetailViewProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<DetailTab>("OVERVIEW");

  const showOwnerEffect = [
    "PENDING_OWNER",
    "OWNER_COMPLETED",
    "OWNER_BLOCKED",
    "OWNER_FAILED_RETRYABLE"
  ].includes(detail.status);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + 28, 52) }
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Segmented Tab Bar: Overview vs History */}
      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "OVERVIEW" }}
          onPress={() => setActiveTab("OVERVIEW")}
          style={[styles.tabBtn, activeTab === "OVERVIEW" && styles.activeTabBtn]}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "OVERVIEW" && styles.activeTabBtnText
            ]}
          >
            Overview
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "HISTORY" }}
          onPress={() => setActiveTab("HISTORY")}
          style={[styles.tabBtn, activeTab === "HISTORY" && styles.activeTabBtn]}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "HISTORY" && styles.activeTabBtnText
            ]}
          >
            History ({detail.history.length})
          </Text>
        </Pressable>
      </View>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === "OVERVIEW" && (
        <View style={styles.contentWrap}>
          {/* Account & Role Cards */}
          <View style={styles.card}>
            <View style={styles.rowItem}>
              <View style={[styles.iconBox, { backgroundColor: "#EFF6FF" }]}>
                <IconUser size={18} color="#2563EB" />
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.fieldLabel}>Account</Text>
                <Text style={styles.fieldValue}>{detail.accountName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowItem}>
              <View style={[styles.iconBox, { backgroundColor: "#F1F5F9" }]}>
                <IconShield size={18} color="#0F172A" />
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.fieldLabel}>Proposed Role</Text>
                <Text style={styles.fieldValue}>{detail.roleName}</Text>
              </View>
            </View>
          </View>

          {/* 4-Box Revisions Grid */}
          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Proposal Revision</Text>
              <Text style={styles.gridValue}>{detail.proposalRevision}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Process Version</Text>
              <Text style={styles.gridValue}>{detail.processVersion}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Account Revision</Text>
              <Text style={styles.gridValue}>
                {detail.sourceAccountAccessRevision}
              </Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>Role Revision</Text>
              <Text style={styles.gridValue}>{detail.sourceRoleRevision}</Text>
            </View>
          </View>

          {/* Amber Warning Notice Banner */}
          <View style={styles.warningBanner}>
            <View style={styles.warningIconWrap}>
              <IconAlertTriangle size={18} color="#D97706" />
            </View>
            <Text style={styles.warningBannerText}>
              Approval is not an access grant. The account source applies changes only
              after a verified final decision.
            </Text>
          </View>

          {/* Verified CG-01 Account Effect (if relevant) */}
          {showOwnerEffect && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Verified CG-01 Account Effect</Text>
              <Text style={styles.ownerDescription}>
                {ownerOutcome?.status === "OWNER_COMPLETED"
                  ? "One approved role assignment is confirmed in the original account ledger."
                  : ownerOutcome?.status === "OWNER_BLOCKED"
                  ? "The original source changed. This decision cannot grant access."
                  : "Account access is still being verified. Approval alone grants nothing."}
              </Text>
              {canReview && ownerOutcome?.canRetry && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recheck original owner effect"
                  disabled={ownerBusy}
                  onPress={onRetryOwner}
                  style={({ pressed }) => [
                    styles.retryOwnerBtn,
                    pressed && styles.btnPressed
                  ]}
                >
                  {ownerBusy ? (
                    <ActivityIndicator size="small" color="#1E53DC" />
                  ) : (
                    <>
                      <IconRotateCcw size={16} color="#1E53DC" />
                      <Text style={styles.retryOwnerBtnText}>
                        Recheck original owner effect
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}

          {/* Bottom Review Decision CTA */}
          {canReview && detail.allowedDecisions.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Review Decision for this application"
              onPress={onOpenDecision}
              style={({ pressed }) => [
                styles.reviewActionBtn,
                pressed && styles.btnPressed
              ]}
            >
              <Text style={styles.reviewActionBtnText}>Review Decision</Text>
              <IconArrowRight size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      )}

      {/* HISTORY TAB CONTENT */}
      {activeTab === "HISTORY" && (
        <View style={styles.contentWrap}>
          {detail.history.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <IconClock size={28} color="#94A3B8" />
              <Text style={styles.emptyHistoryText}>
                No approval timeline events recorded yet.
              </Text>
            </View>
          ) : (
            <View style={styles.timelineCard}>
              {detail.history.map((event, idx) => {
                const isLast = idx === detail.history.length - 1;
                const eventDate = new Date(event.at).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });

                return (
                  <View key={idx} style={styles.timelineItem}>
                    {/* Indicator Column */}
                    <View style={styles.timelineIndicatorCol}>
                      <View style={styles.timelineDot}>
                        <IconCheck size={10} color="#FFFFFF" />
                      </View>
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    {/* Body */}
                    <View style={styles.timelineBody}>
                      <View style={styles.timelineHeaderRow}>
                        <Text style={styles.timelineAction}>{event.action}</Text>
                        <Text style={styles.timelineBy}>by {event.by}</Text>
                      </View>
                      <Text style={styles.timelineTime}>{eventDate}</Text>
                      {Boolean(event.remarks) && (
                        <View style={styles.remarksBox}>
                          <Text style={styles.remarksText}>{event.remarks}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 24
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    gap: 4
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9
  },
  activeTabBtn: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B"
  },
  activeTabBtnText: {
    color: "#16A34A",
    fontWeight: "700"
  },
  contentWrap: {
    gap: 12
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  textGroup: {
    flex: 1
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase"
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  gridCell: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B"
  },
  gridValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2
  },
  warningBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start"
  },
  warningIconWrap: {
    marginTop: 1
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
    fontWeight: "500"
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  ownerDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18
  },
  retryOwnerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4
  },
  retryOwnerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E53DC"
  },
  reviewActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4
  },
  reviewActionBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  emptyHistoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    gap: 8
  },
  emptyHistoryText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  timelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12
  },
  timelineIndicatorCol: {
    alignItems: "center",
    width: 20
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center"
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4
  },
  timelineBody: {
    flex: 1,
    paddingBottom: 16
  },
  timelineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  timelineAction: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  timelineBy: {
    fontSize: 12,
    color: "#64748B"
  },
  timelineTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2
  },
  remarksBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#CBD5E1"
  },
  remarksText: {
    fontSize: 12,
    color: "#334155"
  },
  btnPressed: {
    opacity: 0.75
  }
});
