import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import * as Linking from "expo-linking";
import {
  IconBarChart3,
  IconExternalLink,
  IconUsers,
  IconLayers,
  IconShieldCheck
} from "./dashboard-icons";

export interface OperationsOverviewProps {
  roleName: string;
  scope: string;
  onViewSite?: () => void;
}

export function OperationsOverview({ roleName, scope, onViewSite }: OperationsOverviewProps) {
  const handleViewSite = () => {
    if (onViewSite) {
      onViewSite();
      return;
    }
    void Linking.openURL("https://careganga.com/").catch(() => undefined);
  };

  return (
    <View style={styles.sectionContainer}>
      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.titleWithIcon}>
          <IconBarChart3 size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Operations Overview</Text>
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="View CareGanga public website"
          onPress={handleViewSite}
          style={styles.viewSiteButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.viewSiteText}>View Site</Text>
          <IconExternalLink size={13} color="#1D4ED8" />
        </Pressable>
      </View>

      {/* 3 Overview Cards Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}
      >
        {/* Card 1: Current Role */}
        <View style={styles.overviewCard}>
          <View style={[styles.cardIconWrap, { backgroundColor: "#E0F2FE" }]}>
            <IconUsers size={18} color="#0284C7" />
          </View>
          <Text style={styles.cardLabel}>Current Role</Text>
          <Text style={styles.cardValue} numberOfLines={1}>
            {roleName || "Staff"}
          </Text>
          <Text style={styles.cardCaption} numberOfLines={1}>
            Assigned System Authority
          </Text>
        </View>

        {/* Card 2: Operational Scope */}
        <View style={styles.overviewCard}>
          <View style={[styles.cardIconWrap, { backgroundColor: "#F3E8FF" }]}>
            <IconLayers size={18} color="#9333EA" />
          </View>
          <Text style={styles.cardLabel}>Operational Scope</Text>
          <Text style={styles.cardValue} numberOfLines={1}>
            {scope || "Organization"}
          </Text>
          <Text style={styles.cardCaption} numberOfLines={1}>
            {scope ? `${scope} Organization` : "Central Operations"}
          </Text>
        </View>

        {/* Card 3: Session Status */}
        <View style={styles.overviewCard}>
          <View style={[styles.cardIconWrap, { backgroundColor: "#DCFCE7" }]}>
            <IconShieldCheck size={18} color="#16A34A" />
          </View>
          <Text style={styles.cardLabel}>Session Status</Text>
          <Text style={[styles.cardValue, { color: "#16A34A" }]} numberOfLines={1}>
            Active & Verified
          </Text>
          <Text style={styles.cardCaption} numberOfLines={1}>
            Authenticated Access
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 18,
    marginBottom: 6
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 12
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  viewSiteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4
  },
  viewSiteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  cardsRow: {
    paddingHorizontal: 18,
    gap: 10,
    flexDirection: "row"
  },
  overviewCard: {
    width: 146,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 2
  },
  cardValue: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2
  },
  cardCaption: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8"
  }
});
